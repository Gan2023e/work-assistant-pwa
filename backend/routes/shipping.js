const express = require('express');
const router = express.Router();
const { WarehouseProductsNeed, LocalBox, AmzSkuMapping } = require('../models/index');
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
    
    // 检查数据表记录数
    const needsCount = await WarehouseProductsNeed.count();
    const localBoxCount = await LocalBox.count();
    
    console.log('\x1b[32m%s\x1b[0m', '📊 数据表状态:', {
      pbi_warehouse_products_need: `${needsCount} 条记录`,
      local_boxes: `${localBoxCount} 条记录`
    });
    
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
          }
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
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到合并数据查询请求');
  
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    // 1. 获取发货需求数据
    const whereCondition = {};
    if (status) {
      whereCondition.status = status;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows: needsData } = await WarehouseProductsNeed.findAndCountAll({
      where: whereCondition,
      order: [['record_num', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    console.log('\x1b[32m%s\x1b[0m', '📊 发货需求数据数量:', needsData.length);

    // 2. 对每个发货需求，查找对应的本地SKU和库存信息
    const mergedData = await Promise.all(
      needsData.map(async (need) => {
        try {
          // 通过amz_sku + country查找对应的local_sku
          const skuMapping = await AmzSkuMapping.findOne({
            where: {
              amz_sku: need.sku,
              country: need.country
            },
            raw: true
          });

          let inventoryInfo = {
            local_sku: '',
            whole_box_quantity: 0,
            whole_box_count: 0,
            mixed_box_quantity: 0,
            total_available: 0
          };

          if (skuMapping) {
            // 查找对应的库存数据
            const inventoryData = await LocalBox.findAll({
              where: {
                sku: skuMapping.local_sku,
                country: need.country
              },
              raw: true
            });

            // 计算库存统计
            let wholeBoxQty = 0, wholeBoxCount = 0, mixedBoxQty = 0;
            
            inventoryData.forEach(item => {
              const quantity = parseInt(item.total_quantity) || 0;
              const boxes = parseInt(item.total_boxes) || 0;
              
              if (!item.mix_box_num || item.mix_box_num.trim() === '') {
                wholeBoxQty += quantity;
                wholeBoxCount += boxes;
              } else {
                mixedBoxQty += quantity;
              }
            });

            inventoryInfo = {
              local_sku: skuMapping.local_sku,
              whole_box_quantity: wholeBoxQty,
              whole_box_count: wholeBoxCount,
              mixed_box_quantity: mixedBoxQty,
              total_available: wholeBoxQty + mixedBoxQty
            };
          }

          // 合并发货需求和库存信息
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
            shortage: Math.max(0, (need.ori_quantity || 0) - inventoryInfo.total_available)
          };
        } catch (error) {
          console.error('处理单个需求数据失败:', error);
          return {
            record_num: need.record_num,
            need_num: need.need_num || '',
            amz_sku: need.sku || '',
            local_sku: '',
            quantity: need.ori_quantity || 0,
            shipping_method: need.shipping_method || '',
            marketplace: need.marketplace || '',
            country: need.country || '',
            status: need.status || '待发货',
            created_at: need.create_date || new Date().toISOString(),
            whole_box_quantity: 0,
            whole_box_count: 0,
            mixed_box_quantity: 0,
            total_available: 0,
            shortage: need.ori_quantity || 0
          };
        }
      })
    );

    console.log('\x1b[35m%s\x1b[0m', '📊 合并数据示例（前3条）:', mergedData.slice(0, 3));

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        list: mergedData,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit)
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
    // 1. 创建SKU映射测试数据
    const testMappings = [
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
      },
      {
        amz_sku: 'AMZ-TEST-003',
        site: 'Amazon.de',
        country: 'DE',
        local_sku: 'LOCAL-003',
        update_time: new Date()
      }
    ];

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

    // 3. 创建一些对应的库存数据
    const testInventory = [
      {
        sku: 'LOCAL-001',
        country: 'US',
        total_quantity: 120,
        total_boxes: 5,
        mix_box_num: null,
        marketPlace: 'Amazon'
      },
      {
        sku: 'LOCAL-001',
        country: 'US',
        total_quantity: 20,
        total_boxes: 0,
        mix_box_num: 'MIX-001',
        marketPlace: 'Amazon'
      },
      {
        sku: 'LOCAL-002',
        country: 'UK',
        total_quantity: 30,
        total_boxes: 2,
        mix_box_num: null,
        marketPlace: 'Amazon'
      },
      {
        sku: 'LOCAL-003',
        country: 'DE',
        total_quantity: 60,
        total_boxes: 3,
        mix_box_num: null,
        marketPlace: 'Amazon'
      },
      {
        sku: 'LOCAL-003',
        country: 'DE',
        total_quantity: 10,
        total_boxes: 0,
        mix_box_num: 'MIX-002',
        marketPlace: 'Amazon'
      }
    ];

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