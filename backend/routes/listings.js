const express = require('express');
const router = express.Router();
const { SellerInventorySku, AmzSkuMapping, ProductWeblink, FbaInventory, ListingsSku, sequelize } = require('../models');
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

    // 恢复以sellerinventory_sku为主的LEFT JOIN查询
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows: skuData } = await SellerInventorySku.findAndCountAll({
      where: whereCondition,
      include: [{
        model: ProductWeblink,
        as: 'ProductWeblink',
        required: false, // LEFT JOIN
        attributes: ['weblink', 'status', 'notice']
      }],
      order: [[sort_by, sort_order.toUpperCase()]],
      limit: parseInt(limit),
      offset: offset
    });

    // 获取所有相关的child_sku列表 (排除null值)
    const childSkus = skuData
      .filter(item => item.child_sku)
      .map(item => item.child_sku);
    
    // 查询这些child_sku在各站点的映射情况
    let mappings = [];
    if (childSkus.length > 0) {
      mappings = await AmzSkuMapping.findAll({
        where: {
          local_sku: { [Op.in]: childSkus }
        }
      });
    }

    // 查询listings_sku表获取实际的seller-sku数据
    let listingsData = [];
    if (mappings.length > 0) {
      // 构建查询条件，匹配amz_sku和site
      const conditions = mappings.map(mapping => 
        `(\`seller-sku\` = '${mapping.amz_sku}' AND site = '${mapping.site}')`
      ).join(' OR ');
      
      if (conditions) {
        listingsData = await sequelize.query(`
          SELECT \`seller-sku\`, site, asin1, price, \`fulfillment-channel\`, quantity
          FROM listings_sku 
          WHERE ${conditions}
        `, {
          type: sequelize.QueryTypes.SELECT
        });
      }
    }

    // 查询SKU类型信息，从pbi_amzsku_sku表获取sku_type
    let skuTypeMap = new Map();
    if (mappings.length > 0) {
      console.log('\x1b[36m%s\x1b[0m', '🔍 查询SKU类型信息...');
      
      const skuTypeData = await AmzSkuMapping.findAll({
        where: {
          amz_sku: { [Op.in]: mappings.map(m => m.amz_sku) },
          site: { [Op.in]: mappings.map(m => m.site) }
        },
        attributes: ['amz_sku', 'site', 'sku_type']
      });
      
      console.log('\x1b[32m%s\x1b[0m', `📊 查询到 ${skuTypeData.length} 条SKU类型信息`);
      
      // 构建SKU类型映射
      skuTypeData.forEach(item => {
        const key = `${item.amz_sku}_${item.site}`;
        skuTypeMap.set(key, item.sku_type);
        
        if (item.amz_sku === 'FBAXBA039A1') {
          console.log('\x1b[33m%s\x1b[0m', `🎯 FBAXBA039A1 SKU类型: "${item.sku_type}"`);
        }
      });
    }

    // 查询FBA库存数据 - 基于sku_type判断
    let fbaInventoryData = [];
    if (listingsData.length > 0) {
      console.log('\x1b[36m%s\x1b[0m', '🔍 开始查找FBA SKU...');
      
      const fbaConditions = listingsData
        .filter(listing => {
          const key = `${listing['seller-sku']}_${listing.site}`;
          const skuType = skuTypeMap.get(key);
          const isFba = skuType === 'FBA SKU';
          
          if (listing['seller-sku'] === 'FBAXBA039A1') {
            console.log('\x1b[36m%s\x1b[0m', `🎯 FBA过滤阶段 - FBAXBA039A1:`);
            console.log('\x1b[36m%s\x1b[0m', `   sku_type: "${skuType}"`);
            console.log('\x1b[36m%s\x1b[0m', `   isFBA结果: ${isFba}`);
          }
          
          console.log('\x1b[36m%s\x1b[0m', `检查SKU ${listing['seller-sku']}, sku_type: ${skuType}, isFBA: ${isFba}`);
          return isFba;
        })
        .map(listing => ({
          sku: listing['seller-sku'],
          site: listing.site
        }));
      
      console.log('\x1b[33m%s\x1b[0m', `🎯 找到 ${fbaConditions.length} 个FBA SKU需要查询库存`);

      if (fbaConditions.length > 0) {
        const fbaQueries = fbaConditions.map(condition => 
          `(sku = '${condition.sku}' AND site = '${condition.site}')`
        ).join(' OR ');

        console.log('\x1b[35m%s\x1b[0m', '🔍 FBA库存查询SQL:', `SELECT sku, site, \`mfn-fulfillable-quantity\` FROM fba_inventory WHERE ${fbaQueries}`);
        
        fbaInventoryData = await sequelize.query(`
          SELECT sku, site, \`mfn-fulfillable-quantity\`
          FROM fba_inventory 
          WHERE ${fbaQueries}
        `, {
          type: sequelize.QueryTypes.SELECT
        });
        
        console.log('\x1b[32m%s\x1b[0m', `📊 从fba_inventory表查询到 ${fbaInventoryData.length} 条记录`);
        if (fbaInventoryData.length > 0) {
          console.log('\x1b[32m%s\x1b[0m', '📊 FBA库存示例:', JSON.stringify(fbaInventoryData.slice(0, 2), null, 2));
        }
      }
    }

    // 建立FBA库存的映射表
    const fbaInventoryMap = new Map();
    fbaInventoryData.forEach(fba => {
      const key = `${fba.sku}_${fba.site}`;
      fbaInventoryMap.set(key, {
        mfnFulfillableQuantity: fba['mfn-fulfillable-quantity']
      });
    });

    // 建立listings_sku的映射表，以amz_sku + site为键
    const listingsMap = new Map();
    console.log('\x1b[36m%s\x1b[0m', `📋 处理 ${listingsData.length} 条listings_sku数据`);
    
    listingsData.forEach(listing => {
      const key = `${listing['seller-sku']}_${listing.site}`;
      const skuType = skuTypeMap.get(key);
      const isFbaSku = skuType === 'FBA SKU';
      
      // 添加详细调试信息，特别是FBAXBA039A1
      if (listing['seller-sku'] === 'FBAXBA039A1') {
        console.log('\x1b[33m%s\x1b[0m', `🔍 FBAXBA039A1 详细分析:`);
        console.log('\x1b[33m%s\x1b[0m', `   sku_type: "${skuType}"`);
        console.log('\x1b[33m%s\x1b[0m', `   isFbaSku结果: ${isFbaSku}`);
      }
      
      // 获取对应的库存数量
      let inventoryQuantity = null;
      if (isFbaSku) {
        const fbaInfo = fbaInventoryMap.get(key);
        inventoryQuantity = fbaInfo ? fbaInfo.mfnFulfillableQuantity : null;
        console.log('\x1b[35m%s\x1b[0m', `🔵 FBA SKU: ${listing['seller-sku']}, quantity: ${inventoryQuantity}`);
      } else {
        inventoryQuantity = listing.quantity;
        console.log('\x1b[33m%s\x1b[0m', `🟡 非FBA SKU: ${listing['seller-sku']}, quantity: ${inventoryQuantity}`);
      }

      listingsMap.set(key, {
        sellerSku: listing['seller-sku'],
        site: listing.site,
        asin: listing.asin1,
        price: listing.price,
        fulfillmentChannel: listing['fulfillment-channel'],
        quantity: inventoryQuantity,
        isFbaSku: isFbaSku
      });
    });
    
    console.log('\x1b[32m%s\x1b[0m', `✅ 构建了 ${listingsMap.size} 个listing映射`);
    
    // 输出几个映射示例用于调试
    let debugCount = 0;
    for (let [key, value] of listingsMap) {
      if (debugCount < 3) {
        console.log('\x1b[36m%s\x1b[0m', `🔍 映射示例: ${key} ->`, JSON.stringify(value, null, 2));
        debugCount++;
      }
    }

    // 站点到中文国家名称的映射
    const siteToCountryMap = {
      'www.amazon.com': '美国',
      'www.amazon.ca': '加拿大',
      'www.amazon.co.uk': '英国',
      'www.amazon.com.au': '澳大利亚',
      'www.amazon.ae': '阿联酋',
      'www.amazon.de': '德国',
      'www.amazon.fr': '法国',
      'www.amazon.it': '意大利',
      'www.amazon.es': '西班牙'
    };
    
    const countryList = ['美国', '加拿大', '英国', '澳大利亚', '阿联酋'];
    
    // 获取所有站点列表
    const allSites = await AmzSkuMapping.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('site')), 'site']],
      raw: true
    });
    const siteList = allSites.map(s => s.site);

    // 整理数据结构 - 适配新的查询结果
    const result = skuData.map(sku => {
      // 找到该child_sku的所有映射 (只有存在child_sku的记录才有映射)
      const skuMappings = sku.child_sku ? mappings.filter(m => m.local_sku === sku.child_sku) : [];
      
      // 按国家组织映射数据
      const countryStatus = {};
      countryList.forEach(country => {
        // 找到该国家的所有映射
        const countryMappings = skuMappings.filter(m => m.country === country);
        
        // 从listings_sku表中获取实际的seller-sku数据
        const listingMappings = countryMappings.map(mapping => {
          const listingKey = `${mapping.amz_sku}_${mapping.site}`;
          const listingInfo = listingsMap.get(listingKey);
          
          return {
            amzSku: listingInfo ? listingInfo.sellerSku : mapping.amz_sku, // 优先显示listings_sku中的seller-sku
            site: mapping.site,
            skuType: mapping.sku_type,
            updateTime: mapping.update_time,
            asin: listingInfo ? listingInfo.asin : null,
            price: listingInfo ? listingInfo.price : null,
            fulfillmentChannel: listingInfo ? listingInfo.fulfillmentChannel : null,
            quantity: listingInfo ? listingInfo.quantity : null,
            isFbaSku: listingInfo ? listingInfo.isFbaSku : false,
            isInListings: !!listingInfo // 标识是否在listings_sku表中存在
          };
        }).filter(mapping => mapping.isInListings); // 只显示在listings_sku表中存在的SKU
        
        countryStatus[country] = {
          isListed: listingMappings.length > 0,
          mappings: listingMappings
        };
      });

      // 计算上架状态统计（只考虑5个主要国家）
      const listedCount = countryList.filter(country => countryStatus[country]?.isListed).length;
      const totalCountries = countryList.length;
      let listingStatus;
      if (listedCount === 0) {
        listingStatus = 'unlisted';
      } else if (listedCount === totalCountries) {
        listingStatus = 'listed';
      } else {
        listingStatus = 'partial';
      }

      // 获取关联的product_weblink信息
      const productWeblink = sku.ProductWeblink || null;

      return {
        skuid: sku.skuid,
        parent_sku: sku.parent_sku,
        child_sku: sku.child_sku,
        sellercolorname: sku.sellercolorname,
        sellersizename: sku.sellersizename,
        qty_per_box: sku.qty_per_box,
        // 产品链接信息
        weblink: productWeblink ? productWeblink.weblink : null,
        product_status: productWeblink ? productWeblink.status : null,
        notice: productWeblink ? productWeblink.notice : null,
        countryStatus,
        listingStatus,
        listedCount,
        totalCountries,
        listingRate: totalCountries > 0 ? Math.round((listedCount / totalCountries) * 100) : 0
      };
    });

    // 根据状态过滤
    let filteredResult = result;
    if (status && status !== 'all') {
      filteredResult = result.filter(item => item.listingStatus === status);
    }

    // 根据国家过滤
    if (site && site !== 'all') {
      // site参数现在用于国家过滤
      filteredResult = filteredResult.filter(item => item.countryStatus[site]?.isListed);
    }

    console.log('\x1b[33m%s\x1b[0m', `📦 查询到 ${filteredResult.length} 个母SKU的Listings数据`);
    console.log('\x1b[36m%s\x1b[0m', `📋 从listings_sku表获取到 ${listingsData.length} 条seller-sku记录`);

    res.json({
      code: 0,
      message: '查询成功',
      data: {
        total: count,
        current: parseInt(page),
        pageSize: parseInt(limit),
        records: filteredResult,
        countryList: countryList.sort(), // 按字母顺序排序
        siteList, // 保留原有字段以兼容性
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

// 批量删除SKU记录
router.delete('/batch-delete', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🗑️ 收到批量删除SKU请求');
  
  try {
    const { skuids, deleteParentSku = true } = req.body;
    
    if (!skuids || !Array.isArray(skuids) || skuids.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '请提供要删除的SKU ID列表'
      });
    }

    console.log('\x1b[33m%s\x1b[0m', `准备删除 ${skuids.length} 条SKU记录，删除母SKU选项: ${deleteParentSku}`);

    let deletedParentSkuCount = 0;
    
    // 如果需要删除母SKU，先获取所有母SKU列表
    if (deleteParentSku) {
      const skuRecords = await SellerInventorySku.findAll({
        where: {
          skuid: { [Op.in]: skuids }
        },
        attributes: ['parent_sku'],
        group: ['parent_sku']
      });
      
      const parentSkus = skuRecords.map(record => record.parent_sku);
      
      if (parentSkus.length > 0) {
        console.log('\x1b[33m%s\x1b[0m', `准备删除 ${parentSkus.length} 个母SKU:`, parentSkus);
        
        // 删除product_weblink表中对应的母SKU记录
        deletedParentSkuCount = await ProductWeblink.destroy({
          where: {
            parent_sku: { [Op.in]: parentSkus }
          }
        });
        
        console.log('\x1b[32m%s\x1b[0m', `✅ 成功删除 ${deletedParentSkuCount} 条母SKU记录`);
      }
    }

    // 批量删除SellerInventorySku记录
    const deletedCount = await SellerInventorySku.destroy({
      where: {
        skuid: { [Op.in]: skuids }
      }
    });

    console.log('\x1b[32m%s\x1b[0m', `✅ 成功删除 ${deletedCount} 条SKU记录`);

    res.json({
      code: 0,
      message: deleteParentSku 
        ? `成功删除 ${deletedCount} 条SKU记录和 ${deletedParentSkuCount} 条母SKU记录`
        : `成功删除 ${deletedCount} 条SKU记录`,
      data: {
        deletedCount,
        deletedParentSkuCount,
        requestedCount: skuids.length,
        deleteParentSku
      }
    });

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 批量删除SKU失败:', error);
    res.status(500).json({
      code: 1,
      message: '删除失败',
      error: error.message
    });
  }
});

// 数据一致性检查API
router.get('/data-consistency-check', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 执行数据一致性检查');
  
  try {
    // 查找只在sellerinventory_sku中存在的记录
    const onlyInSkuQuery = `
      SELECT sku.parent_sku, COUNT(sku.skuid) as sku_count, 'missing_weblink' as issue_type
      FROM sellerinventory_sku sku
      LEFT JOIN product_weblink pw ON sku.parent_sku = pw.parent_sku
      WHERE pw.parent_sku IS NULL
      GROUP BY sku.parent_sku
    `;

    // 查找只在product_weblink中存在的记录
    const onlyInWeblinkQuery = `
      SELECT pw.parent_sku, pw.status, pw.weblink, pw.notice, 'missing_sku' as issue_type
      FROM product_weblink pw
      LEFT JOIN sellerinventory_sku sku ON pw.parent_sku = sku.parent_sku
      WHERE sku.parent_sku IS NULL
    `;

    const [onlyInSku] = await sequelize.query(onlyInSkuQuery);
    const [onlyInWeblink] = await sequelize.query(onlyInWeblinkQuery);

    // 统计信息
    const totalSkuRecords = await SellerInventorySku.count();
    const totalWeblinkRecords = await ProductWeblink.count();
    const consistentRecords = await sequelize.query(`
      SELECT COUNT(DISTINCT sku.parent_sku) as count
      FROM sellerinventory_sku sku
      INNER JOIN product_weblink pw ON sku.parent_sku = pw.parent_sku
    `);

    const stats = {
      totalSkuRecords,
      totalWeblinkRecords,
      consistentRecords: consistentRecords[0][0].count,
      missingWeblinkRecords: onlyInSku.length,
      missingSkuRecords: onlyInWeblink.length,
      consistencyRate: totalSkuRecords > 0 ? 
        Math.round((consistentRecords[0][0].count / totalSkuRecords) * 100) : 0
    };

    console.log('\x1b[33m%s\x1b[0m', `📊 一致性检查完成: 一致率${stats.consistencyRate}%`);

    res.json({
      code: 0,
      message: '数据一致性检查完成',
      data: {
        statistics: stats,
        inconsistentData: {
          missingWeblink: onlyInSku,
          missingSku: onlyInWeblink
        }
      }
    });

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 数据一致性检查失败:', error);
    res.status(500).json({
      code: 1,
      message: '检查失败',
      error: error.message
    });
  }
});

// 数据同步API
router.post('/sync-data', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔄 执行数据同步');
  
  try {
    const { action, parentSkus } = req.body; // action: 'create_weblink' | 'create_sku' | 'delete_orphan'
    
    if (!action || !parentSkus || !Array.isArray(parentSkus)) {
      return res.status(400).json({
        code: 1,
        message: '请提供同步操作类型和父SKU列表'
      });
    }

    let result = { created: 0, deleted: 0, errors: [] };

    switch (action) {
      case 'create_weblink':
        // 为缺少weblink的SKU创建默认记录
        for (const parentSku of parentSkus) {
          try {
            await ProductWeblink.create({
              parent_sku: parentSku,
              weblink: '',
              status: '待处理',
              update_time: new Date()
            });
            result.created++;
          } catch (error) {
            result.errors.push(`${parentSku}: ${error.message}`);
          }
        }
        break;

      case 'delete_orphan':
        // 删除孤立的weblink记录
        const deletedCount = await ProductWeblink.destroy({
          where: {
            parent_sku: { [Op.in]: parentSkus }
          }
        });
        result.deleted = deletedCount;
        break;

      default:
        return res.status(400).json({
          code: 1,
          message: '不支持的同步操作类型'
        });
    }

    console.log('\x1b[32m%s\x1b[0m', `✅ 数据同步完成: 创建${result.created}条, 删除${result.deleted}条`);

    res.json({
      code: 0,
      message: `数据同步完成`,
      data: result
    });

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 数据同步失败:', error);
    res.status(500).json({
      code: 1,
      message: '同步失败',
      error: error.message
    });
  }
});

module.exports = router; 