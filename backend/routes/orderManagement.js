const express = require('express');
const router = express.Router();
const { 
  WarehouseProductsNeed, 
  ShipmentRecord, 
  ShipmentItem, 
  OrderShipmentRelation,
  LocalBox,
  AmzSkuMapping,
  sequelize 
} = require('../models/index');
const { Sequelize, Op } = require('sequelize');
const axios = require('axios');
const crypto = require('crypto');

// 钉钉通知函数 - 海外仓补货需求
async function sendDingTalkNotification(data) {
  const webhookUrl = process.env.DINGTALK_WEBHOOK;
  const secretKey = process.env.SECRET_KEY;
  const mobileNumMom = process.env.MOBILE_NUM_MOM;
  
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

    // 构建消息内容
    const message = `海外仓补货需求
截止日期：${new Date(data.send_out_date).toLocaleDateString('zh-CN')}
目的国：${data.country}
物流方式：${data.shipping_method}
物销售平台：${data.marketplace}
SKU及数量：
${data.skuList.join('\n')}
@${mobileNumMom || '邹菊先'}`;

    const dingTalkData = {
      msgtype: 'text',
      text: {
        content: message
      },
      at: {
        atMobiles: mobileNumMom ? [mobileNumMom] : [],
        isAtAll: false
      }
    };

    const response = await axios.post(url, dingTalkData);
    console.log('✅ 海外仓补货需求钉钉通知发送成功');
  } catch (error) {
    console.error('❌ 海外仓补货需求钉钉通知发送失败:', error.message);
    throw error;
  }
}

// 获取需求单列表（按需求单号分组）
router.get('/orders', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 获取需求单列表请求:', JSON.stringify(req.query, null, 2));
  
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    // 按需求单号分组统计（修复SQL语法）
    const ordersQuery = `
      SELECT 
        need_num,
        COUNT(*) as total_items,
        SUM(ori_quantity) as total_quantity,
        MIN(create_date) as created_at,
        MAX(create_date) as updated_at,
        MAX(country) as country,
        MAX(marketplace) as marketplace,
        MAX(shipping_method) as shipping_method,
        MAX(status) as status,
        GROUP_CONCAT(DISTINCT status SEPARATOR ',') as status_list
      FROM pbi_warehouse_products_need 
      WHERE need_num IS NOT NULL AND need_num != ''
        ${status && status !== '全部' ? `AND status = '${status}'` : ''}
      GROUP BY need_num
      ORDER BY MIN(create_date) DESC
      LIMIT ${parseInt(limit)} OFFSET ${(parseInt(page) - 1) * parseInt(limit)}
    `;

    // 获取总数
    const countQuery = `
      SELECT COUNT(DISTINCT need_num) as total
      FROM pbi_warehouse_products_need 
      WHERE need_num IS NOT NULL AND need_num != ''
        ${status && status !== '全部' ? `AND status = '${status}'` : ''}
    `;

    const [orders] = await sequelize.query(ordersQuery);
    const [countResult] = await sequelize.query(countQuery);
    const total = countResult[0]?.total || 0;

    console.log('\x1b[33m%s\x1b[0m', '🔍 原始查询结果:', { ordersCount: orders.length, total });

    // 查询每个需求单的发货历史
    const orderNums = orders.map(order => order.need_num).filter(Boolean);
    let shipmentHistory = [];
    
    if (orderNums.length > 0) {
      shipmentHistory = await OrderShipmentRelation.findAll({
        where: {
          need_num: { [Op.in]: orderNums }
        },
        include: [{
          model: ShipmentRecord,
          as: 'shipmentRecord',
          attributes: ['shipment_number', 'created_at', 'status', 'operator']
        }],
        order: [['created_at', 'DESC']]
      });
    }

    // 组装发货历史到需求单信息中
    const ordersWithHistory = orders.map(order => {
      const history = shipmentHistory.filter(sh => sh.need_num === order.need_num);
      const totalShipped = history.reduce((sum, h) => sum + (h.total_shipped || 0), 0);
      
      // 判断订单状态
      let orderStatus = '待发货';
      if (order.status_list && order.status_list.includes('已发货')) {
        orderStatus = totalShipped >= order.total_quantity ? '全部发出' : '部分发出';
      } else {
        orderStatus = order.status || '待发货';
      }
      
      const completionRate = order.total_quantity > 0 ? 
        Math.round((totalShipped / order.total_quantity) * 100) : 0;
      
      return {
        need_num: order.need_num,
        total_items: parseInt(order.total_items) || 0,
        total_quantity: parseInt(order.total_quantity) || 0,
        total_shipped: totalShipped,
        remaining_quantity: (parseInt(order.total_quantity) || 0) - totalShipped,
        created_at: order.created_at,
        updated_at: order.updated_at,
        country: order.country || '',
        marketplace: order.marketplace || '',
        shipping_method: order.shipping_method || '',
        order_status: orderStatus,
        completion_rate: completionRate,
        shipment_count: history.length,
        latest_shipment: history[0] ? {
          shipment_number: history[0].shipmentRecord?.shipment_number,
          created_at: history[0].shipmentRecord?.created_at,
          operator: history[0].shipmentRecord?.operator
        } : null
      };
    });

    console.log('\x1b[32m%s\x1b[0m', '📊 需求单查询结果:', { 
      total: parseInt(total), 
      ordersCount: ordersWithHistory.length,
      sampleOrder: ordersWithHistory[0]
    });

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        list: ordersWithHistory,
        total: parseInt(total),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取需求单列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 获取需求单详情（包含SKU明细）
router.get('/orders/:needNum/details', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 获取需求单详情:', req.params.needNum);
  
  try {
    const { needNum } = req.params;
    
    // 查询需求单的所有SKU记录
    const orderItems = await WarehouseProductsNeed.findAll({
      where: { need_num: needNum },
      order: [['record_num', 'ASC']]
    });

    if (orderItems.length === 0) {
      return res.status(404).json({
        code: 1,
        message: '需求单不存在'
      });
    }

    // 查询库存信息和映射关系
    const itemsWithInventory = await Promise.all(
      orderItems.map(async (item) => {
        // 查询SKU映射
        const mapping = await AmzSkuMapping.findOne({
          where: {
            local_sku: item.sku,
            country: item.country
          }
        });

        // 查询库存
        const inventory = await LocalBox.findAll({
          where: {
            sku: mapping ? mapping.local_sku : item.sku,
            country: item.country
          },
          attributes: ['mix_box_num', 'total_quantity', 'total_boxes'],
          raw: true
        });

        // 计算库存统计
        let wholeBoxQuantity = 0, wholeBoxCount = 0, mixedBoxQuantity = 0;
        inventory.forEach(inv => {
          const quantity = parseInt(inv.total_quantity) || 0;
          const boxes = parseInt(inv.total_boxes) || 0;
          
          if (!inv.mix_box_num || inv.mix_box_num.trim() === '') {
            wholeBoxQuantity += quantity;
            wholeBoxCount += boxes;
          } else {
            mixedBoxQuantity += quantity;
          }
        });

        // 查询已发货数量
        const shipped = await ShipmentItem.sum('shipped_quantity', {
          where: { order_item_id: item.record_num }
        }) || 0;

        // 动态计算SKU状态
        let skuStatus = '待发货';
        if (shipped > 0) {
          if (shipped >= item.ori_quantity) {
            skuStatus = '全部发出';
          } else {
            skuStatus = '部分发出';
          }
        }

        return {
          ...item.toJSON(),
          amz_sku: mapping?.amz_sku || item.sku,
          whole_box_quantity: wholeBoxQuantity,
          whole_box_count: wholeBoxCount,
          mixed_box_quantity: mixedBoxQuantity,
          total_available: wholeBoxQuantity + mixedBoxQuantity,
          shipped_quantity: shipped,
          remaining_quantity: item.ori_quantity - shipped,
          shortage: Math.max(0, item.ori_quantity - shipped - (wholeBoxQuantity + mixedBoxQuantity)),
          status: skuStatus  // 使用动态计算的状态，而不是数据库中的status字段
        };
      })
    );

    // 查询发货历史
    const shipmentHistory = await OrderShipmentRelation.findAll({
      where: { need_num: needNum },
      include: [{
        model: ShipmentRecord,
        as: 'shipmentRecord',
        attributes: ['shipment_number', 'created_at', 'status', 'operator', 'total_boxes']
      }],
      order: [['created_at', 'DESC']]
    });

    const orderSummary = {
      need_num: needNum,
      total_items: orderItems.length,
      total_quantity: orderItems.reduce((sum, item) => sum + item.ori_quantity, 0),
      total_shipped: itemsWithInventory.reduce((sum, item) => sum + item.shipped_quantity, 0),
      created_at: orderItems[0].create_date,
      country: orderItems[0].country,
      marketplace: orderItems[0].marketplace,
      shipping_method: orderItems[0].shipping_method
    };

    orderSummary.remaining_quantity = orderSummary.total_quantity - orderSummary.total_shipped;
    orderSummary.completion_rate = Math.round((orderSummary.total_shipped / orderSummary.total_quantity) * 100);

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        order_summary: orderSummary,
        order_items: itemsWithInventory,
        shipment_history: shipmentHistory.map(sh => ({
          ...sh.toJSON(),
          shipment_info: sh.shipmentRecord
        }))
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取需求单详情失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 创建新需求单
router.post('/orders', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 创建新需求单请求:', JSON.stringify(req.body, null, 2));
  
  try {
    const { 
      country, 
      shipping_method, 
      marketplace, 
      send_out_date, 
      expect_sold_out_date, 
      sku_data 
    } = req.body;

    // 验证必填字段
    if (!country || !shipping_method || !marketplace || !send_out_date || !expect_sold_out_date || !sku_data) {
      return res.status(400).json({
        code: 1,
        message: '请填写所有必填字段'
      });
    }

    // 解析SKU数据
    const skuLines = sku_data.trim().split('\n').filter(line => line.trim());
    if (skuLines.length === 0) {
      return res.status(400).json({
        code: 1,
        message: 'SKU数据不能为空'
      });
    }

    // 生成需求单号（格式：日期+序号）
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const existingCount = await WarehouseProductsNeed.count({
      where: {
        need_num: {
          [Op.like]: `XQ${today}%`
        }
      }
    });
    const needNum = `XQ${today}${String(existingCount + 1).padStart(3, '0')}`;

    // 解析并创建需求单记录
    const orderItems = [];
    for (let i = 0; i < skuLines.length; i++) {
      const line = skuLines[i].trim();
      const parts = line.split(/\s+/);
      
      if (parts.length < 2) {
        return res.status(400).json({
          code: 1,
          message: `第${i + 1}行SKU数据格式错误，正确格式：SKU 数量`
        });
      }

      const sku = parts[0];
      const quantity = parseInt(parts[1]);
      
      if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({
          code: 1,
          message: `第${i + 1}行数量必须是大于0的数字`
        });
      }

      orderItems.push({
        need_num: needNum,
        create_date: new Date(),
        sku: sku,
        ori_quantity: quantity,
        country: country,
        shipping_method: shipping_method,
        send_out_date: new Date(send_out_date),
        marketplace: marketplace,
        expired_date: new Date(send_out_date), // 发货截止日作为过期日期
        expect_sold_out_date: new Date(expect_sold_out_date),
        status: '待发货'
      });
    }

    // 批量创建记录
    await WarehouseProductsNeed.bulkCreate(orderItems);

    console.log('\x1b[32m%s\x1b[0m', '✅ 需求单创建成功:', {
      needNum,
      itemCount: orderItems.length,
      totalQuantity: orderItems.reduce((sum, item) => sum + item.ori_quantity, 0)
    });

    // 准备钉钉通知数据
    const notificationData = {
      needNum,
      country,
      shipping_method,
      marketplace,
      send_out_date,
      expect_sold_out_date,
      skuList: orderItems.map(item => `${item.sku} ${item.ori_quantity}`)
    };

    // 发送钉钉通知（异步，不影响响应）
    try {
      await sendDingTalkNotification(notificationData);
    } catch (notifyError) {
      console.error('\x1b[33m%s\x1b[0m', '⚠️ 钉钉通知发送失败:', notifyError.message);
      // 不影响主流程
    }

    res.json({
      code: 0,
      message: '需求单创建成功',
      data: {
        need_num: needNum,
        total_items: orderItems.length,
        total_quantity: orderItems.reduce((sum, item) => sum + item.ori_quantity, 0)
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 创建需求单失败:', error);
    res.status(500).json({
      code: 1,
      message: '创建失败',
      error: error.message
    });
  }
});

// 修改需求单中SKU的数量
router.put('/orders/:needNum/items/:recordNum', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔄 修改需求数量:', {
    needNum: req.params.needNum,
    recordNum: req.params.recordNum,
    body: req.body
  });
  
  try {
    const { needNum, recordNum } = req.params;
    const { quantity } = req.body;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        code: 1,
        message: '数量必须大于0'
      });
    }

    // 查询原记录
    const orderItem = await WarehouseProductsNeed.findOne({
      where: {
        record_num: parseInt(recordNum),
        need_num: needNum
      }
    });

    if (!orderItem) {
      return res.status(404).json({
        code: 1,
        message: '需求记录不存在'
      });
    }

    // 检查是否已有发货记录
    const shippedQuantity = await ShipmentItem.sum('shipped_quantity', {
      where: { order_item_id: parseInt(recordNum) }
    }) || 0;

    if (quantity < shippedQuantity) {
      return res.status(400).json({
        code: 1,
        message: `修改后的数量(${quantity})不能小于已发货数量(${shippedQuantity})`
      });
    }

    // 更新数量
    await orderItem.update({
      ori_quantity: quantity
    });

    console.log('\x1b[32m%s\x1b[0m', '✅ 需求数量修改成功:', {
      recordNum,
      oldQuantity: orderItem.ori_quantity,
      newQuantity: quantity
    });

    res.json({
      code: 0,
      message: '修改成功',
      data: {
        record_num: orderItem.record_num,
        old_quantity: orderItem.ori_quantity,
        new_quantity: quantity,
        shipped_quantity: shippedQuantity,
        remaining_quantity: quantity - shippedQuantity
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 修改需求数量失败:', error);
    res.status(500).json({
      code: 1,
      message: '修改失败',
      error: error.message
    });
  }
});

module.exports = router; 