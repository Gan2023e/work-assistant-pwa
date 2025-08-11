const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const ProductWeblink = require('../models/ProductWeblink');
const SellerInventorySku = require('../models/SellerInventorySku');
const TemplateLink = require('../models/TemplateLink');
const ProductInformation = require('../models/ProductInformation');
const multer = require('multer');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const pdf = require('pdf-parse');
const xlsx = require('xlsx');
const { uploadToOSS, deleteFromOSS } = require('../utils/oss');

// 配置multer用于文件上传
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  },
  fileFilter: (req, file, cb) => {
    // 允许Excel文件
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];
    
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}，请上传Excel文件(.xlsx或.xls)`));
    }
  }
});

// 配置CPC文件上传中间件
const cpcStorage = multer.memoryStorage();
const cpcUpload = multer({
  storage: cpcStorage,
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

// 搜索功能（优化后）
router.post('/search', async (req, res) => {
  try {
    const { keywords, searchType = 'auto', isFuzzy = true } = req.body;
    console.log('🔍 后端收到搜索请求:', { keywords, searchType, isFuzzy });
    
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.json({ data: [] });
    }

    let orConditions = [];

    // 根据搜索类型构建不同的查询条件
    if (searchType === 'sku') {
      // 搜索SKU
      orConditions = keywords.map(keyword => {
        if (isFuzzy) {
          // 模糊搜索
          console.log(`🔍 构建模糊搜索条件: parent_sku LIKE %${keyword}%`);
          return { parent_sku: { [Op.like]: `%${keyword}%` } };
        } else {
          // 精确搜索
          console.log(`🔍 构建精确搜索条件: parent_sku = ${keyword}`);
          return { parent_sku: keyword };
        }
      });
    } else if (searchType === 'weblink') {
      // 搜索产品链接/ID - 只支持模糊搜索
      orConditions = keywords.map(keyword => ({
        weblink: { [Op.like]: `%${keyword}%` }
      }));
    } else {
      // 默认模式（auto）- 同时搜索SKU和产品链接
      orConditions = keywords.map(keyword => ({
        [Op.or]: [
          { parent_sku: { [Op.like]: `%${keyword}%` } },
          { weblink: { [Op.like]: `%${keyword}%` } }
        ]
      }));
    }
    
    console.log('🔍 最终查询条件:', JSON.stringify(orConditions, null, 2));

    const result = await ProductWeblink.findAll({
      where: {
        [Op.or]: orConditions
      },
      attributes: [
        'id',
        'parent_sku',
        'weblink',
        'update_time',
        'check_time',
        'status',
        'notice',
        'cpc_status',
        'cpc_submit',
        'model_number',
        'recommend_age',
        'ads_add',
        'list_parent_sku',
        'no_inventory_rate',
        'sales_30days',
        'seller_name',
        'cpc_files'
      ]
    });

    res.json({ data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 批量更新状态
router.post('/batch-update-status', async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: '请选择要更新的记录' });
    }

    await ProductWeblink.update(
      { status },
      {
        where: {
          id: { [Op.in]: ids }
        }
      }
    );

    res.json({ message: '批量更新成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 批量发送CPC测试申请
router.post('/batch-send-cpc-test', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: '请选择要申请测试的记录' });
    }

    // 更新选中记录的CPC测试状态为"申请测试"
    await ProductWeblink.update(
      { cpc_status: '申请测试' },
      {
        where: {
          id: { [Op.in]: ids }
        }
      }
    );

    // 发送钉钉通知
    try {
      await sendCpcTestNotification(ids.length);
    } catch (notificationError) {
      console.error('钉钉通知发送失败，但不影响数据更新:', notificationError.message);
    }

    res.json({ message: `成功提交 ${ids.length} 条CPC测试申请` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 批量标记CPC样品已发
router.post('/batch-mark-cpc-sample-sent', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: '请选择要标记的记录' });
    }

    // 更新选中记录的CPC测试状态为"样品已发"
    await ProductWeblink.update(
      { cpc_status: '样品已发' },
      {
        where: {
          id: { [Op.in]: ids }
        }
      }
    );

    // 发送钉钉通知
    try {
      await sendCpcSampleSentNotification(ids.length);
    } catch (notificationError) {
      console.error('钉钉通知发送失败，但不影响数据更新:', notificationError.message);
    }

    res.json({ message: `成功标记 ${ids.length} 条CPC样品已发` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 批量删除
router.post('/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: '请选择要删除的记录' });
    }

    await ProductWeblink.destroy({
      where: {
        id: { [Op.in]: ids }
      }
    });

    res.json({ message: '批量删除成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新单个记录
router.put('/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    await ProductWeblink.update(updateData, {
      where: { id }
    });

    res.json({ message: '更新成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 钉钉通知函数
async function sendDingTalkNotification(newProductCount) {
  try {
    const DINGTALK_WEBHOOK = process.env.DINGTALK_WEBHOOK;
    const SECRET_KEY = process.env.SECRET_KEY;
    const MOBILE_NUM_GERRY = process.env.MOBILE_NUM_GERRY;
    
    if (!DINGTALK_WEBHOOK) {
      console.log('钉钉Webhook未配置，跳过通知');
      return;
    }

    // 如果有SECRET_KEY，计算签名
    let webhookUrl = DINGTALK_WEBHOOK;
    if (SECRET_KEY) {
      const timestamp = Date.now();
      const stringToSign = `${timestamp}\n${SECRET_KEY}`;
      const sign = crypto.createHmac('sha256', SECRET_KEY)
                        .update(stringToSign)
                        .digest('base64');
      
      // 添加时间戳和签名参数
      const urlObj = new URL(DINGTALK_WEBHOOK);
      urlObj.searchParams.append('timestamp', timestamp.toString());
      urlObj.searchParams.append('sign', encodeURIComponent(sign));
      webhookUrl = urlObj.toString();
    }

    // 使用配置的手机号，如果没有配置则使用默认值
    const mobileNumber = MOBILE_NUM_GERRY || '18676689673';

    const message = {
      msgtype: 'text',
      text: {
        content: `有${newProductCount}款新品上传数据库，需要先审核再批图！@${mobileNumber}`
      },
      at: {
        atMobiles: [mobileNumber],
        isAtAll: false
      }
    };

    const response = await axios.post(webhookUrl, message, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    if (response.data.errcode === 0) {
      console.log('钉钉通知发送成功');
    } else {
      console.error('钉钉通知发送失败:', response.data);
    }
  } catch (error) {
    console.error('发送钉钉通知时出错:', error.message);
  }
}

// CPC测试申请钉钉通知函数
async function sendCpcTestNotification(cpcTestCount) {
  try {
    const DINGTALK_WEBHOOK = process.env.DINGTALK_WEBHOOK;
    const SECRET_KEY = process.env.SECRET_KEY;
    const MOBILE_NUM_GERRY = process.env.MOBILE_NUM_GERRY;
    
    if (!DINGTALK_WEBHOOK) {
      console.log('钉钉Webhook未配置，跳过通知');
      return;
    }

    // 如果有SECRET_KEY，计算签名
    let webhookUrl = DINGTALK_WEBHOOK;
    if (SECRET_KEY) {
      const timestamp = Date.now();
      const stringToSign = `${timestamp}\n${SECRET_KEY}`;
      const sign = crypto.createHmac('sha256', SECRET_KEY)
                        .update(stringToSign)
                        .digest('base64');
      
      // 添加时间戳和签名参数
      const urlObj = new URL(DINGTALK_WEBHOOK);
      urlObj.searchParams.append('timestamp', timestamp.toString());
      urlObj.searchParams.append('sign', encodeURIComponent(sign));
      webhookUrl = urlObj.toString();
    }

    // 使用配置的手机号，如果没有配置则使用默认值
    const mobileNumber = MOBILE_NUM_GERRY || '18676689673';

    const message = {
      msgtype: 'text',
      text: {
        content: `有${cpcTestCount}款产品申请CPC测试，请及时处理！@${mobileNumber}`
      },
      at: {
        atMobiles: [mobileNumber],
        isAtAll: false
      }
    };

    const response = await axios.post(webhookUrl, message, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    if (response.data.errcode === 0) {
      console.log('CPC测试申请钉钉通知发送成功');
    } else {
      console.error('CPC测试申请钉钉通知发送失败:', response.data);
    }
  } catch (error) {
    console.error('发送CPC测试申请钉钉通知时出错:', error.message);
  }
}

// CPC样品已发钉钉通知函数
async function sendCpcSampleSentNotification(sampleCount) {
  try {
    const DINGTALK_WEBHOOK = process.env.DINGTALK_WEBHOOK;
    const SECRET_KEY = process.env.SECRET_KEY;
    const MOBILE_NUM_GERRY = process.env.MOBILE_NUM_GERRY;
    
    if (!DINGTALK_WEBHOOK) {
      console.log('钉钉Webhook未配置，跳过通知');
      return;
    }

    // 如果有SECRET_KEY，计算签名
    let webhookUrl = DINGTALK_WEBHOOK;
    if (SECRET_KEY) {
      const timestamp = Date.now();
      const stringToSign = `${timestamp}\n${SECRET_KEY}`;
      const sign = crypto.createHmac('sha256', SECRET_KEY)
                        .update(stringToSign)
                        .digest('base64');
      
      // 添加时间戳和签名参数
      const urlObj = new URL(DINGTALK_WEBHOOK);
      urlObj.searchParams.append('timestamp', timestamp.toString());
      urlObj.searchParams.append('sign', encodeURIComponent(sign));
      webhookUrl = urlObj.toString();
    }

    // 使用配置的手机号，如果没有配置则使用默认值
    const mobileNumber = MOBILE_NUM_GERRY || '18676689673';

    const message = {
      msgtype: 'text',
      text: {
        content: `已标记${sampleCount}款产品CPC样品已发，请及时跟进测试进度！@${mobileNumber}`
      },
      at: {
        atMobiles: [mobileNumber],
        isAtAll: false
      }
    };

    const response = await axios.post(webhookUrl, message, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    if (response.data.errcode === 0) {
      console.log('CPC样品已发钉钉通知发送成功');
    } else {
      console.error('CPC样品已发钉钉通知发送失败:', response.data);
    }
  } catch (error) {
    console.error('发送CPC样品已发钉钉通知时出错:', error.message);
  }
}

// 生成SKU的函数
function generateSKU() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  let sku = '';
  // 前3个字符是字母
  for (let i = 0; i < 3; i++) {
    sku += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  // 后3个字符是数字
  for (let i = 0; i < 3; i++) {
    sku += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  
  return sku;
}

// Excel文件上传（原有的）
router.post('/upload-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '请选择Excel文件' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    const newRecords = [];
    
    // 跳过表头，从第二行开始处理
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] && row[0].trim()) { // A列有产品链接
        const weblink = row[0].trim();
        
        // 检查是否已存在
        const existing = await ProductWeblink.findOne({
          where: { weblink }
        });
        
        if (!existing) {
          let parent_sku;
          do {
            parent_sku = generateSKU();
            // 确保生成的SKU不重复
            const skuExists = await ProductWeblink.findOne({
              where: { parent_sku }
            });
            if (!skuExists) break;
          } while (true);

          newRecords.push({
            parent_sku,
            weblink,
            update_time: new Date(),
            status: '待处理'
          });
        }
      }
    }

    if (newRecords.length > 0) {
      await ProductWeblink.bulkCreate(newRecords);
      res.json({ 
        message: `成功上传 ${newRecords.length} 条新记录`,
        count: newRecords.length 
      });
    } else {
      res.json({ 
        message: '没有找到新的产品链接',
        count: 0 
      });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '文件上传失败: ' + err.message });
  }
});

// 新的Excel上传（支持SKU, 链接, 备注）
router.post('/upload-excel-new', (req, res) => {
  // 使用multer中间件，并处理可能的错误
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: '文件太大，请选择小于10MB的文件' });
      } else if (err.message.includes('不支持的文件类型')) {
        return res.status(400).json({ message: err.message });
      } else {
        return res.status(400).json({ message: '文件上传失败: ' + err.message });
      }
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({ message: '请选择Excel文件' });
      }

          // 获取钉钉推送开关状态
      const enableDingTalkNotification = req.body.enableDingTalkNotification === 'true';

      let workbook, data;
      try {
        workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          return res.status(400).json({ message: 'Excel文件无有效工作表，请检查文件格式' });
        }
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        if (!worksheet) {
          return res.status(400).json({ message: 'Excel文件工作表为空，请添加数据后重新上传' });
        }
        
        data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
      } catch (excelError) {
        return res.status(400).json({ message: 'Excel文件格式错误，请确保上传正确的.xlsx或.xls文件' });
      }

          // 优化空表检查 - 快速失败
      if (!data || data.length === 0) {
        return res.status(400).json({ message: 'Excel文件为空，请添加数据后重新上传' });
      }

      // 检查是否有任何非空行
      const hasValidData = data.some(row => row && row[0] && row[0].toString().trim());
      if (!hasValidData) {
        return res.status(400).json({ message: 'Excel文件中没有找到有效的数据行。请确保A列填写了SKU信息。' });
      }
    const newRecords = [];
    const errors = [];
    
    // 从第一行开始处理（无表头）
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[0] && row[0].toString().trim()) { // A列有SKU
        const parent_sku = row[0].toString().trim();
        const weblink = row[1] ? row[1].toString().trim() : '';
        const notice = row[2] ? row[2].toString().trim() : '';
        
        // 检查SKU是否已存在
        const existing = await ProductWeblink.findOne({
          where: { parent_sku }
        });
        
        if (existing) {
          errors.push(`第${i+1}行：SKU ${parent_sku} 已存在`);
          continue;
        }

        // 检查链接是否已存在（如果有链接的话）
        if (weblink) {
          const existingLink = await ProductWeblink.findOne({
            where: { weblink }
          });
          
          if (existingLink) {
            errors.push(`第${i+1}行：链接已存在于SKU ${existingLink.parent_sku}`);
            continue;
          }
        }

        newRecords.push({
          parent_sku,
          weblink,
          notice,
          update_time: new Date(),
          status: '待审核'
        });
      }
    }

          let resultMessage = '';
      if (newRecords.length > 0) {
        await ProductWeblink.bulkCreate(newRecords);
        resultMessage = `成功上传 ${newRecords.length} 条新记录`;
        
        // 根据开关状态决定是否发送钉钉通知
        if (enableDingTalkNotification) {
          try {
            await sendDingTalkNotification(newRecords.length);
          } catch (notificationError) {
            // 钉钉通知发送失败不影响数据保存
          }
        }
      } else {
        // 如果没有找到任何有效数据，返回错误
        const errorMsg = errors.length > 0 
          ? `没有找到有效的数据行。所有行都被跳过：\n${errors.join('\n')}`
          : 'Excel文件中没有找到有效的数据行。请确保A列填写了SKU信息。';
        return res.status(400).json({ message: errorMsg });
      }

      if (errors.length > 0) {
        resultMessage += `\n跳过的记录：\n${errors.join('\n')}`;
      }

      res.json({ 
        message: resultMessage,
        count: newRecords.length,
        errors: errors
      });

    } catch (err) {
      res.status(500).json({ message: '文件上传失败: ' + err.message });
    }
  });
});

// 筛选数据接口
router.post('/filter', async (req, res) => {
  try {
    const { status, cpc_status, cpc_submit, seller_name, dateRange } = req.body;
    
    // 构建查询条件
    const whereConditions = {};
    if (status) {
      whereConditions.status = status;
    }
    if (cpc_status) {
      whereConditions.cpc_status = cpc_status;
    }
    if (cpc_submit !== undefined) {
      if (cpc_submit === '') {
        // 筛选空的CPC提交情况
        whereConditions.cpc_submit = { [Op.or]: [null, ''] };
      } else {
        whereConditions.cpc_submit = cpc_submit;
      }
    }
    if (seller_name) {
      whereConditions.seller_name = { [Op.like]: `%${seller_name}%` };
    }
    
    // 添加时间范围筛选
    if (dateRange && dateRange.length === 2) {
      const [startDate, endDate] = dateRange;
      whereConditions.update_time = {
        [Op.between]: [
          new Date(startDate + ' 00:00:00'),
          new Date(endDate + ' 23:59:59')
        ]
      };
    }

    const result = await ProductWeblink.findAll({
      where: whereConditions,
      attributes: [
        'id',
        'parent_sku',
        'weblink',
        'update_time',
        'check_time',
        'status',
        'notice',
        'cpc_status',
        'cpc_submit',
        'model_number',
        'recommend_age',
        'ads_add',
        'list_parent_sku',
        'no_inventory_rate',
        'sales_30days',
        'seller_name'
      ]
    });

    res.json({ data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '筛选失败' });
  }
});

// CPC待上架产品筛选接口（测试完成且CPC提交情况为空）
router.post('/filter-cpc-pending-listing', async (req, res) => {
  try {
    const result = await ProductWeblink.findAll({
      where: {
        cpc_status: '测试完成',
        [Op.or]: [
          { cpc_submit: null },
          { cpc_submit: '' }
        ]
      },
      attributes: [
        'id',
        'parent_sku',
        'weblink',
        'update_time',
        'check_time',
        'status',
        'notice',
        'cpc_status',
        'cpc_submit',
        'model_number',
        'recommend_age',
        'ads_add',
        'list_parent_sku',
        'no_inventory_rate',
        'sales_30days',
        'seller_name'
      ]
    });

    res.json({ data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '筛选CPC待上架产品失败' });
  }
});

// 获取全部数据统计信息
router.get('/statistics', async (req, res) => {
  try {
    // 获取状态统计
    const statusStats = await ProductWeblink.findAll({
      attributes: [
        'status',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      where: {
        status: {
          [Op.ne]: null,
          [Op.ne]: ''
        }
      },
      group: ['status'],
      raw: true
    });

    // 获取CPC状态统计
    const cpcStatusStats = await ProductWeblink.findAll({
      attributes: [
        'cpc_status',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      where: {
        cpc_status: {
          [Op.ne]: null,
          [Op.ne]: ''
        }
      },
      group: ['cpc_status'],
      raw: true
    });

    // 获取CPC提交情况统计
    const cpcSubmitStats = await ProductWeblink.findAll({
      attributes: [
        'cpc_submit',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      where: {
        cpc_submit: {
          [Op.ne]: null,
          [Op.ne]: ''
        }
      },
      group: ['cpc_submit'],
      having: require('sequelize').where(
        require('sequelize').fn('COUNT', require('sequelize').col('id')), 
        '>', 
        0
      ),
      raw: true
    });

    console.log('📊 CPC提交情况统计查询结果:', cpcSubmitStats);

    // 获取供应商统计
    const supplierStats = await ProductWeblink.findAll({
      attributes: [
        'seller_name',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      where: {
        seller_name: {
          [Op.ne]: null,
          [Op.ne]: ''
        }
      },
      group: ['seller_name'],
      raw: true
    });

    // 计算特定状态的产品数量
    const waitingPImageCount = await ProductWeblink.count({
      where: { status: '待P图' }
    });

    const waitingUploadCount = await ProductWeblink.count({
      where: { status: '待上传' }
    });

    // 计算CPC测试待审核的产品数量（申请测试状态）
    const cpcTestPendingCount = await ProductWeblink.count({
      where: { cpc_status: '申请测试' }
    });

    // 计算CPC检测中的产品数量
    const cpcTestingCount = await ProductWeblink.count({
      where: { cpc_status: '测试中' }
    });

    // 计算CPC已发样品数量
    const cpcSampleSentCount = await ProductWeblink.count({
      where: { cpc_status: '样品已发' }
    });

    // 计算CPC待上架产品数量（测试完成且CPC提交情况为空）
    const cpcPendingListingCount = await ProductWeblink.count({
      where: {
        cpc_status: '测试完成',
        [Op.or]: [
          { cpc_submit: null },
          { cpc_submit: '' }
        ]
      }
    });

    res.json({
      statistics: {
        waitingPImage: waitingPImageCount,
        waitingUpload: waitingUploadCount,
        cpcTestPending: cpcTestPendingCount,
        cpcTesting: cpcTestingCount,
        cpcSampleSent: cpcSampleSentCount,
        cpcPendingListing: cpcPendingListingCount
      },
      statusStats: statusStats.map(item => ({
        value: item.status,
        count: parseInt(item.count)
      })),
      cpcStatusStats: cpcStatusStats.map(item => ({
        value: item.cpc_status,
        count: parseInt(item.count)
      })),
      cpcSubmitStats: cpcSubmitStats
        .filter(item => item.cpc_submit && item.cpc_submit.trim() !== '') // 过滤空值
        .map(item => ({
          value: item.cpc_submit,
          count: parseInt(item.count) || 0
        }))
        .filter(item => item.count > 0), // 确保count大于0
      supplierStats: supplierStats.map(item => ({
        value: item.seller_name,
        count: parseInt(item.count)
      }))
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '获取统计信息失败: ' + err.message });
  }
});



// 测试端点 - 检查SellerInventorySku表
router.get('/test-seller-sku', async (req, res) => {
  try {
    const count = await SellerInventorySku.count();
    const sample = await SellerInventorySku.findAll({ limit: 3 });
    res.json({ 
      message: '数据库表访问成功',
      count: count,
      sample: sample
    });
  } catch (err) {
    res.status(500).json({ 
      message: '数据库表访问失败',
      error: err.message,
      name: err.name
    });
  }
});

// ==================== CPC文件上传相关接口 ====================

// CPC文件上传接口
router.post('/upload-cpc-file/:id', cpcUpload.single('cpcFile'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        code: 1,
        message: '请选择CPC文件'
      });
    }

    // 检查记录是否存在
    const record = await ProductWeblink.findByPk(id);
    if (!record) {
      return res.status(404).json({
        code: 1,
        message: '记录不存在'
      });
    }

    try {
      // 上传文件到OSS
      const uploadResult = await uploadToOSS(req.file.buffer, req.file.originalname, 'cpc-files');
      
      if (!uploadResult.success) {
        return res.status(500).json({
          code: 1,
          message: '文件上传失败'
        });
      }

      // 解析PDF文件获取Style Number和推荐年龄
      let extractedData = { styleNumber: '', recommendAge: '' };
      try {
        const pdfData = await pdf(req.file.buffer);
        extractedData = await extractCpcInfo(pdfData.text);
      } catch (parseError) {
        console.warn('PDF解析失败，跳过自动提取:', parseError.message);
      }

      // 准备文件信息，处理中文文件名
      const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      const fileInfo = {
        uid: Date.now() + '-' + Math.random().toString(36).substr(2, 9), // 更唯一的ID
        name: originalName,
        url: uploadResult.url,
        objectName: uploadResult.name,
        size: uploadResult.size,
        uploadTime: new Date().toISOString(),
        extractedData: extractedData
      };

      // 获取现有的CPC文件列表
      let existingFiles = [];
      if (record.cpc_files) {
        try {
          existingFiles = JSON.parse(record.cpc_files);
          if (!Array.isArray(existingFiles)) {
            existingFiles = [];
          }
        } catch (e) {
          existingFiles = [];
        }
      }

      // 添加新文件
      existingFiles.push(fileInfo);

      // 更新数据库记录
      const updateData = {
        cpc_files: JSON.stringify(existingFiles)
      };

      // 检查是否已经有提取过的信息（避免重复提取）
      const hasExistingExtractedData = existingFiles.some(file => 
        file.extractedData && (file.extractedData.styleNumber || file.extractedData.recommendAge)
      );

      // 不再自动更新数据库字段，改为返回提取信息让前端确认
      // 只在控制台记录提取结果
      if (!hasExistingExtractedData && (extractedData.styleNumber || extractedData.recommendAge)) {
        console.log(`📝 从CPC文件中提取信息 (SKU: ${record.parent_sku}):`);
        if (extractedData.styleNumber) {
          console.log(`  - Style Number: ${extractedData.styleNumber}`);
        }
        if (extractedData.recommendAge) {
          console.log(`  - 推荐年龄: ${extractedData.recommendAge}`);
        }
      } else if (hasExistingExtractedData && (extractedData.styleNumber || extractedData.recommendAge)) {
        console.log(`ℹ️ SKU ${record.parent_sku} 已有提取信息，跳过重复提取`);
      }

      // 如果CPC文件数量达到2个或以上，自动更新CPC测试情况为"已测试"
      if (existingFiles.length >= 2) {
        updateData.cpc_status = '已测试';
        console.log(`📋 SKU ${record.parent_sku} 的CPC文件数量达到${existingFiles.length}个，自动更新CPC测试情况为"已测试"`);
      }

      await ProductWeblink.update(updateData, {
        where: { id: id }
      });

      res.json({
        code: 0,
        message: 'CPC文件上传成功',
        data: {
          fileInfo: fileInfo,
          extractedData: extractedData,
          autoUpdated: {
            styleNumber: !hasExistingExtractedData && !!extractedData.styleNumber,
            recommendAge: !hasExistingExtractedData && !!extractedData.recommendAge,
            cpcStatus: existingFiles.length >= 2
          },
          cpcStatusUpdated: existingFiles.length >= 2,
          totalFileCount: existingFiles.length,
          isFirstExtraction: !hasExistingExtractedData && (extractedData.styleNumber || extractedData.recommendAge),
          hasExistingData: hasExistingExtractedData
        }
      });

    } catch (uploadError) {
      console.error('文件上传失败:', uploadError);
      res.status(500).json({
        code: 1,
        message: '文件上传失败: ' + uploadError.message
      });
    }

  } catch (error) {
    console.error('CPC文件上传处理失败:', error);
    res.status(500).json({
      code: 1,
      message: '服务器错误: ' + error.message
    });
  }
});

// 获取CPC文件列表
router.get('/cpc-files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const record = await ProductWeblink.findByPk(id);
    if (!record) {
      return res.status(404).json({
        code: 1,
        message: '记录不存在'
      });
    }

    let cpcFiles = [];
    if (record.cpc_files) {
      try {
        cpcFiles = JSON.parse(record.cpc_files);
        if (!Array.isArray(cpcFiles)) {
          cpcFiles = [];
        }
      } catch (e) {
        cpcFiles = [];
      }
    }

    res.json({
      code: 0,
      message: '获取成功',
      data: cpcFiles
    });

  } catch (error) {
    console.error('获取CPC文件列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '服务器错误: ' + error.message
    });
  }
});

// 删除CPC文件
router.delete('/cpc-file/:id/:fileUid', async (req, res) => {
  try {
    const { id, fileUid } = req.params;
    
    const record = await ProductWeblink.findByPk(id);
    if (!record) {
      return res.status(404).json({
        code: 1,
        message: '记录不存在'
      });
    }

    let cpcFiles = [];
    if (record.cpc_files) {
      try {
        cpcFiles = JSON.parse(record.cpc_files);
        if (!Array.isArray(cpcFiles)) {
          cpcFiles = [];
        }
      } catch (e) {
        cpcFiles = [];
      }
    }

    // 找到要删除的文件
    const fileIndex = cpcFiles.findIndex(file => file.uid === fileUid);
    if (fileIndex === -1) {
      return res.status(404).json({
        code: 1,
        message: '文件不存在'
      });
    }

    const fileToDelete = cpcFiles[fileIndex];
    
    // 从OSS中删除文件（如果有objectName）
    if (fileToDelete.objectName) {
      try {
        await deleteFromOSS(fileToDelete.objectName);
        console.log(`✅ 已从OSS删除文件: ${fileToDelete.objectName}`);
      } catch (ossError) {
        console.warn(`⚠️ OSS文件删除失败: ${fileToDelete.objectName}`, ossError.message);
        // 继续执行数据库删除，即使OSS删除失败
      }
    }

    // 从数组中移除文件
    cpcFiles.splice(fileIndex, 1);

    // 更新数据库
    await ProductWeblink.update(
      { cpc_files: JSON.stringify(cpcFiles) },
      { where: { id: id } }
    );

    res.json({
      code: 0,
      message: '文件删除成功'
    });

  } catch (error) {
    console.error('删除CPC文件失败:', error);
    res.status(500).json({
      code: 1,
      message: '服务器错误: ' + error.message
    });
  }
});

// CPC信息提取函数
async function extractCpcInfo(pdfText) {
  try {
    const result = { styleNumber: '', recommendAge: '' };
    
    // 首先检查是否为CHILDREN'S PRODUCT CERTIFICATE文件
    const isCpcCertificate = pdfText.includes("CHILDREN'S PRODUCT CERTIFICATE") || 
                           pdfText.includes("CHILDREN'S PRODUCT CERTIFICATE") ||
                           pdfText.includes("CHILDRENS PRODUCT CERTIFICATE");
    
    if (!isCpcCertificate) {
      console.log("📄 非CHILDREN'S PRODUCT CERTIFICATE文件，跳过信息提取");
      return result; // 返回空结果
    }
    
    console.log("📋 检测到CHILDREN'S PRODUCT CERTIFICATE文件，开始提取信息...");
    
    // 提取Style Number（在"Model"后面）
    const modelMatch = pdfText.match(/Model[:\s]*([A-Z0-9]+)/i);
    if (modelMatch) {
      result.styleNumber = modelMatch[1].trim();
    }
    
    // 提取推荐年龄（在"Age grading"后面）
    const ageMatch = pdfText.match(/Age\s+grading[:\s]*([^\n\r]+)/i);
    if (ageMatch) {
      result.recommendAge = ageMatch[1].trim();
    }
    
    console.log('🔍 CPC证书信息提取结果:', result);
    return result;
    
  } catch (error) {
    console.error('CPC信息提取失败:', error);
    return { styleNumber: '', recommendAge: '' };
  }
}



// 亚马逊模板管理 - 通用API
// 上传亚马逊资料模板
router.post('/amazon-templates/upload', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  try {
    console.log('📤 收到亚马逊模板上传请求');
    
    if (!req.file) {
      return res.status(400).json({ message: '请选择要上传的文件' });
    }

    const { country } = req.body;
    if (!country) {
      return res.status(400).json({ message: '请指定站点' });
    }

    console.log(`📋 文件信息: ${req.file.originalname}, 大小: ${req.file.size} 字节, 站点: ${country}`);

    // 验证文件类型
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!validTypes.includes(req.file.mimetype) && !req.file.originalname.match(/\.(xlsx)$/i)) {
      return res.status(400).json({ message: '请上传有效的Excel文件（仅支持.xlsx格式）' });
    }

    // 使用OSS上传模板功能
    const { uploadTemplateToOSS } = require('../utils/oss');
    
    const originalFileName = req.body.originalFileName || req.file.originalname;
    console.log('📝 使用文件名:', originalFileName);
    
    const uploadResult = await uploadTemplateToOSS(
      req.file.buffer, 
      originalFileName,
      'amazon', 
      null, 
      country
    );

    if (!uploadResult.success) {
      return res.status(500).json({ message: '模板文件上传失败' });
    }

    // 保存模板信息到数据库
    let templateLink = null;
    try {
      templateLink = await TemplateLink.create({
        template_type: 'amazon',
        country: country,
        file_name: originalFileName,
        oss_object_name: uploadResult.name,
        oss_url: uploadResult.url,
        file_size: uploadResult.size,
        upload_time: new Date(),
        is_active: true
      });
      
      console.log(`📊 模板信息已保存到数据库，ID: ${templateLink.id}`);
    } catch (dbError) {
      console.warn('⚠️ 保存模板信息到数据库失败:', dbError.message);
      // 不阻断上传流程，只是警告
    }

    const uploadTime = Date.now() - startTime;
    console.log(`✅ 上传完成，耗时: ${uploadTime}ms`);

    // 构建响应数据
    const responseData = {
      fileName: uploadResult.originalName,
      url: uploadResult.url,
      objectName: uploadResult.name,
      size: uploadResult.size,
      country: country,
      uploadTime: new Date().toISOString(),
      processingTime: uploadTime
    };

    // 只有当模板信息成功保存到数据库时才返回templateId
    if (templateLink && templateLink.id) {
      responseData.templateId = templateLink.id;
    }

    res.json({
      message: `${country}站点资料表模板上传成功`,
      data: responseData
    });

  } catch (error) {
    const uploadTime = Date.now() - startTime;
    console.error(`❌ 上传亚马逊资料表模板失败 (耗时: ${uploadTime}ms):`, error);
    
    let errorMessage = '上传失败: ' + error.message;
    if (error.code === 'RequestTimeout') {
      errorMessage = '上传超时，请检查网络连接后重试';
    } else if (error.code === 'AccessDenied') {
      errorMessage = 'OSS访问权限不足，请联系管理员';
    }
    
    res.status(500).json({ 
      message: errorMessage,
      processingTime: uploadTime
    });
  }
});

// 获取亚马逊模板列表
router.get('/amazon-templates', async (req, res) => {
  try {
    const { country } = req.query;
    
    console.log(`📋 从数据库获取亚马逊模板列表，站点: ${country || '全部'}`);
    
    // 构建查询条件
    const whereConditions = {
      template_type: 'amazon',
      is_active: true
    };
    
    if (country) {
      whereConditions.country = country;
    }
    
    // 从数据库查询模板列表
    const templateLinks = await TemplateLink.findAll({
      where: whereConditions,
      order: [['upload_time', 'DESC']]
    });

    // 转换为前端需要的格式
    const files = templateLinks.map(template => ({
      name: template.oss_object_name,
      fileName: template.file_name,
      size: template.file_size || 0,
      lastModified: template.upload_time,
      url: template.oss_url,
      country: template.country,
      id: template.id
    }));

    console.log(`📊 从数据库找到 ${files.length} 个模板文件`);

    res.json({
      message: '获取成功',
      data: files,
      count: files.length
    });

  } catch (error) {
    console.error('从数据库获取亚马逊模板列表失败:', error);
    res.status(500).json({ message: '获取模板列表失败: ' + error.message });
  }
});

// 下载亚马逊模板
router.get('/amazon-templates/download/:objectName*', async (req, res) => {
  try {
    const objectName = req.params.objectName + (req.params[0] || '');
    
    console.log(`🔽 收到下载请求: ${objectName}`);
    
    if (!objectName) {
      return res.status(400).json({ message: '缺少文件名参数' });
    }

    const { downloadTemplateFromOSS } = require('../utils/oss');
    
    const result = await downloadTemplateFromOSS(objectName);
    
    if (!result.success) {
      console.error(`❌ 下载失败: ${result.message}`);
      return res.status(404).json({ message: result.message || '模板文件不存在' });
    }

    console.log(`📤 准备发送文件: ${result.fileName} (${result.size} 字节)`);
    
    // 设置响应头
    res.setHeader('Content-Type', result.contentType);
    const encodedFileName = encodeURIComponent(result.fileName);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
    res.setHeader('Content-Length', result.size);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');
    
    // 发送文件内容
    if (Buffer.isBuffer(result.content)) {
      res.end(result.content);
    } else {
      res.end(Buffer.from(result.content));
    }
    
    console.log(`✅ 文件下载完成: ${result.fileName}`);

  } catch (error) {
    console.error('❌ 下载亚马逊模板失败:', error);
    res.status(500).json({ message: '下载失败: ' + error.message });
  }
});

// 删除亚马逊模板
router.delete('/amazon-templates/:objectName*', async (req, res) => {
  try {
    const objectName = req.params.objectName + (req.params[0] || '');
    
    console.log(`🗑️ 收到删除请求: ${objectName}`);
    
    if (!objectName) {
      return res.status(400).json({ message: '缺少文件名参数' });
    }

    const { deleteTemplateFromOSS, backupTemplate } = require('../utils/oss');
    
    // 删除前先备份
    try {
      await backupTemplate(objectName, 'amazon');
      console.log('✅ 模板文件已备份');
    } catch (backupError) {
      console.warn('⚠️ 模板文件备份失败，继续删除操作:', backupError.message);
    }
    
    const result = await deleteTemplateFromOSS(objectName);
    
    if (!result.success) {
      return res.status(500).json({ 
        message: result.message || '删除失败',
        error: result.error 
      });
    }

    // 从数据库中删除模板记录
    try {
      const deletedCount = await TemplateLink.destroy({
        where: {
          oss_object_name: objectName
        }
      });
      
      if (deletedCount > 0) {
        console.log(`📊 已从数据库删除 ${deletedCount} 条模板记录`);
      } else {
        console.warn('⚠️ 数据库中未找到对应的模板记录');
      }
    } catch (dbError) {
      console.warn('⚠️ 从数据库删除模板记录失败:', dbError.message);
      // 不阻断删除流程，只是警告
    }

    res.json({ message: '模板删除成功' });

  } catch (error) {
    console.error('删除亚马逊模板失败:', error);
    res.status(500).json({ message: '删除失败: ' + error.message });
  }
});

// ==================== 生成英国资料表接口 ====================

// 生成英国资料表
router.post('/generate-uk-data-sheet', async (req, res) => {
  const startTime = Date.now();
  try {
    console.log('📋 收到生成英国资料表请求');
    
    const { parentSkus } = req.body;
    
    if (!Array.isArray(parentSkus) || parentSkus.length === 0) {
      return res.status(400).json({ message: '请提供要生成资料表的母SKU列表' });
    }

    console.log(`📝 处理 ${parentSkus.length} 个母SKU:`, parentSkus);

    // 步骤1: 从数据库获取英国模板文件
    console.log('🔍 从数据库查找英国模板文件...');
    
    const ukTemplate = await TemplateLink.findOne({
      where: {
        template_type: 'amazon',
        country: 'UK',
        is_active: true
      },
      order: [['upload_time', 'DESC']]
    });
    
    if (!ukTemplate) {
      return res.status(400).json({ message: '未找到英国站点的资料模板，请先上传英国模板文件' });
    }

    console.log(`📄 使用英国模板: ${ukTemplate.file_name} (ID: ${ukTemplate.id})`);

    // 步骤2: 下载模板文件
    console.log('📥 下载英国模板文件...');
    const { downloadTemplateFromOSS } = require('../utils/oss');
    
    const downloadResult = await downloadTemplateFromOSS(ukTemplate.oss_object_name);
    
    if (!downloadResult.success) {
      console.error('❌ 下载英国模板失败:', downloadResult.message);
      return res.status(500).json({ 
        message: `下载英国模板失败: ${downloadResult.message}`,
        details: downloadResult.error
      });
    }

    console.log(`✅ 英国模板下载成功: ${downloadResult.fileName} (${downloadResult.size} 字节)`);

    // 步骤3: 查询sellerinventory_sku表获取子SKU信息
    console.log('🔍 查询子SKU信息...');
    const inventorySkus = await SellerInventorySku.findAll({
      where: {
        parent_sku: {
          [Op.in]: parentSkus
        }
      },
      order: [['parent_sku', 'ASC'], ['child_sku', 'ASC']]
    });

    if (inventorySkus.length === 0) {
      return res.status(404).json({ 
        message: '在数据库中未找到这些母SKU对应的子SKU信息' 
      });
    }

    console.log(`📊 找到 ${inventorySkus.length} 条子SKU记录`);

    // 步骤4: 使用xlsx库处理Excel文件（更高效、更稳定）
    console.log('📝 开始使用xlsx库处理Excel文件，高效稳定...');
    const XLSX = require('xlsx');
    
    try {
      console.log(`📊 开始加载Excel文件，文件大小: ${downloadResult.size} 字节`);
      
      // 使用xlsx读取工作簿（更快速、稳定）
      const workbook = XLSX.read(downloadResult.content, { 
        type: 'buffer',
        cellStyles: true, // 保持样式
        cellNF: true,     // 保持数字格式
        cellDates: true   // 处理日期
      });
      
      console.log('✅ Excel文件加载完成');
      
      // 检查是否有Template工作表
      if (!workbook.Sheets['Template']) {
        return res.status(400).json({ message: '模板文件中未找到Template工作表' });
      }

      console.log('✅ 成功加载Template工作表');
      
      const worksheet = workbook.Sheets['Template'];
      
      // 将工作表转换为二维数组，便于操作
      const data = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, // 使用数组形式
        defval: '', // 空单元格默认值
        raw: false  // 保持原始数据格式
      });
      
      console.log(`📊 工作表数据行数: ${data.length}`);

      // 查找列位置（在第3行查找标题，索引为2）
      let itemSkuCol = -1;
      let colorNameCol = -1;
      let sizeNameCol = -1;
      let brandNameCol = -1;
      let manufacturerCol = -1;
      let externalProductIdTypeCol = -1;
      let modelCol = -1;
      let quantityCol = -1;
      let ageRangeDescriptionCol = -1;
      let parentChildCol = -1;
      let parentSkuCol = -1;
      let relationshipTypeCol = -1;
      let variationThemeCol = -1;
      let countryOfOriginCol = -1;
      let areBatteriesIncludedCol = -1;
      let conditionTypeCol = -1;
      
      if (data.length >= 3 && data[2]) { // 第3行，索引为2
        data[2].forEach((header, colIndex) => {
          if (header) {
            const cellValue = header.toString().toLowerCase();
            if (cellValue === 'item_sku') {
              itemSkuCol = colIndex;
            } else if (cellValue === 'color_name') {
              colorNameCol = colIndex;
            } else if (cellValue === 'size_name') {
              sizeNameCol = colIndex;
            } else if (cellValue === 'brand_name') {
              brandNameCol = colIndex;
            } else if (cellValue === 'manufacturer') {
              manufacturerCol = colIndex;
            } else if (cellValue === 'external_product_id_type') {
              externalProductIdTypeCol = colIndex;
            } else if (cellValue === 'model') {
              modelCol = colIndex;
            } else if (cellValue === 'quantity') {
              quantityCol = colIndex;
            } else if (cellValue === 'age_range_description') {
              ageRangeDescriptionCol = colIndex;
            } else if (cellValue === 'parent_child') {
              parentChildCol = colIndex;
            } else if (cellValue === 'parent_sku') {
              parentSkuCol = colIndex;
            } else if (cellValue === 'relationship_type') {
              relationshipTypeCol = colIndex;
            } else if (cellValue === 'variation_theme') {
              variationThemeCol = colIndex;
            } else if (cellValue === 'country_of_origin') {
              countryOfOriginCol = colIndex;
            } else if (cellValue === 'are_batteries_included') {
              areBatteriesIncludedCol = colIndex;
            } else if (cellValue === 'condition_type') {
              conditionTypeCol = colIndex;
            }
          }
        });
      }

      if (itemSkuCol === -1 || colorNameCol === -1 || sizeNameCol === -1) {
        return res.status(400).json({ 
          message: '在模板第3行中未找到必需的列：item_sku、color_name、size_name' 
        });
      }

      console.log(`📍 找到基础列位置 - item_sku: ${itemSkuCol}, color_name: ${colorNameCol}, size_name: ${sizeNameCol}`);
      console.log(`📍 找到扩展列位置 - brand_name: ${brandNameCol}, manufacturer: ${manufacturerCol}, external_product_id_type: ${externalProductIdTypeCol}`);
      console.log(`📍 找到其他列位置 - model: ${modelCol}, quantity: ${quantityCol}, age_range_description: ${ageRangeDescriptionCol}`);
      console.log(`📍 找到关系列位置 - parent_child: ${parentChildCol}, parent_sku: ${parentSkuCol}, relationship_type: ${relationshipTypeCol}, variation_theme: ${variationThemeCol}`);
      console.log(`📍 找到属性列位置 - country_of_origin: ${countryOfOriginCol}, are_batteries_included: ${areBatteriesIncludedCol}, condition_type: ${conditionTypeCol}`);

      // 步骤5: 准备填写数据
      console.log('✍️ 准备填写数据到Excel...');
      
      // 按母SKU分组
      const skuGroups = {};
      inventorySkus.forEach(sku => {
        if (!skuGroups[sku.parent_sku]) {
          skuGroups[sku.parent_sku] = [];
        }
        skuGroups[sku.parent_sku].push(sku);
      });

      // 确保数据数组有足够的行
      const totalRowsNeeded = 4 + Object.keys(skuGroups).reduce((total, parentSku) => {
        return total + 1 + skuGroups[parentSku].length; // 母SKU行 + 子SKU行数
      }, 0);

      // 扩展数据数组
      while (data.length < totalRowsNeeded) {
        data.push([]);
      }

      // 从第4行开始填写数据（索引为3）
      let currentRowIndex = 3; // 第4行开始，索引为3
      
      Object.keys(skuGroups).forEach(parentSku => {
        // 计算需要的最大列数
        const allColumns = [
          itemSkuCol, colorNameCol, sizeNameCol, brandNameCol, manufacturerCol,
          externalProductIdTypeCol, modelCol, quantityCol, ageRangeDescriptionCol,
          parentChildCol, parentSkuCol, relationshipTypeCol, variationThemeCol,
          countryOfOriginCol, areBatteriesIncludedCol, conditionTypeCol
        ].filter(col => col !== -1);
        const maxCol = Math.max(...allColumns);
        
        // 确保当前行有足够的列
        if (!data[currentRowIndex]) {
          data[currentRowIndex] = [];
        }
        while (data[currentRowIndex].length <= maxCol) {
          data[currentRowIndex].push('');
        }
        
        // 填写母SKU信息
        data[currentRowIndex][itemSkuCol] = `UK${parentSku}`;
        data[currentRowIndex][colorNameCol] = '';
        data[currentRowIndex][sizeNameCol] = '';
        
        // 填写母SKU的新增字段
        if (brandNameCol !== -1) data[currentRowIndex][brandNameCol] = 'SellerFun';
        if (manufacturerCol !== -1) data[currentRowIndex][manufacturerCol] = 'SellerFun';
        if (externalProductIdTypeCol !== -1) data[currentRowIndex][externalProductIdTypeCol] = ''; // 母SKU留空
        if (modelCol !== -1) data[currentRowIndex][modelCol] = `UK${parentSku}`;
        if (quantityCol !== -1) data[currentRowIndex][quantityCol] = ''; // 母SKU留空
        if (ageRangeDescriptionCol !== -1) data[currentRowIndex][ageRangeDescriptionCol] = '5+ Years';
        if (parentChildCol !== -1) data[currentRowIndex][parentChildCol] = 'Parent';
        if (parentSkuCol !== -1) data[currentRowIndex][parentSkuCol] = ''; // 母SKU留空
        if (relationshipTypeCol !== -1) data[currentRowIndex][relationshipTypeCol] = ''; // 母SKU留空
        if (variationThemeCol !== -1) data[currentRowIndex][variationThemeCol] = 'SizeName-ColorName'; // 母SKU也填写SizeName-ColorName
        if (countryOfOriginCol !== -1) data[currentRowIndex][countryOfOriginCol] = 'China';
        if (areBatteriesIncludedCol !== -1) data[currentRowIndex][areBatteriesIncludedCol] = 'No';
        if (conditionTypeCol !== -1) data[currentRowIndex][conditionTypeCol] = 'New';
        
        currentRowIndex++;
        
        // 填写子SKU行
        skuGroups[parentSku].forEach(childSku => {
          if (!data[currentRowIndex]) {
            data[currentRowIndex] = [];
          }
          while (data[currentRowIndex].length <= maxCol) {
            data[currentRowIndex].push('');
          }
          
          data[currentRowIndex][itemSkuCol] = `UK${childSku.child_sku}`;
          data[currentRowIndex][colorNameCol] = childSku.sellercolorname || '';
          data[currentRowIndex][sizeNameCol] = childSku.sellersizename || '';
          
          // 填写子SKU的新增字段
          if (brandNameCol !== -1) data[currentRowIndex][brandNameCol] = 'SellerFun';
          if (manufacturerCol !== -1) data[currentRowIndex][manufacturerCol] = 'SellerFun';
          if (externalProductIdTypeCol !== -1) data[currentRowIndex][externalProductIdTypeCol] = 'GCID';
          if (modelCol !== -1) data[currentRowIndex][modelCol] = `UK${parentSku}`;
          if (quantityCol !== -1) data[currentRowIndex][quantityCol] = '15';
          if (ageRangeDescriptionCol !== -1) data[currentRowIndex][ageRangeDescriptionCol] = '5+ Years';
          if (parentChildCol !== -1) data[currentRowIndex][parentChildCol] = 'Child';
          if (parentSkuCol !== -1) data[currentRowIndex][parentSkuCol] = `UK${parentSku}`;
          if (relationshipTypeCol !== -1) data[currentRowIndex][relationshipTypeCol] = 'Variation';
          if (variationThemeCol !== -1) data[currentRowIndex][variationThemeCol] = 'SizeName-ColorName';
          if (countryOfOriginCol !== -1) data[currentRowIndex][countryOfOriginCol] = 'China';
          if (areBatteriesIncludedCol !== -1) data[currentRowIndex][areBatteriesIncludedCol] = 'No';
          if (conditionTypeCol !== -1) data[currentRowIndex][conditionTypeCol] = 'New';
          
          currentRowIndex++;
        });
      });

      console.log(`📊 填写完成，共填写了 ${currentRowIndex - 3} 行数据`);

      // 步骤6: 将数据重新转换为工作表
      console.log('💾 生成Excel文件...');
      const newWorksheet = XLSX.utils.aoa_to_sheet(data);
      
      // 保持原始工作表的列宽等属性
      if (worksheet['!cols']) {
        newWorksheet['!cols'] = worksheet['!cols'];
      }
      if (worksheet['!rows']) {
        newWorksheet['!rows'] = worksheet['!rows'];
      }
      if (worksheet['!merges']) {
        newWorksheet['!merges'] = worksheet['!merges'];
      }
      
      // 更新工作簿
      workbook.Sheets['Template'] = newWorksheet;
      
      // 生成Excel文件buffer
      const excelBuffer = XLSX.write(workbook, { 
        type: 'buffer', 
        bookType: 'xlsx',
        cellStyles: true
      });

      const processingTime = Date.now() - startTime;
      console.log(`✅ 英国资料表生成完成，耗时: ${processingTime}ms`);

      // 设置响应头 - 使用新的命名格式：UK_母SKU1_母SKU2
      const skuList = parentSkus.join('_');
      const fileName = `UK_${skuList}.xlsx`;
      
      console.log(`📁 生成的文件名: ${fileName}`);
      console.log(`📋 母SKU列表: ${JSON.stringify(parentSkus)}`);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.setHeader('Content-Length', excelBuffer.length);
      
      console.log(`🌐 设置的Content-Disposition: attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      
      res.send(excelBuffer);

    } catch (error) {
      console.error('❌ Excel文件处理失败:', error.message);
      throw error;
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ 生成英国资料表失败 (耗时: ${processingTime}ms):`, error);
    
    let errorMessage = '生成失败: ' + error.message;
    if (error.code === 'ENOTFOUND') {
      errorMessage = '网络连接失败，请检查网络设置';
    } else if (error.code === 'AccessDenied') {
      errorMessage = 'OSS访问权限不足，请联系管理员';
    }
    
    res.status(500).json({ 
      message: errorMessage,
      processingTime: processingTime
    });
  }
});

// ==================== 生成其他站点资料表接口 ====================

// 检查其他站点模板列差异
router.post('/check-other-site-template', upload.single('file'), async (req, res) => {
  try {
    console.log('🔍 收到检查其他站点模板列差异请求');
    
    const { country } = req.body;
    const uploadedFile = req.file;
    
    if (!country || !uploadedFile) {
      return res.status(400).json({ message: '请提供国家信息和Excel文件' });
    }

    // 解析上传的Excel文件
    const workbook = xlsx.read(uploadedFile.buffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 3) {
      return res.status(400).json({ message: 'Excel文件格式错误，至少需要包含前3行（第3行为标题行）' });
    }

    // 获取上传文件的列（第3行是标题行，索引为2）
    const uploadedColumns = jsonData[2] ? jsonData[2].filter(col => col && col.toString().trim()) : [];
    
    // 获取目标国家的模板文件
    const countryTemplate = await TemplateLink.findOne({
      where: {
        template_type: 'amazon',
        country: country,
        is_active: true
      },
      order: [['upload_time', 'DESC']]
    });
    
    if (!countryTemplate) {
      return res.status(400).json({ message: `未找到${country}站点的资料模板，请先上传${country}模板文件` });
    }

    // 下载并解析模板文件
    const { downloadTemplateFromOSS } = require('../utils/oss');
    const downloadResult = await downloadTemplateFromOSS(countryTemplate.oss_object_name);
    
    if (!downloadResult.success) {
      return res.status(500).json({ 
        message: `下载${country}模板失败: ${downloadResult.message}`
      });
    }

    // 解析模板文件的列（第3行）
    const templateWorkbook = xlsx.read(downloadResult.content);
    const templateSheetName = templateWorkbook.SheetNames[0];
    const templateWorksheet = templateWorkbook.Sheets[templateSheetName];
    const templateData = xlsx.utils.sheet_to_json(templateWorksheet, { header: 1 });
    
    const templateColumns = templateData.length >= 3 && templateData[2] ? 
      templateData[2].filter(col => col && col.toString().trim()) : [];

    // 检查缺失的列
    const missingColumns = uploadedColumns.filter(col => 
      !templateColumns.some(templateCol => 
        templateCol.toString().toLowerCase() === col.toString().toLowerCase()
      )
    );

    return res.json({
      success: true,
      uploadedColumns,
      templateColumns,
      missingColumns,
      hasMissingColumns: missingColumns.length > 0
    });

  } catch (error) {
    console.error('❌ 检查模板列差异失败:', error);
    res.status(500).json({ 
      message: error.message || '检查模板列差异时发生未知错误'
    });
  }
});

// 生成其他站点资料表
router.post('/generate-other-site-datasheet', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  try {
    console.log('📋 收到生成其他站点资料表请求');
    
    const { country, targetCountry } = req.body;
    const uploadedFile = req.file;
    
    // 支持两种参数格式：country 或 targetCountry
    const actualCountry = country || targetCountry;
    
    if (!actualCountry || !uploadedFile) {
      return res.status(400).json({ message: '请提供国家信息和Excel文件' });
    }

    console.log(`📝 处理国家: ${actualCountry}, 文件: ${uploadedFile.originalname}`);

    // 步骤1: 解析上传的Excel文件
    console.log('📖 解析上传的Excel文件...');
    const workbook = xlsx.read(uploadedFile.buffer);
    
    // 优先寻找Template工作表，如果没有则使用第一个工作表
    let sheetName;
    let worksheet;
    
    if (workbook.Sheets['Template']) {
      sheetName = 'Template';
      worksheet = workbook.Sheets['Template'];
      console.log('✅ 找到Template工作表，使用Template工作表');
    } else {
      sheetName = workbook.SheetNames[0];
      worksheet = workbook.Sheets[sheetName];
      console.log(`⚠️ 未找到Template工作表，使用第一个工作表: ${sheetName}`);
    }
    
    console.log(`📋 当前使用的工作表: ${sheetName}`);
    
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      return res.status(400).json({ message: 'Excel文件格式错误，至少需要包含标题行和数据行' });
    }

    // 步骤2: 处理数据并保存到product_information表
    console.log('💾 保存数据到product_information表...');
    
    // 获取标题行（第3行是标题行，索引为2）
    if (jsonData.length < 4) {
      return res.status(400).json({ message: 'Excel文件格式错误，至少需要包含前3行标题说明和数据行' });
    }
    
    const headers = jsonData[2]; // 第3行是标题行
    const dataRows = jsonData.slice(3); // 第4行开始是数据行
    
    const savedRecords = [];
    
    for (const row of dataRows) {
      if (!row || row.length === 0) continue;
      
      // 创建数据对象
      const rowData = {};
      headers.forEach((header, index) => {
        if (header && row[index] !== undefined) {
          rowData[header.toLowerCase().replace(/\s+/g, '_')] = row[index];
        }
      });
      
      // 设置site字段为选择的国家
      rowData.site = actualCountry;
      
      // 设置original_parent_sku字段（去掉前两个字符）
      if (rowData.item_sku && rowData.item_sku.length > 2) {
        rowData.original_parent_sku = rowData.item_sku.substring(2);
      }
      
      try {
        const savedRecord = await ProductInformation.create(rowData);
        savedRecords.push(savedRecord);
      } catch (error) {
        console.warn(`⚠️ 保存记录失败: ${JSON.stringify(rowData)}, 错误: ${error.message}`);
      }
    }

    console.log(`✅ 成功保存 ${savedRecords.length} 条记录到product_information表`);

    // 步骤3: 获取对应国家的模板文件
    console.log(`🔍 查找${actualCountry}站点的模板文件...`);
    
    const countryTemplate = await TemplateLink.findOne({
      where: {
        template_type: 'amazon',
        country: actualCountry,
        is_active: true
      },
      order: [['upload_time', 'DESC']]
    });
    
    if (!countryTemplate) {
      return res.status(400).json({ message: `未找到${actualCountry}站点的资料模板，请先上传${actualCountry}模板文件` });
    }

    console.log(`📄 使用${actualCountry}模板: ${countryTemplate.file_name} (ID: ${countryTemplate.id})`);

    // 步骤4: 下载模板文件
    console.log(`📥 下载${actualCountry}模板文件...`);
    const { downloadTemplateFromOSS } = require('../utils/oss');
    
    const downloadResult = await downloadTemplateFromOSS(countryTemplate.oss_object_name);
    
    if (!downloadResult.success) {
      console.error(`❌ 下载${actualCountry}模板失败:`, downloadResult.message);
      return res.status(500).json({ 
        message: `下载${actualCountry}模板失败: ${downloadResult.message}`,
        details: downloadResult.error
      });
    }

    console.log(`✅ ${actualCountry}模板下载成功: ${downloadResult.fileName} (${downloadResult.size} 字节)`);

    // 步骤5: 使用xlsx库处理模板文件
    console.log('📊 开始使用xlsx库处理Excel文件...');
    
    // 解析模板文件
    const templateWorkbook = xlsx.read(downloadResult.content);
    const templateSheetName = templateWorkbook.SheetNames[0];
    const templateWorksheet = templateWorkbook.Sheets[templateSheetName];
    
    if (!templateWorksheet) {
      return res.status(400).json({ message: '模板文件格式错误，未找到工作表' });
    }

    // 将模板转换为数组格式以便处理
    const templateData = xlsx.utils.sheet_to_json(templateWorksheet, {header: 1});
    console.log(`📋 模板有 ${templateData.length} 行数据`);

    // 步骤6: 映射数据到模板
    console.log('🎯 开始映射数据到模板...');
    const updatedData = mapDataToTemplateXlsx(templateData, savedRecords, actualCountry);

    // 步骤7: 创建新的工作簿并写入数据
    console.log('📤 生成最终文件...');
    
    try {
      const newWorkbook = xlsx.utils.book_new();
      
      // 验证数据格式
      if (!Array.isArray(updatedData) || updatedData.length === 0) {
        throw new Error('映射后的数据为空或格式错误');
      }
      
      console.log(`📊 准备写入 ${updatedData.length} 行数据到Excel文件`);
      
      const newWorksheet = xlsx.utils.aoa_to_sheet(updatedData);
      
      // 复制原模板的列宽设置
      if (templateWorksheet['!cols']) {
        newWorksheet['!cols'] = templateWorksheet['!cols'];
      }
      
      // 验证工作表名称
      const sheetName = templateSheetName || 'Template';
      console.log(`📋 使用工作表名称: ${sheetName}`);
      
      xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);
      
      // 生成Excel文件buffer，使用更兼容的设置
      const outputBuffer = xlsx.write(newWorkbook, { 
        type: 'buffer', 
        bookType: 'xlsx',
        compression: true,
        Props: {
          Title: `${actualCountry} Data Sheet`,
          Subject: `${actualCountry} Product Information`,
          CreatedDate: new Date()
        }
      });
      
      console.log(`✅ Excel文件生成成功，大小: ${outputBuffer.length} 字节`);
      
      const fileName = `${actualCountry}_data_sheet_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', outputBuffer.length);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ 生成${actualCountry}资料表成功 (耗时: ${processingTime}ms)`);
      
      res.send(outputBuffer);
      
    } catch (fileError) {
      console.error('❌ Excel文件生成失败:', fileError);
      throw new Error('Excel文件生成失败: ' + fileError.message);
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error.message || '生成其他站点资料表时发生未知错误';
    console.error(`❌ 生成其他站点资料表失败 (耗时: ${processingTime}ms):`);
    console.error(`🔍 错误详情: ${error.message}`);
    console.error(`📋 错误堆栈:`, error.stack);
    console.error(`🏷️ 错误类型: ${error.name}`);
    
          // 输出请求参数以便调试
      console.error(`📋 请求参数: actualCountry=${req.body.country || req.body.targetCountry}, file=${req.file ? req.file.originalname : 'no file'}`);
      
      res.status(500).json({ 
        message: errorMessage,
        processingTime: processingTime,
        error: error.name,
        details: error.stack ? error.stack.split('\n')[0] : 'No stack trace'
      });
    }
  });

// 映射数据到模板的辅助函数（基于xlsx库）
function mapDataToTemplateXlsx(templateData, records, country) {
  try {
    console.log(`🎯 开始映射 ${records.length} 条记录到${country}模板...`);
    
    // 验证输入数据
    if (!Array.isArray(templateData) || templateData.length === 0) {
      throw new Error('模板数据为空或格式错误');
    }
    
    if (!Array.isArray(records)) {
      throw new Error('记录数据格式错误');
    }
    
    // 复制模板数据
    const updatedData = templateData.map(row => [...(row || [])]);
    
    console.log(`📋 模板有 ${updatedData.length} 行数据`);

    // 查找列位置（在第3行查找标题，索引为2）
    let itemSkuCol = -1;
    let itemNameCol = -1;
    let colorNameCol = -1;
    let sizeNameCol = -1;
    let brandNameCol = -1;
    let manufacturerCol = -1;
    let mainImageUrlCol = -1;
    let otherImageUrl1Col = -1;
    let otherImageUrl2Col = -1;
    let otherImageUrl3Col = -1;
    let otherImageUrl4Col = -1;
    let otherImageUrl5Col = -1;
    let productDescriptionCol = -1;
    let bulletPoint1Col = -1;
    let bulletPoint2Col = -1;
    let bulletPoint3Col = -1;
    let bulletPoint4Col = -1;
    let bulletPoint5Col = -1;
    
    const missingColumns = [];
    
    if (updatedData.length >= 3 && updatedData[2]) {
      updatedData[2].forEach((header, colIndex) => {
        if (header) {
          const cellValue = header.toString().toLowerCase();
          if (cellValue === 'item_sku') {
            itemSkuCol = colIndex;
          } else if (cellValue === 'item_name') {
            itemNameCol = colIndex;
          } else if (cellValue === 'color_name') {
            colorNameCol = colIndex;
          } else if (cellValue === 'size_name') {
            sizeNameCol = colIndex;
          } else if (cellValue === 'brand_name') {
            brandNameCol = colIndex;
          } else if (cellValue === 'manufacturer') {
            manufacturerCol = colIndex;
          } else if (cellValue === 'main_image_url') {
            mainImageUrlCol = colIndex;
          } else if (cellValue === 'other_image_url1') {
            otherImageUrl1Col = colIndex;
          } else if (cellValue === 'other_image_url2') {
            otherImageUrl2Col = colIndex;
          } else if (cellValue === 'other_image_url3') {
            otherImageUrl3Col = colIndex;
          } else if (cellValue === 'other_image_url4') {
            otherImageUrl4Col = colIndex;
          } else if (cellValue === 'other_image_url5') {
            otherImageUrl5Col = colIndex;
          } else if (cellValue === 'product_description') {
            productDescriptionCol = colIndex;
          } else if (cellValue === 'bullet_point1') {
            bulletPoint1Col = colIndex;
          } else if (cellValue === 'bullet_point2') {
            bulletPoint2Col = colIndex;
          } else if (cellValue === 'bullet_point3') {
            bulletPoint3Col = colIndex;
          } else if (cellValue === 'bullet_point4') {
            bulletPoint4Col = colIndex;
          } else if (cellValue === 'bullet_point5') {
            bulletPoint5Col = colIndex;
          }
        }
      });
    }

    // 检查缺失的列
    const requiredCols = [
      { name: 'item_sku', col: itemSkuCol },
      { name: 'color_name', col: colorNameCol },
      { name: 'size_name', col: sizeNameCol },
      { name: 'brand_name', col: brandNameCol },
    ];
    
    requiredCols.forEach(({ name, col }) => {
      if (col === -1) {
        missingColumns.push(name);
      }
    });
    
    if (missingColumns.length > 0) {
      console.warn(`⚠️ 模板中缺少以下列: ${missingColumns.join(', ')}`);
    }

    console.log(`📍 找到列位置 - item_sku: ${itemSkuCol}, item_name: ${itemNameCol}, color_name: ${colorNameCol}, size_name: ${sizeNameCol}, brand_name: ${brandNameCol}, manufacturer: ${manufacturerCol}`);

    // 判断源文件类型（通过第一条记录的SKU前缀）
    const sourceCountryType = records.length > 0 && records[0].item_sku ? 
      (records[0].item_sku.startsWith('US') ? 'US_CA' : 'OTHER') : 'OTHER';
    
    console.log(`📍 源文件类型: ${sourceCountryType}, 目标国家: ${country}`);

    // 处理文本内容，根据源文件和目标国家决定品牌替换规则
    const processTextContent = (text) => {
      if (!text) return text;
      
      // 如果源文件不是美国/加拿大，在生成美国/加拿大资料表时，SellerFun改成JiaYou
      if (sourceCountryType !== 'US_CA' && (country === 'US' || country === 'CA')) {
        return text.replace(/SellerFun/g, 'JiaYou');
      }
      
      // 如果源文件是美国/加拿大，在生成非美国/加拿大资料表时，JiaYou改成SellerFun
      if (sourceCountryType === 'US_CA' && country !== 'US' && country !== 'CA') {
        return text.replace(/JiaYou/g, 'SellerFun');
      }
      
      return text;
    };

    // 处理图片URL，根据源文件和目标国家决定替换规则
    const processImageUrl = (url) => {
      if (!url) return url;
      
      // 如果源文件不是美国/加拿大，在生成美国/加拿大资料表时，JiaYou改成SellerFun
      if (sourceCountryType !== 'US_CA' && (country === 'US' || country === 'CA')) {
        return url.replace(/JiaYou/g, 'SellerFun');
      }
      
      // 如果源文件是美国/加拿大，在生成非美国/加拿大资料表时，SellerFun改成JiaYou
      if (sourceCountryType === 'US_CA' && country !== 'US' && country !== 'CA') {
        return url.replace(/SellerFun/g, 'JiaYou');
      }
      
      return url;
    };

    // 清空现有数据行（保留前3行：标题、说明等）
    const headerRowCount = 3;
    updatedData.splice(headerRowCount);

    // 添加新数据
    let addedCount = 0;
    records.forEach((record, index) => {
      const rowIndex = headerRowCount + index;
      
      // 确保行存在
      if (!updatedData[rowIndex]) {
        updatedData[rowIndex] = [];
      }
      
      // 确保行有足够的列
      const maxCol = Math.max(
        itemSkuCol, itemNameCol, colorNameCol, sizeNameCol, brandNameCol, manufacturerCol,
        mainImageUrlCol, otherImageUrl1Col, otherImageUrl2Col, otherImageUrl3Col, 
        otherImageUrl4Col, otherImageUrl5Col, productDescriptionCol,
        bulletPoint1Col, bulletPoint2Col, bulletPoint3Col, bulletPoint4Col, bulletPoint5Col
      );
      
      for (let i = updatedData[rowIndex].length; i <= maxCol; i++) {
        updatedData[rowIndex][i] = '';
      }

      // 填充数据
      if (itemSkuCol !== -1) {
        updatedData[rowIndex][itemSkuCol] = record.item_sku || '';
      }
      if (itemNameCol !== -1) {
        updatedData[rowIndex][itemNameCol] = processTextContent(record.item_name) || '';
      }
      if (colorNameCol !== -1) {
        updatedData[rowIndex][colorNameCol] = record.color_name || '';
      }
      if (sizeNameCol !== -1) {
        updatedData[rowIndex][sizeNameCol] = record.size_name || '';
      }
      if (brandNameCol !== -1) {
        updatedData[rowIndex][brandNameCol] = processTextContent(record.brand_name) || '';
      }
      if (manufacturerCol !== -1) {
        updatedData[rowIndex][manufacturerCol] = processTextContent(record.manufacturer) || '';
      }
      if (mainImageUrlCol !== -1) {
        updatedData[rowIndex][mainImageUrlCol] = processImageUrl(record.main_image_url) || '';
      }
      if (otherImageUrl1Col !== -1) {
        updatedData[rowIndex][otherImageUrl1Col] = processImageUrl(record.other_image_url1) || '';
      }
      if (otherImageUrl2Col !== -1) {
        updatedData[rowIndex][otherImageUrl2Col] = processImageUrl(record.other_image_url2) || '';
      }
      if (otherImageUrl3Col !== -1) {
        updatedData[rowIndex][otherImageUrl3Col] = processImageUrl(record.other_image_url3) || '';
      }
      if (otherImageUrl4Col !== -1) {
        updatedData[rowIndex][otherImageUrl4Col] = processImageUrl(record.other_image_url4) || '';
      }
      if (otherImageUrl5Col !== -1) {
        updatedData[rowIndex][otherImageUrl5Col] = processImageUrl(record.other_image_url5) || '';
      }
      if (productDescriptionCol !== -1) {
        updatedData[rowIndex][productDescriptionCol] = processTextContent(record.product_description) || '';
      }
      if (bulletPoint1Col !== -1) {
        updatedData[rowIndex][bulletPoint1Col] = processTextContent(record.bullet_point1) || '';
      }
      if (bulletPoint2Col !== -1) {
        updatedData[rowIndex][bulletPoint2Col] = processTextContent(record.bullet_point2) || '';
      }
      if (bulletPoint3Col !== -1) {
        updatedData[rowIndex][bulletPoint3Col] = processTextContent(record.bullet_point3) || '';
      }
      if (bulletPoint4Col !== -1) {
        updatedData[rowIndex][bulletPoint4Col] = processTextContent(record.bullet_point4) || '';
      }
      if (bulletPoint5Col !== -1) {
        updatedData[rowIndex][bulletPoint5Col] = processTextContent(record.bullet_point5) || '';
      }

      addedCount++;
    });

    console.log(`✅ 数据映射完成，添加了 ${addedCount} 行数据到${country}模板`);
    
    // 验证返回的数据格式
    if (!Array.isArray(updatedData) || updatedData.length === 0) {
      throw new Error('映射后的数据为空');
    }
    
    // 验证每行数据的完整性
    for (let i = 0; i < Math.min(updatedData.length, 5); i++) {
      if (!Array.isArray(updatedData[i])) {
        throw new Error(`第${i}行数据格式错误`);
      }
    }
    
    console.log(`📊 返回映射后的数据: ${updatedData.length} 行 x ${updatedData[0] ? updatedData[0].length : 0} 列`);
    
    return updatedData;
    
  } catch (error) {
    console.error('❌ 映射数据到模板失败:');
    console.error(`🔍 错误详情: ${error.message}`);
    console.error(`📋 错误堆栈:`, error.stack);
    console.error(`🏷️ 错误类型: ${error.name}`);
    console.error(`📊 输入参数: country=${country}, records数量=${Array.isArray(records) ? records.length : 'not array'}, templateData行数=${Array.isArray(templateData) ? templateData.length : 'not array'}`);
    throw error;
  }
}

// 批量生成其他站点资料表（基于源站点数据）
router.post('/generate-batch-other-site-datasheet', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  try {
    console.log('🔄 收到批量生成其他站点资料表请求');
    
    const { sourceCountry, targetCountry } = req.body;
    const uploadedFile = req.file;
    
    if (!sourceCountry || !targetCountry || !uploadedFile) {
      return res.status(400).json({ 
        message: '请提供源站点、目标站点信息和Excel文件' 
      });
    }
    
    if (sourceCountry === targetCountry) {
      return res.status(400).json({ 
        message: '源站点和目标站点不能相同' 
      });
    }

    console.log(`📝 处理批量生成: ${sourceCountry} -> ${targetCountry}, 文件: ${uploadedFile.originalname}`);

    // 步骤1: 解析上传的Excel文件
    console.log('📖 解析上传的Excel文件...');
    const workbook = xlsx.read(uploadedFile.buffer);
    
    // 优先寻找Template工作表，如果没有则使用第一个工作表
    let sheetName;
    let worksheet;
    
    if (workbook.Sheets['Template']) {
      sheetName = 'Template';
      worksheet = workbook.Sheets['Template'];
      console.log('✅ 找到Template工作表，使用Template工作表');
    } else {
      sheetName = workbook.SheetNames[0];
      worksheet = workbook.Sheets[sheetName];
      console.log(`⚠️ 未找到Template工作表，使用第一个工作表: ${sheetName}`);
    }
    
    console.log(`📋 当前使用的工作表: ${sheetName}`);
    
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      return res.status(400).json({ message: 'Excel文件格式错误，至少需要包含标题行和数据行' });
    }

    // 步骤2: 获取目标国家的模板文件
    console.log(`🔍 查找${targetCountry}站点的模板文件...`);
    
    const targetTemplate = await TemplateLink.findOne({
      where: {
        template_type: 'amazon',
        country: targetCountry,
        is_active: true
      },
      order: [['upload_time', 'DESC']]
    });
    
    if (!targetTemplate) {
      return res.status(400).json({ 
        message: `未找到${targetCountry}站点的资料模板，请先上传${targetCountry}模板文件` 
      });
    }

    console.log(`📄 使用${targetCountry}模板: ${targetTemplate.file_name} (ID: ${targetTemplate.id})`);

    // 步骤3: 下载目标模板文件
    console.log(`📥 下载${targetCountry}模板文件...`);
    const { downloadTemplateFromOSS } = require('../utils/oss');
    
    const downloadResult = await downloadTemplateFromOSS(targetTemplate.oss_object_name);
    
    if (!downloadResult.success) {
      console.error(`❌ 下载${targetCountry}模板失败:`, downloadResult.message);
      return res.status(500).json({ 
        message: `下载${targetCountry}模板失败: ${downloadResult.message}`,
        details: downloadResult.error
      });
    }

    console.log(`✅ ${targetCountry}模板下载成功: ${downloadResult.fileName} (${downloadResult.size} 字节)`);

    // 步骤4: 处理数据转换
    console.log('🔄 开始数据转换处理...');
    const { ProductInformation } = require('../models');
    
    // 获取标题行（第3行是标题行，索引为2）
    if (jsonData.length < 4) {
      return res.status(400).json({ message: 'Excel文件格式错误，至少需要包含前3行标题说明和数据行' });
    }
    
    const headers = jsonData[2]; // 第3行是标题行
    const dataRows = jsonData.slice(3); // 第4行开始是数据行
    
    const transformedRecords = [];
    
    for (const row of dataRows) {
      if (!row || row.length === 0) continue;
      
      // 创建数据对象
      const rowData = {};
      headers.forEach((header, index) => {
        if (header && row[index] !== undefined) {
          rowData[header.toLowerCase().replace(/\s+/g, '_')] = row[index];
        }
      });
      
      // 关键转换：将源站点的SKU转换为目标站点的SKU
      if (rowData.item_sku && rowData.item_sku.length > 2) {
        // 保存原始SKU（去掉前两个字符）作为original_parent_sku
        rowData.original_parent_sku = rowData.item_sku.substring(2);
        
        // 生成目标站点的SKU：目标站点前缀 + 原始SKU的后部分
        rowData.item_sku = targetCountry + rowData.item_sku.substring(2);
      }
      
      // 设置site字段为目标国家
      rowData.site = targetCountry;
      
      transformedRecords.push(rowData);
    }

    console.log(`🔄 转换了 ${transformedRecords.length} 条记录，SKU从${sourceCountry}前缀转换为${targetCountry}前缀`);

    // 步骤5: 使用xlsx库处理模板文件
    console.log('📊 开始使用xlsx库处理Excel文件...');
    
    // 解析模板文件
    const templateWorkbook = xlsx.read(downloadResult.content);
    const templateSheetName = templateWorkbook.SheetNames[0];
    const templateWorksheet = templateWorkbook.Sheets[templateSheetName];
    
    if (!templateWorksheet) {
      return res.status(400).json({ message: '模板文件格式错误，未找到工作表' });
    }

    // 将模板转换为数组格式以便处理
    const templateData = xlsx.utils.sheet_to_json(templateWorksheet, {header: 1});
    console.log(`📋 模板有 ${templateData.length} 行数据`);

    // 步骤6: 映射数据到模板
    console.log('🎯 开始映射转换后的数据到模板...');
    const updatedData = mapDataToTemplateXlsx(templateData, transformedRecords, targetCountry);

    // 步骤7: 创建新的工作簿并写入数据
    console.log('📤 生成最终文件...');
    
    try {
      const batchWorkbook = xlsx.utils.book_new();
      
      // 验证数据格式
      if (!Array.isArray(updatedData) || updatedData.length === 0) {
        throw new Error('映射后的数据为空或格式错误');
      }
      
      console.log(`📊 准备写入 ${updatedData.length} 行数据到Excel文件`);
      
      const batchWorksheet = xlsx.utils.aoa_to_sheet(updatedData);
      
      // 复制原模板的列宽设置
      if (templateWorksheet['!cols']) {
        batchWorksheet['!cols'] = templateWorksheet['!cols'];
      }
      
      // 验证工作表名称
      const sheetName = templateSheetName || 'Template';
      console.log(`📋 使用工作表名称: ${sheetName}`);
      
      xlsx.utils.book_append_sheet(batchWorkbook, batchWorksheet, sheetName);
      
      // 生成Excel文件buffer，使用更兼容的设置
      const outputBuffer = xlsx.write(batchWorkbook, { 
        type: 'buffer', 
        bookType: 'xlsx',
        compression: true,
        Props: {
          Title: `${targetCountry} Data Sheet`,
          Subject: `${targetCountry} Product Information`,
          CreatedDate: new Date()
        }
      });
      
      console.log(`✅ Excel文件生成成功，大小: ${outputBuffer.length} 字节`);
      
      const fileName = `${targetCountry}_data_sheet_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', outputBuffer.length);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ 批量生成${sourceCountry}到${targetCountry}资料表成功 (耗时: ${processingTime}ms)`);
      
      res.send(outputBuffer);
      
    } catch (fileError) {
      console.error('❌ Excel文件生成失败:', fileError);
      throw new Error('Excel文件生成失败: ' + fileError.message);
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error.message || '批量生成其他站点资料表时发生未知错误';
    console.error(`❌ 批量生成其他站点资料表失败 (耗时: ${processingTime}ms):`);
    console.error(`🔍 错误详情: ${error.message}`);
    console.error(`📋 错误堆栈:`, error.stack);
    console.error(`🏷️ 错误类型: ${error.name}`);
    
    // 输出请求参数以便调试
    console.error(`📋 请求参数: sourceCountry=${req.body.sourceCountry}, targetCountry=${req.body.targetCountry}, file=${req.file ? req.file.originalname : 'no file'}`);
    
    res.status(500).json({ 
      message: errorMessage,
      processingTime: processingTime,
      error: error.name,
      details: error.stack ? error.stack.split('\n')[0] : 'No stack trace'
    });
  }
});

// ==================== 3步流程 - 步骤1：上传源数据到数据库 ====================
router.post('/upload-source-data', upload.single('file'), async (req, res) => {
  try {
    console.log('🔄 开始上传源数据到数据库...');
    
    const { site } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ message: '未接收到文件' });
    }
    
    if (!site) {
      return res.status(400).json({ message: '未指定站点' });
    }
    
    console.log(`📄 处理文件: ${file.originalname}, 站点: ${site}`);
    
    // 读取Excel文件
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    
    // 优先寻找Template工作表，如果没有则使用第一个工作表
    let sheetName;
    let worksheet;
    
    if (workbook.Sheets['Template']) {
      sheetName = 'Template';
      worksheet = workbook.Sheets['Template'];
      console.log('✅ 找到Template工作表，使用Template工作表');
    } else {
      sheetName = workbook.SheetNames[0];
      worksheet = workbook.Sheets[sheetName];
      console.log(`⚠️ 未找到Template工作表，使用第一个工作表: ${sheetName}`);
    }
    
    console.log(`📋 当前使用的工作表: ${sheetName}`);
    
    // 转换为JSON
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length < 2) {
      return res.status(400).json({ message: 'Excel文件必须包含标题行和至少一行数据' });
    }
    
    // 提取标题行和数据行（第3行是标题行，索引为2）
    if (jsonData.length < 4) {
      return res.status(400).json({ message: 'Excel文件格式错误，至少需要包含前3行标题说明和数据行' });
    }
    
    const headers = jsonData[2]; // 第3行是标题行
    const dataRows = jsonData.slice(3); // 第4行开始是数据行
    
    console.log(`📊 文件包含 ${headers.length} 列，${dataRows.length} 行数据`);
    
    // 预处理标题行，生成字段映射
    const fieldMapping = {};
    const processedHeaders = headers.map((header, index) => {
      if (header) {
        const originalHeader = header.toString();
        const fieldName = originalHeader.toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^\w_]/g, '');
        fieldMapping[index] = { original: originalHeader, processed: fieldName };
        return fieldName;
      }
      return null;
    });
    
    console.log(`🔍 找到 ${processedHeaders.filter(h => h).length} 个有效列标题`);
    
    // 转换数据格式
    const records = [];
    let processedRows = 0;
    let skippedRows = 0;
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      // 步骤1: 检查整行是否为空
      const hasAnyValue = row.some(cell => cell !== undefined && cell !== null && cell !== '');
      if (!hasAnyValue) {
        skippedRows++;
        continue;
      }
      
      const record = {
        site: site // 只设置站点，不添加created_at和updated_at字段
      };
      
      let hasItemSku = false;
      let hasOtherValues = false;
      
      // 步骤2: 映射每一列的数据
      for (let j = 0; j < headers.length; j++) {
        const fieldName = processedHeaders[j]; // 使用预处理的字段名
        const cellValue = row[j];
        
        if (fieldName && cellValue !== undefined && cellValue !== null && cellValue !== '') {
          // 特殊处理一些字段
          if (fieldName === 'item_sku' || fieldName === 'sku') {
            record.item_sku = cellValue.toString(); // 转换为字符串
            hasItemSku = true;
            // 生成original_parent_sku：去掉前两个字符
            if (cellValue && cellValue.toString().length > 2) {
              record.original_parent_sku = cellValue.toString().substring(2);
            }
          } else {
            // 其他字段直接设置（只有当有值时）
            record[fieldName] = cellValue;
            hasOtherValues = true;
          }
        }
      }
      
      // 步骤3: 验证item_sku字段完整性
      if (!hasItemSku && hasOtherValues) {
        const errorMsg = `❌ 第${i + 4}行错误：item_sku字段为空但其他字段有值，item_sku作为主键不能为空`;
        console.error(errorMsg);
        console.error(`📋 问题行数据:`, record);
        return res.status(400).json({ 
          message: errorMsg,
          rowNumber: i + 4,
          rowData: record
        });
      }
      
      if (hasItemSku && !hasOtherValues) {
        const errorMsg = `❌ 第${i + 4}行错误：只有item_sku字段有值，其他字段都为空，记录缺少必要信息`;
        console.error(errorMsg);
        console.error(`📋 问题行数据:`, record);
        return res.status(400).json({ 
          message: errorMsg,
          rowNumber: i + 4,
          rowData: record
        });
      }
      
      if (!hasItemSku) {
        skippedRows++;
        continue;
      }
      
      records.push(record);
      processedRows++;
    }
    
    console.log(`📊 数据处理完成: 有效记录 ${processedRows} 条，跳过 ${skippedRows} 条`);
    
    console.log(`💾 准备保存 ${records.length} 条记录到product_information表...`);
    
    // 批量保存到数据库 - 适配复合主键
    try {
      // 首先删除相同站点的旧数据
      await ProductInformation.destroy({
        where: { site: site }
      });
      
      console.log(`🗑️ 已清理站点 ${site} 的旧数据`);
      
      // 逐条插入数据（因为复合主键的特殊性，使用upsert更安全）
      let successCount = 0;
      let errorCount = 0;
      
      for (const record of records) {
        try {
          await ProductInformation.upsert(record, {
            returning: false, // 提高性能
            validate: true // 启用验证
          });
          successCount++;
        } catch (error) {
          console.error(`❌ 保存记录失败: site=${record.site}, item_sku=${record.item_sku}, 错误: ${error.message}`);
          errorCount++;
        }
      }
      
      console.log(`✅ 成功保存 ${successCount} 条记录到数据库${errorCount > 0 ? `，${errorCount}条失败` : ''}`);
      
      // 返回成功响应
      res.json({
        success: true,
        message: `成功上传 ${successCount} 条记录到数据库${errorCount > 0 ? `，${errorCount}条失败` : ''}`,
        recordCount: successCount,
        errorCount: errorCount,
        site: site,
        fileName: file.originalname
      });
      
    } catch (dbError) {
      console.error('❌ 数据库操作失败:', dbError);
      throw new Error('数据库保存失败: ' + dbError.message);
    }
    
  } catch (error) {
    console.error('❌ 上传源数据失败:', error);
    res.status(500).json({
      message: '上传失败: ' + error.message,
      error: error.toString()
    });
  }
});

module.exports = router;
