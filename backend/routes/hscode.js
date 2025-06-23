const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const HsCode = require('../models/HsCode');

// 创建uploads目录（如果不存在）
const uploadsDir = path.join(__dirname, '../uploads/hscode');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  },
  fileFilter: function (req, file, cb) {
    // 只允许图片文件
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

// 获取所有HSCODE
router.get('/', async (req, res) => {
  try {
    const { category, status, search } = req.query;
    const where = {};
    
    if (category) where.category = category;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { hsCode: { [Op.like]: `%${search}%` } },
        { productName: { [Op.like]: `%${search}%` } },
        { productNameEn: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const hsCodes = await HsCode.findAll({
      where,
      order: [['usageCount', 'DESC'], ['createdAt', 'DESC']]
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

// 创建新HSCODE
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const hsCodeData = { ...req.body };
    
    // 如果有上传的图片
    if (req.file) {
      hsCodeData.imageUrl = `/uploads/hscode/${req.file.filename}`;
      hsCodeData.imageName = req.file.originalname;
    }
    
    const hsCode = await HsCode.create(hsCodeData);
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
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const hsCodeData = { ...req.body };
    
    // 如果有上传的新图片
    if (req.file) {
      // 删除旧图片
      const oldHsCode = await HsCode.findByPk(req.params.id);
      if (oldHsCode && oldHsCode.imageUrl) {
        const oldImagePath = path.join(__dirname, '../', oldHsCode.imageUrl);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      
      hsCodeData.imageUrl = `/uploads/hscode/${req.file.filename}`;
      hsCodeData.imageName = req.file.originalname;
    }
    
    const [updated] = await HsCode.update(hsCodeData, {
      where: { id: req.params.id }
    });
    
    if (updated) {
      const hsCode = await HsCode.findByPk(req.params.id);
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
router.delete('/:id', async (req, res) => {
  try {
    const hsCode = await HsCode.findByPk(req.params.id);
    if (!hsCode) {
      return res.status(404).json({
        code: 1,
        message: 'HSCODE不存在'
      });
    }
    
    // 删除关联的图片文件
    if (hsCode.imageUrl) {
      const imagePath = path.join(__dirname, '../', hsCode.imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    await hsCode.destroy();
    res.json({
      code: 0,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除HSCODE失败:', error);
    res.status(500).json({
      code: 1,
      message: '删除失败',
      error: error.message
    });
  }
});

// 获取产品分类列表
router.get('/categories', async (req, res) => {
  try {
    const categories = await HsCode.findAll({
      attributes: ['category'],
      where: {
        category: { [Op.ne]: null },
        status: 'active'
      },
      group: ['category'],
      order: [['category', 'ASC']]
    });
    
    res.json({
      code: 0,
      message: '获取成功',
      data: categories.map(item => item.category)
    });
  } catch (error) {
    console.error('获取分类列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 增加使用次数
router.post('/:id/use', async (req, res) => {
  try {
    const hsCode = await HsCode.findByPk(req.params.id);
    if (!hsCode) {
      return res.status(404).json({
        code: 1,
        message: 'HSCODE不存在'
      });
    }
    
    await hsCode.update({
      usageCount: hsCode.usageCount + 1,
      lastUsedAt: new Date()
    });
    
    res.json({
      code: 0,
      message: '使用次数更新成功'
    });
  } catch (error) {
    console.error('更新使用次数失败:', error);
    res.status(500).json({
      code: 1,
      message: '更新失败',
      error: error.message
    });
  }
});

module.exports = router; 