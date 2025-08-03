const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const ProductWeblink = require('../models/ProductWeblink');
const SellerInventorySku = require('../models/SellerInventorySku');
const multer = require('multer');
const xlsx = require('xlsx');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const pdf = require('pdf-parse');
const { uploadToOSS, deleteFromOSS } = require('../utils/oss');

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

// 子SKU生成器接口
router.post('/child-sku-generator', upload.single('file'), async (req, res) => {
  try {
    const { parentSkus } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: '请上传Excel文件' });
    }

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

    // 读取Excel文件
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    
    // 查找Template页面
    if (!workbook.SheetNames.includes('Template')) {
      return res.status(400).json({ message: 'Excel文件中未找到Template页面' });
    }

    const worksheet = workbook.Sheets['Template'];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length < 3) {
      return res.status(400).json({ message: 'Template页面至少需要3行数据（包含表头）' });
    }

    // 查找第三行中列的位置
    const headerRow = data[2]; // 第三行（索引2）
    let itemSkuCol = -1;
    let colorNameCol = -1;
    let sizeNameCol = -1;

    for (let i = 0; i < headerRow.length; i++) {
      const cellValue = headerRow[i]?.toString().toLowerCase();
      if (cellValue === 'item_sku') {
        itemSkuCol = i;
      } else if (cellValue === 'color_name') {
        colorNameCol = i;
      } else if (cellValue === 'size_name') {
        sizeNameCol = i;
      }
    }

    if (itemSkuCol === -1 || colorNameCol === -1 || sizeNameCol === -1) {
      return res.status(400).json({ 
        message: '在第三行中未找到必需的列：item_sku、color_name、size_name' 
      });
    }

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

    // 确保数据数组有足够的行数
    while (data.length < 4 + inventorySkus.length) {
      data.push([]);
    }

    // 确保数据数组有足够的行数
    while (data.length < 4 + inventorySkus.length) {
      data.push([]);
    }

    // 填充数据（从第4行开始，索引3）
    inventorySkus.forEach((sku, index) => {
      const rowIndex = 3 + index; // 第4行开始
      
      // 确保行存在
      if (!data[rowIndex]) {
        data[rowIndex] = [];
      }
      
      // 确保行有足够的列
      const maxCol = Math.max(itemSkuCol, colorNameCol, sizeNameCol);
      while (data[rowIndex].length <= maxCol) {
        data[rowIndex].push('');
      }
      
      // 填充数据
      data[rowIndex][itemSkuCol] = `UK${sku.child_sku}`;
      data[rowIndex][colorNameCol] = sku.sellercolorname || '';
      data[rowIndex][sizeNameCol] = sku.sellersizename || '';
    });

    // 重新创建工作表
    const newWorksheet = xlsx.utils.aoa_to_sheet(data);
    workbook.Sheets['Template'] = newWorksheet;

    // 生成Excel文件
    const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=processed_template.xlsx');
    
    res.send(excelBuffer);

  } catch (err) {
    console.error('子SKU生成器失败:', err);
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
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.ms-excel.sheet.macroEnabled.12'
    ];
    
    if (!validTypes.includes(req.file.mimetype) && !req.file.originalname.match(/\.(xlsx|xls|xlsm)$/i)) {
      return res.status(400).json({ message: '请上传有效的Excel文件（.xlsx、.xls或.xlsm格式）' });
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

    const uploadTime = Date.now() - startTime;
    console.log(`✅ 上传完成，耗时: ${uploadTime}ms`);

    res.json({
      message: `${country}站点资料表模板上传成功`,
      data: {
        fileName: uploadResult.originalName,
        url: uploadResult.url,
        objectName: uploadResult.name,
        size: uploadResult.size,
        country: country,
        uploadTime: new Date().toISOString(),
        processingTime: uploadTime
      }
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
    
    console.log(`📋 获取亚马逊模板列表，站点: ${country || '全部'}`);
    
    const { listTemplateFiles } = require('../utils/oss');
    
    const result = await listTemplateFiles('amazon', null, country);
    
    if (!result.success) {
      return res.status(500).json({ message: '获取模板列表失败' });
    }

    res.json({
      message: '获取成功',
      data: result.files,
      count: result.count
    });

  } catch (error) {
    console.error('获取亚马逊模板列表失败:', error);
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

    res.json({ message: '模板删除成功' });

  } catch (error) {
    console.error('删除亚马逊模板失败:', error);
    res.status(500).json({ message: '删除失败: ' + error.message });
  }
});

// ==================== 生成英国资料表相关接口 ====================

// 生成英国资料表接口
router.post('/generate-uk-data-sheet', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('📤 收到生成英国资料表请求');
    
    const { selectedParentSkus } = req.body;
    
    if (!selectedParentSkus || !Array.isArray(selectedParentSkus) || selectedParentSkus.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: '请选择要生成资料表的母SKU' 
      });
    }

    console.log(`📋 准备为 ${selectedParentSkus.length} 个母SKU生成英国资料表:`, selectedParentSkus);

    // 设置响应头用于流式进度更新
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // 发送进度更新函数
    const sendProgress = (step, message, progress) => {
      const progressData = {
        step,
        message,
        progress,
        timestamp: new Date().toISOString()
      };
      res.write(JSON.stringify(progressData) + '\n');
    };

    // 步骤1: 查询子SKU信息 (10%)
    sendProgress(1, '正在查询子SKU信息...', 10);
    
    const inventorySkus = await SellerInventorySku.findAll({
      where: {
        parent_sku: {
          [Op.in]: selectedParentSkus
        }
      },
      attributes: ['parent_sku', 'child_sku', 'sellercolorname', 'sellersizename']
    });

    if (inventorySkus.length === 0) {
      sendProgress(1, '未找到匹配的子SKU信息', 100);
      res.end(JSON.stringify({ success: false, message: '在数据库中未找到匹配的子SKU信息' }));
      return;
    }

    console.log(`📊 查询到 ${inventorySkus.length} 条子SKU记录`);
    sendProgress(1, `查询到 ${inventorySkus.length} 条子SKU记录`, 20);

    // 步骤2: 获取英国模板文件 (30%)
    sendProgress(2, '正在获取英国模板文件...', 30);
    
    const { downloadTemplateFromOSS } = require('../utils/oss');
    
    // 查找英国模板文件
    const { listTemplateFiles } = require('../utils/oss');
    const templateResult = await listTemplateFiles('amazon', null, 'UK');
    
    if (!templateResult.success || templateResult.files.length === 0) {
      sendProgress(2, '未找到英国模板文件', 100);
      res.end(JSON.stringify({ success: false, message: '未找到英国站点的资料模板文件' }));
      return;
    }

    // 使用第一个找到的英国模板
    const templateFile = templateResult.files[0];
    console.log(`📁 使用模板文件: ${templateFile.fileName}`);
    sendProgress(2, `找到模板文件: ${templateFile.fileName}`, 40);

    // 下载模板文件
    const downloadResult = await downloadTemplateFromOSS(templateFile.name);
    if (!downloadResult.success) {
      sendProgress(2, '下载模板文件失败', 100);
      res.end(JSON.stringify({ success: false, message: '下载模板文件失败: ' + downloadResult.message }));
      return;
    }

    sendProgress(2, '模板文件下载完成', 50);

    // 步骤3: 处理Excel文件 (50%-90%)
    sendProgress(3, '正在处理Excel文件...', 50);
    
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    
    // 从buffer加载工作簿
    await workbook.xlsx.load(downloadResult.content);
    
    // 获取Template工作表
    const worksheet = workbook.getWorksheet('Template');
    if (!worksheet) {
      sendProgress(3, 'Excel文件中未找到Template工作表', 100);
      res.end(JSON.stringify({ success: false, message: 'Excel文件中未找到Template工作表' }));
      return;
    }

    sendProgress(3, 'Excel文件加载完成，开始填写数据...', 60);

    // 查找列位置（第3行是标题行）
    const headerRow = worksheet.getRow(3);
    let itemSkuCol = -1;
    let colorNameCol = -1;
    let sizeNameCol = -1;

    headerRow.eachCell((cell, colNumber) => {
      const cellValue = cell.value?.toString().toLowerCase();
      if (cellValue === 'item_sku') {
        itemSkuCol = colNumber;
      } else if (cellValue === 'color_name') {
        colorNameCol = colNumber;
      } else if (cellValue === 'size_name') {
        sizeNameCol = colNumber;
      }
    });

    if (itemSkuCol === -1 || colorNameCol === -1 || sizeNameCol === -1) {
      sendProgress(3, '模板文件格式错误：未找到必需的列', 100);
      res.end(JSON.stringify({ 
        success: false, 
        message: '模板文件格式错误：在第三行中未找到必需的列（item_sku、color_name、size_name）' 
      }));
      return;
    }

    console.log(`📍 找到列位置 - item_sku: ${itemSkuCol}, color_name: ${colorNameCol}, size_name: ${sizeNameCol}`);
    sendProgress(3, '找到必需的列，开始填写数据...', 65);

    // 按母SKU分组整理数据
    const parentSkuGroups = {};
    inventorySkus.forEach(sku => {
      if (!parentSkuGroups[sku.parent_sku]) {
        parentSkuGroups[sku.parent_sku] = [];
      }
      parentSkuGroups[sku.parent_sku].push(sku);
    });

    // 准备要插入的数据
    const dataToInsert = [];
    let processedParents = 0;
    
    for (const parentSku of selectedParentSkus) {
      const childSkus = parentSkuGroups[parentSku] || [];
      
      // 先添加母SKU行（color_name和size_name留空）
      dataToInsert.push([
        itemSkuCol === 1 ? `UK${parentSku}` : '',
        itemSkuCol === 2 ? `UK${parentSku}` : (colorNameCol === 2 ? '' : ''),
        itemSkuCol === 3 ? `UK${parentSku}` : (colorNameCol === 3 ? '' : (sizeNameCol === 3 ? '' : ''))
      ]);
      
      // 然后添加子SKU行
      childSkus.forEach(sku => {
        const rowData = [];
        // 填充到正确的列位置
        for (let i = 1; i <= Math.max(itemSkuCol, colorNameCol, sizeNameCol); i++) {
          if (i === itemSkuCol) {
            rowData[i - 1] = `UK${sku.child_sku}`;
          } else if (i === colorNameCol) {
            rowData[i - 1] = sku.sellercolorname || '';
          } else if (i === sizeNameCol) {
            rowData[i - 1] = sku.sellersizename || '';
          } else {
            rowData[i - 1] = '';
          }
        }
        dataToInsert.push(rowData);
      });
      
      processedParents++;
      const progress = 65 + (processedParents / selectedParentSkus.length) * 20;
      sendProgress(3, `已处理 ${processedParents}/${selectedParentSkus.length} 个母SKU`, Math.round(progress));
    }

    console.log(`📝 准备插入 ${dataToInsert.length} 行数据`);
    sendProgress(3, `准备插入 ${dataToInsert.length} 行数据...`, 85);

    // 批量插入数据，从第4行开始，使用'i+'选项继承样式包括空单元格
    if (dataToInsert.length > 0) {
      worksheet.insertRows(4, dataToInsert, 'i+');
    }

    sendProgress(3, '数据填写完成', 90);

    // 步骤4: 生成文件并准备下载 (90%-100%)
    sendProgress(4, '正在生成最终文件...', 90);
    
    // 生成文件buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `UK_DataSheet_${selectedParentSkus.length}SKUs_${timestamp}.xlsx`;
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ 英国资料表生成完成，耗时: ${processingTime}ms`);
    
    sendProgress(4, '文件生成完成，准备下载...', 95);

    // 发送最终结果
    const finalResult = {
      success: true,
      message: `成功生成英国资料表，包含 ${selectedParentSkus.length} 个母SKU，${inventorySkus.length} 个子SKU`,
      fileName: fileName,
      fileSize: buffer.length,
      parentSkuCount: selectedParentSkus.length,
      childSkuCount: inventorySkus.length,
      totalRows: dataToInsert.length,
      processingTime: processingTime,
      downloadUrl: `/api/product_weblink/download-generated-file/${encodeURIComponent(fileName)}`,
      fileBuffer: buffer.toString('base64') // 用于直接下载
    };

    sendProgress(4, '准备文件下载...', 100);
    res.end(JSON.stringify(finalResult));

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ 生成英国资料表失败 (耗时: ${processingTime}ms):`, error);
    
    const errorResult = {
      success: false,
      message: '生成英国资料表失败: ' + error.message,
      processingTime: processingTime
    };
    
    try {
      res.end(JSON.stringify(errorResult));
    } catch (resError) {
      console.error('响应发送失败:', resError);
    }
  }
});

module.exports = router; 