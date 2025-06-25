const express = require('express');
const router = express.Router();
const { WarehouseProductsNeed, LocalBox, AmzSkuMapping, sequelize } = require('../models/index');
const { Sequelize, Op } = require('sequelize');
const axios = require('axios');
const crypto = require('crypto');

// 钉钉通知函数
async function sendDingTalkNotification(message, atMobiles = []) {
  const webhookUrl = process.env.DINGTALK_WEBHOOK;
  const secretKey = process.env.SECRET_KEY;
  
  if (!webhookUrl) {
    console.log('⚠️ 钉钉Webhook未配置，跳过通知');
    return;
  }

  try {
    let url = webhookUrl;
    
    // 如果有签名密钥，生成签名
    if (secretKey) {
      const timestamp = Date.now();
      const stringToSign = `${timestamp}\n${secretKey}`;
      const sign = crypto
        .createHmac('sha256', secretKey)
        .update(stringToSign)
        .digest('base64');
      
      url += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
    }

    const data = {
      msgtype: 'text',
      text: {
        content: message
      },
      at: {
        atMobiles: atMobiles,
        isAtAll: false
      }
    };

    await axios.post(url, data);
    console.log('✅ 钉钉通知发送成功');
  } catch (error) {
    console.error('❌ 钉钉通知发送失败:', error.message);
  }
}

// 获取发货需求列表
router.get('/needs', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到发货需求查询请求:', JSON.stringify(req.query, null, 2));
  
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const whereCondition = {};
    if (status) {
      whereCondition.status = status;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    console.log('\x1b[35m%s\x1b[0m', '🔍 查询条件:', JSON.stringify({ whereCondition, offset, limit: parseInt(limit) }, null, 2));
    
    const { count, rows } = await WarehouseProductsNeed.findAndCountAll({
      where: whereCondition,
      order: [['record_num', 'DESC']],  // 改为按record_num排序，因为created_at字段不存在
      limit: parseInt(limit),
      offset: offset
    });

    console.log('\x1b[32m%s\x1b[0m', '📊 查询结果:', { count, rowsLength: rows.length });
    
    // 数据字段映射，将数据库字段映射为前端期望的字段
    const mappedRows = rows.map(row => ({
      record_num: row.record_num,
      need_num: row.need_num || '',
      sku: row.sku || '',
      quantity: row.ori_quantity || 0, // 使用ori_quantity映射到quantity
      shipping_method: row.shipping_method || '',
      marketplace: row.marketplace || '',
      country: row.country || '',
      status: row.status || '待发货',
      created_at: row.create_date || new Date().toISOString(), // 使用create_date作为创建时间
      updated_at: row.create_date || new Date().toISOString(),
      created_by: 'System', // 实际表中没有此字段
      remark: '', // 实际表中没有此字段
      send_out_date: row.send_out_date,
      expired_date: row.expired_date,
      expect_sold_out_date: row.expect_sold_out_date
    }));

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        list: mappedRows,  // 使用映射后的数据
        total: count,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取发货需求列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 获取库存统计
router.get('/inventory-stats', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到库存统计查询请求');
  
  try {
    // 查询所有库存数据
    const allData = await LocalBox.findAll({
      attributes: ['sku', 'country', 'mix_box_num', 'total_quantity', 'total_boxes'],
      raw: true
    });

    console.log('\x1b[33m%s\x1b[0m', '🔍 原始数据总数:', allData.length);

    // 按SKU和国家分组，分别计算整箱和混合箱数据
    const skuStats = {};
    
    allData.forEach(item => {
      const key = `${item.sku}_${item.country}`;
      
      if (!skuStats[key]) {
        skuStats[key] = {
          sku: item.sku || '',
          country: item.country || '',
          // 整箱数据（mix_box_num为空或null）
          whole_box_quantity: 0,
          whole_box_count: 0,
          // 混合箱数据（有mix_box_num）
          mixed_box_quantity: 0,
          mixed_box_numbers: new Set() // 用于统计不同的混合箱号
        };
      }
      
      const quantity = parseInt(item.total_quantity) || 0;
      const boxes = parseInt(item.total_boxes) || 0;
      
      if (!item.mix_box_num || item.mix_box_num.trim() === '') {
        // 整箱数据
        skuStats[key].whole_box_quantity += quantity;
        skuStats[key].whole_box_count += boxes;
      } else {
        // 混合箱数据
        skuStats[key].mixed_box_quantity += quantity;
        skuStats[key].mixed_box_numbers.add(item.mix_box_num);
      }
    });

    // 转换为数组格式，并过滤掉总数量为0的记录
    const formattedStats = Object.values(skuStats)
      .map(item => ({
        sku: item.sku,
        country: item.country,
        whole_box_quantity: item.whole_box_quantity,
        whole_box_count: item.whole_box_count,
        mixed_box_quantity: item.mixed_box_quantity,
        total_quantity: item.whole_box_quantity + item.mixed_box_quantity
      }))
      .filter(item => item.total_quantity !== 0); // 过滤掉总数量为0的记录

    console.log('\x1b[32m%s\x1b[0m', '📊 汇总后库存统计数量:', formattedStats.length);
    console.log('\x1b[35m%s\x1b[0m', '📊 统计详情（前5条）:', formattedStats.slice(0, 5));

    res.json({
      code: 0,
      message: '获取成功',
      data: formattedStats
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取库存统计失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 创建发货需求
router.post('/needs', async (req, res) => {
  try {
    const { needs, created_by } = req.body;
    
    if (!needs || !Array.isArray(needs) || needs.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '需求数据不能为空'
      });
    }

    // 生成需求单号（时间戳）
    const need_num = Date.now().toString();
    
    // 批量创建需求
    const createdNeeds = await Promise.all(
      needs.map(need => 
        WarehouseProductsNeed.create({
          ...need,
          need_num,
          created_by: created_by || '系统'
        })
      )
    );

    // 发送钉钉通知
    const mobileNumMom = process.env.MOBILE_NUM_MOM;
    if (mobileNumMom) {
      const message = `新增发货需求 ${needs.length} 个SKU，需求单号：${need_num}`;
      await sendDingTalkNotification(message, [mobileNumMom]);
    }

    res.json({
      code: 0,
      message: '创建成功',
      data: createdNeeds
    });
  } catch (error) {
    console.error('创建发货需求失败:', error);
    res.status(500).json({
      code: 1,
      message: '创建失败',
      error: error.message
    });
  }
});

// 更新发货需求
router.put('/needs/:id', async (req, res) => {
  try {
    const [updated] = await WarehouseProductsNeed.update(req.body, {
      where: { record_num: req.params.id }
    });
    
    if (updated) {
      const need = await WarehouseProductsNeed.findByPk(req.params.id);
      res.json({
        code: 0,
        message: '更新成功',
        data: need
      });
    } else {
      res.status(404).json({
        code: 1,
        message: '需求不存在'
      });
    }
  } catch (error) {
    console.error('更新发货需求失败:', error);
    res.status(500).json({
      code: 1,
      message: '更新失败',
      error: error.message
    });
  }
});

// 删除发货需求
router.delete('/needs/:id', async (req, res) => {
  try {
    const deleted = await WarehouseProductsNeed.destroy({
      where: { record_num: req.params.id }
    });
    
    if (deleted) {
      res.json({
        code: 0,
        message: '删除成功'
      });
    } else {
      res.status(404).json({
        code: 1,
        message: '需求不存在'
      });
    }
  } catch (error) {
    console.error('删除发货需求失败:', error);
    res.status(500).json({
      code: 1,
      message: '删除失败',
      error: error.message
    });
  }
});

// 批量更新需求状态
router.put('/needs/batch-status', async (req, res) => {
  try {
    const { ids, status } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        code: 1,
        message: 'ID列表不能为空'
      });
    }

    const [updated] = await WarehouseProductsNeed.update(
      { status },
      { where: { record_num: ids } }
    );
    
    res.json({
      code: 0,
      message: `批量更新成功，影响 ${updated} 条记录`,
      data: { updated }
    });
  } catch (error) {
    console.error('批量更新状态失败:', error);
    res.status(500).json({
      code: 1,
      message: '批量更新失败',
      error: error.message
    });
  }
});

// 健康检查和测试端点
router.get('/health', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 发货需求模块健康检查');
  
  try {
    // 检查数据表是否存在
    await WarehouseProductsNeed.describe();
    await LocalBox.describe();
    await AmzSkuMapping.describe();
    
    // 检查数据表记录数
    const needsCount = await WarehouseProductsNeed.count();
    const localBoxCount = await LocalBox.count();
    const mappingCount = await AmzSkuMapping.count();
    
    // 获取一些示例数据用于调试
    const sampleNeeds = await WarehouseProductsNeed.findAll({
      limit: 3,
      attributes: ['sku', 'country', 'status'],
      raw: true
    });
    
    const sampleMappings = await AmzSkuMapping.findAll({
      limit: 5,
      attributes: ['amz_sku', 'country', 'local_sku'],
      raw: true
    });
    
    console.log('\x1b[32m%s\x1b[0m', '📊 数据表状态:', {
      pbi_warehouse_products_need: `${needsCount} 条记录`,
      local_boxes: `${localBoxCount} 条记录`,
      pbi_amzsku_sku: `${mappingCount} 条记录`
    });
    
    console.log('\x1b[33m%s\x1b[0m', '📋 示例发货需求SKU:', sampleNeeds.map(n => n.sku));
    console.log('\x1b[33m%s\x1b[0m', '📋 示例SKU映射:', sampleMappings.map(m => `${m.amz_sku}->${m.local_sku}`));
    
    res.json({
      code: 0,
      message: '发货需求模块运行正常',
      data: {
        tables: {
          pbi_warehouse_products_need: {
            exists: true,
            count: needsCount
          },
          local_boxes: {
            exists: true,
            count: localBoxCount
          },
          pbi_amzsku_sku: {
            exists: true,
            count: mappingCount
          }
        },
        samples: {
          needs: sampleNeeds,
          mappings: sampleMappings
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 发货需求模块健康检查失败:', error);
    
    res.status(500).json({
      code: 1,
      message: '发货需求模块异常',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 获取合并的发货需求和库存数据
router.get('/merged-data', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到合并数据查询请求 - 优化映射流程');
  
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    // 优化的映射流程：
    // 1. 先获取库存统计数据（去重获取唯一的 sku + country 组合）
    // 2. 通过库存 SKU + country 在映射表中查找对应的 Amazon SKU
    // 3. 使用找到的 Amazon SKU 与发货需求进行匹配
    // 4. 保留所有发货需求记录，同时也保留有库存但无需求的记录
    
    console.log('\x1b[33m%s\x1b[0m', '🔄 步骤1: 获取库存统计数据');
    
    // 1. 获取库存统计数据 (按 sku + country 分组)
    const inventoryStats = await LocalBox.findAll({
      attributes: [
        'sku',
        'country',
        [sequelize.fn('SUM', 
          sequelize.literal(`CASE WHEN mix_box_num IS NULL OR mix_box_num = '' THEN total_quantity ELSE 0 END`)
        ), 'whole_box_quantity'],
        [sequelize.fn('SUM', 
          sequelize.literal(`CASE WHEN mix_box_num IS NULL OR mix_box_num = '' THEN total_boxes ELSE 0 END`)
        ), 'whole_box_count'],
        [sequelize.fn('SUM', 
          sequelize.literal(`CASE WHEN mix_box_num IS NOT NULL AND mix_box_num != '' THEN total_quantity ELSE 0 END`)
        ), 'mixed_box_quantity'],
        [sequelize.fn('SUM', sequelize.col('total_quantity')), 'total_quantity']
      ],
      group: ['sku', 'country'],
      having: sequelize.literal('SUM(total_quantity) != 0'), // 过滤掉零库存
      raw: true
    });

    console.log('\x1b[33m%s\x1b[0m', `📦 库存统计数据: ${inventoryStats.length} 条`, 
      inventoryStats.slice(0, 3).map(i => `${i.sku}(${i.country}): ${i.total_quantity}`));

    console.log('\x1b[33m%s\x1b[0m', '🔄 步骤2: 查找库存对应的Amazon SKU映射');
    
    // 2. 对每个库存记录，查找对应的 Amazon SKU
    const inventoryWithAmzSku = await Promise.all(
      inventoryStats.map(async (inventory) => {
        try {
          const skuMapping = await AmzSkuMapping.findOne({
            where: {
              local_sku: inventory.sku,
              country: inventory.country
            },
            raw: true
          });

          return {
            local_sku: inventory.sku,
            country: inventory.country,
            amz_sku: skuMapping?.amz_sku || null,
            whole_box_quantity: parseInt(inventory.whole_box_quantity) || 0,
            whole_box_count: parseInt(inventory.whole_box_count) || 0,
            mixed_box_quantity: parseInt(inventory.mixed_box_quantity) || 0,
            total_available: parseInt(inventory.total_quantity) || 0
          };
        } catch (error) {
          console.error(`处理库存映射失败 ${inventory.sku}:`, error);
          return {
            local_sku: inventory.sku,
            country: inventory.country,
            amz_sku: null,
            whole_box_quantity: parseInt(inventory.whole_box_quantity) || 0,
            whole_box_count: parseInt(inventory.whole_box_count) || 0,
            mixed_box_quantity: parseInt(inventory.mixed_box_quantity) || 0,
            total_available: parseInt(inventory.total_quantity) || 0
          };
        }
      })
    );

    console.log('\x1b[33m%s\x1b[0m', `🔗 映射完成: ${inventoryWithAmzSku.filter(i => i.amz_sku).length} 条有映射，${inventoryWithAmzSku.filter(i => !i.amz_sku).length} 条无映射`);

    console.log('\x1b[33m%s\x1b[0m', '🔄 步骤3: 获取发货需求数据');
    
    // 3. 获取发货需求数据
    const whereCondition = {};
    if (status) {
      whereCondition.status = status;
    }

    const { count, rows: needsData } = await WarehouseProductsNeed.findAndCountAll({
      where: whereCondition,
      order: [['record_num', 'DESC']],
      limit: parseInt(limit) === 1000 ? undefined : parseInt(limit), // 如果是1000，表示要全部数据
      offset: parseInt(limit) === 1000 ? undefined : (parseInt(page) - 1) * parseInt(limit)
    });

    console.log('\x1b[33m%s\x1b[0m', `📋 发货需求数据: ${needsData.length} 条`);

    console.log('\x1b[33m%s\x1b[0m', '🔄 步骤4: 合并发货需求和库存数据');
    
    // 4. 创建一个 Map 来快速查找库存信息
    const inventoryMap = new Map();
    inventoryWithAmzSku.forEach(inv => {
      if (inv.amz_sku) {
        const key = `${inv.amz_sku}_${inv.country}`;
        inventoryMap.set(key, inv);
      }
    });

    // 5. 处理发货需求，与库存信息合并
    const mergedFromNeeds = needsData.map(need => {
      const key = `${need.sku}_${need.country}`;
      const inventoryInfo = inventoryMap.get(key) || {
        local_sku: '',
        whole_box_quantity: 0,
        whole_box_count: 0,
        mixed_box_quantity: 0,
        total_available: 0
      };

      return {
        record_num: need.record_num,
        need_num: need.need_num || '',
        amz_sku: need.sku || '',
        local_sku: inventoryInfo.local_sku,
        quantity: need.ori_quantity || 0,
        shipping_method: need.shipping_method || '',
        marketplace: need.marketplace || '',
        country: need.country || '',
        status: need.status || '待发货',
        created_at: need.create_date || new Date().toISOString(),
        // 库存信息
        whole_box_quantity: inventoryInfo.whole_box_quantity,
        whole_box_count: inventoryInfo.whole_box_count,
        mixed_box_quantity: inventoryInfo.mixed_box_quantity,
        total_available: inventoryInfo.total_available,
        // 计算缺货情况
        shortage: Math.max(0, (need.ori_quantity || 0) - inventoryInfo.total_available),
        data_source: 'need' // 标记数据来源
      };
    });

    // 6. 处理有库存但无需求的记录
    const needsAmzSkuSet = new Set(needsData.map(need => `${need.sku}_${need.country}`));
    const inventoryOnlyRecords = inventoryWithAmzSku
      .filter(inv => inv.amz_sku && !needsAmzSkuSet.has(`${inv.amz_sku}_${inv.country}`))
      .map((inv, index) => ({
        record_num: -1 - index, // 使用负数作为临时ID
        need_num: '',
        amz_sku: inv.amz_sku,
        local_sku: inv.local_sku,
        quantity: 0,
        shipping_method: '',
        marketplace: '',
        country: inv.country,
        status: '有库存无需求',
        created_at: new Date().toISOString(),
        // 库存信息
        whole_box_quantity: inv.whole_box_quantity,
        whole_box_count: inv.whole_box_count,
        mixed_box_quantity: inv.mixed_box_quantity,
        total_available: inv.total_available,
        shortage: 0, // 无需求，所以无缺货
        data_source: 'inventory' // 标记数据来源
      }));

    // 7. 合并所有数据
    const allMergedData = [...mergedFromNeeds, ...inventoryOnlyRecords];

    console.log('\x1b[35m%s\x1b[0m', '📊 合并完成统计:', {
      发货需求记录: mergedFromNeeds.length,
      仅库存记录: inventoryOnlyRecords.length,
      总计: allMergedData.length,
      有映射需求: mergedFromNeeds.filter(r => r.local_sku).length,
      无映射需求: mergedFromNeeds.filter(r => !r.local_sku).length
    });

    console.log('\x1b[35m%s\x1b[0m', '📊 合并数据示例（前3条）:', allMergedData.slice(0, 3));

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        list: allMergedData,
        total: allMergedData.length, // 注意：这里返回实际合并后的总数
        page: parseInt(page),
        limit: parseInt(limit),
        summary: {
          需求记录数: mergedFromNeeds.length,
          库存记录数: inventoryOnlyRecords.length,
          总记录数: allMergedData.length,
          有映射需求: mergedFromNeeds.filter(r => r.local_sku).length,
          无映射需求: mergedFromNeeds.filter(r => !r.local_sku).length
        }
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取合并数据失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 创建测试数据端点（仅用于测试）
router.post('/create-test-data', async (req, res) => {
  console.log('\x1b[33m%s\x1b[0m', '⚠️  创建测试数据请求');
  
  try {
    // 1. 获取现有的发货需求数据，为其创建SKU映射
    const existingNeeds = await WarehouseProductsNeed.findAll({
      attributes: ['sku', 'country'],
      group: ['sku', 'country'],
      raw: true
    });

    console.log('\x1b[33m%s\x1b[0m', '📋 现有发货需求SKU:', existingNeeds);

    // 2. 为现有的Amazon SKU创建映射到本地SKU
    const testMappings = existingNeeds.map((need, index) => ({
      amz_sku: need.sku,
      site: 'Amazon.com',
      country: need.country,
      local_sku: `LOCAL-${need.sku.substr(-4)}-${need.country}`, // 生成对应的本地SKU
      update_time: new Date()
    }));

    // 3. 添加一些额外的测试映射
    testMappings.push(
      {
        amz_sku: 'AMZ-TEST-001',
        site: 'Amazon.com',
        country: 'US',
        local_sku: 'LOCAL-001',
        update_time: new Date()
      },
      {
        amz_sku: 'AMZ-TEST-002',
        site: 'Amazon.co.uk',
        country: 'UK',
        local_sku: 'LOCAL-002',
        update_time: new Date()
      }
    );

    await AmzSkuMapping.bulkCreate(testMappings, {
      ignoreDuplicates: true
    });

    // 2. 创建一些测试发货需求数据（使用映射的Amazon SKU）
    const testNeeds = [
      {
        need_num: `NEED-${Date.now()}`,
        create_date: new Date(),
        sku: 'AMZ-TEST-001',
        ori_quantity: 100,
        shipping_method: '空运',
        marketplace: 'Amazon',
        country: 'US',
        status: '待发货'
      },
      {
        need_num: `NEED-${Date.now() + 1}`,
        create_date: new Date(),
        sku: 'AMZ-TEST-002',
        ori_quantity: 50,
        shipping_method: '海运',
        marketplace: 'Amazon',
        country: 'UK',
        status: '待发货'
      },
      {
        need_num: `NEED-${Date.now() + 2}`,
        create_date: new Date(),
        sku: 'AMZ-TEST-003',
        ori_quantity: 75,
        shipping_method: '快递',
        marketplace: 'Amazon',
        country: 'DE',
        status: '待发货'
      },
      {
        need_num: `NEED-${Date.now() + 3}`,
        create_date: new Date(),
        sku: 'UNMAPPED-SKU',
        ori_quantity: 30,
        shipping_method: '空运',
        marketplace: 'eBay',
        country: 'US',
        status: '待发货'
      }
    ];
    
    const createdNeeds = await WarehouseProductsNeed.bulkCreate(testNeeds);

    // 4. 为映射的本地SKU创建对应的库存数据
    const testInventory = [];
    
    // 为每个映射的本地SKU创建库存数据
    testMappings.forEach((mapping, index) => {
      const baseQuantity = Math.floor(Math.random() * 100) + 50; // 50-150的随机数量
      
      // 添加整箱库存
      testInventory.push({
        sku: mapping.local_sku,
        country: mapping.country,
        total_quantity: baseQuantity,
        total_boxes: Math.floor(baseQuantity / 20), // 假设每箱20个
        mix_box_num: null,
        marketPlace: 'Amazon'
      });
      
      // 随机添加一些混合箱库存
      if (Math.random() > 0.5) {
        testInventory.push({
          sku: mapping.local_sku,
          country: mapping.country,
          total_quantity: Math.floor(Math.random() * 30) + 10,
          total_boxes: 0,
          mix_box_num: `MIX-${index + 1}`,
          marketPlace: 'Amazon'
        });
      }
    });

    await LocalBox.bulkCreate(testInventory, {
      ignoreDuplicates: true
    });
    
    console.log('\x1b[32m%s\x1b[0m', '✅ 测试数据创建成功:', {
      mappings: testMappings.length,
      needs: createdNeeds.length,
      inventory: testInventory.length
    });
    
    res.json({
      code: 0,
      message: '测试数据创建成功',
      data: {
        mappings: testMappings.length,
        needs: createdNeeds.length,
        inventory: testInventory.length
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 创建测试数据失败:', error);
    
    res.status(500).json({
      code: 1,
      message: '创建测试数据失败',
      error: error.message
    });
  }
});

module.exports = router; 