const express = require('express');
const router = express.Router();
const { SellerInventorySku, AmzSkuMapping, sequelize } = require('../models');
const { Op } = require('sequelize');

// 获取母SKU及其站点上架状态列表
router.get('/', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 获取在线Listings管理数据');
  
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      site, 
      status, // 'all' | 'listed' | 'unlisted' | 'partial'
      sort_by = 'parent_sku',
      sort_order = 'ASC'
    } = req.query;

    // 构建搜索条件
    let whereCondition = {};
    if (search) {
      whereCondition = {
        [Op.or]: [
          { parent_sku: { [Op.like]: `%${search}%` } },
          { child_sku: { [Op.like]: `%${search}%` } },
          { sellercolorname: { [Op.like]: `%${search}%` } },
          { sellersizename: { [Op.like]: `%${search}%` } }
        ]
      };
    }

    // 分页查询母子SKU关系
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows: skuData } = await SellerInventorySku.findAndCountAll({
      where: whereCondition,
      order: [[sort_by, sort_order.toUpperCase()]],
      limit: parseInt(limit),
      offset: offset
    });

    // 获取所有相关的child_sku列表
    const childSkus = skuData.map(item => item.child_sku);
    
    // 查询这些child_sku在各站点的映射情况
    let mappings = [];
    if (childSkus.length > 0) {
      mappings = await AmzSkuMapping.findAll({
        where: {
          local_sku: { [Op.in]: childSkus }
        }
      });
    }

    // 获取所有可能的站点列表
    const allSites = await AmzSkuMapping.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('site')), 'site']],
      raw: true
    });
    const siteList = allSites.map(s => s.site);

    // 整理数据结构
    const result = skuData.map(sku => {
      // 找到该child_sku的所有映射
      const skuMappings = mappings.filter(m => m.local_sku === sku.child_sku);
      
      // 按站点组织映射数据
      const siteStatus = {};
      siteList.forEach(site => {
        const mapping = skuMappings.find(m => m.site === site);
        siteStatus[site] = {
          isListed: !!mapping,
          amzSku: mapping ? mapping.amz_sku : null,
          country: mapping ? mapping.country : null,
          updateTime: mapping ? mapping.update_time : null,
          skuType: mapping ? mapping.sku_type : null
        };
      });

      // 计算上架状态统计
      const listedCount = Object.values(siteStatus).filter(s => s.isListed).length;
      const totalSites = siteList.length;
      let listingStatus;
      if (listedCount === 0) {
        listingStatus = 'unlisted';
      } else if (listedCount === totalSites) {
        listingStatus = 'listed';
      } else {
        listingStatus = 'partial';
      }

      return {
        skuid: sku.skuid,
        parent_sku: sku.parent_sku,
        child_sku: sku.child_sku,
        sellercolorname: sku.sellercolorname,
        sellersizename: sku.sellersizename,
        qty_per_box: sku.qty_per_box,
        siteStatus,
        listingStatus,
        listedCount,
        totalSites,
        listingRate: totalSites > 0 ? Math.round((listedCount / totalSites) * 100) : 0
      };
    });

    // 根据状态过滤
    let filteredResult = result;
    if (status && status !== 'all') {
      filteredResult = result.filter(item => item.listingStatus === status);
    }

    // 根据站点过滤
    if (site && site !== 'all') {
      filteredResult = filteredResult.filter(item => item.siteStatus[site]?.isListed);
    }

    console.log('\x1b[33m%s\x1b[0m', `📦 查询到 ${filteredResult.length} 个母SKU的Listings数据`);

    res.json({
      code: 0,
      message: '查询成功',
      data: {
        total: count,
        current: parseInt(page),
        pageSize: parseInt(limit),
        records: filteredResult,
        siteList,
        summary: {
          totalSkus: count,
          listedSkus: result.filter(r => r.listingStatus === 'listed').length,
          unlistedSkus: result.filter(r => r.listingStatus === 'unlisted').length,
          partialSkus: result.filter(r => r.listingStatus === 'partial').length
        }
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取Listings数据失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 获取单个SKU的详细映射信息
router.get('/:childSku/mappings', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 获取单个SKU映射详情');
  
  try {
    const { childSku } = req.params;
    
    // 获取SKU基本信息
    const skuInfo = await SellerInventorySku.findOne({
      where: { child_sku: childSku }
    });
    
    if (!skuInfo) {
      return res.status(404).json({
        code: 1,
        message: 'SKU不存在'
      });
    }
    
    // 获取该SKU的所有映射
    const mappings = await AmzSkuMapping.findAll({
      where: { local_sku: childSku },
      order: [['site', 'ASC']]
    });
    
    console.log('\x1b[33m%s\x1b[0m', `📦 查询到SKU ${childSku} 的 ${mappings.length} 条映射记录`);
    
    res.json({
      code: 0,
      message: '查询成功',
      data: {
        skuInfo,
        mappings
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取SKU映射详情失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 添加新的SKU映射
router.post('/mappings', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 添加SKU映射');
  
  try {
    const { local_sku, amz_sku, site, country, sku_type = 'FBA SKU' } = req.body;
    
    if (!local_sku || !amz_sku || !site || !country) {
      return res.status(400).json({
        code: 1,
        message: '请提供完整的映射信息'
      });
    }
    
    // 检查是否已存在相同映射
    const existingMapping = await AmzSkuMapping.findOne({
      where: {
        amz_sku,
        site
      }
    });
    
    if (existingMapping) {
      return res.status(400).json({
        code: 1,
        message: '该Amazon SKU在此站点已存在映射'
      });
    }
    
    // 创建新映射
    const newMapping = await AmzSkuMapping.create({
      local_sku,
      amz_sku,
      site,
      country,
      sku_type,
      update_time: new Date()
    });
    
    console.log('\x1b[32m%s\x1b[0m', '✅ SKU映射添加成功');
    
    res.json({
      code: 0,
      message: '添加成功',
      data: newMapping
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 添加SKU映射失败:', error);
    res.status(500).json({
      code: 1,
      message: '添加失败',
      error: error.message
    });
  }
});

// 更新SKU映射
router.put('/mappings/:amzSku/:site', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 更新SKU映射');
  
  try {
    const { amzSku, site } = req.params;
    const { local_sku, country, sku_type } = req.body;
    
    const mapping = await AmzSkuMapping.findOne({
      where: {
        amz_sku: amzSku,
        site
      }
    });
    
    if (!mapping) {
      return res.status(404).json({
        code: 1,
        message: '映射记录不存在'
      });
    }
    
    // 更新映射
    await mapping.update({
      local_sku: local_sku || mapping.local_sku,
      country: country || mapping.country,
      sku_type: sku_type || mapping.sku_type,
      update_time: new Date()
    });
    
    console.log('\x1b[32m%s\x1b[0m', '✅ SKU映射更新成功');
    
    res.json({
      code: 0,
      message: '更新成功',
      data: mapping
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 更新SKU映射失败:', error);
    res.status(500).json({
      code: 1,
      message: '更新失败',
      error: error.message
    });
  }
});

// 删除SKU映射
router.delete('/mappings/:amzSku/:site', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 删除SKU映射');
  
  try {
    const { amzSku, site } = req.params;
    
    const result = await AmzSkuMapping.destroy({
      where: {
        amz_sku: amzSku,
        site
      }
    });
    
    if (result === 0) {
      return res.status(404).json({
        code: 1,
        message: '映射记录不存在'
      });
    }
    
    console.log('\x1b[32m%s\x1b[0m', '✅ SKU映射删除成功');
    
    res.json({
      code: 0,
      message: '删除成功'
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 删除SKU映射失败:', error);
    res.status(500).json({
      code: 1,
      message: '删除失败',
      error: error.message
    });
  }
});

// 批量添加SKU映射
router.post('/mappings/batch', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 批量添加SKU映射');
  
  try {
    const { mappings } = req.body;
    
    if (!Array.isArray(mappings) || mappings.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '请提供要添加的映射数据'
      });
    }
    
    // 验证数据格式
    for (const mapping of mappings) {
      if (!mapping.local_sku || !mapping.amz_sku || !mapping.site || !mapping.country) {
        return res.status(400).json({
          code: 1,
          message: '映射数据格式不正确，缺少必要字段'
        });
      }
    }
    
    const results = [];
    const transaction = await sequelize.transaction();
    
    try {
      for (const mapping of mappings) {
        try {
          // 检查是否已存在
          const existing = await AmzSkuMapping.findOne({
            where: {
              amz_sku: mapping.amz_sku,
              site: mapping.site
            },
            transaction
          });
          
          if (existing) {
            results.push({
              success: false,
              reason: '映射已存在',
              mapping
            });
            continue;
          }
          
          // 创建新映射
          await AmzSkuMapping.create({
            local_sku: mapping.local_sku,
            amz_sku: mapping.amz_sku,
            site: mapping.site,
            country: mapping.country,
            sku_type: mapping.sku_type || 'FBA SKU',
            update_time: new Date()
          }, { transaction });
          
          results.push({
            success: true,
            mapping
          });
        } catch (error) {
          results.push({
            success: false,
            reason: error.message,
            mapping
          });
        }
      }
      
      await transaction.commit();
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      console.log('\x1b[32m%s\x1b[0m', `✅ 批量添加完成: 成功${successCount}条, 失败${failureCount}条`);
      
      res.json({
        code: 0,
        message: `批量添加完成: 成功${successCount}条, 失败${failureCount}条`,
        data: {
          successCount,
          failureCount,
          results
        }
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 批量添加SKU映射失败:', error);
    res.status(500).json({
      code: 1,
      message: '批量添加失败',
      error: error.message
    });
  }
});

// 获取统计数据
router.get('/statistics', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 获取Listings统计数据');
  
  try {
    // 获取总SKU数量
    const totalSkus = await SellerInventorySku.count();
    
    // 获取总映射数量
    const totalMappings = await AmzSkuMapping.count();
    
    // 获取各站点统计
    const siteStats = await AmzSkuMapping.findAll({
      attributes: [
        'site',
        [sequelize.fn('COUNT', sequelize.col('*')), 'count']
      ],
      group: ['site'],
      raw: true
    });
    
    // 获取有映射的SKU数量
    const mappedSkusQuery = `
      SELECT COUNT(DISTINCT local_sku) as mapped_skus
      FROM pbi_amzsku_sku
    `;
    const [mappedSkusResult] = await sequelize.query(mappedSkusQuery);
    const mappedSkus = mappedSkusResult[0]?.mapped_skus || 0;
    
    const unmappedSkus = totalSkus - mappedSkus;
    
    console.log('\x1b[33m%s\x1b[0m', '📊 统计数据获取成功');
    
    res.json({
      code: 0,
      message: '获取成功',
      data: {
        totalSkus,
        mappedSkus,
        unmappedSkus,
        totalMappings,
        mappingRate: totalSkus > 0 ? Math.round((mappedSkus / totalSkus) * 100) : 0,
        siteStats: siteStats.reduce((acc, curr) => {
          acc[curr.site] = parseInt(curr.count);
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取统计数据失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

module.exports = router; 