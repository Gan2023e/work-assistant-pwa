const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const Logistics = require('../models/Logistics');
const { authenticateToken } = require('./auth');
const multer = require('multer');
const { uploadToOSS, deleteFromOSS } = require('../utils/oss');
const pdf = require('pdf-parse');

// 配置multer用于文件上传
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB限制
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('只支持PDF文件'), false);
    }
  }
});

// VAT税单PDF解析函数
const parseVatReceiptPDF = async (buffer) => {
  try {
    const data = await pdf(buffer);
    const text = data.text;
    
    console.log('📄 VAT税单PDF解析开始');
    console.log('📄 PDF文本长度:', text.length);
    console.log('📄 PDF文本片段 (前1000字符):', text.substring(0, 1000));
    
    const extractedData = {
      mrn: '',
      taxAmount: null,
      taxDate: null
    };
    
    // 1. 提取MRN (Movement Reference Number)
    // MRN通常是25位字符，格式如：25GB7A8H3YNK4P0AR3
    const mrnPatterns = [
      /MRN[：:\s]*([A-Z0-9]{25})/i,
      /Movement Reference Number[：:\s]*([A-Z0-9]{25})/i,
      /([A-Z]{2}[A-Z0-9]{23})/i, // 2位国家代码 + 23位字符
      /([A-Z0-9]{25})/i // 25位字母数字组合
    ];
    
    for (const pattern of mrnPatterns) {
      const match = text.match(pattern);
      if (match) {
        extractedData.mrn = match[1];
        console.log('✅ MRN提取成功:', extractedData.mrn);
        break;
      }
    }
    
    // 2. 提取税金金额
    // 查找VAT相关的金额信息
    const taxAmountPatterns = [
      /VAT[^0-9]*([0-9,]+\.?[0-9]*)/i,
      /VAT \(PVA\)[^0-9]*([0-9,]+\.?[0-9]*)/i,
      /\[B00\] VAT[^0-9]*([0-9,]+\.?[0-9]*)/i,
      /Payable amount[^0-9]*([0-9,]+\.?[0-9]*)/i,
      /Total tax assessed[^0-9]*([0-9,]+\.?[0-9]*)/i,
      /Tax base[^0-9]*([0-9,]+\.?[0-9]*)/i
    ];
    
    for (const pattern of taxAmountPatterns) {
      const match = text.match(pattern);
      if (match) {
        const amountStr = match[1].replace(/,/g, '');
        const amount = parseFloat(amountStr);
        if (!isNaN(amount) && amount > 0) {
          extractedData.taxAmount = amount;
          console.log('✅ 税金金额提取成功:', extractedData.taxAmount);
          break;
        }
      }
    }
    
    // 3. 提取税金日期
    const datePatterns = [
      /Acceptance date[^0-9]*(\d{2}\/\d{2}\/\d{4})/i,
      /Status date[^0-9]*(\d{2}\/\d{2}\/\d{4})/i,
      /\[54\] Place and date[^0-9]*(\d{2}\/\d{2}\/\d{4})/i,
      /(\d{2}\/\d{2}\/\d{4})/i, // 通用日期格式
      /(\d{4}-\d{2}-\d{2})/i, // ISO日期格式
      /(\d{2}\.\d{2}\.\d{4})/i // 点分隔日期格式
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        let dateStr = match[1];
        // 标准化日期格式
        if (dateStr.includes('/')) {
          // 转换 DD/MM/YYYY 为 YYYY-MM-DD
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        } else if (dateStr.includes('.')) {
          // 转换 DD.MM.YYYY 为 YYYY-MM-DD
          const parts = dateStr.split('.');
          if (parts.length === 3) {
            dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          extractedData.taxDate = dateStr;
          console.log('✅ 税金日期提取成功:', extractedData.taxDate);
          break;
        }
      }
    }
    
    console.log('📄 VAT税单解析结果:', extractedData);
    return extractedData;
    
  } catch (error) {
    console.error('❌ VAT税单PDF解析失败:', error);
    return {
      mrn: '',
      taxAmount: null,
      taxDate: null
    };
  }
};

// 搜索物流信息
router.post('/search', authenticateToken, async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到搜索请求:', JSON.stringify(req.body, null, 2));
  
  try {
    const { shippingIds, filters } = req.body;
    
    // 构建查询条件
    const where = {};
    if (Array.isArray(shippingIds) && shippingIds.length > 0) {
      where.shippingId = {
        [Op.in]: shippingIds
      };
    }

    // 添加筛选条件
    if (filters) {
      // 处理特殊查询
      if (filters.specialQuery === 'pendingWarehouse') {
        // 查询10天内即将到仓的记录，只统计状态为"在途"的记录
        const tenDaysFromNow = new Date();
        tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
        
        where[Op.and] = [
          {
            estimatedWarehouseDate: {
              [Op.and]: [
                { [Op.ne]: null },
                { [Op.lte]: tenDaysFromNow.toISOString().split('T')[0] },
                { [Op.gte]: new Date().toISOString().split('T')[0] }
              ]
            }
          },
          {
            status: '在途'
          }
        ];
      } else if (filters.specialQuery === 'yearlyShipments') {
        // 查询今年发货的记录（发出日期为今年）
        const currentYear = new Date().getFullYear();
        where.departureDate = {
          [Op.and]: [
            { [Op.ne]: null },
            { [Op.gte]: `${currentYear}-01-01` },
            { [Op.lte]: `${currentYear}-12-31` }
          ]
        };
      } else if (filters.specialQuery === 'unuploadedVatReceipt') {
        // 查询目的地为英国且未上传VAT税单的记录
        where[Op.and] = [
          { destinationCountry: '英国' },
          {
            [Op.or]: [
              { vatReceiptUrl: null },
              { vatReceiptUrl: '' }
            ]
          }
        ];
      } else {
        // 处理状态筛选
        if (filters.status) {
          if (Array.isArray(filters.status)) {
            if (filters.status.includes('not_completed')) {
              // 如果包含 not_completed，则查询非完成状态
              const otherStatuses = filters.status.filter(s => s !== 'not_completed');
              if (otherStatuses.length > 0) {
                where[Op.or] = [
                  { status: { [Op.ne]: '完成' } },
                  { status: { [Op.in]: otherStatuses } }
                ];
              } else {
                where.status = { [Op.ne]: '完成' };
              }
            } else {
              where.status = { [Op.in]: filters.status };
            }
          } else if (filters.status === 'not_completed') {
        where.status = { [Op.ne]: '完成' };
          } else {
        where.status = filters.status;
      }
        }

        // 处理其他筛选条件（支持数组和单值）
        const filterFields = [
          'logisticsProvider',
          'channel', 
          'destinationCountry',
          'taxPaymentStatus',
          'taxDeclarationStatus',
          'paymentStatus'
        ];

        filterFields.forEach(field => {
          if (filters[field]) {
            if (Array.isArray(filters[field]) && filters[field].length > 0) {
              where[field] = { [Op.in]: filters[field] };
            } else if (!Array.isArray(filters[field])) {
              where[field] = filters[field];
            }
          }
        });
      }
    }

    console.log('\x1b[35m%s\x1b[0m', '查询条件:', JSON.stringify(where, null, 2));

    const logistics = await Logistics.findAll({
      where,
      order: [['shippingId', 'DESC']]
    });

    console.log('\x1b[32m%s\x1b[0m', '查询结果数量:', logistics.length);

    res.json({
      code: 0,
      message: 'success',
      data: logistics
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '搜索物流信息失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: error.message
    });
  }
});

// 更新单个记录
router.post('/update', authenticateToken, async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到单个记录更新请求:', JSON.stringify(req.body, null, 2));
  
  try {
    const { shippingId, ...updateData } = req.body;
    
    // 验证参数
    if (!shippingId) {
      return res.status(400).json({
        code: 400,
        message: 'shippingId 是必需的'
      });
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        code: 400,
        message: '至少需要提供一个要更新的字段'
      });
    }

    console.log('\x1b[35m%s\x1b[0m', `更新记录 ${shippingId}:`, updateData);

    // 查找记录是否存在
    const existingRecord = await Logistics.findOne({
      where: { shippingId }
    });

    if (!existingRecord) {
      return res.status(404).json({
        code: 404,
        message: '记录不存在'
      });
    }

    // 执行更新
    const [affectedCount] = await Logistics.update(updateData, {
      where: { shippingId }
    });

    console.log('\x1b[32m%s\x1b[0m', '成功更新记录数:', affectedCount);

    // 返回更新后的记录
    const updatedRecord = await Logistics.findOne({
      where: { shippingId }
    });

    res.json({
      code: 0,
      message: 'success',
      data: updatedRecord
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '更新记录失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: error.message
    });
  }
});

// 批量更新多字段
router.post('/batch-update', authenticateToken, async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到批量更新多字段请求:', JSON.stringify(req.body, null, 2));
  
  try {
    const { updates } = req.body;
    
    // 验证参数
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        code: 400,
        message: 'updates 必须是非空数组'
      });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // 逐个处理更新
    for (const updateItem of updates) {
      const { shippingId, updates: updateData } = updateItem;
      
      if (!shippingId || !updateData || Object.keys(updateData).length === 0) {
        console.log('\x1b[33m%s\x1b[0m', `跳过无效的更新项:`, updateItem);
        errorCount++;
        results.push({
          shippingId,
          success: false,
          error: 'shippingId 和 updates 是必需的'
        });
        continue;
      }

      try {
        // 检查记录是否存在
        const existingRecord = await Logistics.findOne({
          where: { shippingId }
        });

        if (!existingRecord) {
          console.log('\x1b[33m%s\x1b[0m', `记录不存在: ${shippingId}`);
          errorCount++;
          results.push({
            shippingId,
            success: false,
            error: '记录不存在'
          });
          continue;
        }

        // 执行更新
        const [affectedCount] = await Logistics.update(updateData, {
          where: { shippingId }
        });

        if (affectedCount > 0) {
          successCount++;
          results.push({
            shippingId,
            success: true,
            updatedFields: Object.keys(updateData)
          });
          console.log('\x1b[32m%s\x1b[0m', `成功更新记录: ${shippingId}`);
        } else {
          errorCount++;
          results.push({
            shippingId,
            success: false,
            error: '更新失败'
          });
        }
      } catch (itemError) {
        console.error('\x1b[31m%s\x1b[0m', `更新记录 ${shippingId} 失败:`, itemError);
        errorCount++;
        results.push({
          shippingId,
          success: false,
          error: itemError.message
        });
      }
    }

    console.log('\x1b[32m%s\x1b[0m', `批量更新完成: 成功 ${successCount} 条，失败 ${errorCount} 条`);

    res.json({
      code: 0,
      message: 'success',
      data: {
        totalCount: updates.length,
        successCount,
        errorCount,
        results
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '批量更新多字段失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: error.message
    });
  }
});

// 批量更新状态
router.post('/batch-update-status', authenticateToken, async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到批量更新状态请求:', JSON.stringify(req.body, null, 2));
  
  try {
    const { shippingIds, status } = req.body;
    
    // 验证参数
    if (!Array.isArray(shippingIds) || shippingIds.length === 0) {
      return res.status(400).json({
        code: 400,
        message: 'shippingIds 必须是非空数组'
      });
    }
    
    if (!status || !['在途', '入库中', '完成'].includes(status)) {
      return res.status(400).json({
        code: 400,
        message: '状态必须是：在途、入库中、完成 中的一种'
      });
    }

    console.log('\x1b[35m%s\x1b[0m', `批量更新 ${shippingIds.length} 条记录状态为: ${status}`);

    // 执行批量更新
    const [affectedCount] = await Logistics.update(
      { status: status },
      {
        where: {
          shippingId: {
            [Op.in]: shippingIds
          }
        }
      }
    );

    console.log('\x1b[32m%s\x1b[0m', '成功更新记录数:', affectedCount);

    res.json({
      code: 0,
      message: 'success',
      data: {
        affectedCount,
        updatedStatus: status,
        shippingIds
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '批量更新状态失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: error.message
    });
  }
});

// 批量更新付款状态
router.post('/batch-update-payment-status', authenticateToken, async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到批量更新付款状态请求:', JSON.stringify(req.body, null, 2));
  
  try {
    const { shippingIds, paymentStatus } = req.body;
    
    // 验证参数
    if (!Array.isArray(shippingIds) || shippingIds.length === 0) {
      return res.status(400).json({
        code: 400,
        message: 'shippingIds 必须是非空数组'
      });
    }
    
    if (!paymentStatus || !['已付', '未付'].includes(paymentStatus)) {
      return res.status(400).json({
        code: 400,
        message: '付款状态必须是：已付、未付 中的一种'
      });
    }

    console.log('\x1b[35m%s\x1b[0m', `批量更新 ${shippingIds.length} 条记录付款状态为: ${paymentStatus}`);

    // 执行批量更新
    const [affectedCount] = await Logistics.update(
      { paymentStatus: paymentStatus },
      {
        where: {
          shippingId: {
            [Op.in]: shippingIds
          }
        }
      }
    );

    console.log('\x1b[32m%s\x1b[0m', '成功更新记录数:', affectedCount);

    res.json({
      code: 0,
      message: 'success',
      data: {
        affectedCount,
        updatedPaymentStatus: paymentStatus,
        shippingIds
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '批量更新付款状态失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: error.message
    });
  }
});

// 批量更新税金状态
router.post('/batch-update-tax-status', authenticateToken, async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到批量更新税金状态请求:', JSON.stringify(req.body, null, 2));
  
  try {
    const { shippingIds, taxPaymentStatus } = req.body;
    
    // 验证参数
    if (!Array.isArray(shippingIds) || shippingIds.length === 0) {
      return res.status(400).json({
        code: 400,
        message: 'shippingIds 必须是非空数组'
      });
    }
    
    if (!taxPaymentStatus || !['已付', '未付'].includes(taxPaymentStatus)) {
      return res.status(400).json({
        code: 400,
        message: '税金状态必须是：已付、未付 中的一种'
      });
    }

    console.log('\x1b[35m%s\x1b[0m', `批量更新 ${shippingIds.length} 条记录税金状态为: ${taxPaymentStatus}`);

    // 执行批量更新
    const [affectedCount] = await Logistics.update(
      { taxPaymentStatus: taxPaymentStatus },
      {
        where: {
          shippingId: {
            [Op.in]: shippingIds
          }
        }
      }
    );

    console.log('\x1b[32m%s\x1b[0m', '成功更新记录数:', affectedCount);

    res.json({
      code: 0,
      message: 'success',
      data: {
        affectedCount,
        updatedTaxPaymentStatus: taxPaymentStatus,
        shippingIds
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '批量更新税金状态失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: error.message
    });
  }
});

// 获取所有可筛选字段的唯一值
router.get('/filters', async (req, res) => {
  try {
    const fieldMap = {
      logisticsProvider: 'logistics_provider',
      channel: 'channel',
      status: 'status',
      destinationCountry: 'destination_country',
      taxPaymentStatus: 'tax_payment_status',
      taxDeclarationStatus: 'tax_declaration_status',
      paymentStatus: 'payment_status'
    };
    const fields = Object.keys(fieldMap);
    const result = {};
    for (const key of fields) {
      const dbField = fieldMap[key];
      try {
        const rows = await Logistics.findAll({
          attributes: [[dbField, 'value']],
          group: [dbField],
          raw: true
        });
        result[key] = rows.map(r => r.value).filter(v => v !== null && v !== '');
      } catch (e) {
        console.error('字段出错:', key, e.message);
        result[key] = [];
      }
    }
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: 500, message: '获取筛选项失败', error: e.message });
  }
});

// 获取统计数据
router.get('/statistics', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到统计数据请求');
  
  try {
    const currentYear = new Date().getFullYear();
    
    // 1. 今年发货票数（只统计发出日期为今年的记录）
    const yearlyCount = await Logistics.count({
      where: {
        departureDate: {
          [Op.and]: [
            { [Op.ne]: null },
            { [Op.gte]: `${currentYear}-01-01` },
            { [Op.lte]: `${currentYear}-12-31` }
          ]
        }
      }
    });

    // 2. 在途产品数
    const transitRecords = await Logistics.findAll({
      where: { status: '在途' },
      attributes: ['productCount'],
      raw: true
    });
    const transitProductCount = transitRecords.reduce((sum, record) => sum + (Number(record.productCount) || 0), 0);

    // 3. 在途箱数
    const transitPackageRecords = await Logistics.findAll({
      where: { status: '在途' },
      attributes: ['packageCount'],
      raw: true
    });
    const transitPackageCount = transitPackageRecords.reduce((sum, record) => sum + (Number(record.packageCount) || 0), 0);

    // 4. 未付总运费
    const unpaidRecords = await Logistics.findAll({
      where: { paymentStatus: '未付' },
      attributes: ['price', 'billingWeight'],
      raw: true
    });
    const unpaidTotalFee = unpaidRecords.reduce((sum, record) => {
      const price = Number(record.price) || 0;
      const weight = Number(record.billingWeight) || 0;
      return sum + (price * weight);
    }, 0);

    // 5. 待调整到仓日货件数（10天内，只统计状态为"在途"的记录）
    const tenDaysFromNow = new Date();
    tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
    
    const pendingWarehouseCount = await Logistics.count({
      where: {
        [Op.and]: [
          {
            estimatedWarehouseDate: {
              [Op.and]: [
                { [Op.ne]: null },
                { [Op.lte]: tenDaysFromNow.toISOString().split('T')[0] },
                { [Op.gte]: new Date().toISOString().split('T')[0] }
              ]
            }
          },
          {
            status: '在途'
          }
        ]
      }
    });

    // 6. 未上传VAT税单数量（目的地为英国且没有VAT税单的记录）
    const unuploadedVatReceiptCount = await Logistics.count({
      where: {
        [Op.and]: [
          { destinationCountry: '英国' },
          {
            [Op.or]: [
              { vatReceiptUrl: null },
              { vatReceiptUrl: '' }
            ]
          }
        ]
      }
    });

    const result = {
      yearlyCount,
      transitProductCount,
      transitPackageCount,
      unpaidTotalFee: Math.round(unpaidTotalFee * 100) / 100, // 保留两位小数
      pendingWarehouseCount,
      unuploadedVatReceiptCount
    };

    console.log('\x1b[32m%s\x1b[0m', '统计数据:', result);

    res.json({
      code: 0,
      message: 'success',
      data: result
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '获取统计数据失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: error.message
    });
  }
});

// 批量删除物流记录
router.post('/batch-delete', authenticateToken, async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔥 收到批量删除物流记录请求');
  console.log('\x1b[36m%s\x1b[0m', '🔍 请求详情:', {
    headers: req.headers,
    body: req.body,
    user: req.user
  });
  
  try {
    const { shippingIds } = req.body;
    
    console.log('\x1b[35m%s\x1b[0m', '📋 接收到的shippingIds:', shippingIds);
    console.log('\x1b[35m%s\x1b[0m', '📋 shippingIds类型:', typeof shippingIds);
    console.log('\x1b[35m%s\x1b[0m', '📋 shippingIds是否为数组:', Array.isArray(shippingIds));
    
    // 验证参数
    if (!Array.isArray(shippingIds) || shippingIds.length === 0) {
      console.log('\x1b[31m%s\x1b[0m', '❌ 参数验证失败 - shippingIds 必须是非空数组');
      return res.status(400).json({
        code: 400,
        message: 'shippingIds 必须是非空数组'
      });
    }

    console.log('\x1b[35m%s\x1b[0m', `✅ 准备删除 ${shippingIds.length} 条物流记录:`, shippingIds);

    // 先查找要删除的记录（用于日志和验证）
    console.log('\x1b[36m%s\x1b[0m', '🔍 查找要删除的记录...');
    const recordsToDelete = await Logistics.findAll({
      where: {
        shippingId: {
          [Op.in]: shippingIds
        }
      },
      attributes: ['shippingId', 'logisticsProvider', 'status']
    });

    console.log('\x1b[36m%s\x1b[0m', `🔍 查找结果: 找到 ${recordsToDelete.length} 条记录`);
    console.log('\x1b[36m%s\x1b[0m', '📋 找到的记录:', recordsToDelete.map(r => ({
      shippingId: r.shippingId,
      logisticsProvider: r.logisticsProvider,
      status: r.status
    })));

    if (recordsToDelete.length === 0) {
      console.log('\x1b[31m%s\x1b[0m', '❌ 没有找到要删除的记录');
      return res.status(404).json({
        code: 404,
        message: '没有找到要删除的记录'
      });
    }

    console.log('\x1b[33m%s\x1b[0m', `🗑️ 开始执行删除操作...`);
    
    // 执行批量删除
    const deletedCount = await Logistics.destroy({
      where: {
        shippingId: {
          [Op.in]: shippingIds
        }
      }
    });

    console.log('\x1b[32m%s\x1b[0m', `✅ 删除操作完成! 成功删除 ${deletedCount} 条物流记录`);

    const responseData = {
      code: 0,
      message: '批量删除成功',
      data: {
        deletedCount,
        requestedCount: shippingIds.length,
        foundCount: recordsToDelete.length,
        deletedRecords: recordsToDelete.map(r => ({
          shippingId: r.shippingId,
          logisticsProvider: r.logisticsProvider,
          status: r.status
        }))
      }
    };
    
    console.log('\x1b[32m%s\x1b[0m', '📤 返回响应:', responseData);
    res.json(responseData);
    
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '💥 批量删除物流记录失败:', error);
    console.error('\x1b[31m%s\x1b[0m', '💥 错误详情:', {
      message: error.message,
      stack: error.stack,
      sql: error.sql
    });
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: error.message
    });
  }
});

// 解析VAT税单PDF（仅解析，不上传）
router.post('/parse-vat-receipt', authenticateToken, upload.single('vatReceipt'), async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到VAT税单解析请求');
  
  try {
    if (!req.file) {
      return res.status(400).json({
        code: 400,
        message: '请选择要解析的PDF文件'
      });
    }
    
    // 解析PDF提取MRN、税金和时间
    const extractedData = await parseVatReceiptPDF(req.file.buffer);
    
    console.log('✅ VAT税单解析成功:', extractedData);
    
    res.json({
      code: 0,
      message: 'VAT税单解析成功',
      data: extractedData
    });
    
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'VAT税单解析失败:', error);
    res.status(500).json({
      code: 500,
      message: 'VAT税单解析失败',
      error: error.message
    });
  }
});

// 上传VAT税单
router.post('/upload-vat-receipt/:shippingId', authenticateToken, upload.single('vatReceipt'), async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到VAT税单上传请求:', req.params.shippingId);
  
  try {
    const { shippingId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        code: 400,
        message: '请选择要上传的PDF文件'
      });
    }
    
    // 验证物流记录是否存在
    const logisticsRecord = await Logistics.findOne({
      where: { shippingId }
    });
    
    if (!logisticsRecord) {
      return res.status(404).json({
        code: 404,
        message: '物流记录不存在'
      });
    }
    
    // 如果已有VAT税单，先删除旧文件
    if (logisticsRecord.vatReceiptObjectName) {
      try {
        await deleteFromOSS(logisticsRecord.vatReceiptObjectName);
        console.log('✅ 删除旧VAT税单文件成功');
      } catch (error) {
        console.warn('⚠️ 删除旧VAT税单文件失败:', error.message);
      }
    }
    
    // 解析PDF提取MRN、税金和时间
    const extractedData = await parseVatReceiptPDF(req.file.buffer);
    
    // 构建文件名，包含shippingId便于识别
    const fileName = `VAT-${shippingId}-${req.file.originalname}`;
    
    // 上传新文件到OSS，使用purchase文件夹
    const uploadResult = await uploadToOSS(req.file.buffer, fileName, 'purchase');
    
    if (!uploadResult.success) {
      throw new Error('文件上传失败');
    }
    
    // 准备更新数据
    const updateData = {
      vatReceiptUrl: uploadResult.url,
      vatReceiptObjectName: uploadResult.name,
      vatReceiptFileName: req.file.originalname,
      vatReceiptFileSize: req.file.size,
      vatReceiptUploadTime: new Date()
    };
    
    // 如果解析到了MRN，更新MRN字段
    if (extractedData.mrn) {
      updateData.mrn = extractedData.mrn;
    }
    
    // 如果解析到了税金金额，更新vatReceiptTaxAmount字段
    if (extractedData.taxAmount) {
      updateData.vatReceiptTaxAmount = extractedData.taxAmount;
    }
    
    // 如果解析到了税金日期，更新vatReceiptTaxDate字段
    if (extractedData.taxDate) {
      updateData.vatReceiptTaxDate = extractedData.taxDate;
    }
    
    // 更新数据库记录
    await Logistics.update(updateData, {
      where: { shippingId }
    });
    
    console.log('✅ VAT税单上传成功:', uploadResult.name);
    console.log('✅ 提取的数据:', extractedData);
    
    res.json({
      code: 0,
      message: 'VAT税单上传成功',
      data: {
        url: uploadResult.url,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        uploadTime: new Date(),
        extractedData: extractedData
      }
    });
    
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'VAT税单上传失败:', error);
    res.status(500).json({
      code: 500,
      message: 'VAT税单上传失败',
      error: error.message
    });
  }
});

// 删除VAT税单
router.delete('/delete-vat-receipt/:shippingId', authenticateToken, async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到VAT税单删除请求:', req.params.shippingId);
  
  try {
    const { shippingId } = req.params;
    
    // 验证物流记录是否存在
    const logisticsRecord = await Logistics.findOne({
      where: { shippingId }
    });
    
    if (!logisticsRecord) {
      return res.status(404).json({
        code: 404,
        message: '物流记录不存在'
      });
    }
    
    if (!logisticsRecord.vatReceiptObjectName) {
      return res.status(404).json({
        code: 404,
        message: '该记录没有VAT税单'
      });
    }
    
    // 从OSS删除文件
    try {
      await deleteFromOSS(logisticsRecord.vatReceiptObjectName);
      console.log('✅ OSS文件删除成功');
    } catch (error) {
      console.warn('⚠️ OSS文件删除失败:', error.message);
      // 继续执行数据库清理，即使OSS删除失败
    }
    
    // 清除数据库中的VAT税单信息
    await Logistics.update({
      vatReceiptUrl: null,
      vatReceiptObjectName: null,
      vatReceiptFileName: null,
      vatReceiptFileSize: null,
      vatReceiptUploadTime: null
    }, {
      where: { shippingId }
    });
    
    console.log('✅ VAT税单删除成功');
    
    res.json({
      code: 0,
      message: 'VAT税单删除成功'
    });
    
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'VAT税单删除失败:', error);
    res.status(500).json({
      code: 500,
      message: 'VAT税单删除失败',
      error: error.message
    });
  }
});

// 获取VAT税单文件（代理方式）
router.get('/vat-receipt/:shippingId/file', authenticateToken, async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到VAT税单文件获取请求:', req.params.shippingId);
  
  try {
    const { shippingId } = req.params;
    
    // 获取物流记录信息
    const logisticsRecord = await Logistics.findOne({
      where: { shippingId }
    });
    
    if (!logisticsRecord) {
      return res.status(404).json({
        code: 404,
        message: '物流记录不存在'
      });
    }
    
    // 检查是否有VAT税单
    if (!logisticsRecord.vatReceiptUrl || !logisticsRecord.vatReceiptObjectName) {
      return res.status(404).json({
        code: 404,
        message: 'VAT税单不存在'
      });
    }
    
    // 从OSS获取文件
    try {
      const OSS = require('ali-oss');
      const client = new OSS({
        region: process.env.OSS_REGION,
        accessKeyId: process.env.OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
        bucket: process.env.OSS_BUCKET,
        endpoint: process.env.OSS_ENDPOINT
      });
      
      console.log('正在获取OSS文件:', logisticsRecord.vatReceiptObjectName);
      
      // 直接获取文件内容
      const result = await client.get(logisticsRecord.vatReceiptObjectName);
      
      // 设置响应头
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${logisticsRecord.vatReceiptFileName || 'VAT税单.pdf'}"`
      });
      
      // 返回文件内容
      res.send(result.content);
      console.log('✅ VAT税单文件获取成功');
      
    } catch (error) {
      console.error('❌ 从OSS获取VAT税单文件失败:', error);
      return res.status(500).json({
        code: 500,
        message: '获取VAT税单文件失败: ' + error.message
      });
    }
    
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '获取VAT税单文件失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取VAT税单文件失败',
      error: error.message
    });
  }
});

module.exports = router;