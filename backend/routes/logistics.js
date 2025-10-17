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
    console.log('📄 PDF文本片段 (后1000字符):', text.substring(text.length - 1000));
    
    const extractedData = {
      mrn: '',
      taxAmount: null,
      taxDate: null
    };
    
    // 1. 提取MRN (Movement Reference Number)
    // MRN通常是25位字符，格式如：25GB7A8H3YNK4P0AR3
    console.log('🔍 开始搜索MRN...');
    
    // 首先尝试直接匹配MRN行，优先查找文档开头的MRN
    const mrnLineMatch = text.match(/MRN:\s*([A-Z0-9Ø]+)/i);
    if (mrnLineMatch) {
      let mrn = mrnLineMatch[1];
      console.log('🔍 从MRN行提取到:', mrn);
      // 将Ø转换为0，然后清理其他特殊字符
      mrn = mrn.replace(/Ø/g, '0').replace(/[^A-Z0-9]/gi, '');
      if (mrn.length >= 15 && mrn.length <= 30) {
        extractedData.mrn = mrn;
        console.log('✅ MRN提取成功:', extractedData.mrn);
      }
    }
    
    // 如果没找到，尝试更精确的搜索
    if (!extractedData.mrn) {
      console.log('🔍 尝试更精确的MRN搜索...');
      
      // 按行分割文本，优先查找文档前几行的MRN
      const lines = text.split('\n');
      console.log('📊 文档总行数:', lines.length);
      console.log('📊 前10行内容:');
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        console.log(`  行${i + 1}: "${lines[i]}"`);
      }
      
      // 优先查找前20行中的MRN
      for (let i = 0; i < Math.min(20, lines.length); i++) {
        const line = lines[i].trim();
        
        // 查找包含MRN的行
        if (line.includes('MRN') || line.includes('Movement Reference Number')) {
          console.log(`🔍 找到MRN相关行${i + 1}: "${line}"`);
          
          // 尝试提取MRN号码 - 使用更精确的正则表达式
          let mrnMatch = line.match(/Movement Reference Number \(MRN\): ([A-Z0-9Ø]+)/i);
          if (!mrnMatch) {
            mrnMatch = line.match(/MRN: ([A-Z0-9Ø]+)/i);
          }
          if (!mrnMatch) {
            mrnMatch = line.match(/([A-Z0-9Ø]{25})/i);
          }
          
          if (mrnMatch) {
            let mrn = mrnMatch[1];
            console.log('🔍 从行中提取到MRN:', mrn);
            // 将Ø转换为0，然后清理其他特殊字符
            mrn = mrn.replace(/Ø/g, '0').replace(/[^A-Z0-9]/gi, '');
            if (mrn.length >= 15 && mrn.length <= 30) {
              // 排除Bank Reference（通常以GB开头且包含BARC）
              if (!mrn.includes('BARC') && !mrn.startsWith('GB16')) {
                extractedData.mrn = mrn;
                console.log('✅ MRN提取成功 (从行搜索):', extractedData.mrn);
                break;
              } else {
                console.log('🔍 跳过Bank Reference:', mrn);
              }
            }
          }
        }
      }
    }
    
    // 如果还是没找到，使用正则表达式模式匹配
    if (!extractedData.mrn) {
      console.log('🔍 使用正则表达式模式匹配MRN...');
      const mrnPatterns = [
        /MRN[：:\s]*([A-Z0-9Ø]{25})/i,
        /Movement Reference Number[：:\s]*([A-Z0-9Ø]{25})/i,
        /([A-Z]{2}[A-Z0-9Ø]{23})/i, // 2位国家代码 + 23位字符
        /([A-Z0-9Ø]{25})/i, // 25位字母数字组合（包含特殊字符）
        // 更宽松的模式，处理OCR识别可能的错误
        /([A-Z0-9Ø]{20,30})/i // 20-30位字符，适应OCR可能的识别误差
      ];
      
      for (const pattern of mrnPatterns) {
        const match = text.match(pattern);
        if (match) {
          let mrn = match[1];
          console.log('🔍 正则匹配到可能的MRN:', mrn);
          // 将Ø转换为0，然后清理其他特殊字符
          mrn = mrn.replace(/Ø/g, '0').replace(/[^A-Z0-9]/gi, '');
          console.log('🔍 清理后的MRN:', mrn, '长度:', mrn.length);
          // 如果长度接近25位，认为是有效的MRN
          if (mrn.length >= 15 && mrn.length <= 30) {
            // 排除Bank Reference（通常以GB开头且包含BARC）
            if (!mrn.includes('BARC') && !mrn.startsWith('GB16')) {
              extractedData.mrn = mrn;
              console.log('✅ MRN提取成功 (正则匹配):', extractedData.mrn);
              break;
            } else {
              console.log('🔍 跳过Bank Reference:', mrn);
            }
          }
        }
      }
    }
    
    // 最后备用方法：搜索所有可能的25位字符组合，但排除Bank Reference
    if (!extractedData.mrn) {
      console.log('⚠️ 未找到MRN，尝试搜索所有可能的25位字符组合（排除Bank Reference）...');
      // 搜索所有可能的25位字符组合
      const allMatches = text.match(/[A-Z0-9Ø]{20,30}/gi);
      if (allMatches) {
        console.log('🔍 找到的所有可能MRN:', allMatches);
        for (const match of allMatches) {
          // 将Ø转换为0，然后清理其他特殊字符
          const cleaned = match.replace(/Ø/g, '0').replace(/[^A-Z0-9]/gi, '');
          if (cleaned.length >= 15 && cleaned.length <= 30) {
            // 排除Bank Reference（通常以GB开头且包含BARC）
            if (!cleaned.includes('BARC') && !cleaned.startsWith('GB16')) {
              extractedData.mrn = cleaned;
              console.log('✅ MRN提取成功 (备用方法):', extractedData.mrn);
              break;
            } else {
              console.log('🔍 跳过Bank Reference:', cleaned);
            }
          }
        }
      }
    }
    
    // 2. 提取税金金额 - 重点查找Amount Payable列最下面的金额
    console.log('🔍 开始搜索税金金额...');
    
    // 按行分割文本，查找右下角的金额
    const lines = text.split('\n');
    let foundAmount = false;
    
    console.log('📊 文档总行数:', lines.length);
    console.log('📊 最后10行内容:');
    for (let i = Math.max(0, lines.length - 10); i < lines.length; i++) {
      console.log(`  行${i + 1}: "${lines[i]}"`);
    }
    
    // 优先查找Amount Payable相关的金额
    console.log('🔍 优先查找Amount Payable相关金额...');
    
    // 首先尝试查找Amount Payable列最下面的金额
    const amountPayablePatterns = [
      /Amount Payable[^0-9]*([0-9,]+\.?[0-9]*)/i,
      /Amount Payable[^0-9]*\n[^0-9]*([0-9,]+\.?[0-9]*)/i,
      /Payable amount[^0-9]*([0-9,]+\.?[0-9]*)/i,
      /Total amount payable[^0-9]*([0-9,]+\.?[0-9]*)/i
    ];
    
    for (const pattern of amountPayablePatterns) {
      const match = text.match(pattern);
      if (match) {
        const amountStr = match[1].replace(/,/g, '');
        const amount = parseFloat(amountStr);
        console.log(`🔍 Amount Payable匹配到金额: ${amountStr} -> ${amount}`);
        if (!isNaN(amount) && amount > 0 && amount < 10000) {
          extractedData.taxAmount = amount;
          console.log('✅ 税金金额提取成功 (Amount Payable):', extractedData.taxAmount);
          foundAmount = true;
          break;
        }
      }
    }
    
    // 如果没找到，尝试查找文档中所有金额，优先选择最下面的
    if (!foundAmount) {
      console.log('🔍 查找文档中所有金额，优先选择最下面的...');
      const allAmountMatches = text.match(/[0-9,]+\.?[0-9]*/g);
      if (allAmountMatches) {
        console.log('🔍 找到的所有金额:', allAmountMatches);
        // 从后往前查找，优先选择最下面的金额
        for (let i = allAmountMatches.length - 1; i >= 0; i--) {
          const amountStr = allAmountMatches[i].replace(/,/g, '');
          const amount = parseFloat(amountStr);
          console.log(`🔍 检查金额${i + 1}: ${amountStr} -> ${amount}`);
          if (!isNaN(amount) && amount > 0 && amount < 10000) {
            // 检查这个金额是否在文档的后面部分
            const amountIndex = text.lastIndexOf(allAmountMatches[i]);
            const textLength = text.length;
            // 如果金额在文档的后30%部分，认为是Amount Payable列最下面的金额
            if (amountIndex > textLength * 0.7) {
              extractedData.taxAmount = amount;
              console.log('✅ 税金金额提取成功 (最下面金额):', extractedData.taxAmount);
              foundAmount = true;
              break;
            }
          }
        }
      }
    }
    
    // 如果没找到Amount Payable，从后往前查找，优先查找文档末尾的金额
    if (!foundAmount) {
      console.log('🔍 从后往前查找金额...');
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        
        // 跳过包含日期的行
        if (line.match(/\d{2}\/\d{2}\/\d{4}/)) {
          console.log(`🔍 跳过日期行${i + 1}: "${line}"`);
          continue;
        }
        // 跳过包含[54]的行
        if (line.includes('[54]')) {
          console.log(`🔍 跳过[54]行${i + 1}: "${line}"`);
          continue;
        }
        // 跳过包含"Generated by"的行
        if (line.includes('Generated by')) {
          console.log(`🔍 跳过Generated by行${i + 1}: "${line}"`);
          continue;
        }
        // 跳过包含"Bank Reference"的行
        if (line.includes('Bank Reference')) {
          console.log(`🔍 跳过Bank Reference行${i + 1}: "${line}"`);
          continue;
        }
        
        // 查找包含数字的行
        const amountMatch = line.match(/([0-9,]+\.?[0-9]*)/);
        if (amountMatch) {
          const amountStr = amountMatch[1].replace(/,/g, '');
          const amount = parseFloat(amountStr);
          console.log(`🔍 行${i + 1}找到金额: ${amountStr} -> ${amount}`);
          if (!isNaN(amount) && amount > 0 && amount < 10000) { // 合理的税金范围
            extractedData.taxAmount = amount;
            console.log('✅ 税金金额提取成功 (从行尾):', extractedData.taxAmount);
            foundAmount = true;
            break;
          }
        }
      }
    }
    
    // 如果还是没找到，使用其他正则表达式查找
    if (!foundAmount) {
      console.log('🔍 使用其他正则表达式查找金额...');
      const taxAmountPatterns = [
        // VAT相关金额
        /VAT[^0-9]*([0-9,]+\.?[0-9]*)/i,
        /VAT \(PVA\)[^0-9]*([0-9,]+\.?[0-9]*)/i,
        /\[B00\] VAT[^0-9]*([0-9,]+\.?[0-9]*)/i,
        /Total tax assessed[^0-9]*([0-9,]+\.?[0-9]*)/i,
        /Tax base[^0-9]*([0-9,]+\.?[0-9]*)/i,
        // 查找表格中的金额，通常在右下角
        /([0-9,]+\.?[0-9]*)\s*$/m, // 行末的金额
        /([0-9,]+\.?[0-9]*)\s*\n\s*$/m, // 文档末尾的金额
      ];
      
      for (const pattern of taxAmountPatterns) {
        const match = text.match(pattern);
        if (match) {
          const amountStr = match[1].replace(/,/g, '');
          const amount = parseFloat(amountStr);
          console.log(`🔍 正则匹配到金额: ${amountStr} -> ${amount}`);
          if (!isNaN(amount) && amount > 0 && amount < 10000) {
            extractedData.taxAmount = amount;
            console.log('✅ 税金金额提取成功:', extractedData.taxAmount);
            break;
          }
        }
      }
    }
    
    // 3. 提取税金日期 - 重点查找Place and date部分，确保格式为YYYY-MM-DD
    const datePatterns = [
      // 优先查找Place and date相关
      /\[54\] Place and date[^0-9]*(\d{2}\/\d{2}\/\d{4})/i,
      /Place and date[^0-9]*(\d{2}\/\d{2}\/\d{4})/i,
      // 查找包含地点和日期的行
      /([A-Za-z]+)\s+(\d{2}\/\d{2}\/\d{4})/i, // 地点 日期格式
      // 其他日期格式
      /Acceptance date[^0-9]*(\d{2}\/\d{2}\/\d{4})/i,
      /Status date[^0-9]*(\d{2}\/\d{2}\/\d{4})/i,
      /(\d{2}\/\d{2}\/\d{4})/i, // 通用日期格式
      /(\d{4}-\d{2}-\d{2})/i, // ISO日期格式
      /(\d{2}\.\d{2}\.\d{4})/i // 点分隔日期格式
    ];
    
    console.log('🔍 开始搜索税金日期...');
    // 查找包含"Place and date"的行
    const placeAndDateLine = lines.find(line => 
      line.includes('Place and date') || line.includes('[54]')
    );
    
    if (placeAndDateLine) {
      console.log('📅 找到Place and date行:', placeAndDateLine);
      // 查找下一行的日期
      const lineIndex = lines.findIndex(line => line.includes('Place and date') || line.includes('[54]'));
      if (lineIndex >= 0 && lineIndex + 1 < lines.length) {
        const nextLine = lines[lineIndex + 1].trim();
        console.log('📅 下一行内容:', nextLine);
        const dateMatch = nextLine.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (dateMatch) {
          let dateStr = dateMatch[1];
          console.log('📅 提取到日期:', dateStr);
          // 标准化日期格式为YYYY-MM-DD
          if (dateStr.includes('/')) {
            // 转换 DD/MM/YYYY 为 YYYY-MM-DD
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
          
          if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            extractedData.taxDate = dateStr;
            console.log('✅ 税金日期提取成功 (从Place and date):', extractedData.taxDate);
          }
        }
      }
    }
    
    // 如果没找到，使用正则表达式查找
    if (!extractedData.taxDate) {
      console.log('🔍 从Place and date未找到日期，使用正则表达式查找...');
      for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
          let dateStr = match[1];
          console.log('📅 正则匹配到日期:', dateStr);
          // 标准化日期格式为YYYY-MM-DD
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
    
    if (!status || !['在途', '查验中', '入库中', '完成'].includes(status)) {
      return res.status(400).json({
        code: 400,
        message: '状态必须是：在途、查验中、入库中、完成 中的一种'
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

    // 2. 在途产品数（包含"查验中"状态）
    const transitRecords = await Logistics.findAll({
      where: { 
        status: {
          [Op.in]: ['在途', '查验中']
        }
      },
      attributes: ['productCount'],
      raw: true
    });
    const transitProductCount = transitRecords.reduce((sum, record) => sum + (Number(record.productCount) || 0), 0);

    // 3. 在途箱数（包含"查验中"状态）
    const transitPackageRecords = await Logistics.findAll({
      where: { 
        status: {
          [Op.in]: ['在途', '查验中']
        }
      },
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

    // 7. 查验中记录数量
    const inspectingCount = await Logistics.count({
      where: { status: '查验中' }
    });

    const result = {
      yearlyCount,
      transitProductCount,
      transitPackageCount,
      unpaidTotalFee: Math.round(unpaidTotalFee * 100) / 100, // 保留两位小数
      pendingWarehouseCount,
      unuploadedVatReceiptCount,
      inspectingCount
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
    
    // 获取前端发送的解析数据
    const frontendMrn = req.body.mrn;
    const frontendTaxAmount = req.body.taxAmount;
    const frontendTaxDate = req.body.taxDate;
    
    // 解析PDF提取MRN、税金和时间（作为备用）
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
    
    // 优先使用前端发送的数据，如果没有则使用PDF解析的数据
    if (frontendMrn && frontendMrn.trim()) {
      updateData.mrn = frontendMrn.trim();
    } else if (extractedData.mrn) {
      updateData.mrn = extractedData.mrn;
    }
    
    if (frontendTaxAmount && !isNaN(parseFloat(frontendTaxAmount))) {
      updateData.vatReceiptTaxAmount = parseFloat(frontendTaxAmount);
    } else if (extractedData.taxAmount) {
      updateData.vatReceiptTaxAmount = extractedData.taxAmount;
    }
    
    if (frontendTaxDate && frontendTaxDate.trim()) {
      updateData.vatReceiptTaxDate = frontendTaxDate.trim();
    } else if (extractedData.taxDate) {
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

// 更新VAT税单信息
router.put('/update-vat-receipt/:shippingId', authenticateToken, async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到VAT税单信息更新请求:', req.params.shippingId);
  
  try {
    const { shippingId } = req.params;
    const { mrn, taxAmount, taxDate } = req.body;
    
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
    
    // 更新VAT税单信息
    const updateData = {};
    
    if (mrn !== undefined) {
      updateData.mrn = mrn;
    }
    
    if (taxAmount !== undefined) {
      updateData.vatReceiptTaxAmount = taxAmount;
    }
    
    if (taxDate !== undefined) {
      updateData.vatReceiptTaxDate = taxDate;
    }
    
    await Logistics.update(updateData, {
      where: { shippingId }
    });
    
    console.log('✅ VAT税单信息更新成功');
    
    res.json({
      code: 0,
      message: 'VAT税单信息更新成功',
      data: updateData
    });
    
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'VAT税单信息更新失败:', error);
    res.status(500).json({
      code: 500,
      message: 'VAT税单信息更新失败',
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
  console.log('用户信息:', req.user);
  
  try {
    const { shippingId } = req.params;
    
    // 验证shippingId格式
    if (!shippingId || typeof shippingId !== 'string') {
      console.error('❌ 无效的shippingId:', shippingId);
      return res.status(400).json({
        code: 400,
        message: '无效的货件ID'
      });
    }
    
    // 获取物流记录信息
    const logisticsRecord = await Logistics.findOne({
      where: { shippingId }
    });
    
    if (!logisticsRecord) {
      console.error('❌ 物流记录不存在:', shippingId);
      return res.status(404).json({
        code: 404,
        message: '物流记录不存在'
      });
    }
    
    console.log('✅ 找到物流记录:', {
      shippingId: logisticsRecord.shippingId,
      destinationCountry: logisticsRecord.destinationCountry,
      vatReceiptUrl: logisticsRecord.vatReceiptUrl ? '存在' : '不存在',
      vatReceiptObjectName: logisticsRecord.vatReceiptObjectName ? '存在' : '不存在'
    });
    
    // 检查是否有VAT税单
    if (!logisticsRecord.vatReceiptUrl || !logisticsRecord.vatReceiptObjectName) {
      console.error('❌ VAT税单不存在:', {
        vatReceiptUrl: !!logisticsRecord.vatReceiptUrl,
        vatReceiptObjectName: !!logisticsRecord.vatReceiptObjectName
      });
      return res.status(404).json({
        code: 404,
        message: 'VAT税单不存在'
      });
    }
    
    // 从OSS获取文件
    try {
      const OSS = require('ali-oss');
      
      // 检查OSS配置
      const ossConfig = {
        region: process.env.OSS_REGION,
        accessKeyId: process.env.OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
        bucket: process.env.OSS_BUCKET,
        endpoint: process.env.OSS_ENDPOINT
      };
      
      console.log('OSS配置检查:', {
        region: !!ossConfig.region,
        accessKeyId: !!ossConfig.accessKeyId,
        accessKeySecret: !!ossConfig.accessKeySecret,
        bucket: !!ossConfig.bucket,
        endpoint: !!ossConfig.endpoint
      });
      
      // 验证必要的OSS配置
      const requiredConfig = ['OSS_REGION', 'OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET', 'OSS_BUCKET'];
      const missingConfig = requiredConfig.filter(key => !process.env[key]);
      
      if (missingConfig.length > 0) {
        console.error('❌ OSS配置缺失:', missingConfig);
        return res.status(500).json({
          code: 500,
          message: 'OSS配置不完整，请联系管理员'
        });
      }
      
      const client = new OSS(ossConfig);
      
      console.log('正在获取OSS文件:', logisticsRecord.vatReceiptObjectName);
      
      // 检查文件是否存在
      try {
        const existsResult = await client.head(logisticsRecord.vatReceiptObjectName);
        console.log('✅ OSS文件存在:', {
          size: existsResult.res.headers['content-length'],
          lastModified: existsResult.res.headers['last-modified']
        });
      } catch (headError) {
        console.error('❌ OSS文件不存在:', headError.message);
        return res.status(404).json({
          code: 404,
          message: 'VAT税单文件在OSS中不存在'
        });
      }
      
      // 直接获取文件内容
      const result = await client.get(logisticsRecord.vatReceiptObjectName);
      
      console.log('✅ 成功获取OSS文件:', {
        size: result.content.length,
        type: result.res.headers['content-type']
      });
      
      // 验证文件内容
      if (!result.content || result.content.length === 0) {
        console.error('❌ 获取到的文件内容为空');
        return res.status(500).json({
          code: 500,
          message: 'VAT税单文件内容为空'
        });
      }
      
      // 设置响应头
      const fileName = logisticsRecord.vatReceiptFileName || 'VAT税单.pdf';
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': result.content.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      // 返回文件内容
      res.send(result.content);
      console.log('✅ VAT税单文件获取成功，已发送给客户端');
      
    } catch (ossError) {
      console.error('❌ 从OSS获取VAT税单文件失败:', ossError);
      
      // 提供更详细的错误信息
      let errorMessage = '获取VAT税单文件失败';
      if (ossError.code === 'AccessDenied') {
        errorMessage = 'OSS访问权限不足，请联系管理员';
      } else if (ossError.code === 'NoSuchKey') {
        errorMessage = 'VAT税单文件在OSS中不存在';
      } else if (ossError.code === 'NetworkingError') {
        errorMessage = 'OSS网络连接失败，请稍后重试';
      } else {
        errorMessage = `获取VAT税单文件失败: ${ossError.message}`;
      }
      
      return res.status(500).json({
        code: 500,
        message: errorMessage,
        error: ossError.message
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

// 修复编码问题的函数
const fixEncoding = (text) => {
  if (!text) return text;
  
  try {
    // 检测是否包含乱码字符
    const hasMojibake = /[\u00C0-\u00FF]/.test(text);
    
    if (hasMojibake) {
      // 尝试多种编码修复方法
      const encodings = ['latin1', 'iso-8859-1', 'cp1252'];
      
      for (const encoding of encodings) {
        try {
          const fixed = Buffer.from(text, encoding).toString('utf8');
          if (!/[\u00C0-\u00FF]/.test(fixed)) {
            console.log(`✅ 编码修复成功: ${encoding} -> utf8`);
            return fixed;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    return text;
  } catch (error) {
    console.error('编码修复失败:', error);
    return text;
  }
};

// 安全处理中文文件名的函数
const sanitizeFileName = (fileName) => {
  if (!fileName) return null;
  
  try {
    // 首先尝试修复编码问题
    let safeName = fixEncoding(fileName);
    
    // 移除或替换不安全的字符
    safeName = safeName
      .replace(/[<>:"/\\|?*]/g, '_') // 替换Windows不允许的字符
      .replace(/\s+/g, '_') // 替换空格为下划线
      .replace(/\u0000/g, '') // 移除null字符
      .trim();
    
    // 确保文件名不为空
    if (!safeName || safeName === '') {
      return 'VAT税单.pdf';
    }
    
    // 确保以.pdf结尾
    if (!safeName.toLowerCase().endsWith('.pdf')) {
      safeName += '.pdf';
    }
    
    return safeName;
  } catch (error) {
    console.error('文件名处理错误:', error);
    return `${Date.now()}_VAT税单.pdf`;
  }
};

// 导出VAT税单
router.post('/export-vat-receipts', authenticateToken, async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到导出VAT税单请求:', JSON.stringify(req.body, null, 2));
  
  try {
    const { startDate, endDate, destinationCountry = '英国' } = req.body;
    
    // 验证参数
    if (!startDate || !endDate) {
      return res.status(400).json({
        code: 400,
        message: '开始日期和结束日期是必需的'
      });
    }

    console.log('\x1b[35m%s\x1b[0m', '查询条件:', {
      startDate,
      endDate,
      destinationCountry
    });

    // 查询符合条件的VAT税单记录（包含OSS对象名）
    const vatReceipts = await Logistics.findAll({
      where: {
        [Op.and]: [
          { destinationCountry: destinationCountry },
          { vatReceiptUrl: { [Op.ne]: null } },
          { vatReceiptUrl: { [Op.ne]: '' } },
          {
            vatReceiptTaxDate: {
              [Op.and]: [
                { [Op.ne]: null },
                { [Op.gte]: startDate },
                { [Op.lte]: endDate }
              ]
            }
          }
        ]
      },
      order: [['vatReceiptTaxDate', 'ASC']],
      attributes: [
        'shippingId',
        'logisticsProvider',
        'channel',
        'trackingNumber',
        'packageCount',
        'productCount',
        'departureDate',
        'sailingDate',
        'estimatedArrivalDate',
        'estimatedWarehouseDate',
        'destinationWarehouse',
        'price',
        'billingWeight',
        'mrn',
        'customsDuty',
        'vatReceiptTaxAmount',
        'vatReceiptTaxDate',
        'vatReceiptFileName',
        'vatReceiptUploadTime',
        'vatReceiptObjectName' // 添加OSS对象名
      ]
    });

    console.log('\x1b[32m%s\x1b[0m', '查询结果数量:', vatReceipts.length);

    if (vatReceipts.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '在指定时间范围内没有找到VAT税单记录'
      });
    }

    // 生成Excel文件
    const XLSX = require('xlsx');
    
    // 准备Excel数据
    const excelData = vatReceipts.map((record, index) => ({
      '序号': index + 1,
      'Shipping ID': record.shippingId,
      '物流商': record.logisticsProvider,
      '渠道': record.channel,
      '跟踪号': record.trackingNumber,
      '箱数': record.packageCount,
      '产品数': record.productCount,
      '发出日期': record.departureDate ? new Date(record.departureDate).toLocaleDateString('zh-CN') : '',
      '开航日': record.sailingDate ? new Date(record.sailingDate).toLocaleDateString('zh-CN') : '',
      '预计到港日': record.estimatedArrivalDate ? new Date(record.estimatedArrivalDate).toLocaleDateString('zh-CN') : '',
      '预计到仓日': record.estimatedWarehouseDate ? new Date(record.estimatedWarehouseDate).toLocaleDateString('zh-CN') : '',
      '目的地仓库': record.destinationWarehouse,
      '运费': record.price,
      '计费重量': record.billingWeight,
      'MRN': record.mrn,
      '关税': record.customsDuty,
      'VAT税额': record.vatReceiptTaxAmount,
      'VAT税单日期': record.vatReceiptTaxDate ? new Date(record.vatReceiptTaxDate).toLocaleDateString('zh-CN') : '',
      'VAT税单文件名': record.vatReceiptFileName,
      'VAT税单上传时间': record.vatReceiptUploadTime ? new Date(record.vatReceiptUploadTime).toLocaleDateString('zh-CN') : ''
    }));

    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // 设置列宽
    const columnWidths = [
      { wch: 8 },   // 序号
      { wch: 15 },  // Shipping ID
      { wch: 12 },  // 物流商
      { wch: 15 },  // 渠道
      { wch: 15 },  // 跟踪号
      { wch: 8 },   // 箱数
      { wch: 8 },   // 产品数
      { wch: 12 },  // 发出日期
      { wch: 12 },  // 开航日
      { wch: 12 },  // 预计到港日
      { wch: 12 },  // 预计到仓日
      { wch: 15 },  // 目的地仓库
      { wch: 10 },  // 运费
      { wch: 10 },  // 计费重量
      { wch: 20 },  // MRN
      { wch: 10 },  // 关税
      { wch: 12 },  // VAT税额
      { wch: 12 },  // VAT税单日期
      { wch: 20 },  // VAT税单文件名
      { wch: 15 }   // VAT税单上传时间
    ];
    worksheet['!cols'] = columnWidths;

    // 添加工作表到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, 'VAT税单列表');

    // 生成Excel文件
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 创建ZIP文件
    const archiver = require('archiver');
    const archive = archiver('zip', {
      zlib: { level: 9 }, // 设置压缩级别
      forceZip64: true, // 强制使用ZIP64格式以支持大文件
      store: false // 不存储，使用压缩
    });

    // 设置响应头
    const folderName = `英国VAT税单_${startDate}_${endDate}`;
    const zipFileName = `${folderName}.zip`;
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(zipFileName)}`,
      'Content-Transfer-Encoding': 'binary',
      'Cache-Control': 'no-cache'
    });

    // 将ZIP流连接到响应
    archive.pipe(res);

    // 添加Excel文件到ZIP
    archive.append(excelBuffer, { 
      name: `${folderName}/VAT税单列表.xlsx`,
      type: 'file'
    });

    // 从OSS获取PDF文件并添加到ZIP
    console.log('\x1b[35m%s\x1b[0m', '开始从OSS获取PDF文件...');
    
    try {
      const OSS = require('ali-oss');
      
      // 检查OSS配置
      const ossConfig = {
        region: process.env.OSS_REGION,
        accessKeyId: process.env.OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
        bucket: process.env.OSS_BUCKET,
        endpoint: process.env.OSS_ENDPOINT,
        timeout: 30000 // 设置30秒超时
      };
      
      // 验证必要的OSS配置
      const requiredConfig = ['OSS_REGION', 'OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET', 'OSS_BUCKET'];
      const missingConfig = requiredConfig.filter(key => !process.env[key]);
      
      if (missingConfig.length > 0) {
        console.error('❌ OSS配置缺失:', missingConfig);
        throw new Error('OSS配置不完整，无法获取PDF文件');
      }
      
      const client = new OSS(ossConfig);
      
      // 并发处理PDF文件，限制并发数量避免过载
      const concurrencyLimit = 5; // 最多同时处理5个PDF文件
      let pdfCount = 0;
      let processedCount = 0;
      
      const processPdfFile = async (record) => {
        if (!record.vatReceiptObjectName) return;
        
        try {
          console.log(`📄 正在获取PDF文件: ${record.shippingId} -> ${record.vatReceiptObjectName}`);
          
          // 设置超时控制
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('PDF文件获取超时')), 20000); // 20秒超时
          });
          
          // 检查文件是否存在
          const headPromise = client.head(record.vatReceiptObjectName);
          await Promise.race([headPromise, timeoutPromise]);
          
          // 获取文件内容
          const getPromise = client.get(record.vatReceiptObjectName);
          const result = await Promise.race([getPromise, timeoutPromise]);
          
          if (result.content && result.content.length > 0) {
            // 生成安全的文件名
            const safeFileName = sanitizeFileName(record.vatReceiptFileName) || 
              `${record.shippingId}_VAT税单.pdf`;
            
            // 添加到ZIP，使用UTF-8编码
            archive.append(result.content, { 
              name: `${folderName}/PDF文件/${safeFileName}`,
              type: 'file'
            });
            
            pdfCount++;
            console.log(`✅ 成功添加PDF文件: ${safeFileName}`);
          } else {
            console.warn(`⚠️ PDF文件内容为空: ${record.shippingId}`);
          }
        } catch (pdfError) {
          console.error(`❌ 获取PDF文件失败 ${record.shippingId}:`, pdfError.message);
          // 继续处理其他文件，不中断整个流程
        } finally {
          processedCount++;
        }
      };
      
      // 分批处理PDF文件
      const recordsWithPdf = vatReceipts.filter(record => record.vatReceiptObjectName);
      const batches = [];
      for (let i = 0; i < recordsWithPdf.length; i += concurrencyLimit) {
        batches.push(recordsWithPdf.slice(i, i + concurrencyLimit));
      }
      
      for (const batch of batches) {
        await Promise.all(batch.map(processPdfFile));
        console.log(`📊 已处理 ${processedCount}/${recordsWithPdf.length} 个PDF文件`);
      }
      
      console.log(`📊 PDF文件处理完成: 成功添加 ${pdfCount}/${recordsWithPdf.length} 个PDF文件`);
      
    } catch (ossError) {
      console.error('❌ OSS操作失败:', ossError);
      // 即使OSS失败，也要完成ZIP文件的创建
      console.log('⚠️ 继续创建ZIP文件，但不包含PDF文件');
    }

    // 完成ZIP文件
    await archive.finalize();
    
    console.log('\x1b[32m%s\x1b[0m', 'VAT税单ZIP包导出成功');

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '导出VAT税单失败:', error);
    res.status(500).json({
      code: 500,
      message: '导出VAT税单失败',
      error: error.message
    });
  }
});

module.exports = router;