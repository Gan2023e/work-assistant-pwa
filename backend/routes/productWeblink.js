const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const ProductWeblink = require('../models/ProductWeblink');
const SellerInventorySku = require('../models/SellerInventorySku');
const multer = require('multer');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs'); // 新增ExcelJS支持
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const pdf = require('pdf-parse');
const { 
  uploadToOSS, 
  deleteFromOSS, 
  uploadTemplateToOSS, 
  listTemplateFiles, 
  downloadTemplateFromOSS, 
  deleteTemplateFromOSS, 
  checkOSSConfig,
  createOSSClient 
} = require('../utils/oss'); // 扩展OSS工具函数导入

// 配置multer用于文件上传
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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
router.post('/upload-excel-new', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '请选择Excel文件' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

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
      
      // 发送钉钉通知
      try {
        await sendDingTalkNotification(newRecords.length);
      } catch (notificationError) {
        console.error('钉钉通知发送失败，但不影响数据保存:', notificationError.message);
      }
    } else {
      resultMessage = '没有找到有效的数据行';
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
    console.error(err);
    res.status(500).json({ message: '文件上传失败: ' + err.message });
  }
});

// SKU最新编号查询
router.post('/latest-sku', async (req, res) => {
  try {
    const { prefix } = req.body;
    if (!prefix || prefix.trim() === '') {
      return res.status(400).json({ message: '请提供SKU前缀' });
    }

    const trimmedPrefix = prefix.trim();
    
    // 使用正则表达式精确匹配：前缀 + 数字
    // 例如：XB001, XB002, ... XB999，但不包括XBC001
    const result = await ProductWeblink.findOne({
      where: {
        parent_sku: {
          [Op.regexp]: `^${trimmedPrefix}[0-9]+$`
        }
      },
      order: [['parent_sku', 'DESC']],
      attributes: ['parent_sku']
    });

    res.json({ 
      latestSku: result ? result.parent_sku : '未找到该前缀的SKU'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '查询失败: ' + err.message });
  }
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

// 子SKU生成器接口（单模板模式 - 仅支持英国模板）
router.post('/child-sku-generator', async (req, res) => {
  try {
    const { parentSkus } = req.body;
    
    if (!parentSkus || parentSkus.trim() === '') {
      return res.status(400).json({ message: '请输入需要整理的SKU' });
    }

    // 解析输入的SKU列表
    const skuList = parentSkus
      .split('\n')
      .map(sku => sku.trim())
      .filter(Boolean);

    if (skuList.length === 0) {
      return res.status(400).json({ message: '请输入有效的SKU' });
    }

    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.status(500).json({ message: 'OSS配置不完整，请联系管理员' });
    }

    let workbook, templateSheet;
    let templateName = 'processed_template';

    try {
      // 获取英国模板配置（单模板模式）
      const allConfigs = await getUKTemplateConfigFromOSS();
      const templates = allConfigs.templates || {};
      
      if (Object.keys(templates).length === 0) {
        return res.status(404).json({ message: '系统中没有英国资料表模板，请先上传模板' });
      }

      // 单模板模式，获取唯一的模板
      const templateId = Object.keys(templates)[0];
      const template = templates[templateId];
      templateName = template.name || template.originalName.replace(/\.[^/.]+$/, "");
      
      // 从OSS下载模板文件
      console.log(`📥 正在从OSS下载英国模板: ${template.name}`);
      const downloadResult = await downloadTemplateFromOSS(template.ossPath);
      
      if (!downloadResult.success) {
        throw new Error('模板文件下载失败');
      }

      // 使用ExcelJS读取模板，完美保持格式
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(downloadResult.content);
      
      templateSheet = workbook.getWorksheet('Template');
      if (!templateSheet) {
        return res.status(400).json({ message: '模板中未找到Template工作表' });
      }
      
      console.log(`✅ 英国模板"${template.name}"下载并读取成功`);
      
    } catch (error) {
      console.error('❌ 英国模板处理失败:', error);
      return res.status(500).json({ message: '英国模板处理失败: ' + error.message });
    }

    // 使用ExcelJS验证Template工作表结构
    const headerRow = templateSheet.getRow(3); // 第3行
    const headers = [];
    let itemSkuCol = -1;
    let colorNameCol = -1;
    let sizeNameCol = -1;

    headerRow.eachCell((cell, colNumber) => {
      const cellValue = cell.text?.toLowerCase() || '';
      headers.push(cellValue);
      
      if (cellValue === 'item_sku') {
        itemSkuCol = colNumber;
      } else if (cellValue === 'color_name') {
        colorNameCol = colNumber;
      } else if (cellValue === 'size_name') {
        sizeNameCol = colNumber;
      }
    });

    if (itemSkuCol === -1 || colorNameCol === -1 || sizeNameCol === -1) {
      return res.status(400).json({ 
        message: '在第三行中未找到必需的列：item_sku、color_name、size_name' 
      });
    }

    console.log(`📊 找到必需列位置 - item_sku:${itemSkuCol}, color_name:${colorNameCol}, size_name:${sizeNameCol}`);

    // 从数据库查询子SKU信息
    const inventorySkus = await SellerInventorySku.findAll({
      where: {
        parent_sku: {
          [Op.in]: skuList
        }
      }
    });

    if (inventorySkus.length === 0) {
      return res.status(404).json({ 
        message: '在数据库中未找到匹配的子SKU信息' 
      });
    }

    console.log(`🔍 找到 ${inventorySkus.length} 个子SKU记录`);

    // 使用ExcelJS精确填写数据，保持所有原始格式
    let currentRow = 4; // 从第4行开始填写数据
    
    inventorySkus.forEach((sku, index) => {
      // 使用ExcelJS的方式填写item_sku列，完美保持格式
      const itemSkuCell = templateSheet.getCell(currentRow, itemSkuCol);
      itemSkuCell.value = `UK${sku.child_sku}`;
      
      // 使用ExcelJS的方式填写color_name列，完美保持格式
      const colorNameCell = templateSheet.getCell(currentRow, colorNameCol);
      colorNameCell.value = sku.sellercolorname || '';
      
      // 使用ExcelJS的方式填写size_name列，完美保持格式
      const sizeNameCell = templateSheet.getCell(currentRow, sizeNameCol);
      sizeNameCell.value = sku.sellersizename || '';
      
      console.log(`📝 ExcelJS填写第${currentRow}行: UK${sku.child_sku}, ${sku.sellercolorname || ''}, ${sku.sellersizename || ''}`);
      
      currentRow++;
    });

    console.log(`✅ ExcelJS完成数据填写，共填写 ${inventorySkus.length} 行数据，保持完美格式`);

    // 使用ExcelJS生成Excel文件，完美保持所有原始格式
    const excelBuffer = await workbook.xlsx.writeBuffer();

    // 生成带时间戳的文件名（支持中文）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputFileName = `${templateName}_子SKU_${timestamp}.xlsx`;
    const encodedFileName = encodeURIComponent(outputFileName);

    // 设置响应头（支持中文文件名）
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
    res.setHeader('Content-Length', excelBuffer.length);
    
    console.log(`📦 返回处理后的Excel文件: ${outputFileName}`);
    res.send(excelBuffer);

  } catch (err) {
    console.error('❌ 子SKU生成器失败:', err);
    res.status(500).json({ message: '子SKU生成器失败: ' + err.message });
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

// ================================
// 英国资料表模板管理接口
// ================================

// OSS配置常量
const UK_TEMPLATE_CONFIG_OSS_PATH = 'templates/config/uk-template-config.json';
const UK_TEMPLATE_FOLDER = '英国'; // 使用中文文件夹名

// 获取英国模板配置
async function getUKTemplateConfigFromOSS() {
  try {
    if (!checkOSSConfig()) {
      console.warn('OSS配置不完整，使用空配置');
      return { templates: {} };
    }

    const result = await downloadTemplateFromOSS(UK_TEMPLATE_CONFIG_OSS_PATH);
    
    if (result.success) {
      const configText = result.content.toString('utf8');
      return JSON.parse(configText);
    } else {
      console.log('英国模板配置文件不存在，返回空配置');
      return { templates: {} };
    }
  } catch (error) {
    console.warn('获取英国模板配置失败:', error.message);
    return { templates: {} };
  }
}

// 保存英国模板配置到OSS
async function saveUKTemplateConfigToOSS(config) {
  try {
    if (!checkOSSConfig()) {
      throw new Error('OSS配置不完整');
    }

    const client = createOSSClient();
    const configBuffer = Buffer.from(JSON.stringify(config, null, 2), 'utf8');
    
    // 使用OSS客户端直接上传配置文件，确保中文编码正确
    const result = await client.put(UK_TEMPLATE_CONFIG_OSS_PATH, configBuffer, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-oss-storage-class': 'Standard'
      }
    });

    console.log('✅ 英国模板配置保存成功:', result.name);
    return { success: true };
  } catch (error) {
    console.error('❌ 保存英国模板配置失败:', error);
    throw error;
  }
}

// 上传英国资料表模板（单模板模式）
router.post('/uk-template/upload', upload.single('template'), async (req, res) => {
  try {
    const { templateName, description } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传模板文件'
      });
    }

    if (!templateName || templateName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '请输入模板名称'
      });
    }

    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.status(500).json({
        success: false,
        message: 'OSS配置不完整，请联系管理员配置OSS服务'
      });
    }

    // 检查是否已存在模板
    const existingConfig = await getUKTemplateConfigFromOSS();
    const existingTemplates = existingConfig.templates || {};
    
    if (Object.keys(existingTemplates).length > 0) {
      return res.status(400).json({
        success: false,
        message: '系统中已存在英国资料表模板，如需更新请先删除现有模板'
      });
    }

    // 验证Excel文件格式
    let workbook;
    try {
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      
      // 验证是否包含Template工作表
      const templateSheet = workbook.getWorksheet('Template');
      if (!templateSheet) {
        return res.status(400).json({
          success: false,
          message: 'Excel文件中必须包含名为"Template"的工作表'
        });
      }

      // 验证Template工作表的结构（第3行必须包含item_sku、color_name、size_name列）
      const headerRow = templateSheet.getRow(3);
      const headers = [];
      headerRow.eachCell((cell, colNumber) => {
        headers.push(cell.text?.toLowerCase() || '');
      });

      const requiredColumns = ['item_sku', 'color_name', 'size_name'];
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));
      
      if (missingColumns.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Template工作表第3行缺少必需的列：${missingColumns.join('、')}`
        });
      }

      console.log('✅ Excel文件验证通过，包含Template工作表和必需列');
      
    } catch (error) {
      console.error('❌ Excel文件验证失败:', error);
      return res.status(400).json({
        success: false,
        message: '无效的Excel文件格式：' + error.message
      });
    }

    // 确保文件名支持中文，避免乱码
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    console.log('📁 原始文件名:', originalName);

    // 上传模板文件到OSS
    const uploadResult = await uploadTemplateToOSS(
      req.file.buffer,
      originalName,
      'amazon',
      null,
      UK_TEMPLATE_FOLDER // 使用中文文件夹名
    );

    if (!uploadResult.success) {
      throw new Error('模板文件上传失败');
    }

    // 生成唯一模板ID（单模板模式）
    const templateId = 'uk_template_single';
    
    // 创建新配置（单模板）
    const newConfig = {
      templates: {
        [templateId]: {
          id: templateId,
          name: templateName.trim(),
          description: description?.trim() || '',
          originalName: originalName,
          ossPath: uploadResult.name,
          uploadTime: new Date().toISOString(),
          fileSize: uploadResult.size,
          isDefault: true // 单模板模式，始终为默认
        }
      }
    };

    // 保存配置
    await saveUKTemplateConfigToOSS(newConfig);

    console.log(`✅ 英国资料表模板上传成功（单模板模式）: ${templateName.trim()}`);

    res.json({
      success: true,
      message: '英国资料表模板上传成功',
      data: {
        templateId: templateId,
        templateName: templateName.trim(),
        fileName: originalName,
        uploadTime: newConfig.templates[templateId].uploadTime,
        fileSize: uploadResult.size
      }
    });

  } catch (error) {
    console.error('❌ 上传英国模板失败:', error);
    res.status(500).json({
      success: false,
      message: '上传失败: ' + error.message
    });
  }
});

// 获取英国资料表模板列表
router.get('/uk-template/list', async (req, res) => {
  try {
    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.json({
        success: true,
        data: {
          hasTemplate: false,
          templates: []
        }
      });
    }

    const allConfigs = await getUKTemplateConfigFromOSS();
    const templates = allConfigs.templates || {};
    
    const templateList = Object.values(templates).map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      originalName: template.originalName,
      uploadTime: template.uploadTime,
      fileSize: template.fileSize,
      isDefault: template.isDefault,
      // 添加预览URL（通过代理访问）
      previewUrl: `/api/product_weblink/uk-template/preview/${template.id}`
    }));

    res.json({
      success: true,
      data: {
        hasTemplate: templateList.length > 0,
        templates: templateList,
        count: templateList.length
      }
    });

  } catch (error) {
    console.error('❌ 获取英国模板列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模板列表失败: ' + error.message
    });
  }
});

// 删除英国资料表模板（单模板模式）
router.delete('/uk-template/delete', async (req, res) => {
  try {
    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.status(500).json({
        success: false,
        message: 'OSS配置不完整，无法删除模板'
      });
    }

    // 获取现有配置
    const allConfigs = await getUKTemplateConfigFromOSS();
    const templates = allConfigs.templates || {};
    
    if (Object.keys(templates).length === 0) {
      return res.status(404).json({
        success: false,
        message: '当前没有英国资料表模板'
      });
    }

    // 单模板模式，获取唯一的模板
    const templateId = Object.keys(templates)[0];
    const template = templates[templateId];
    
    // 删除OSS中的模板文件
    try {
      console.log(`🔄 正在删除模板文件: ${template.ossPath}`);
      await deleteTemplateFromOSS(template.ossPath);
      console.log(`✅ 模板文件删除成功: ${template.name}`);
    } catch (deleteError) {
      console.warn(`⚠️ 删除模板文件失败:`, deleteError.message);
      // 即使文件删除失败，也继续删除配置
    }
    
    // 删除配置文件
    try {
      await deleteTemplateFromOSS(UK_TEMPLATE_CONFIG_OSS_PATH);
      console.log('✅ 英国模板配置文件删除成功');
    } catch (error) {
      console.warn('⚠️ 删除配置文件失败:', error.message);
    }

    console.log(`✅ 英国资料表模板删除成功（单模板模式）: ${template.name}`);

    res.json({
      success: true,
      message: `英国资料表模板"${template.name}"删除成功，现在可以上传新模板`,
      data: {
        deletedTemplate: {
          id: templateId,
          name: template.name,
          originalName: template.originalName
        }
      }
    });

  } catch (error) {
    console.error('❌ 删除英国模板失败:', error);
    res.status(500).json({
      success: false,
      message: '删除失败: ' + error.message
    });
  }
});

// 预览英国资料表模板
router.get('/uk-template/preview/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;

    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.status(500).json({
        success: false,
        message: 'OSS配置不完整'
      });
    }

    // 获取配置
    const allConfigs = await getUKTemplateConfigFromOSS();
    const templates = allConfigs.templates || {};
    
    if (!templates[templateId]) {
      return res.status(404).json({
        success: false,
        message: '模板不存在'
      });
    }

    const template = templates[templateId];
    
    // 从OSS下载模板文件
    const downloadResult = await downloadTemplateFromOSS(template.ossPath);
    
    if (!downloadResult.success) {
      throw new Error('模板文件下载失败');
    }

    // 设置正确的Content-Type和文件名（支持中文）
    const encodedFilename = encodeURIComponent(template.originalName);
    
    res.setHeader('Content-Type', downloadResult.contentType);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Length', downloadResult.content.length);
    
    res.send(downloadResult.content);

  } catch (error) {
    console.error('❌ 预览英国模板失败:', error);
    res.status(500).json({
      success: false,
      message: '预览失败: ' + error.message
    });
  }
});

// 注意：单模板模式下不需要设置默认模板功能

module.exports = router; 