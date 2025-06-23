const express = require('express');
const router = express.Router();
const AmzWarehouse = require('../models/AmzWarehouse');

// 获取所有仓库
router.get('/', async (req, res) => {
  try {
    const warehouses = await AmzWarehouse.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json({
      code: 0,
      message: '获取成功',
      data: warehouses
    });
  } catch (error) {
    console.error('获取仓库列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 创建新仓库
router.post('/', async (req, res) => {
  try {
    const warehouse = await AmzWarehouse.create(req.body);
    res.json({
      code: 0,
      message: '创建成功',
      data: warehouse
    });
  } catch (error) {
    console.error('创建仓库失败:', error);
    res.status(500).json({
      code: 1,
      message: '创建失败',
      error: error.message
    });
  }
});

// 更新仓库
router.put('/:id', async (req, res) => {
  try {
    const [updated] = await AmzWarehouse.update(req.body, {
      where: { id: req.params.id }
    });
    
    if (updated) {
      const warehouse = await AmzWarehouse.findByPk(req.params.id);
      res.json({
        code: 0,
        message: '更新成功',
        data: warehouse
      });
    } else {
      res.status(404).json({
        code: 1,
        message: '仓库不存在'
      });
    }
  } catch (error) {
    console.error('更新仓库失败:', error);
    res.status(500).json({
      code: 1,
      message: '更新失败',
      error: error.message
    });
  }
});

// 删除仓库
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await AmzWarehouse.destroy({
      where: { id: req.params.id }
    });
    
    if (deleted) {
      res.json({
        code: 0,
        message: '删除成功'
      });
    } else {
      res.status(404).json({
        code: 1,
        message: '仓库不存在'
      });
    }
  } catch (error) {
    console.error('删除仓库失败:', error);
    res.status(500).json({
      code: 1,
      message: '删除失败',
      error: error.message
    });
  }
});

// 获取活跃仓库列表（用于选择）
router.get('/active', async (req, res) => {
  try {
    const warehouses = await AmzWarehouse.findAll({
      where: { status: 'active' },
      attributes: ['id', 'warehouseName', 'warehouseCode', 'country', 'city'],
      order: [['warehouseName', 'ASC']]
    });
    res.json({
      code: 0,
      message: '获取成功',
      data: warehouses
    });
  } catch (error) {
    console.error('获取活跃仓库列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

module.exports = router; 