const express = require('express');
const router = express.Router();
const { FbaInventory } = require('../models');
const { Op } = require('sequelize');

// 获取FBA库存列表
router.get('/', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到FBA库存查询请求');
  
  try {
    const { 
      page = 1, 
      limit = 20, 
      sku, 
      marketplace, 
      country,
      snapshot_date,
      sort_by = 'updated_at',
      sort_order = 'DESC'
    } = req.query;

    // 构建查询条件
    const whereCondition = {};
    
    if (sku) {
      whereCondition.sku = { [Op.like]: `%${sku}%` };
    }
    
    if (marketplace) {
      whereCondition.marketplace = marketplace;
    }
    
    if (country) {
      whereCondition.country = country;
    }
    
    if (snapshot_date) {
      whereCondition.snapshot_date = snapshot_date;
    }

    // 分页查询
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await FbaInventory.findAndCountAll({
      where: whereCondition,
      order: [[sort_by, sort_order.toUpperCase()]],
      limit: parseInt(limit),
      offset: offset
    });

    console.log('\x1b[33m%s\x1b[0m', `📦 查询到FBA库存记录: ${rows.length} 条，总计: ${count} 条`);

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        total: count,
        current: parseInt(page),
        pageSize: parseInt(limit),
        records: rows
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取FBA库存失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 获取FBA库存统计数据
router.get('/stats', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到FBA库存统计查询请求');
  
  try {
    const { country, marketplace } = req.query;
    
    const whereCondition = {};
    if (country) whereCondition.country = country;
    if (marketplace) whereCondition.marketplace = marketplace;

    // 获取最新快照的统计数据
    const latestSnapshot = await FbaInventory.findOne({
      attributes: ['snapshot_date'],
      where: whereCondition,
      order: [['snapshot_date', 'DESC']],
      limit: 1
    });

    if (!latestSnapshot) {
      return res.json({
        code: 0,
        message: '暂无数据',
        data: {
          total_skus: 0,
          total_available: 0,
          total_reserved: 0,
          total_inbound: 0,
          by_marketplace: [],
          by_country: []
        }
      });
    }

    whereCondition.snapshot_date = latestSnapshot.snapshot_date;

    // 按市场站点统计
    const marketplaceStats = await FbaInventory.findAll({
      attributes: [
        'marketplace',
        [FbaInventory.sequelize.fn('COUNT', FbaInventory.sequelize.col('id')), 'sku_count'],
        [FbaInventory.sequelize.fn('SUM', FbaInventory.sequelize.col('available_quantity')), 'total_available'],
        [FbaInventory.sequelize.fn('SUM', FbaInventory.sequelize.col('reserved_quantity')), 'total_reserved'],
        [FbaInventory.sequelize.fn('SUM', FbaInventory.sequelize.col('inbound_working_quantity')), 'total_inbound']
      ],
      where: whereCondition,
      group: ['marketplace'],
      raw: true
    });

    // 按国家统计
    const countryStats = await FbaInventory.findAll({
      attributes: [
        'country',
        [FbaInventory.sequelize.fn('COUNT', FbaInventory.sequelize.col('id')), 'sku_count'],
        [FbaInventory.sequelize.fn('SUM', FbaInventory.sequelize.col('available_quantity')), 'total_available'],
        [FbaInventory.sequelize.fn('SUM', FbaInventory.sequelize.col('reserved_quantity')), 'total_reserved'],
        [FbaInventory.sequelize.fn('SUM', FbaInventory.sequelize.col('inbound_working_quantity')), 'total_inbound']
      ],
      where: whereCondition,
      group: ['country'],
      raw: true
    });

    // 总体统计
    const totalStats = await FbaInventory.findOne({
      attributes: [
        [FbaInventory.sequelize.fn('COUNT', FbaInventory.sequelize.col('id')), 'total_skus'],
        [FbaInventory.sequelize.fn('SUM', FbaInventory.sequelize.col('available_quantity')), 'total_available'],
        [FbaInventory.sequelize.fn('SUM', FbaInventory.sequelize.col('reserved_quantity')), 'total_reserved'],
        [FbaInventory.sequelize.fn('SUM', FbaInventory.sequelize.col('inbound_working_quantity')), 'total_inbound']
      ],
      where: whereCondition,
      raw: true
    });

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        snapshot_date: latestSnapshot.snapshot_date,
        ...totalStats,
        by_marketplace: marketplaceStats,
        by_country: countryStats
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取FBA库存统计失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取统计失败',
      error: error.message
    });
  }
});

// 创建FBA库存记录
router.post('/', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '📝 收到创建FBA库存请求');
  
  try {
    const inventoryData = req.body;
    
    // 验证必填字段
    const requiredFields = ['sku', 'marketplace', 'country', 'snapshot_date'];
    for (const field of requiredFields) {
      if (!inventoryData[field]) {
        return res.status(400).json({
          code: 1,
          message: `缺少必填字段: ${field}`
        });
      }
    }

    // 检查是否已存在相同的记录
    const existingRecord = await FbaInventory.findOne({
      where: {
        sku: inventoryData.sku,
        marketplace: inventoryData.marketplace,
        snapshot_date: inventoryData.snapshot_date
      }
    });

    if (existingRecord) {
      return res.status(400).json({
        code: 1,
        message: '该SKU在指定市场和快照日期的记录已存在'
      });
    }

    const newRecord = await FbaInventory.create(inventoryData);
    
    console.log('\x1b[32m%s\x1b[0m', '✅ FBA库存记录创建成功:', newRecord.id);
    
    res.json({
      code: 0,
      message: '创建成功',
      data: newRecord
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 创建FBA库存记录失败:', error);
    res.status(500).json({
      code: 1,
      message: '创建失败',
      error: error.message
    });
  }
});

// 更新FBA库存记录
router.put('/:id', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '📝 收到更新FBA库存请求:', req.params.id);
  
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const record = await FbaInventory.findByPk(id);
    if (!record) {
      return res.status(404).json({
        code: 1,
        message: '记录不存在'
      });
    }

    await record.update(updateData);
    
    console.log('\x1b[32m%s\x1b[0m', '✅ FBA库存记录更新成功:', id);
    
    res.json({
      code: 0,
      message: '更新成功',
      data: record
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 更新FBA库存记录失败:', error);
    res.status(500).json({
      code: 1,
      message: '更新失败',
      error: error.message
    });
  }
});

// 删除FBA库存记录
router.delete('/:id', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🗑️ 收到删除FBA库存请求:', req.params.id);
  
  try {
    const { id } = req.params;
    
    const record = await FbaInventory.findByPk(id);
    if (!record) {
      return res.status(404).json({
        code: 1,
        message: '记录不存在'
      });
    }

    await record.destroy();
    
    console.log('\x1b[32m%s\x1b[0m', '✅ FBA库存记录删除成功:', id);
    
    res.json({
      code: 0,
      message: '删除成功'
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 删除FBA库存记录失败:', error);
    res.status(500).json({
      code: 1,
      message: '删除失败',
      error: error.message
    });
  }
});

// 批量导入FBA库存数据
router.post('/batch-import', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '📥 收到批量导入FBA库存请求');
  
  try {
    const { records, snapshot_date } = req.body;
    
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '导入数据不能为空'
      });
    }

    const transaction = await FbaInventory.sequelize.transaction();
    
    try {
      // 为每条记录添加快照日期
      const recordsWithSnapshot = records.map(record => ({
        ...record,
        snapshot_date: snapshot_date || new Date().toISOString().split('T')[0]
      }));

      // 批量创建记录
      const createdRecords = await FbaInventory.bulkCreate(recordsWithSnapshot, {
        transaction,
        updateOnDuplicate: [
          'available_quantity',
          'inbound_working_quantity', 
          'inbound_shipped_quantity',
          'inbound_receiving_quantity',
          'reserved_quantity',
          'unfulfillable_quantity',
          'total_quantity',
          'last_updated',
          'updated_at'
        ]
      });

      await transaction.commit();
      
      console.log('\x1b[32m%s\x1b[0m', `✅ 批量导入FBA库存成功: ${createdRecords.length} 条记录`);
      
      res.json({
        code: 0,
        message: `批量导入成功，共处理 ${createdRecords.length} 条记录`,
        data: {
          imported_count: createdRecords.length
        }
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 批量导入FBA库存失败:', error);
    res.status(500).json({
      code: 1,
      message: '批量导入失败',
      error: error.message
    });
  }
});

// 获取可用的快照日期列表
router.get('/snapshot-dates', async (req, res) => {
  try {
    const dates = await FbaInventory.findAll({
      attributes: ['snapshot_date'],
      group: ['snapshot_date'],
      order: [['snapshot_date', 'DESC']],
      raw: true
    });

    res.json({
      code: 0,
      message: '获取成功',
      data: dates.map(item => item.snapshot_date)
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取快照日期失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

module.exports = router; 