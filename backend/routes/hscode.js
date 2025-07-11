const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const HsCode = require('../models/HsCode');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
    const { parent_sku, weblink, uk_hscode, us_hscode, declared_value, declared_value_currency } = req.body;
    
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
      declared_value,
      declared_value_currency: declared_value_currency || 'USD',
      declared_image: req.body.declared_image
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
    console.log('📝 更新HSCODE请求 - parent_sku:', parentSku);
    
    const { weblink, uk_hscode, us_hscode, declared_value, declared_value_currency, declared_image } = req.body;
    
    // 验证必填字段
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
      declared_value,
      declared_value_currency,
      declared_image,
      updated_at: new Date()
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

// 上传申报图片
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
      // 删除已上传的文件
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        code: 1,
        message: 'HSCODE记录不存在'
      });
    }
    
    // 如果之前有图片，删除旧图片
    if (hsCode.declared_image) {
      const oldImagePath = path.join(__dirname, '../uploads/hscode-images', path.basename(hsCode.declared_image));
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }
    
    // 更新数据库记录
    const imagePath = `/uploads/hscode-images/${req.file.filename}`;
    await HsCode.update({
      declared_image: imagePath,
      updated_at: new Date()
    }, {
      where: { parent_sku: parentSku }
    });
    
    // 获取更新后的记录
    const updatedHsCode = await HsCode.findByPk(parentSku);
    
    res.json({
      code: 0,
      message: '图片上传成功',
      data: {
        declared_image: imagePath,
        record: updatedHsCode
      }
    });
  } catch (error) {
    console.error('上传申报图片失败:', error);
    // 如果有上传的文件，删除它
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
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
    
    // 删除文件
    const imagePath = path.join(__dirname, '../uploads/hscode-images', path.basename(hsCode.declared_image));
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
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
      message: '申报图片删除成功'
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