const express = require('express');
const router = express.Router();
const { PurchaseOrder, Invoice, sequelize } = require('../models/index');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdf = require('pdf-parse');
const XLSX = require('xlsx');
const { uploadToOSS, deleteFromOSS, getSignedUrl, checkOSSConfig } = require('../utils/oss');

// 配置文件上传中间件
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  },
  fileFilter: (req, file, cb) => {
    // 允许PDF文件
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('只允许上传PDF文件'));
    }
  }
});

// 配置Excel文件上传中间件
const excelStorage = multer.memoryStorage();
const excelUpload = multer({
  storage: excelStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  },
  fileFilter: (req, file, cb) => {
    // 允许Excel文件
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('只允许上传Excel文件'));
    }
  }
});

// 配置图片文件上传中间件（用于截图）
const imageStorage = multer.memoryStorage();
const imageUpload = multer({
  storage: imageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  },
  fileFilter: (req, file, cb) => {
    // 允许图片文件
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

// ==================== 采购订单相关接口 ====================

// 获取采购订单列表
router.get('/orders', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      seller_name, 
      invoice_status, 
      payment_account,
      start_date,
      end_date,
      order_number,
      invoice_number
    } = req.query;

    const whereCondition = {};
    const includeCondition = [{
      model: Invoice,
      as: 'invoice',
      required: false
    }];
    
    if (seller_name) {
      whereCondition.seller_name = { [Op.like]: `%${seller_name}%` };
    }
    
    if (invoice_status) {
      whereCondition.invoice_status = invoice_status;
    }
    
    if (payment_account) {
      whereCondition.payment_account = { [Op.like]: `%${payment_account}%` };
    }
    
    if (order_number) {
      whereCondition.order_number = { [Op.like]: `%${order_number}%` };
    }
    
    // 添加发票号搜索
    if (invoice_number) {
      includeCondition[0] = {
        model: Invoice,
        as: 'invoice',
        required: true,
        where: {
          invoice_number: { [Op.like]: `%${invoice_number}%` }
        }
      };
    }
    
    if (start_date && end_date) {
      whereCondition.order_date = {
        [Op.between]: [start_date, end_date]
      };
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await PurchaseOrder.findAndCountAll({
      where: whereCondition,
      include: includeCondition,
      order: [['order_date', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        records: rows,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('获取采购订单列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 创建采购订单
router.post('/orders', async (req, res) => {
  try {
    const orderData = req.body;
    
    // 检查订单号是否已存在
    const existingOrder = await PurchaseOrder.findOne({
      where: { order_number: orderData.order_number }
    });
    
    if (existingOrder) {
      return res.status(400).json({
        code: 1,
        message: '采购订单号已存在'
      });
    }

    const newOrder = await PurchaseOrder.create(orderData);
    
    res.json({
      code: 0,
      message: '创建成功',
      data: newOrder
    });
  } catch (error) {
    console.error('创建采购订单失败:', error);
    res.status(500).json({
      code: 1,
      message: '创建失败',
      error: error.message
    });
  }
});

// 批量创建采购订单
router.post('/orders/batch', excelUpload.single('excel'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        code: 1,
        message: '请上传Excel文件'
      });
    }

    // 解析Excel文件
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // 处理合并单元格 - 获取合并单元格信息并填充空单元格
    if (sheet['!merges']) {
      sheet['!merges'].forEach(merge => {
        const startRow = merge.s.r;
        const endRow = merge.e.r;
        const startCol = merge.s.c;
        const endCol = merge.e.c;
        
        // 获取合并单元格的值（通常在左上角单元格）
        const startCellAddress = XLSX.utils.encode_cell({ c: startCol, r: startRow });
        const mergedValue = sheet[startCellAddress] ? sheet[startCellAddress].v : '';
        
        // 将值填充到合并区域内的所有单元格
        for (let row = startRow; row <= endRow; row++) {
          for (let col = startCol; col <= endCol; col++) {
            const cellAddress = XLSX.utils.encode_cell({ c: col, r: row });
            if (!sheet[cellAddress]) {
              sheet[cellAddress] = { 
                t: typeof mergedValue === 'string' ? 's' : 'n',
                v: mergedValue 
              };
            }
          }
        }
      });
    }
    
    // 将Excel数据转换为JSON，保留原始数据类型
    const rawData = XLSX.utils.sheet_to_json(sheet, {
      raw: false, // 转换为字符串而不是保留原始类型
      dateNF: 'yyyy-mm-dd' // 指定日期格式
    });
    
    if (!rawData || rawData.length === 0) {
      return res.status(400).json({
        code: 1,
        message: 'Excel文件没有数据'
      });
    }

    // 需要的固定列名
    const requiredColumns = ['订单编号', '买家公司名', '卖家公司名', '实付款(元)', '订单付款时间'];
    
    // 检查必需的列是否存在
    const headers = Object.keys(rawData[0]);
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      return res.status(400).json({
        code: 1,
        message: `Excel文件缺少必需的列: ${missingColumns.join(', ')}`
      });
    }

    // 处理数据 - 先去重，因为合并单元格会导致同一订单出现多行
    const processedData = [];
    const skippedData = [];
    const errorData = [];
    const processedOrderNumbers = new Set(); // 用于去重订单号

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      
      try {
        // 提取数据
        const orderNumber = String(row['订单编号'] || '').trim();
        const buyerName = String(row['买家公司名'] || '').trim();
        const sellerName = String(row['卖家公司名'] || '').trim();
        // 处理金额格式，移除千位分隔符逗号
        const amountStr = String(row['实付款(元)'] || '').trim().replace(/,/g, '');
        const amount = parseFloat(amountStr) || 0;
        // 处理日期字段 - 可能是Date对象、数字或字符串
        let orderDateStr;
        const rawDateValue = row['订单付款时间'];
        
        console.log(`第${i + 1}行 - 原始日期值类型: ${typeof rawDateValue}, 值: `, rawDateValue);
        
        if (rawDateValue instanceof Date) {
          // 如果是Date对象，直接使用
          orderDateStr = rawDateValue.toISOString().split('T')[0];
          console.log(`第${i + 1}行 - Date对象转换结果: "${orderDateStr}"`);
        } else if (typeof rawDateValue === 'number') {
          // 如果是Excel的日期数字格式，转换为Date
          const excelDate = XLSX.SSF.parse_date_code(rawDateValue);
          if (excelDate) {
            orderDateStr = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
            console.log(`第${i + 1}行 - Excel数字日期转换结果: "${orderDateStr}"`);
          } else {
            orderDateStr = String(rawDateValue).trim();
          }
        } else {
          // 字符串格式
          orderDateStr = String(rawDateValue || '').trim();
        }

        // 验证必需字段
        if (!orderNumber || !buyerName || !sellerName || !amount) {
          // 只有当订单号不为空时才报错，否则可能是合并单元格的空行
          if (orderNumber) {
            errorData.push({
              row: i + 1,
              reason: '缺少必需字段',
              data: row
            });
          }
          continue;
        }

        // 检查是否已处理过此订单号（合并单元格导致的重复行）
        if (processedOrderNumbers.has(orderNumber)) {
          // 跳过重复的订单，不算作错误
          continue;
        }

        // 解析日期 - 优化处理，支持提取时间中的日期部分
        let orderDate;
        try {
          console.log(`第${i + 1}行 - 处理后的日期字符串: "${orderDateStr}"`);
          
          // 如果已经是YYYY-MM-DD格式，直接创建Date对象
          if (/^\d{4}-\d{2}-\d{2}$/.test(orderDateStr)) {
            const parts = orderDateStr.split('-');
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const day = parseInt(parts[2]);
            orderDate = new Date(year, month - 1, day);
            console.log(`第${i + 1}行 - 直接解析YYYY-MM-DD格式成功: `, orderDate);
          } else {
            // 先提取日期部分，去除时间部分
            let dateOnlyStr = orderDateStr;
            
            // 如果包含时间（有空格），只取空格前的部分
            if (dateOnlyStr.includes(' ')) {
              dateOnlyStr = dateOnlyStr.split(' ')[0].trim();
            }
            
            // 如果包含时间（有冒号），分割并取日期部分
            if (dateOnlyStr.includes(':')) {
              // 查找最后一个数字后跟冒号的位置，从该位置截断
              const match = dateOnlyStr.match(/^(.*?)[\s]+\d{1,2}:/);
              if (match) {
                dateOnlyStr = match[1].trim();
              }
            }
            
            console.log(`第${i + 1}行 - 提取的日期部分: "${dateOnlyStr}"`);
            
            // 尝试解析不同格式的日期
            if (dateOnlyStr.includes('/')) {
              const parts = dateOnlyStr.split('/');
              console.log(`第${i + 1}行 - 斜杠分割结果:`, parts);
              if (parts.length === 3) {
                // 处理 YYYY/M/D 或 YYYY/MM/DD 格式
                const year = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const day = parseInt(parts[2]);
                
                console.log(`第${i + 1}行 - 解析的日期: ${year}-${month}-${day}`);
                
                if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                  orderDate = new Date(year, month - 1, day); // 月份从0开始
                } else {
                  throw new Error(`日期数值超出有效范围: ${year}-${month}-${day}`);
                }
              } else {
                throw new Error(`斜杠分割后部分数量不正确: ${parts.length}`);
              }
            } else if (dateOnlyStr.includes('-')) {
              // 处理 YYYY-MM-DD 格式
              const parts = dateOnlyStr.split('-');
              console.log(`第${i + 1}行 - 横杠分割结果:`, parts);
              if (parts.length === 3) {
                const year = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const day = parseInt(parts[2]);
                
                console.log(`第${i + 1}行 - 解析的日期: ${year}-${month}-${day}`);
                
                if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                  orderDate = new Date(year, month - 1, day); // 月份从0开始
                } else {
                  throw new Error(`日期数值超出有效范围: ${year}-${month}-${day}`);
                }
              } else {
                throw new Error(`横杠分割后部分数量不正确: ${parts.length}`);
              }
            } else {
              // 尝试直接解析
              console.log(`第${i + 1}行 - 尝试直接解析日期: "${dateOnlyStr}"`);
              orderDate = new Date(dateOnlyStr);
            }
          }
          
          if (isNaN(orderDate.getTime())) {
            throw new Error(`解析后的日期无效: ${orderDate}`);
          }
          
          console.log(`第${i + 1}行 - 最终日期对象:`, orderDate);
        } catch (error) {
          console.error(`第${i + 1}行 - 日期解析失败:`, error.message);
          errorData.push({
            row: i + 1,
            reason: `日期格式错误: ${error.message} (原始: "${orderDateStr}")`,
            data: row
          });
          continue;
        }

        // 检查订单号是否已存在
        const existingOrder = await PurchaseOrder.findOne({
          where: { order_number: orderNumber }
        });

        if (existingOrder) {
          skippedData.push({
            row: i + 1,
            reason: '订单号已存在',
            data: row
          });
          // 将此订单号标记为已处理，避免重复处理合并单元格的其他行
          processedOrderNumbers.add(orderNumber);
          continue;
        }

        // 准备插入数据
        const orderData = {
          order_number: orderNumber,
          order_date: orderDate.toISOString().split('T')[0],
          amount: amount,
          seller_name: sellerName,
          payment_account: buyerName,
          invoice_status: '未开票',
          remarks: '批量导入'
        };

        processedData.push(orderData);
        
        // 将此订单号标记为已处理，避免重复处理合并单元格的其他行
        processedOrderNumbers.add(orderNumber);

      } catch (error) {
        errorData.push({
          row: i + 1,
          reason: error.message,
          data: row
        });
      }
    }

    // 批量插入数据
    let createdCount = 0;
    if (processedData.length > 0) {
      const createdOrders = await PurchaseOrder.bulkCreate(processedData);
      createdCount = createdOrders.length;
    }

    // 计算实际处理的有效订单数（去除空行和重复行）
    const validOrderCount = processedOrderNumbers.size + skippedData.length + errorData.length;
    
    res.json({
      code: 0,
      message: '批量导入完成',
      data: {
        total: rawData.length,
        validOrders: validOrderCount, // 实际有效订单数
        created: createdCount,
        skipped: skippedData.length,
        error: errorData.length,
        skippedDetails: skippedData,
        errorDetails: errorData
      }
    });
  } catch (error) {
    console.error('批量创建采购订单失败:', error);
    res.status(500).json({
      code: 1,
      message: '批量导入失败',
      error: error.message
    });
  }
});

// 更新采购订单
router.put('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const order = await PurchaseOrder.findByPk(id);
    if (!order) {
      return res.status(404).json({
        code: 1,
        message: '采购订单不存在'
      });
    }
    
    // 如果修改了订单号，检查是否重复
    if (updateData.order_number && updateData.order_number !== order.order_number) {
      const existingOrder = await PurchaseOrder.findOne({
        where: { 
          order_number: updateData.order_number,
          id: { [Op.ne]: id }
        }
      });
      
      if (existingOrder) {
        return res.status(400).json({
          code: 1,
          message: '采购订单号已存在'
        });
      }
    }

    await order.update(updateData);
    
    res.json({
      code: 0,
      message: '更新成功',
      data: order
    });
  } catch (error) {
    console.error('更新采购订单失败:', error);
    res.status(500).json({
      code: 1,
      message: '更新失败',
      error: error.message
    });
  }
});

// 删除采购订单
router.delete('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await PurchaseOrder.findByPk(id);
    if (!order) {
      return res.status(404).json({
        code: 1,
        message: '采购订单不存在'
      });
    }
    
    await order.destroy();
    
    res.json({
      code: 0,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除采购订单失败:', error);
    res.status(500).json({
      code: 1,
      message: '删除失败',
      error: error.message
    });
  }
});

// ==================== 发票相关接口 ====================

// 获取发票列表
router.get('/invoices', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      seller_name, 
      invoice_number,
      invoice_type,
      status,
      start_date,
      end_date 
    } = req.query;

    const whereCondition = {};
    
    if (seller_name) {
      whereCondition.seller_name = { [Op.like]: `%${seller_name}%` };
    }
    
    if (invoice_number) {
      whereCondition.invoice_number = { [Op.like]: `%${invoice_number}%` };
    }
    
    if (invoice_type) {
      whereCondition.invoice_type = invoice_type;
    }
    
    if (status) {
      whereCondition.status = status;
    }
    
    if (start_date && end_date) {
      whereCondition.invoice_date = {
        [Op.between]: [start_date, end_date]
      };
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await Invoice.findAndCountAll({
      where: whereCondition,
      include: [{
        model: PurchaseOrder,
        as: 'purchaseOrders',
        required: false
      }],
      order: [['invoice_date', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        records: rows,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('获取发票列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 创建发票
router.post('/invoices', async (req, res) => {
  try {
    const invoiceData = req.body;
    
    // 检查发票号是否已存在
    const existingInvoice = await Invoice.findOne({
      where: { invoice_number: invoiceData.invoice_number }
    });
    
    if (existingInvoice) {
      return res.status(400).json({
        code: 1,
        message: '发票号已存在'
      });
    }

    const newInvoice = await Invoice.create(invoiceData);
    
    res.json({
      code: 0,
      message: '创建成功',
      data: newInvoice
    });
  } catch (error) {
    console.error('创建发票失败:', error);
    res.status(500).json({
      code: 1,
      message: '创建失败',
      error: error.message
    });
  }
});

// 更新发票
router.put('/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const invoice = await Invoice.findByPk(id);
    if (!invoice) {
      return res.status(404).json({
        code: 1,
        message: '发票不存在'
      });
    }
    
    // 如果修改了发票号，检查是否重复
    if (updateData.invoice_number && updateData.invoice_number !== invoice.invoice_number) {
      const existingInvoice = await Invoice.findOne({
        where: { 
          invoice_number: updateData.invoice_number,
          id: { [Op.ne]: id }
        }
      });
      
      if (existingInvoice) {
        return res.status(400).json({
          code: 1,
          message: '发票号已存在'
        });
      }
    }

    await invoice.update(updateData);
    
    res.json({
      code: 0,
      message: '更新成功',
      data: invoice
    });
  } catch (error) {
    console.error('更新发票失败:', error);
    res.status(500).json({
      code: 1,
      message: '更新失败',
      error: error.message
    });
  }
});

// 删除发票
router.delete('/invoices/:id', async (req, res) => {
  // 使用事务确保数据一致性
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    
    const invoice = await Invoice.findByPk(id);
    if (!invoice) {
      return res.status(404).json({
        code: 1,
        message: '发票不存在'
      });
    }
    
    let ossDeleteResult = { success: false, message: '无文件需要删除' };
    let screenshotDeleteResult = { success: false, message: '无截图需要删除' };
    
    // 1. 先删除金额差异截图（如果有的话）
    if (invoice.amount_difference_screenshot) {
      try {
        const screenshots = JSON.parse(invoice.amount_difference_screenshot);
        let deletedScreenshots = 0;
        let failedScreenshots = 0;
        
        console.log(`🗑️ 开始删除 ${screenshots.length} 个金额差异截图...`);
        console.log('📷 截图数据结构:', JSON.stringify(screenshots, null, 2));
        
        // 删除OSS中的截图文件
        for (const screenshot of screenshots) {
          console.log('🔍 处理截图:', JSON.stringify(screenshot, null, 2));
          
          // 获取OSS对象名，优先使用objectName，其次从URL解析
          let objectName = null;
          
          if (screenshot.objectName) {
            objectName = screenshot.objectName;
            console.log('📋 使用objectName字段:', objectName);
          } else if (screenshot.url) {
            // 从URL中提取对象名
            try {
              if (screenshot.url.includes('screenshot-proxy?path=')) {
                // 从代理URL中提取路径参数
                const urlObj = new URL(screenshot.url);
                objectName = decodeURIComponent(urlObj.searchParams.get('path') || '');
                console.log('🔗 从代理URL解析对象名:', objectName);
              } else if (screenshot.url.includes('aliyuncs.com')) {
                // 从OSS直接URL中提取对象名
                const urlObj = new URL(screenshot.url);
                objectName = urlObj.pathname.substring(1); // 去掉开头的 /
                console.log('🔗 从OSS URL解析对象名:', objectName);
              }
            } catch (urlError) {
              console.warn('⚠️ 从URL解析对象名失败:', screenshot.url, urlError.message);
            }
          }
          
          if (objectName) {
            try {
              console.log('🗑️ 尝试删除OSS文件:', objectName);
              const deleteResult = await deleteFromOSS(objectName);
              if (deleteResult.success) {
                console.log('✅ 删除OSS截图文件成功:', objectName);
                deletedScreenshots++;
              } else {
                console.warn('⚠️ 删除OSS截图文件失败:', objectName, deleteResult.message);
                failedScreenshots++;
              }
            } catch (ossError) {
              console.warn('⚠️ 删除OSS截图文件异常:', objectName, ossError.message);
              failedScreenshots++;
            }
          } else {
            console.warn('⚠️ 无法确定截图文件的对象名:', screenshot);
            failedScreenshots++;
          }
        }
        
        screenshotDeleteResult = {
          success: deletedScreenshots > 0,
          message: `删除截图：成功${deletedScreenshots}个，失败${failedScreenshots}个`,
          deletedCount: deletedScreenshots,
          failedCount: failedScreenshots
        };
        
      } catch (parseError) {
        console.warn('⚠️ 解析截图数据失败:', parseError.message);
        screenshotDeleteResult = { success: false, message: '解析截图数据失败' };
      }
    }
    
    // 2. 删除发票文件（如果有的话）
    if (invoice.invoice_file_url) {
      // 检查OSS配置
      if (checkOSSConfig()) {
        try {
          // 获取OSS对象名称，优先使用数据库中保存的对象名
          let objectName = '';
          
          if (invoice.invoice_file_object_name) {
            // 优先使用数据库中保存的对象名
            objectName = invoice.invoice_file_object_name;
            console.log('📋 使用数据库中保存的对象名:', objectName);
          } else if (invoice.invoice_file_url.includes('aliyuncs.com')) {
            // OSS直接URL格式，从URL解析
            const url = new URL(invoice.invoice_file_url);
            objectName = url.pathname.substring(1); // 去掉开头的 /
            console.log('🔗 从OSS URL解析对象名:', objectName);
          } else if (invoice.invoice_file_url.includes('/api/purchase-invoice/invoices/') && invoice.invoice_file_url.includes('/file')) {
            // 代理URL格式，无法提取对象名
            console.warn('⚠️ 代理URL格式且无数据库对象名，跳过OSS删除:', invoice.invoice_file_url);
            ossDeleteResult = { success: false, message: '代理URL格式且无数据库对象名' };
          } else {
            // 其他格式，尝试使用文件名作为后备
            objectName = path.basename(invoice.invoice_file_url);
            console.warn('⚠️ 未知URL格式，尝试使用文件名作为对象名:', objectName);
          }
          
          if (objectName) {
            console.log('🗑️ 尝试删除OSS文件:', objectName);
            ossDeleteResult = await deleteFromOSS(objectName);
            if (ossDeleteResult.success) {
              console.log('✅ OSS文件删除成功:', objectName);
            } else {
              console.warn('⚠️ OSS文件删除失败:', objectName, ossDeleteResult.message);
            }
          } else {
            ossDeleteResult = { success: false, message: '无法从URL提取对象名' };
            console.warn('⚠️ 无法从URL提取对象名:', invoice.invoice_file_url);
          }
        } catch (ossError) {
          console.error('❌ OSS文件删除出错:', ossError);
          ossDeleteResult = { success: false, message: ossError.message };
          // 不阻止删除流程，只记录错误
        }
      } else {
        ossDeleteResult = { success: false, message: 'OSS配置不完整' };
      }
    }
    
    // 3. 将相关订单的状态重置为"未开票"，并清除invoice_id
    const relatedOrders = await PurchaseOrder.findAll({
      where: { invoice_id: id }
    });
    
    if (relatedOrders.length > 0) {
      await PurchaseOrder.update(
        { 
          invoice_status: '未开票', 
          invoice_id: null 
        },
        { 
          where: { invoice_id: id },
          transaction 
        }
      );
    }
    
    // 4. 删除发票记录
    await invoice.destroy({ transaction });
    
    // 提交事务
    await transaction.commit();
    
    // 返回操作结果
    res.json({
      code: 0,
      message: '删除成功',
      data: {
        resetOrdersCount: relatedOrders.length,
        invoiceNumber: invoice.invoice_number,
        sellerName: invoice.seller_name,
        ossDelete: ossDeleteResult,
        screenshotDelete: screenshotDeleteResult,
        operationDetails: {
          hadFile: !!invoice.invoice_file_url,
          hadScreenshots: !!invoice.amount_difference_screenshot,
          fileName: invoice.invoice_file_name,
          screenshotCount: invoice.amount_difference_screenshot ? 
            (() => {
              try {
                return JSON.parse(invoice.amount_difference_screenshot).length;
              } catch {
                return 0;
              }
            })() : 0,
          relatedOrdersCount: relatedOrders.length,
          relatedOrderNumbers: relatedOrders.map(o => o.order_number)
        }
      }
    });
  } catch (error) {
    // 回滚事务
    await transaction.rollback();
    console.error('删除发票失败:', error);
    
    res.status(500).json({
      code: 1,
      message: '删除失败',
      error: error.message
    });
  }
});

// ==================== 文件上传相关接口 ====================

// 上传发票文件到OSS
router.post('/upload-invoice', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        code: 1,
        message: '没有上传文件'
      });
    }

    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.status(500).json({
        code: 1,
        message: 'OSS配置不完整，请联系管理员'
      });
    }

    // 上传采购发票文件到OSS
    const uploadResult = await uploadToOSS(
      req.file.buffer,
      req.file.originalname,
      'purchase'
    );
    
    if (uploadResult.success) {
      res.json({
        code: 0,
        message: '文件上传成功',
        data: {
          filename: uploadResult.originalName,
          size: uploadResult.size,
          url: uploadResult.url,
          objectName: uploadResult.name
        }
      });
    } else {
      throw new Error('上传失败');
    }
  } catch (error) {
    console.error('文件上传失败:', error);
    res.status(500).json({
      code: 1,
      message: '文件上传失败',
      error: error.message
    });
  }
});

// PDF发票解析功能 - 优化版本
const parseInvoicePDF = (text) => {
  const result = {
    invoice_number: '',
    invoice_date: '',
    total_amount: '',
    tax_amount: '',
    tax_rate: '',
    seller_name: '',
    buyer_name: '',
    invoice_type: '增值税普通发票'
  };

  try {
    // 预处理文本：保留原始格式，只进行必要的清理
    const originalText = text;
    const cleanText = text.replace(/\s+/g, ' ').replace(/\n/g, ' ').trim();
    
    // 添加调试日志
    console.log('📄 PDF原始文本长度:', originalText.length);
    console.log('📄 PDF清理后文本长度:', cleanText.length);
    console.log('📄 PDF文本片段 (前500字符):', cleanText.substring(0, 500));
    
    // 发票号码解析 - 针对发票号码格式优化
    const invoiceNumberPatterns = [
      // 匹配 "发票号码：数字" 格式
      /发票号码[：:\s]*(\d{20,30})/i,
      // 匹配右上角的长数字发票号
      /(\d{20,30})/,
      // 匹配其他可能的发票号格式
      /发票代码[：:\s]*(\d{10,15})[^0-9]*发票号码[：:\s]*(\d{8,30})/i,
      /票据号[：:\s]*(\d{8,30})/i,
      /NO[：:\s]*(\d{8,30})/i,
      /编号[：:\s]*(\d{8,30})/i,
      /发票编号[：:\s]*(\d{8,30})/i,
      /号码[：:\s]*(\d{8,30})/i,
      // 匹配含字母的发票号码
      /(\d{8,20}[A-Z]{1,5})/i
    ];
    
    for (const pattern of invoiceNumberPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        // 取最后一个匹配的数字组合
        const invoiceNumber = match[match.length - 1];
        if (invoiceNumber && invoiceNumber.length >= 15) {
          result.invoice_number = invoiceNumber;
          break;
        }
      }
    }

    // 开票日期解析 - 针对中文日期格式优化
    const datePatterns = [
      // 匹配 "开票日期：YYYY年MM月DD日" 格式
      /开票日期[：:\s]*(\d{4}年\d{1,2}月\d{1,2}日)/,
      /开具日期[：:\s]*(\d{4}年\d{1,2}月\d{1,2}日)/,
      // 匹配其他日期格式
      /开票日期[：:\s]*(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/,
      /开具日期[：:\s]*(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/,
      /日期[：:\s]*(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/,
      /开票时间[：:\s]*(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/,
      // 支持 YYYY-MM-DD 格式
      /(\d{4}-\d{1,2}-\d{1,2})/,
      // 支持 YYYY/MM/DD 格式
      /(\d{4}\/\d{1,2}\/\d{1,2})/,
      // 支持中文日期格式
      /(\d{4}年\d{1,2}月\d{1,2}日)/
    ];
    
    for (const pattern of datePatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        let dateStr = match[1];
        // 标准化日期格式
        dateStr = dateStr.replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '').replace(/\//g, '-');
        if (dateStr.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
          result.invoice_date = dateStr;
          break;
        }
      }
    }

    // 金额解析 - 获取所有"¥"后面的数字，取最大的作为总金额
    const amountPattern = /¥\s*([\d,]+\.?\d*)/g;
    const allAmounts = [];
    let match;
    
    // 获取所有¥后面的数字
    while ((match = amountPattern.exec(cleanText)) !== null) {
      const amount = match[1].replace(/,/g, '');
      const numericAmount = parseFloat(amount);
      
      // 验证是有效的金额数字
      if (!isNaN(numericAmount) && numericAmount > 0 && numericAmount < 99999999.99) {
        allAmounts.push({
          value: numericAmount,
          original: amount
        });
        console.log(`找到金额: ¥${amount}`);
      }
    }
    
    // 取最大的金额作为总金额
    if (allAmounts.length > 0) {
      const maxAmount = allAmounts.reduce((max, current) => 
        current.value > max.value ? current : max
      );
      result.total_amount = maxAmount.original;
      console.log(`✅ 金额解析成功: ${maxAmount.original} (从${allAmounts.length}个金额中选择最大值)`);
    }
    
    // 如果以上模式都没有匹配到，尝试备选模式（但要避免匹配表格中的金额）
    if (!result.total_amount) {
      console.log('❌ 主要金额解析失败，尝试备选模式...');
      
      // 备选模式：匹配合计行的金额（但优先级较低）
      const fallbackPatterns = [
        // 匹配"合计"后面的最后一个金额（通常是价税合计）
        /合计[^¥]*¥\s*([\d,]{1,15}\.\d{2})[^¥]*¥\s*([\d,]{1,15}\.?\d{0,2})/,
        // 匹配"价税合计"后面的数字
        /价税合计[^¥]*¥?\s*([\d,]{1,15}\.\d{2})/,
        /价税合计[^¥]*¥?\s*([\d,]{1,15}\.?\d{0,2})/
      ];
      
      for (const pattern of fallbackPatterns) {
        const match = cleanText.match(pattern);
        if (match) {
          // 如果匹配到两个数字，取第二个（税额）
          const amount = match[2] ? match[2].replace(/,/g, '') : match[1].replace(/,/g, '');
          // 验证金额的合理性
          if (parseFloat(amount) > 0 && 
              parseFloat(amount) < 99999999.99 && // 最大金额限制
              amount.length <= 10 && // 数字长度限制
              amount !== result.invoice_number && // 不能是发票号码
              !amount.match(/^\d{15,}$/)) { // 不能是15位以上的纯数字（避免发票号码）
            result.total_amount = amount;
            console.log(`✅ 备选金额解析成功: ${amount}, 使用模式: ${pattern}`);
            break;
          }
        }
      }
    }
    
    // 如果仍然没有找到金额，输出调试信息
    if (!result.total_amount) {
      console.log('❌ 金额解析失败，尝试在文本中查找价税合计相关内容:');
      const priceRelatedLines = cleanText.split(' ').filter(line => 
        line.includes('价税合计') || line.includes('小写') || line.includes('¥')
      );
      console.log('价税合计相关文本:', priceRelatedLines.slice(0, 5));
      
      // 输出原始文本片段用于调试
      const xiaoxieIndex = cleanText.indexOf('小写');
      if (xiaoxieIndex !== -1) {
        const contextStart = Math.max(0, xiaoxieIndex - 50);
        const contextEnd = Math.min(cleanText.length, xiaoxieIndex + 100);
        console.log('小写上下文:', cleanText.substring(contextStart, contextEnd));
      }
    }

    // 税额解析 - 针对税额列格式优化
    const taxAmountPatterns = [
      // 匹配合计行的税额 "合计 ¥30.69 ¥0.31"
      /合计[^¥]*¥[^¥]*¥\s*([\d,]{1,10}\.?\d{0,2})/,
      // 匹配税额列最后的小数金额（在税率后面）
      /税率[\/征收率]*[^%\d]*\d{1,2}%[^0-9]*(\d{1,10}\.\d{2})/,
      /税\s*额[^¥\d]*(\d{1,10}\.\d{2})/,
      /税额[^¥\d]*(\d{1,10}\.\d{2})/,
      // 匹配¥符号后的税额
      /税额[：:\s]*¥\s*([\d,]{1,10}\.?\d{0,2})/,
      /税金[：:\s]*¥\s*([\d,]{1,10}\.?\d{0,2})/,
      /增值税[：:\s]*¥\s*([\d,]{1,10}\.?\d{0,2})/,
      /税[：:\s]*¥\s*([\d,]{1,10}\.?\d{0,2})/,
      // 匹配税额列中的数字
      /税额[^¥\d]*¥?\s*([\d,]{1,10}\.?\d{0,2})/,
      /税金[^¥\d]*¥?\s*([\d,]{1,10}\.?\d{0,2})/,
      /增值税[^¥\d]*¥?\s*([\d,]{1,10}\.?\d{0,2})/,
      // 匹配表格中税额列的数字
      /税\s*额[^¥\d]*¥?\s*([\d,]{1,10}\.?\d{0,2})/,
      // 匹配税额的数字格式
      /税额[：:\s]*([\d,]{1,10}\.?\d{0,2})/
    ];
    
    for (const pattern of taxAmountPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const taxAmount = match[1].replace(/,/g, '');
        // 验证税额的合理性
        if (parseFloat(taxAmount) >= 0 && 
            parseFloat(taxAmount) < 9999999.99 && // 最大税额限制
            taxAmount.length <= 10 && // 数字长度限制
            taxAmount !== result.invoice_number && // 不能是发票号码
            !taxAmount.match(/^\d{15,}$/)) { // 不能是15位以上的纯数字（避免发票号码）
          result.tax_amount = taxAmount;
          break;
        }
      }
    }

    // 税率解析 - 针对税率/征收率列格式优化
    const taxRatePatterns = [
      // 匹配税率/征收率列中的百分数
      /税率[\/征收率]*[^%]*(\d{1,2}%)/,
      /征收率[^%]*(\d{1,2}%)/,
      // 匹配表格中的税率
      /税\s*率[\/征收率]*[^%]*(\d{1,2}%)/,
      // 匹配其他税率格式
      /税率[：:\s]*(\d{1,2}%)/,
      /税率[：:\s]*(\d{1,2}\.\d{1,2}%)/,
      /税率[：:\s]*0\.(\d{2})/,
      /(\d{1,2}%)/,
      /(\d{1,2}\.\d{1,2}%)/
    ];
    
    for (const pattern of taxRatePatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        let taxRate = match[1];
        // 如果匹配到的是小数形式，转换为百分比
        if (taxRate.match(/^0\.\d{2}$/)) {
          taxRate = (parseFloat(taxRate) * 100).toFixed(0) + '%';
        }
        result.tax_rate = taxRate;
        break;
      }
    }

    // 解析开票方和收票方信息 - 优化版本
    const parseCompanyInfo = (text) => {
      // 提取所有公司名称
      const extractAllCompanies = (text) => {
        const companies = [];
        const companyPatterns = [
          /([^：\n\r]*?有限公司)/g,
          /([^：\n\r]*?股份有限公司)/g,
          /([^：\n\r]*?公司)/g,
          /([^：\n\r]*?企业)/g,
          /([^：\n\r]*?厂)/g
        ];
        
        // 创建一个包含公司名称和位置的数组
        const companyWithPositions = [];
        
        companyPatterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(text)) !== null) {
            const companyName = match[1].trim();
            const position = match.index;
            
            // 过滤掉明显不是真正公司名称的匹配
            if (companyName.length > 2 && 
                !companyName.includes('银行账号') && 
                !companyName.includes('开户银行') &&
                !companyName.includes('销方开户银行') &&
                !companyName.includes('购方开户银行') &&
                !companyName.includes('纳税人识别号') &&
                !companyName.includes('地址电话') &&
                !companyName.includes('开户行') &&
                !companies.some(existing => existing.name === companyName)) {
              
              companyWithPositions.push({
                name: companyName,
                position: position
              });
              companies.push({
                name: companyName,
                position: position
              });
            }
          }
        });
        
        // 按照在文本中出现的位置排序
        companies.sort((a, b) => a.position - b.position);
        
        return companies;
      };
      
      const companies = extractAllCompanies(text);
      
      console.log('📋 提取到的公司名称（按出现顺序）:', companies.map(c => c.name));
      
      // 按照用户需求：第一个公司名是收票方，第二个公司名是开票方
      if (companies.length >= 2) {
        result.buyer_name = companies[0].name;  // 第一个公司名是收票方
        result.issuer_name = companies[1].name; // 第二个公司名是开票方
        
        console.log(`✅ 按顺序识别 - 收票方: ${result.buyer_name}, 开票方: ${result.issuer_name}`);
      } else if (companies.length === 1) {
        // 只有一个公司名的情况，需要通过其他方式判断
        const singleCompanyName = companies[0].name;
        
        // 检查是否包含已知的收票方特征
        if (singleCompanyName.includes('深圳欣蓉') || 
            singleCompanyName.includes('深圳先春') ||
            singleCompanyName.includes('电子商务')) {
          result.buyer_name = singleCompanyName;
          console.log(`✅ 单公司识别为收票方: ${result.buyer_name}`);
        } else {
          // 其他情况默认为开票方
          result.issuer_name = singleCompanyName;
          console.log(`✅ 单公司识别为开票方: ${result.issuer_name}`);
        }
      } else {
        console.log('❌ 未能识别到任何公司名称');
      }
    };

    // 调用优化后的解析函数
    parseCompanyInfo(originalText);

    // 如果按顺序识别失败，尝试传统的关键字匹配作为备选方案
    if (!result.buyer_name && !result.issuer_name) {
      console.log('🔄 使用备选方案进行公司识别...');
      
      // 备选方案：通过关键字匹配
      const fallbackPatterns = {
        buyer: [
          /购[\s\S]*?买[\s\S]*?方[\s\S]*?信[\s\S]*?息[\s\S]*?名称[：:]\s*([^：\n\r]*?有限公司)/,
          /购[\s\S]*?买[\s\S]*?方[\s\S]*?信[\s\S]*?息[\s\S]*?名称[：:]\s*([^：\n\r]*?公司)/,
          /深圳欣蓉[^：\n\r]*?有限公司/,
          /深圳先春[^：\n\r]*?有限公司/,
          /([^：\n\r]*?电子商务有限公司)/
        ],
        seller: [
          /销[\s\S]*?售[\s\S]*?方[\s\S]*?信[\s\S]*?息[\s\S]*?名称[：:]\s*([^：\n\r]*?有限公司)/,
          /销[\s\S]*?售[\s\S]*?方[\s\S]*?信[\s\S]*?息[\s\S]*?名称[：:]\s*([^：\n\r]*?公司)/,
          /([^：\n\r]*?制造有限公司)/,
          /([^：\n\r]*?贸易有限公司)/,
          /([^：\n\r]*?商贸有限公司)/
        ]
      };
      
      // 尝试匹配收票方
      if (!result.buyer_name) {
        for (const pattern of fallbackPatterns.buyer) {
          const match = originalText.match(pattern);
          if (match) {
            result.buyer_name = (match[1] || match[0]).trim();
            console.log(`✅ 备选方案识别收票方: ${result.buyer_name}`);
            break;
          }
        }
      }
      
      // 尝试匹配开票方
      if (!result.issuer_name) {
        for (const pattern of fallbackPatterns.seller) {
          const match = originalText.match(pattern);
          if (match) {
            const companyName = (match[1] || match[0]).trim();
            // 确保不是已识别的收票方
            if (companyName !== result.buyer_name) {
              result.issuer_name = companyName;
              console.log(`✅ 备选方案识别开票方: ${result.issuer_name}`);
              break;
            }
          }
        }
      }
    }

    // 发票类型智能识别
    if (cleanText.includes('增值税专用发票')) {
      result.invoice_type = '增值税专用发票';
    } else if (cleanText.includes('增值税普通发票')) {
      result.invoice_type = '增值税普通发票';
    } else if (cleanText.includes('普通发票')) {
      result.invoice_type = '增值税普通发票';
    } else if (cleanText.includes('收据')) {
      result.invoice_type = '收据';
    }

    // 数据清理和验证
    Object.keys(result).forEach(key => {
      if (typeof result[key] === 'string') {
        result[key] = result[key].trim();
      }
    });



  } catch (error) {
    console.error('PDF解析错误:', error);
  }

  // 返回值需要映射到前端期望的字段名称
  const finalResult = {
    invoice_number: result.invoice_number,
    invoice_date: result.invoice_date,
    total_amount: result.total_amount,
    tax_amount: result.tax_amount,
    tax_rate: result.tax_rate,
    seller_name: result.issuer_name,  // 前端期望 seller_name
    buyer_name: result.buyer_name,
    invoice_type: result.invoice_type
  };
  
  return finalResult;
};

// 计算解析完整性评分
const calculateCompletenessScore = (invoiceInfo) => {
  const requiredFields = ['invoice_number', 'invoice_date', 'total_amount', 'seller_name'];
  const optionalFields = ['tax_amount', 'tax_rate', 'buyer_name'];
  
  let score = 0;
  let totalWeight = 0;
  
  // 必需字段权重为 3
  requiredFields.forEach(field => {
    totalWeight += 3;
    if (invoiceInfo[field] && invoiceInfo[field].toString().trim()) {
      score += 3;
    }
  });
  
  // 可选字段权重为 1
  optionalFields.forEach(field => {
    totalWeight += 1;
    if (invoiceInfo[field] && invoiceInfo[field].toString().trim()) {
      score += 1;
    }
  });
  
  return Math.round((score / totalWeight) * 100);
};

// 上传并解析PDF发票
router.post('/upload-and-parse-invoice', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        code: 1,
        message: '没有上传文件'
      });
    }

    // 检查文件类型
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({
        code: 1,
        message: '只支持PDF文件'
      });
    }

    // 解析PDF内容
    const pdfData = await pdf(req.file.buffer);
    const extractedText = pdfData.text;

    // 从PDF文本中提取发票信息
    const invoiceInfo = parseInvoicePDF(extractedText);

    // 上传文件到OSS
    let uploadResult = null;
    if (checkOSSConfig()) {
      try {
        uploadResult = await uploadToOSS(
          req.file.buffer,
          req.file.originalname,
          'purchase'
        );
      } catch (uploadError) {
        console.warn('OSS上传失败，但PDF解析成功:', uploadError);
      }
    }

    res.json({
      code: 0,
      message: 'PDF解析成功',
      data: {
        extractedInfo: invoiceInfo,
        originalText: extractedText,
        fileInfo: uploadResult ? {
          filename: uploadResult.originalName,
          size: uploadResult.size,
          url: uploadResult.url,
          objectName: uploadResult.name
        } : null,
        // 增加解析质量评估
        parseQuality: {
          hasInvoiceNumber: !!invoiceInfo.invoice_number,
          hasInvoiceDate: !!invoiceInfo.invoice_date,
          hasTotalAmount: !!invoiceInfo.total_amount,
          hasSellerName: !!invoiceInfo.seller_name,
          completeness: calculateCompletenessScore(invoiceInfo)
        }
      }
    });

  } catch (error) {
    console.error('PDF解析失败:', error);
    res.status(500).json({
      code: 1,
      message: 'PDF解析失败',
      error: error.message
    });
  }
});

// 批量关联订单与发票
router.post('/associate-orders-with-invoice', async (req, res) => {
  try {
    const { order_ids, invoice_data } = req.body;
    
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '请提供要关联的订单ID列表'
      });
    }

    if (!invoice_data) {
      return res.status(400).json({
        code: 1,
        message: '请提供发票数据'
      });
    }

    // 开始事务
    const transaction = await sequelize.transaction();
    
    try {
      // 创建发票
      const invoice = await Invoice.create(invoice_data, { transaction });
      
      // 更新订单状态和关联发票
      await PurchaseOrder.update(
        { 
          invoice_status: '已开票', 
          invoice_id: invoice.id 
        },
        { 
          where: { id: { [Op.in]: order_ids } },
          transaction 
        }
      );

      // 提交事务
      await transaction.commit();

      res.json({
        code: 0,
        message: '关联成功',
        data: {
          invoice_id: invoice.id,
          updated_order_count: order_ids.length
        }
      });

    } catch (error) {
      // 回滚事务
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('关联订单与发票失败:', error);
    res.status(500).json({
      code: 1,
      message: '关联失败',
      error: error.message
    });
  }
});

// 删除OSS文件
router.delete('/delete-invoice-file', async (req, res) => {
  try {
    const { objectName } = req.body;
    
    if (!objectName) {
      return res.status(400).json({
        code: 1,
        message: '请提供要删除的文件名'
      });
    }

    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.status(500).json({
        code: 1,
        message: 'OSS配置不完整，请联系管理员'
      });
    }

    const deleteResult = await deleteFromOSS(objectName);
    
    if (deleteResult.success) {
      res.json({
        code: 0,
        message: '文件删除成功'
      });
    } else if (deleteResult.error === 'AccessDenied') {
      res.status(403).json({
        code: 1,
        message: '删除权限不足，请联系管理员检查OSS权限配置',
        error: deleteResult.message
      });
    } else {
      throw new Error(deleteResult.message || '删除失败');
    }
  } catch (error) {
    console.error('文件删除失败:', error);
    res.status(500).json({
      code: 1,
      message: '文件删除失败',
      error: error.message
    });
  }
});

// 获取文件签名URL
router.get('/get-signed-url/:objectName', async (req, res) => {
  try {
    const { objectName } = req.params;
    const { expires = 3600 } = req.query;
    
    if (!objectName) {
      return res.status(400).json({
        code: 1,
        message: '请提供文件名'
      });
    }

    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.status(500).json({
        code: 1,
        message: 'OSS配置不完整，请联系管理员'
      });
    }

    const signedUrlResult = await getSignedUrl(objectName, parseInt(expires));
    
    if (signedUrlResult.success) {
      res.json({
        code: 0,
        message: '获取签名URL成功',
        data: {
          url: signedUrlResult.url,
          expires: expires
        }
      });
    } else {
      throw new Error('获取签名URL失败');
    }
  } catch (error) {
    console.error('获取签名URL失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取签名URL失败',
      error: error.message
    });
  }
});

// ==================== 批量操作接口 ====================

// 批量更新订单开票状态
router.put('/orders/batch-invoice-status', async (req, res) => {
  try {
    const { order_ids, invoice_status, invoice_id } = req.body;
    
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '请提供要更新的订单ID列表'
      });
    }
    
    const updateData = { invoice_status };
    if (invoice_id) {
      updateData.invoice_id = invoice_id;
    }
    
    const [updatedCount] = await PurchaseOrder.update(updateData, {
      where: { id: { [Op.in]: order_ids } }
    });
    
    res.json({
      code: 0,
      message: '批量更新成功',
      data: { updatedCount }
    });
  } catch (error) {
    console.error('批量更新失败:', error);
    res.status(500).json({
      code: 1,
      message: '批量更新失败',
      error: error.message
    });
  }
});

// 批量删除订单
router.delete('/orders/batch', async (req, res) => {
  try {
    const { order_ids } = req.body;
    
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '请提供要删除的订单ID列表'
      });
    }
    
    const deletedCount = await PurchaseOrder.destroy({
      where: { id: { [Op.in]: order_ids } }
    });
    
    res.json({
      code: 0,
      message: '批量删除成功',
      data: { deletedCount }
    });
  } catch (error) {
    console.error('批量删除失败:', error);
    res.status(500).json({
      code: 1,
      message: '批量删除失败',
      error: error.message
    });
  }
});

// ==================== 统计相关接口 ====================

// 获取发票文件（代理方式）
router.get('/invoices/:id/file', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取发票信息
    const invoice = await Invoice.findByPk(id);
    if (!invoice) {
      return res.status(404).json({
        code: 1,
        message: '发票不存在'
      });
    }
    
    // 检查是否有文件URL
    if (!invoice.invoice_file_url) {
      return res.status(404).json({
        code: 1,
        message: '发票文件不存在'
      });
    }
    
    // 如果是OSS链接，直接从OSS读取文件并返回
    if (invoice.invoice_file_url.includes('aliyuncs.com')) {
      try {
        const OSS = require('ali-oss');
        const client = new OSS({
          region: process.env.OSS_REGION,
          accessKeyId: process.env.OSS_ACCESS_KEY_ID,
          accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
          bucket: process.env.OSS_BUCKET,
          endpoint: process.env.OSS_ENDPOINT
        });
        
        // 从URL中提取对象名称
        const url = new URL(invoice.invoice_file_url);
        const objectName = url.pathname.substring(1); // 去掉开头的 /
        
        console.log('正在获取OSS文件:', objectName);
        
        // 直接获取文件内容
        const result = await client.get(objectName);
        
        // 设置响应头
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${invoice.invoice_file_name || '发票文件.pdf'}"`
        });
        
        // 返回文件内容
        res.send(result.content);
        return;
        
      } catch (error) {
        console.error('从OSS获取文件失败:', error);
        return res.status(500).json({
          code: 1,
          message: '获取文件失败: ' + error.message
        });
      }
    }
    
    // 如果不是OSS链接，返回原始URL
    res.json({
      code: 0,
      message: '获取成功',
      data: {
        fileUrl: invoice.invoice_file_url,
        fileName: invoice.invoice_file_name || '发票文件.pdf',
        fileSize: invoice.file_size
      }
    });
    
  } catch (error) {
    console.error('获取发票文件失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取发票文件失败',
      error: error.message
    });
  }
});

// 上传文件到现有发票
router.post('/invoices/:id/upload-file', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取发票信息
    const invoice = await Invoice.findByPk(id);
    if (!invoice) {
      return res.status(404).json({
        code: 1,
        message: '发票不存在'
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        code: 1,
        message: '没有上传文件'
      });
    }

    // 检查文件类型
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({
        code: 1,
        message: '只支持PDF文件'
      });
    }

    // 上传文件到OSS
    let uploadResult = null;
    if (checkOSSConfig()) {
      try {
        uploadResult = await uploadToOSS(
          req.file.buffer,
          req.file.originalname,
          'purchase'
        );
      } catch (uploadError) {
        console.error('OSS上传失败:', uploadError);
        return res.status(500).json({
          code: 1,
          message: 'OSS上传失败',
          error: uploadError.message
        });
      }
    } else {
      return res.status(500).json({
        code: 1,
        message: 'OSS配置未完成，无法上传文件'
      });
    }

    // 更新发票记录
    if (uploadResult) {
      await invoice.update({
        invoice_file_url: uploadResult.url,
        invoice_file_object_name: uploadResult.name,
        invoice_file_name: uploadResult.originalName,
        file_size: uploadResult.size
      });
      
      res.json({
        code: 0,
        message: '文件上传成功',
        data: {
          fileUrl: uploadResult.url,
          fileName: uploadResult.originalName,
          fileSize: uploadResult.size
        }
      });
    } else {
      res.status(500).json({
        code: 1,
        message: '文件上传失败'
      });
    }

  } catch (error) {
    console.error('上传文件到发票失败:', error);
    res.status(500).json({
      code: 1,
      message: '上传文件失败',
      error: error.message
    });
  }
});

// 获取所有不重复的卖家公司名
router.get('/seller-companies', async (req, res) => {
  try {
    const sellerCompanies = await PurchaseOrder.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('seller_name')), 'seller_name']],
      where: {
        seller_name: {
          [Op.ne]: null,
          [Op.ne]: ''
        }
      },
      order: [['seller_name', 'ASC']]
    });

    res.json({
      code: 0,
      message: '获取成功',
      data: sellerCompanies.map(item => item.seller_name)
    });
  } catch (error) {
    console.error('获取卖家公司名失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取卖家公司名失败',
      error: error.message
    });
  }
});

// 获取统计数据
router.get('/statistics', async (req, res) => {
  try {
    // 两个固定的买家公司名称
    const buyerCompanies = ['深圳欣蓉电子商务有限公司', '深圳先春电子商务有限公司'];
    
    // 获取基本统计数据
    const [
      totalOrders,
      totalInvoices,
      totalAmount
    ] = await Promise.all([
      PurchaseOrder.count(),
      Invoice.count(),
      PurchaseOrder.sum('amount') || 0
    ]);

    // 获取按买家公司分组的统计数据
    const companyStats = {};
    
    for (const company of buyerCompanies) {
      const [
        unpaidOrders,
        fullyPaidOrders,
        unpaidAmount
      ] = await Promise.all([
        PurchaseOrder.count({ 
          where: { 
            invoice_status: '未开票',
            payment_account: { [Op.like]: `%${company}%` }
          } 
        }),
        PurchaseOrder.count({ 
          where: { 
            invoice_status: '已开票',
            payment_account: { [Op.like]: `%${company}%` }
          } 
        }),
        PurchaseOrder.sum('amount', { 
          where: { 
            invoice_status: '未开票',
            payment_account: { [Op.like]: `%${company}%` }
          } 
        }) || 0
      ]);

      companyStats[company] = {
        unpaidOrders,
        fullyPaidOrders,
        unpaidAmount
      };
    }

    // 获取各供应商统计
    const supplierStats = await PurchaseOrder.findAll({
      attributes: [
        'seller_name',
        [sequelize.fn('COUNT', sequelize.col('id')), 'order_count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
      ],
      group: ['seller_name'],
      order: [[sequelize.fn('SUM', sequelize.col('amount')), 'DESC']]
    });

    // 获取月度统计
    const monthlyStats = await PurchaseOrder.findAll({
      attributes: [
        [sequelize.fn('DATE_FORMAT', sequelize.col('order_date'), '%Y-%m'), 'month'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'order_count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
      ],
      group: [sequelize.fn('DATE_FORMAT', sequelize.col('order_date'), '%Y-%m')],
      order: [[sequelize.fn('DATE_FORMAT', sequelize.col('order_date'), '%Y-%m'), 'DESC']],
      limit: 12
    });

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        overview: {
          totalOrders,
          totalInvoices,
          totalAmount,
          companyStats
        },
        supplierStats,
        monthlyStats
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取统计数据失败',
      error: error.message
    });
  }
});

// 上传金额差异截图
router.post('/upload-amount-difference-screenshot', imageUpload.single('screenshot'), async (req, res) => {
  console.log('📷 收到截图上传请求');
  
  try {
    if (!req.file) {
      console.log('❌ 没有接收到文件');
      return res.status(400).json({
        code: 1,
        message: '没有上传截图文件'
      });
    }

    console.log('📁 接收到文件:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // 检查文件类型
    if (!req.file.mimetype.startsWith('image/')) {
      console.log('❌ 文件类型不正确:', req.file.mimetype);
      return res.status(400).json({
        code: 1,
        message: '只支持图片文件'
      });
    }

    // 检查OSS配置
    if (!checkOSSConfig()) {
      console.log('❌ OSS配置检查失败');
      return res.status(500).json({
        code: 1,
        message: 'OSS配置不完整，请联系管理员'
      });
    }

    // 上传截图到OSS
    const uploadResult = await uploadToOSS(
      req.file.buffer,
      req.file.originalname,
      'purchase'
    );
    
    // 生成代理URL避免CORS和权限问题
    const proxyUrl = `https://${req.get('host')}/api/purchase-invoice/screenshot-proxy?path=${encodeURIComponent(uploadResult.name)}`;
    
    const responseData = {
      filename: uploadResult.originalName,
      size: uploadResult.size,
      url: proxyUrl,
      objectName: uploadResult.name
    };
    
    res.json({
      code: 0,
      message: '截图上传成功',
      data: responseData
    });
  } catch (error) {
    console.error('❌ 截图上传失败:', error);
    console.error('❌ 错误详情:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    res.status(500).json({
      code: 1,
      message: '截图上传失败',
      error: error.message
    });
  }
});



// 导出采购订单数据
router.post('/export-orders', async (req, res) => {
  try {
    const { 
      seller_name, 
      invoice_status, 
      payment_account,
      start_date,
      end_date,
      order_number,
      invoice_number
    } = req.body;

    const whereCondition = {};
    const includeCondition = [{
      model: Invoice,
      as: 'invoice',
      required: false
    }];
    
    if (seller_name) {
      whereCondition.seller_name = { [Op.like]: `%${seller_name}%` };
    }
    
    if (invoice_status) {
      whereCondition.invoice_status = invoice_status;
    }
    
    if (payment_account) {
      whereCondition.payment_account = { [Op.like]: `%${payment_account}%` };
    }
    
    if (order_number) {
      const orderNumbers = order_number.split(',').map(num => num.trim()).filter(num => num);
      if (orderNumbers.length > 0) {
        whereCondition.order_number = { [Op.in]: orderNumbers };
      }
    }
    
    if (invoice_number) {
      const invoiceNumbers = invoice_number.split(',').map(num => num.trim()).filter(num => num);
      if (invoiceNumbers.length > 0) {
        includeCondition[0].where = {
          invoice_number: { [Op.in]: invoiceNumbers }
        };
      }
    }
    
    if (start_date && end_date) {
      whereCondition.order_date = {
        [Op.between]: [start_date, end_date]
      };
    }
    
    // 获取所有匹配的数据
    const orders = await PurchaseOrder.findAll({
      where: whereCondition,
      include: includeCondition,
      order: [['order_date', 'DESC'], ['created_at', 'DESC']]
    });
    
    // 准备Excel数据
    const excelData = orders.map(order => ({
      '订单编号': order.order_number,
      '订单日期': order.order_date,
      '卖家公司名': order.seller_name,
      '买家公司名': order.payment_account,
      '实付款(元)': order.amount,
      '开票状态': order.invoice_status,
      '发票号': order.invoice?.invoice_number || '',
      '开票日期': order.invoice?.invoice_date || '',
      '发票金额': order.invoice?.total_amount || '',
      '税额': order.invoice?.tax_amount || '',
      '税率': order.invoice?.tax_rate || '',
      '发票类型': order.invoice?.invoice_type || '',
      '发票状态': order.invoice?.status || '',
      '备注': order.remarks || ''
    }));
    
    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // 设置列宽
    const colWidths = [
      { wch: 15 }, // 订单编号
      { wch: 12 }, // 订单日期
      { wch: 20 }, // 卖家公司名
      { wch: 20 }, // 买家公司名
      { wch: 12 }, // 实付款
      { wch: 10 }, // 开票状态
      { wch: 15 }, // 发票号
      { wch: 12 }, // 开票日期
      { wch: 12 }, // 发票金额
      { wch: 10 }, // 税额
      { wch: 8 },  // 税率
      { wch: 15 }, // 发票类型
      { wch: 10 }, // 发票状态
      { wch: 30 }  // 备注
    ];
    worksheet['!cols'] = colWidths;
    
    // 添加工作表到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, '采购订单数据');
    
    // 生成Excel文件
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // 设置响应头
    const filename = `采购订单数据_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', excelBuffer.length);
    
    res.send(excelBuffer);
    
  } catch (error) {
    console.error('导出失败:', error);
    res.status(500).json({
      code: 1,
      message: '导出失败: ' + error.message
    });
  }
});

// 截图代理路由 - 解决CORS和权限问题
router.get('/screenshot-proxy', async (req, res) => {
  try {
    const objectName = req.query.path;
    
    if (!objectName) {
      return res.status(400).json({
        code: 1,
        message: '缺少文件路径参数'
      });
    }
    
    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.status(500).json({
        code: 1,
        message: 'OSS配置不完整'
      });
    }
    
    // 从OSS获取文件
    const OSS = require('ali-oss');
    const client = new OSS({
      region: process.env.OSS_REGION || 'oss-cn-hangzhou',
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      secure: true
    });
    
    const result = await client.get(objectName);
    
    // 设置正确的Content-Type
    const ext = objectName.toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext.includes('.jpg') || ext.includes('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (ext.includes('.png')) {
      contentType = 'image/png';
    } else if (ext.includes('.gif')) {
      contentType = 'image/gif';
    } else if (ext.includes('.webp')) {
      contentType = 'image/webp';
    }
    
    // 设置响应头
    res.set({
      'Content-Type': contentType,
      'Content-Length': result.content.length,
      'Cache-Control': 'public, max-age=31536000', // 缓存1年
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    
    res.send(result.content);
    
  } catch (error) {
    console.error('截图代理失败:', error.message);
    
    if (error.code === 'NoSuchKey') {
      res.status(404).json({
        code: 1,
        message: '截图文件不存在'
      });
    } else {
      res.status(500).json({
        code: 1,
        message: '获取截图失败: ' + error.message
      });
    }
  }
});

module.exports = router; 