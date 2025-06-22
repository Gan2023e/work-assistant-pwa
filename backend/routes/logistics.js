const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const Logistics = require('../models/Logistics');

// 搜索物流信息
router.post('/search', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到搜索请求:', JSON.stringify(req.body, null, 2));
  
  try {
    const { shippingIds, filters } = req.body;
    
    // 构建查询条件
    const where = {};
    if (Array.isArray(shippingIds) && shippingIds.length > 0) {
      where.shippingId = {
        [Op.in]: shippingIds
      };
    }

    // 添加筛选条件
    if (filters) {
      if (filters.status === 'not_completed') {
        // 状态为非完成，假设完成状态为 '完成'
        where.status = { [Op.ne]: '完成' };
      } else if (filters.status) {
        where.status = filters.status;
      }
      if (filters.logisticsProvider) {
        where.logisticsProvider = filters.logisticsProvider;
      }
      if (filters.channel) {
        where.channel = filters.channel;
      }
      if (filters.destinationCountry) {
        where.destinationCountry = filters.destinationCountry;
      }
      if (filters.taxPaymentStatus) {
        where.taxPaymentStatus = filters.taxPaymentStatus;
      }
      if (filters.taxDeclarationStatus) {
        where.taxDeclarationStatus = filters.taxDeclarationStatus;
      }
      if (filters.paymentStatus) {
        where.paymentStatus = filters.paymentStatus;
      }
    }

    console.log('\x1b[35m%s\x1b[0m', '查询条件:', JSON.stringify(where, null, 2));

    const logistics = await Logistics.findAll({
      where,
      order: [['shippingId', 'DESC']]
    });

    console.log('\x1b[32m%s\x1b[0m', '查询结果数量:', logistics.length);

    res.json({
      code: 0,
      message: 'success',
      data: logistics
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '搜索物流信息失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: error.message
    });
  }
});

// 批量更新状态
router.post('/batch-update-status', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到批量更新状态请求:', JSON.stringify(req.body, null, 2));
  
  try {
    const { shippingIds, status } = req.body;
    
    // 验证参数
    if (!Array.isArray(shippingIds) || shippingIds.length === 0) {
      return res.status(400).json({
        code: 400,
        message: 'shippingIds 必须是非空数组'
      });
    }
    
    if (!status || !['在途', '入库中', '完成'].includes(status)) {
      return res.status(400).json({
        code: 400,
        message: '状态必须是：在途、入库中、完成 中的一种'
      });
    }

    console.log('\x1b[35m%s\x1b[0m', `批量更新 ${shippingIds.length} 条记录状态为: ${status}`);

    // 执行批量更新
    const [affectedCount] = await Logistics.update(
      { status: status },
      {
        where: {
          shippingId: {
            [Op.in]: shippingIds
          }
        }
      }
    );

    console.log('\x1b[32m%s\x1b[0m', '成功更新记录数:', affectedCount);

    res.json({
      code: 0,
      message: 'success',
      data: {
        affectedCount,
        updatedStatus: status,
        shippingIds
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '批量更新状态失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: error.message
    });
  }
});

// 获取所有可筛选字段的唯一值
router.get('/filters', async (req, res) => {
  try {
    const fieldMap = {
      logisticsProvider: 'logistics_provider',
      channel: 'channel',
      status: 'status',
      destinationCountry: 'destination_country',
      taxPaymentStatus: 'tax_payment_status',
      taxDeclarationStatus: 'tax_declaration_status',
      paymentStatus: 'payment_status'
    };
    const fields = Object.keys(fieldMap);
    const result = {};
    for (const key of fields) {
      const dbField = fieldMap[key];
      try {
        const rows = await Logistics.findAll({
          attributes: [[dbField, 'value']],
          group: [dbField],
          raw: true
        });
        result[key] = rows.map(r => r.value).filter(v => v !== null && v !== '');
      } catch (e) {
        console.error('字段出错:', key, e.message);
        result[key] = [];
      }
    }
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: 500, message: '获取筛选项失败', error: e.message });
  }
});

module.exports = router; 