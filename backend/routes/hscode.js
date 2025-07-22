const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const HsCode = require('../models/HsCode');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadToOSS } = require('../utils/oss');

// 创建上传目录
const uploadDir = path.join(__dirname, '../uploads/hscode-images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 使用parent_sku + 时间戳 + 原文件扩展名
    const parentSku = req.params.parentSku || req.body.parent_sku || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${parentSku}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // 检查文件类型
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  }
});



// 获取所有HSCODE
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const where = {};
    
    if (search) {
      where[Op.or] = [
        { parent_sku: { [Op.like]: `%${search}%` } },
        { weblink: { [Op.like]: `%${search}%` } },
        { uk_hscode: { [Op.like]: `%${search}%` } },
        { us_hscode: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const hsCodes = await HsCode.findAll({
      where,
      order: [['created_at', 'DESC']]
    });
    
    res.json({
      code: 0,
      message: '获取成功',
      data: hsCodes
    });
  } catch (error) {
    console.error('获取HSCODE列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 图片代理接口，支持私有OSS图片访问
router.get('/image-proxy', async (req, res) => {
  try {
    let { url } = req.query;
    if (!url) {
      return res.status(400).json({ code: 1, message: '缺少图片url参数' });
    }
    url = decodeURIComponent(url);
    // 判断是完整OSS链接还是objectKey
    let objectKey = '';
    if (url.startsWith('http')) {
      // 解析OSS链接，获取objectKey
      try {
        const u = new URL(url);
        objectKey = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
      } catch (e) {
        return res.status(400).json({ code: 1, message: 'url格式不正确' });
      }
    } else {
      // 直接就是objectKey
      objectKey = url;
    }
    // OSS配置
    const OSS = require('ali-oss');
    const client = new OSS({
      region: process.env.OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      endpoint: process.env.OSS_ENDPOINT,
      secure: true
    });
    // 获取图片内容
    const result = await client.get(objectKey);
    // 根据扩展名设置Content-Type
    const ext = objectKey.toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) contentType = 'image/jpeg';
    else if (ext.endsWith('.png')) contentType = 'image/png';
    else if (ext.endsWith('.gif')) contentType = 'image/gif';
    else if (ext.endsWith('.webp')) contentType = 'image/webp';
    res.set({
      'Content-Type': contentType,
      'Content-Length': result.content.length,
      'Cache-Control': 'public, max-age=31536000',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.send(result.content);
  } catch (error) {
    console.error('图片代理失败:', error.message);
    if (error.code === 'NoSuchKey') {
      res.status(404).json({ code: 1, message: '图片不存在' });
    } else {
      res.status(500).json({ code: 1, message: '图片获取失败: ' + error.message });
    }
  }
});

// 根据parent_sku获取单个HSCODE
router.get('/:parentSku', async (req, res) => {
  try {
    const parentSku = decodeURIComponent(req.params.parentSku);
    console.log('🔍 获取HSCODE请求 - parent_sku:', parentSku);
    
    const hsCode = await HsCode.findByPk(parentSku);
    if (!hsCode) {
      return res.status(404).json({
        code: 1,
        message: 'HSCODE不存在'
      });
    }
    
    res.json({
      code: 0,
      message: '获取成功',
      data: hsCode
    });
  } catch (error) {
    console.error('获取HSCODE详情失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 创建新HSCODE
router.post('/', async (req, res) => {
  try {
    const { parent_sku, weblink, uk_hscode, us_hscode, declared_value_usd, declared_value_gbp, declared_image } = req.body;
    // 验证必填字段
    if (!parent_sku || !weblink || !uk_hscode || !us_hscode) {
      return res.status(400).json({
        code: 1,
        message: '缺少必填字段'
      });
    }
    // 检查parent_sku是否已存在
    const existingHsCode = await HsCode.findByPk(parent_sku);
    if (existingHsCode) {
      return res.status(400).json({
        code: 1,
        message: '该父SKU已存在'
      });
    }
    const hsCode = await HsCode.create({
      parent_sku,
      weblink,
      uk_hscode,
      us_hscode,
      declared_value_usd,
      declared_value_gbp,
      declared_image
    });
    res.json({
      code: 0,
      message: '创建成功',
      data: hsCode
    });
  } catch (error) {
    console.error('创建HSCODE失败:', error);
    res.status(500).json({
      code: 1,
      message: '创建失败',
      error: error.message
    });
  }
});

// 更新HSCODE
router.put('/:parentSku', async (req, res) => {
  try {
    const parentSku = decodeURIComponent(req.params.parentSku);
    const { weblink, uk_hscode, us_hscode, declared_value_usd, declared_value_gbp, declared_image } = req.body;
    if (!weblink || !uk_hscode || !us_hscode) {
      return res.status(400).json({
        code: 1,
        message: '缺少必填字段'
      });
    }
    const [updated] = await HsCode.update({
      weblink,
      uk_hscode,
      us_hscode,
      declared_value_usd,
      declared_value_gbp,
      declared_image
    }, {
      where: { parent_sku: parentSku }
    });
    if (updated) {
      const hsCode = await HsCode.findByPk(parentSku);
      res.json({
        code: 0,
        message: '更新成功',
        data: hsCode
      });
    } else {
      res.status(404).json({
        code: 1,
        message: 'HSCODE不存在'
      });
    }
  } catch (error) {
    console.error('更新HSCODE失败:', error);
    res.status(500).json({
      code: 1,
      message: '更新失败',
      error: error.message
    });
  }
});

// 删除HSCODE
router.delete('/:parentSku', async (req, res) => {
  try {
    const parentSku = decodeURIComponent(req.params.parentSku);
    console.log('🗑️ 删除HSCODE请求 - parent_sku:', parentSku);
    console.log('🗑️ 原始参数:', req.params.parentSku);
    
    // 先查找记录
    const hsCode = await HsCode.findOne({
      where: { parent_sku: parentSku }
    });
    console.log('🔍 查找结果:', hsCode ? JSON.stringify(hsCode.dataValues) : '记录不存在');
    
    if (!hsCode) {
      console.log('❌ 记录不存在，parent_sku:', parentSku);
      return res.status(404).json({
        code: 1,
        message: 'HSCODE记录不存在'
      });
    }
    
    // 执行删除
    console.log('🗑️ 开始删除记录:', hsCode.parent_sku);
    const deletedRows = await HsCode.destroy({
      where: { parent_sku: parentSku }
    });
    console.log('✅ 删除操作完成，影响行数:', deletedRows);
    
    if (deletedRows === 0) {
      console.error('⚠️ 删除异常：没有删除任何记录');
      return res.status(500).json({
        code: 1,
        message: '删除操作失败，没有删除任何记录'
      });
    }
    
    // 验证删除是否成功
    const verifyDeleted = await HsCode.findOne({
      where: { parent_sku: parentSku }
    });
    console.log('🔍 删除验证:', verifyDeleted ? '删除失败，记录仍存在' : '删除成功');
    
    if (verifyDeleted) {
      console.error('⚠️ 删除异常：记录仍然存在');
      return res.status(500).json({
        code: 1,
        message: '删除操作失败，记录仍然存在'
      });
    }
    
    res.json({
      code: 0,
      message: '删除成功'
    });
  } catch (error) {
    console.error('❌ 删除HSCODE失败:', error);
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      sql: error.sql
    });
    res.status(500).json({
      code: 1,
      message: '删除失败',
      error: error.message
    });
  }
});

// 上传申报图片（改为OSS）
router.post('/:parentSku/upload-image', upload.single('image'), async (req, res) => {
  try {
    const parentSku = decodeURIComponent(req.params.parentSku);
    if (!req.file) {
      return res.status(400).json({
        code: 1,
        message: '请选择要上传的图片文件'
      });
    }
    // 检查记录是否存在
    const hsCode = await HsCode.findByPk(parentSku);
    if (!hsCode) {
      return res.status(404).json({
        code: 1,
        message: 'HSCODE记录不存在'
      });
    }
    // 上传到OSS
    const fs = require('fs');
    const buffer = fs.readFileSync(req.file.path);
    const ossResult = await uploadToOSS(buffer, req.file.originalname, 'hscode-images');
    // 删除本地临时文件
    fs.unlinkSync(req.file.path);
    // 生成代理URL
    const proxyUrl = `/api/hscode/image-proxy?url=${encodeURIComponent(ossResult.name)}`;
    // 更新数据库记录
    await HsCode.update({
      declared_image: proxyUrl
    }, {
      where: { parent_sku: parentSku }
    });
    const updatedHsCode = await HsCode.findByPk(parentSku);
    res.json({
      code: 0,
      message: '图片上传成功',
      data: {
        declared_image: proxyUrl,
        record: updatedHsCode
      }
    });
  } catch (error) {
    console.error('上传申报图片失败:', error);
    if (req.file && req.file.path && require('fs').existsSync(req.file.path)) {
      require('fs').unlinkSync(req.file.path);
    }
    res.status(500).json({
      code: 1,
      message: '图片上传失败',
      error: error.message
    });
  }
});

// 删除申报图片
router.delete('/:parentSku/image', async (req, res) => {
  try {
    const parentSku = decodeURIComponent(req.params.parentSku);
    const { deleteFromOSS } = require('../utils/oss');
    // 查找记录
    const hsCode = await HsCode.findByPk(parentSku);
    if (!hsCode) {
      return res.status(404).json({
        code: 1,
        message: 'HSCODE记录不存在'
      });
    }
    if (!hsCode.declared_image) {
      return res.status(400).json({
        code: 1,
        message: '该记录没有申报图片'
      });
    }
    // 判断是否为OSS图片链接并提取objectName
    let ossDeleteResult = null;
    let objectName = null;
    
    // 检查是否为代理URL格式
    if (hsCode.declared_image && hsCode.declared_image.includes('/api/hscode/image-proxy')) {
      try {
        // 从代理URL中提取objectName
        const urlParams = new URLSearchParams(hsCode.declared_image.split('?')[1]);
        objectName = urlParams.get('url');
        if (objectName) {
          objectName = decodeURIComponent(objectName);
        }
      } catch (e) {
        console.warn('解析代理URL失败:', e.message);
      }
    } else if (/aliyuncs\.com[\/:]/.test(hsCode.declared_image)) {
      // 直接OSS链接格式
      try {
        const urlObj = new URL(hsCode.declared_image);
        objectName = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
      } catch (e) {
        console.warn('解析OSS URL失败:', e.message);
      }
    }
    
    // 如果成功提取到objectName，尝试删除OSS文件
    if (objectName) {
      try {
        ossDeleteResult = await deleteFromOSS(objectName);
        console.log('🗑️ 尝试删除OSS文件:', objectName, '结果:', ossDeleteResult);
      } catch (e) {
        console.warn('OSS图片删除失败:', e.message);
        ossDeleteResult = { success: false, error: e.message };
      }
    } else {
      // 删除本地文件
      const imagePath = path.join(__dirname, '../uploads/hscode-images', path.basename(hsCode.declared_image));
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log('🗑️ 删除本地文件:', imagePath);
      }
    }
    // 更新数据库记录
    await HsCode.update({
      declared_image: null,
      updated_at: new Date()
    }, {
      where: { parent_sku: parentSku }
    });
    res.json({
      code: 0,
      message: '申报图片删除成功',
      ossDeleteResult
    });
  } catch (error) {
    console.error('删除申报图片失败:', error);
    res.status(500).json({
      code: 1,
      message: '删除图片失败',
      error: error.message
    });
  }
});

// 批量创建HSCODE
router.post('/batch', async (req, res) => {
  try {
    const { hsCodes } = req.body;
    
    if (!Array.isArray(hsCodes) || hsCodes.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '请提供有效的HSCODE数据数组'
      });
    }
    
    // 验证数据格式
    for (const hsCode of hsCodes) {
      if (!hsCode.parent_sku || !hsCode.weblink || !hsCode.uk_hscode || !hsCode.us_hscode) {
        return res.status(400).json({
          code: 1,
          message: '每条记录都需要包含parent_sku、weblink、uk_hscode、us_hscode字段'
        });
      }
      // 设置默认货币
      if (hsCode.declared_value && !hsCode.declared_value_currency) {
        hsCode.declared_value_currency = 'USD';
      }
    }
    
    const createdHsCodes = await HsCode.bulkCreate(hsCodes, {
      ignoreDuplicates: true,
      returning: true
    });
    
    res.json({
      code: 0,
      message: `成功创建${createdHsCodes.length}条记录`,
      data: createdHsCodes
    });
  } catch (error) {
    console.error('批量创建HSCODE失败:', error);
    res.status(500).json({
      code: 1,
      message: '批量创建失败',
      error: error.message
    });
  }
});

module.exports = router; 