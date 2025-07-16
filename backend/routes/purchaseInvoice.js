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
    
    // 将Excel数据转换为JSON
    const rawData = XLSX.utils.sheet_to_json(sheet);
    
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

    // 处理数据
    const processedData = [];
    const skippedData = [];
    const errorData = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      
      try {
        // 提取数据
        const orderNumber = String(row['订单编号'] || '').trim();
        const buyerName = String(row['买家公司名'] || '').trim();
        const sellerName = String(row['卖家公司名'] || '').trim();
        const amount = parseFloat(row['实付款(元)']) || 0;
        const orderDateStr = String(row['订单付款时间'] || '').trim();

        // 验证必需字段
        if (!orderNumber || !buyerName || !sellerName || !amount) {
          errorData.push({
            row: i + 1,
            reason: '缺少必需字段',
            data: row
          });
          continue;
        }

        // 解析日期
        let orderDate;
        try {
          // 尝试解析不同格式的日期
          if (orderDateStr.includes('/')) {
            const parts = orderDateStr.split('/');
            if (parts.length === 3) {
              // 假设格式是 MM/DD/YYYY 或 DD/MM/YYYY
              orderDate = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
            }
          } else if (orderDateStr.includes('-')) {
            orderDate = new Date(orderDateStr);
          } else {
            // 尝试直接解析
            orderDate = new Date(orderDateStr);
          }
          
          if (isNaN(orderDate.getTime())) {
            throw new Error('无效日期格式');
          }
        } catch (error) {
          errorData.push({
            row: i + 1,
            reason: '日期格式错误',
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

    res.json({
      code: 0,
      message: '批量导入完成',
      data: {
        total: rawData.length,
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
    
    // 1. 先删除OSS上的文件（如果有的话）
    if (invoice.invoice_file_url) {
      // 检查OSS配置
      if (checkOSSConfig()) {
        try {
          // 从URL中提取对象名称
          let objectName = '';
          if (invoice.invoice_file_url.includes('aliyuncs.com')) {
            const url = new URL(invoice.invoice_file_url);
            objectName = url.pathname.substring(1); // 去掉开头的 /
          } else {
            // 如果是本地文件路径，直接使用文件名
            objectName = path.basename(invoice.invoice_file_url);
          }
          
          if (objectName) {
            ossDeleteResult = await deleteFromOSS(objectName);
          }
        } catch (ossError) {
          console.error('OSS文件删除出错:', ossError);
          ossDeleteResult = { success: false, message: ossError.message };
          // 不阻止删除流程，只记录错误
        }
      } else {
        ossDeleteResult = { success: false, message: 'OSS配置不完整' };
      }
    }
    
    // 2. 将相关订单的状态重置为"未开票"，并清除invoice_id
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
    
    // 3. 删除发票记录
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
        operationDetails: {
          hadFile: !!invoice.invoice_file_url,
          fileName: invoice.invoice_file_name,
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

    console.log('✅ OSS配置检查通过，开始上传文件...');

    // 上传截图到OSS
    const uploadResult = await uploadToOSS(
      req.file.buffer,
      req.file.originalname,
      'purchase'
    );
    
    console.log('📤 OSS上传结果:', uploadResult);
    console.log('🔗 生成的URL:', uploadResult.url);
    
    // 生成代理URL避免CORS和权限问题
    // Railway总是通过HTTPS对外提供服务，强制使用HTTPS
    const proxyUrl = `https://${req.get('host')}/api/purchase-invoice/screenshot-proxy?path=${encodeURIComponent(uploadResult.name)}`;
    
    const responseData = {
      filename: uploadResult.originalName,
      size: uploadResult.size,
      url: proxyUrl,  // 使用代理URL
      directUrl: uploadResult.url,  // 保留原始URL用于调试
      objectName: uploadResult.name
    };
    
    console.log('🔄 使用代理URL:', proxyUrl);
    
    console.log('📨 返回给前端的数据:', responseData);
    
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

// 删除发票的金额差异截图
router.delete('/invoices/:invoiceId/screenshots', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    
    // 获取发票信息
    const invoice = await Invoice.findByPk(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        code: 1,
        message: '发票不存在'
      });
    }
    
    // 如果有截图，先删除OSS中的文件
    if (invoice.amount_difference_screenshot) {
      try {
        const screenshots = JSON.parse(invoice.amount_difference_screenshot);
        
        // 删除OSS中的截图文件
        for (const screenshot of screenshots) {
          if (screenshot.uid) {
            try {
              await deleteFromOSS(screenshot.uid);
              console.log('✅ 删除OSS截图文件成功:', screenshot.uid);
            } catch (ossError) {
              console.warn('⚠️ 删除OSS截图文件失败:', screenshot.uid, ossError.message);
            }
          }
        }
      } catch (parseError) {
        console.warn('⚠️ 解析截图数据失败:', parseError.message);
      }
    }
    
    // 更新数据库，清除截图信息
    await invoice.update({
      amount_difference_screenshot: null
    });
    
    res.json({
      code: 0,
      message: '截图删除成功',
      data: {
        invoiceId: invoice.id
      }
    });
    
  } catch (error) {
    console.error('删除截图失败:', error);
    res.status(500).json({
      code: 1,
      message: '删除截图失败',
      error: error.message
    });
  }
});

// 截图代理路由 - 解决CORS和权限问题
router.get('/screenshot-proxy', async (req, res) => {
  try {
    const objectName = req.query.path; // 从查询参数获取文件路径
    console.log('🔄 代理请求截图:', objectName);
    
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
    
    console.log('📥 从OSS获取文件:', objectName);
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
    
    console.log('✅ 截图代理成功，文件大小:', result.content.length);
    res.send(result.content);
    
  } catch (error) {
    console.error('❌ 截图代理失败:', error);
    
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