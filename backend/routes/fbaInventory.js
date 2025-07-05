const express = require('express');
const router = express.Router();
const { FbaInventory } = require('../models');
const { Op } = require('sequelize');

// 测试端点 - 检查数据库连接和表结构
router.get('/test', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 测试FBA库存数据库连接');
  
  try {
    // 测试数据库连接
    await FbaInventory.sequelize.authenticate();
    console.log('\x1b[32m%s\x1b[0m', '✅ 数据库连接成功');
    
    // 检查表是否存在
    const tableExists = await FbaInventory.sequelize.getQueryInterface().showAllTables();
    console.log('\x1b[33m%s\x1b[0m', '📋 数据库中的表:', tableExists);
    
    // 检查fba_inventory表结构
    let tableInfo = null;
    try {
      tableInfo = await FbaInventory.sequelize.getQueryInterface().describeTable('fba_inventory');
      console.log('\x1b[33m%s\x1b[0m', '📊 fba_inventory表结构:', Object.keys(tableInfo));
    } catch (error) {
      console.log('\x1b[31m%s\x1b[0m', '❌ fba_inventory表不存在:', error.message);
    }
    
    // 尝试查询记录数量
    let count = 0;
    let sampleData = [];
    try {
      count = await FbaInventory.count();
      sampleData = await FbaInventory.findAll({ limit: 3, raw: true });
      console.log('\x1b[33m%s\x1b[0m', `📦 表中记录数量: ${count}`);
      console.log('\x1b[33m%s\x1b[0m', '📋 示例数据:', sampleData);
    } catch (error) {
      console.log('\x1b[31m%s\x1b[0m', '❌ 查询数据失败:', error.message);
    }
    
    res.json({
      success: true,
      message: '数据库连接测试完成',
      data: {
        connection: 'success',
        tables: tableExists,
        fba_inventory_structure: tableInfo,
        record_count: count,
        sample_data: sampleData
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 数据库连接测试失败:', error);
    res.status(500).json({
      success: false,
      message: '数据库连接失败',
      error: error.message
    });
  }
});

// 获取FBA库存列表
router.get('/', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到FBA库存查询请求');
  
  try {
    const { 
      page = 1, 
      limit = 20, 
      sku, 
      site, 
      store,
      condition,
      sort_by = 'sku',
      sort_order = 'ASC'
    } = req.query;

    // 构建查询条件
    const whereCondition = {};
    
    if (sku) {
      whereCondition.sku = { [Op.like]: `%${sku}%` };
    }
    
    if (site) {
      whereCondition.site = site;
    }
    
    if (store) {
      whereCondition.store = store;
    }
    
    if (condition) {
      whereCondition.condition = condition;
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
    const { site, store } = req.query;
    
    const whereCondition = {};
    if (site) whereCondition.site = site;
    if (store) whereCondition.store = store;

    // 按站点统计
    const siteStats = await FbaInventory.findAll({
      attributes: [
        'site',
        [FbaInventory.sequelize.fn('COUNT', FbaInventory.sequelize.col('sku')), 'sku_count'],
        [FbaInventory.sequelize.fn('SUM', FbaInventory.sequelize.col('afn-fulfillable-quantity')), 'total_afn_fulfillable'],
        [FbaInventory.sequelize.fn('SUM', FbaInventory.sequelize.col('afn-reserved-quantity')), 'total_afn_reserved'],
        [FbaInventory.sequelize.fn('SUM', FbaInventory.sequelize.col('afn-inbound-working-quantity')), 'total_afn_inbound']
      ],
      where: whereCondition,
      group: ['site'],
      raw: true
    });

    // 按店铺统计
    const storeStats = await FbaInventory.findAll({
      attributes: [
        'store',
        [FbaInventory.sequelize.fn('COUNT', FbaInventory.sequelize.col('sku')), 'sku_count'],
        [FbaInventory.sequelize.fn('SUM', FbaInventory.sequelize.col('afn-fulfillable-quantity')), 'total_afn_fulfillable'],
        [FbaInventory.sequelize.fn('SUM', FbaInventory.sequelize.col('afn-reserved-quantity')), 'total_afn_reserved'],
        [FbaInventory.sequelize.fn('SUM', FbaInventory.sequelize.col('afn-inbound-working-quantity')), 'total_afn_inbound']
      ],
      where: whereCondition,
      group: ['store'],
      raw: true
    });

    // 总体统计
    const totalStats = await FbaInventory.findOne({
      attributes: [
        [FbaInventory.sequelize.fn('COUNT', FbaInventory.sequelize.col('sku')), 'total_skus'],
        [FbaInventory.sequelize.fn('SUM', FbaInventory.sequelize.col('afn-fulfillable-quantity')), 'total_afn_fulfillable'],
        [FbaInventory.sequelize.fn('SUM', FbaInventory.sequelize.col('afn-reserved-quantity')), 'total_afn_reserved'],
        [FbaInventory.sequelize.fn('SUM', FbaInventory.sequelize.col('afn-inbound-working-quantity')), 'total_afn_inbound']
      ],
      where: whereCondition,
      raw: true
    });

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        ...totalStats,
        by_site: siteStats,
        by_store: storeStats
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

// 获取站点和店铺列表
router.get('/sites-stores', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到站点和店铺列表查询请求');
  
  try {
    // 获取所有站点
    const sites = await FbaInventory.findAll({
      attributes: ['site'],
      group: ['site'],
      raw: true
    });

    // 获取所有店铺
    const stores = await FbaInventory.findAll({
      attributes: ['store'],
      where: {
        store: {
          [Op.ne]: null,
          [Op.ne]: ''
        }
      },
      group: ['store'],
      raw: true
    });

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        sites: sites.map(item => item.site),
        stores: stores.map(item => item.store)
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取站点和店铺列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
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
    const requiredFields = ['sku', 'site'];
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
        site: inventoryData.site
      }
    });

    if (existingRecord) {
      return res.status(400).json({
        code: 1,
        message: '该SKU在指定站点的记录已存在'
      });
    }

    // 创建新记录
    const newRecord = await FbaInventory.create(inventoryData);
    
    console.log('\x1b[33m%s\x1b[0m', '✅ 创建FBA库存记录成功:', `${newRecord.sku}-${newRecord.site}`);
    
    res.json({
      code: 0,
      message: '创建成功',
      data: newRecord
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 创建FBA库存失败:', error);
    res.status(500).json({
      code: 1,
      message: '创建失败',
      error: error.message
    });
  }
});

// 更新FBA库存记录 - 使用复合主键
router.put('/:sku/:site', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '📝 收到更新FBA库存请求');
  
  try {
    const { sku, site } = req.params;
    const inventoryData = req.body;
    
    // 查找要更新的记录
    const record = await FbaInventory.findOne({
      where: { sku, site }
    });
    
    if (!record) {
      return res.status(404).json({
        code: 1,
        message: '记录不存在'
      });
    }

    // 如果更新了SKU或站点，检查是否与其他记录冲突
    if ((inventoryData.sku && inventoryData.sku !== sku) || 
        (inventoryData.site && inventoryData.site !== site)) {
      const existingRecord = await FbaInventory.findOne({
        where: {
          sku: inventoryData.sku || sku,
          site: inventoryData.site || site,
          [Op.not]: { sku, site }
        }
      });

      if (existingRecord) {
        return res.status(400).json({
          code: 1,
          message: '该SKU在指定站点的记录已存在'
        });
      }
    }

    // 更新记录
    await record.update(inventoryData);
    
    console.log('\x1b[33m%s\x1b[0m', '✅ 更新FBA库存记录成功:', `${sku}-${site}`);
    
    res.json({
      code: 0,
      message: '更新成功',
      data: record
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 更新FBA库存失败:', error);
    res.status(500).json({
      code: 1,
      message: '更新失败',
      error: error.message
    });
  }
});

// 删除FBA库存记录 - 使用复合主键
router.delete('/:sku/:site', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🗑️ 收到删除FBA库存请求');
  
  try {
    const { sku, site } = req.params;
    
    // 查找要删除的记录
    const record = await FbaInventory.findOne({
      where: { sku, site }
    });
    
    if (!record) {
      return res.status(404).json({
        code: 1,
        message: '记录不存在'
      });
    }

    // 删除记录
    await record.destroy();
    
    console.log('\x1b[33m%s\x1b[0m', '✅ 删除FBA库存记录成功:', `${sku}-${site}`);
    
    res.json({
      code: 0,
      message: '删除成功'
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 删除FBA库存失败:', error);
    res.status(500).json({
      code: 1,
      message: '删除失败',
      error: error.message
    });
  }
});

// 批量导入FBA库存
router.post('/batch-import', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '📥 收到批量导入FBA库存请求');
  
  try {
    const { records } = req.body;
    
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '导入数据不能为空'
      });
    }

    let imported_count = 0;
    let updated_count = 0;
    let error_count = 0;

    // 逐条处理记录
    for (const record of records) {
      try {
        // 验证必填字段
        if (!record.sku || !record.site) {
          error_count++;
          continue;
        }

        // 查找是否已存在
        const existingRecord = await FbaInventory.findOne({
          where: {
            sku: record.sku,
            site: record.site
          }
        });

        if (existingRecord) {
          // 更新现有记录
          await existingRecord.update(record);
          updated_count++;
        } else {
          // 创建新记录
          await FbaInventory.create(record);
          imported_count++;
        }
      } catch (error) {
        console.error('处理记录失败:', error);
        error_count++;
      }
    }

    console.log('\x1b[33m%s\x1b[0m', `✅ 批量导入完成: 新增${imported_count}条, 更新${updated_count}条, 失败${error_count}条`);
    
    res.json({
      code: 0,
      message: '批量导入完成',
      data: {
        imported_count,
        updated_count,
        error_count,
        total_processed: imported_count + updated_count + error_count
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 批量导入FBA库存失败:', error);
    res.status(500).json({
      code: 1,
      message: '批量导入失败',
      error: error.message
    });
  }
});

module.exports = router; 