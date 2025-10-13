const express = require('express');
const router = express.Router();
const { FbaInventory, SheinProduct, AmzSkuMapping, FbaCustomCategory, FbaSkuCategory, sequelize } = require('../models');
const { Op } = require('sequelize');
const XLSX = require('xlsx');

// 获取FBA库存列表
router.get('/', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到FBA库存查询请求');
  
  try {
    const { 
      page = 1, 
      limit = 20, 
      sku, 
      fnsku,
      asin,
      site, 
      store,
      condition,
      sort_by = 'sku',
      sort_order = 'ASC'
    } = req.query;

    // 构建查询条件
    const whereCondition = {};
    
    if (sku) {
      // 支持多行搜索，按换行符分割
      const skuList = sku.split('\n').map(s => s.trim()).filter(s => s);
      if (skuList.length > 0) {
        whereCondition.sku = { [Op.in]: skuList };
      }
    }
    
    if (fnsku) {
      // 支持多行搜索，按换行符分割
      const fnskuList = fnsku.split('\n').map(s => s.trim()).filter(s => s);
      if (fnskuList.length > 0) {
        whereCondition.fnsku = { [Op.in]: fnskuList };
      }
    }
    
    if (asin) {
      // 支持多行搜索，按换行符分割
      const asinList = asin.split('\n').map(s => s.trim()).filter(s => s);
      if (asinList.length > 0) {
        whereCondition.asin = { [Op.in]: asinList };
      }
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

// 站点到国家的映射
const siteToCountryMap = {
  'www.amazon.com': '美国',
  'www.amazon.ca': '加拿大',
  'www.amazon.com.mx': '墨西哥',
  'www.amazon.co.uk': '英国',
  'www.amazon.de': '德国',
  'www.amazon.fr': '法国',
  'www.amazon.it': '意大利',
  'www.amazon.es': '西班牙',
  'www.amazon.nl': '荷兰',
  'www.amazon.se': '瑞典',
  'www.amazon.pl': '波兰',
  'www.amazon.com.au': '澳大利亚',
  'www.amazon.co.jp': '日本',
  'www.amazon.in': '印度',
  'www.amazon.com.br': '巴西',
  'www.amazon.sg': '新加坡',
  'www.amazon.ae': '阿联酋',
  'www.amazon.sa': '沙特阿拉伯',
  'www.amazon.eg': '埃及',
  'www.amazon.com.tr': '土耳其'
};

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

    // 按国家统计 - 基于站点映射
    const countryStats = await FbaInventory.findAll({
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

    // 将站点统计转换为国家统计
    const countryStatsMap = {};
    countryStats.forEach(stat => {
      const country = siteToCountryMap[stat.site] || '其他';
      if (!countryStatsMap[country]) {
        countryStatsMap[country] = {
          country: country,
          sku_count: 0,
          total_afn_fulfillable: 0,
          total_afn_reserved: 0,
          total_afn_inbound: 0,
          sites: []
        };
      }
      countryStatsMap[country].sku_count += parseInt(stat.sku_count) || 0;
      countryStatsMap[country].total_afn_fulfillable += parseInt(stat.total_afn_fulfillable) || 0;
      countryStatsMap[country].total_afn_reserved += parseInt(stat.total_afn_reserved) || 0;
      countryStatsMap[country].total_afn_inbound += parseInt(stat.total_afn_inbound) || 0;
      countryStatsMap[country].sites.push(stat.site);
    });

    // 按指定顺序排序国家统计
    const countryOrder = ['美国', '英国', '澳大利亚', '阿联酋'];
    const by_country = Object.values(countryStatsMap).sort((a, b) => {
      const indexA = countryOrder.indexOf(a.country);
      const indexB = countryOrder.indexOf(b.country);
      
      // 如果两个国家都在排序列表中，按列表顺序排序
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // 如果只有a在排序列表中，a排在前面
      if (indexA !== -1) {
        return -1;
      }
      // 如果只有b在排序列表中，b排在前面
      if (indexB !== -1) {
        return 1;
      }
      // 如果都不在排序列表中，按国家名称字母顺序排序
      return a.country.localeCompare(b.country);
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
        by_country: by_country,
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

// 获取特定国家的库存记录
router.get('/by-country/:country', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到按国家查询FBA库存请求');
  
  try {
    const { country } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    // 根据国家找到对应的站点
    const sites = Object.keys(siteToCountryMap).filter(site => 
      siteToCountryMap[site] === country
    );
    
    if (sites.length === 0) {
      return res.status(404).json({
        code: 1,
        message: '未找到对应的站点'
      });
    }
    
    const whereCondition = {
      site: { [Op.in]: sites }
    };
    
    // 分页查询
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await FbaInventory.findAndCountAll({
      where: whereCondition,
      order: [['sku', 'ASC']],
      limit: parseInt(limit),
      offset: offset
    });

    console.log('\x1b[33m%s\x1b[0m', `📦 查询到${country}的FBA库存记录: ${rows.length} 条，总计: ${count} 条`);

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        country: country,
        sites: sites,
        total: count,
        current: parseInt(page),
        pageSize: parseInt(limit),
        records: rows
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取国家库存记录失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
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

// 删除自定义类目
router.delete('/categories/:id', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🗑️ 收到删除自定义类目请求');
  
  try {
    const { id } = req.params;
    const categoryId = parseInt(id);
    
    console.log('\x1b[36m%s\x1b[0m', '🔍 尝试删除类目ID:', categoryId);
    
    const category = await FbaCustomCategory.findByPk(categoryId);
    if (!category) {
      console.log('\x1b[31m%s\x1b[0m', '❌ 类目不存在，ID:', categoryId);
      return res.status(404).json({
        code: 1,
        message: '类目不存在'
      });
    }

    // 删除相关的SKU映射
    await FbaSkuCategory.destroy({
      where: { category_id: categoryId }
    });

    await category.destroy();
    
    console.log('\x1b[33m%s\x1b[0m', '✅ 删除自定义类目成功:', category.name);
    
    res.json({
      code: 0,
      message: '删除成功'
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 删除自定义类目失败:', error);
    res.status(500).json({
      code: 1,
      message: '删除失败',
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

// 生成SHEIN库存同步文件
router.get('/generate-shein-sync', async (req, res) => {
  const startTime = Date.now();
  console.log('\x1b[32m%s\x1b[0m', '📊 收到生成SHEIN库存同步文件请求');
  
  try {
    // 使用一个复合SQL查询来完成所有操作（性能优化）
    console.log('\x1b[33m%s\x1b[0m', '⚡ 开始执行复合SQL查询...');
    
    // 参考用户提供的SQL语句结构，添加必要的过滤条件
    const country = '美国';
    const precode = ''; // 可以根据需要设置排除的前缀
    
    console.log('\x1b[36m%s\x1b[0m', `🔧 查询条件: country="${country}", 排除FBAXB362%, ${precode ? `排除${precode}%` : '无额外前缀排除'}`);
    console.log('\x1b[36m%s\x1b[0m', '🎯 优化逻辑: 保证SHEIN SKU全显示，一对多映射时优先选择有FBA库存的记录');
    
    const sqlQuery = `
      SELECT 
        final.SKU as shein_sku, 
        COALESCE(final.\`afn-fulfillable-quantity\`, 0) AS afn_quantity,
        final.amz_sku,
        final.卖家SKU as seller_sku,
        CASE 
          WHEN final.amz_sku IS NULL THEN '未找到AMZ SKU映射'
          WHEN final.\`afn-fulfillable-quantity\` IS NULL THEN '未找到FBA库存'
          ELSE '正常同步'
        END as remark
      FROM (
        SELECT 
          ranked.SKU,
          ranked.卖家SKU,
          ranked.amz_sku,
          ranked.\`afn-fulfillable-quantity\`,
          ROW_NUMBER() OVER (
            PARTITION BY ranked.SKU 
            ORDER BY 
              CASE WHEN ranked.\`afn-fulfillable-quantity\` IS NOT NULL THEN 1 ELSE 2 END,
              ranked.\`afn-fulfillable-quantity\` DESC
          ) as rn
        FROM (
          SELECT 
            a.SKU, 
            a.卖家SKU, 
            b.amz_sku,
            f.\`afn-fulfillable-quantity\`
          FROM \`shein产品信息\` a 
          LEFT JOIN (
            SELECT * 
            FROM \`pbi_amzsku_sku\` 
            WHERE \`country\` = '${country}' 
              AND \`amz_sku\` NOT LIKE 'FBAXB362%'
              ${precode ? `AND \`amz_sku\` NOT LIKE '${precode}%'` : ''}
          ) b ON SUBSTRING(a.\`卖家SKU\`, 3) = b.\`local_sku\`
          LEFT JOIN \`fba_inventory\` f ON b.\`amz_sku\` = f.\`sku\`
        ) ranked
      ) final
      WHERE final.rn = 1
      ORDER BY final.\`afn-fulfillable-quantity\` ASC
    `;

    const [results] = await sequelize.query(sqlQuery);

    if (results.length === 0) {
      return res.status(404).json({
        code: 1,
        message: '没有找到SHEIN产品信息'
      });
    }

    console.log('\x1b[33m%s\x1b[0m', `🔍 一次性查询到${results.length}条完整数据`);

    // 直接转换为同步数据格式
    const syncData = results.map(row => {
      return {
        SKU: row.shein_sku,
        可售库存: parseInt(row.afn_quantity) || 0,
        FBASKU: row.amz_sku || '无映射',
        备注: row.remark
      };
    });

    // 统计信息
    const mappedCount = results.filter(row => row.amz_sku !== null).length;
    const inventoryFoundCount = results.filter(row => row.amz_sku !== null && parseInt(row.afn_quantity) > 0).length;

    // 第三步：生成Excel文件
    const worksheet = XLSX.utils.json_to_sheet(syncData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SHEIN库存同步');

    // 生成Excel文件buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 统计信息
    const processingTime = Date.now() - startTime;
    const stats = {
      总产品数: results.length,
      映射成功数: mappedCount,
      找到库存数: inventoryFoundCount,
      有库存产品数: results.filter(row => parseInt(row.afn_quantity) > 0).length,
      同步文件记录数: syncData.length,
      处理时间: `${processingTime}ms (${(processingTime / 1000).toFixed(2)}s)`,
      查询优化: '窗口函数ROW_NUMBER()处理一对多映射，优先选择有FBA库存的记录'
    };

    console.log('\x1b[33m%s\x1b[0m', '📊 SHEIN库存同步统计:', stats);

    // 设置响应头
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `SHEIN库存同步_${timestamp}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // 发送文件
    res.send(excelBuffer);

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 生成SHEIN库存同步文件失败:', error);
    res.status(500).json({
      code: 1,
      message: '生成同步文件失败',
      error: error.message
    });
  }
});

// ==================== 自定义类目相关API ====================

// 获取所有自定义类目
router.get('/categories', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到获取自定义类目请求');
  
  try {
    const categories = await FbaCustomCategory.findAll({
      order: [['created_at', 'DESC']]
    });

    res.json({
      code: 0,
      message: '获取成功',
      data: categories
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取自定义类目失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 创建自定义类目
router.post('/categories', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '📝 收到创建自定义类目请求');
  
  try {
    const { name, description, color } = req.body;
    
    if (!name) {
      return res.status(400).json({
        code: 1,
        message: '类目名称不能为空'
      });
    }

    const category = await FbaCustomCategory.create({
      name,
      description: description || '',
      color: color || '#1890ff'
    });
    
    console.log('\x1b[33m%s\x1b[0m', '✅ 创建自定义类目成功:', category.name);
    
    res.json({
      code: 0,
      message: '创建成功',
      data: category
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 创建自定义类目失败:', error);
    res.status(500).json({
      code: 1,
      message: '创建失败',
      error: error.message
    });
  }
});

// 更新自定义类目
router.put('/categories/:id', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '📝 收到更新自定义类目请求');
  
  try {
    const { id } = req.params;
    const { name, description, color } = req.body;
    
    const category = await FbaCustomCategory.findByPk(id);
    if (!category) {
      return res.status(404).json({
        code: 1,
        message: '类目不存在'
      });
    }

    await category.update({
      name: name || category.name,
      description: description !== undefined ? description : category.description,
      color: color || category.color
    });
    
    console.log('\x1b[33m%s\x1b[0m', '✅ 更新自定义类目成功:', category.name);
    
    res.json({
      code: 0,
      message: '更新成功',
      data: category
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 更新自定义类目失败:', error);
    res.status(500).json({
      code: 1,
      message: '更新失败',
      error: error.message
    });
  }
});


// 为SKU分配类目
router.post('/categories/assign', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '📝 收到SKU分配类目请求');
  
  try {
    const { sku, site, category_id } = req.body;
    
    if (!sku || !site || !category_id) {
      return res.status(400).json({
        code: 1,
        message: 'SKU、站点和类目ID不能为空'
      });
    }

    // 检查SKU是否存在
    const fbaRecord = await FbaInventory.findOne({
      where: { sku, site }
    });
    
    if (!fbaRecord) {
      return res.status(404).json({
        code: 1,
        message: 'FBA库存记录不存在'
      });
    }

    // 检查类目是否存在
    const category = await FbaCustomCategory.findByPk(category_id);
    if (!category) {
      return res.status(404).json({
        code: 1,
        message: '类目不存在'
      });
    }

    // 创建或更新映射关系
    const [skuCategory, created] = await FbaSkuCategory.findOrCreate({
      where: { sku, site, category_id },
      defaults: { sku, site, category_id }
    });
    
    console.log('\x1b[33m%s\x1b[0m', `✅ SKU分配类目${created ? '成功' : '已存在'}:`, `${sku}-${site} -> ${category.name}`);
    
    res.json({
      code: 0,
      message: created ? '分配成功' : '已存在',
      data: skuCategory
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ SKU分配类目失败:', error);
    res.status(500).json({
      code: 1,
      message: '分配失败',
      error: error.message
    });
  }
});

// 移除SKU的类目分配
router.delete('/categories/assign', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🗑️ 收到移除SKU类目分配请求');
  
  try {
    const { sku, site, category_id } = req.query;
    
    if (!sku || !site || !category_id) {
      return res.status(400).json({
        code: 1,
        message: 'SKU、站点和类目ID不能为空'
      });
    }

    const deletedCount = await FbaSkuCategory.destroy({
      where: { sku, site, category_id }
    });
    
    if (deletedCount === 0) {
      return res.status(404).json({
        code: 1,
        message: '映射关系不存在'
      });
    }
    
    console.log('\x1b[33m%s\x1b[0m', '✅ 移除SKU类目分配成功:', `${sku}-${site} -> ${category_id}`);
    
    res.json({
      code: 0,
      message: '移除成功'
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 移除SKU类目分配失败:', error);
    res.status(500).json({
      code: 1,
      message: '移除失败',
      error: error.message
    });
  }
});

// 获取类目统计信息（包含数量）
router.get('/categories/stats', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到获取类目统计请求');
  
  try {
    const categories = await FbaCustomCategory.findAll({
      include: [{
        model: FbaSkuCategory,
        as: 'skuCategories',
        include: [{
          model: FbaInventory,
          as: 'fbaInventory',
          attributes: ['sku', 'site', 'afn-fulfillable-quantity']
        }]
      }]
    });

    const stats = categories.map(category => {
      const skuCount = category.skuCategories.length;
      const totalQuantity = category.skuCategories.reduce((sum, skuCategory) => {
        return sum + (skuCategory.fbaInventory ? (skuCategory.fbaInventory['afn-fulfillable-quantity'] || 0) : 0);
      }, 0);

      return {
        id: category.id,
        name: category.name,
        description: category.description,
        color: category.color,
        sku_count: skuCount,
        total_quantity: totalQuantity,
        created_at: category.created_at,
        updated_at: category.updated_at
      };
    });

    res.json({
      code: 0,
      message: '获取成功',
      data: stats
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取类目统计失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 根据类目获取SKU列表
router.get('/categories/:id/skus', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到获取类目SKU列表请求');
  
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await FbaSkuCategory.findAndCountAll({
      where: { category_id: id },
      include: [{
        model: FbaInventory,
        as: 'fbaInventory',
        attributes: ['sku', 'fnsku', 'asin', 'product-name', 'your-price', 'site', 'afn-fulfillable-quantity', 'afn-warehouse-quantity', 'afn-reserved-quantity', 'afn-total-quantity']
      }],
      limit: parseInt(limit),
      offset: offset,
      order: [['created_at', 'DESC']]
    });

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
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取类目SKU列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

module.exports = router; 