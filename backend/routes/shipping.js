const express = require('express');
const router = express.Router();
const { WarehouseProductsNeed, LocalBox } = require('../models/index');
const { Sequelize } = require('sequelize');
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
    const stats = await LocalBox.findAll({
      attributes: [
        'sku',
        'country',
        'mix_box_num',
        'marketPlace',
        [Sequelize.fn('SUM', Sequelize.col('total_quantity')), 'total_quantity'],
        [Sequelize.fn('SUM', Sequelize.col('total_boxes')), 'total_boxes']
      ],
      group: ['sku', 'country', 'mix_box_num', 'marketPlace'],
      raw: true
    });

    console.log('\x1b[32m%s\x1b[0m', '📊 库存统计结果数量:', stats.length);

    res.json({
      code: 0,
      message: '获取成功',
      data: stats
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

// 创建测试数据端点（仅用于测试）
router.post('/create-test-data', async (req, res) => {
  console.log('\x1b[33m%s\x1b[0m', '⚠️  创建测试数据请求');
  
  try {
    // 创建一些测试发货需求数据
    const testNeeds = [
      {
        need_num: Date.now().toString(),
        create_date: new Date(),
        sku: 'TEST-SKU-001',
        ori_quantity: 100,
        shipping_method: '空运',
        marketplace: 'Amazon',
        country: 'US',
        status: '待发货'
      },
      {
        need_num: (Date.now() + 1).toString(),
        create_date: new Date(),
        sku: 'TEST-SKU-002',
        ori_quantity: 50,
        shipping_method: '海运',
        marketplace: 'eBay',
        country: 'UK',
        status: '待发货'
      }
    ];
    
    const createdNeeds = await WarehouseProductsNeed.bulkCreate(testNeeds);
    
    console.log('\x1b[32m%s\x1b[0m', '✅ 测试数据创建成功:', createdNeeds.length);
    
    res.json({
      code: 0,
      message: '测试数据创建成功',
      data: createdNeeds
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