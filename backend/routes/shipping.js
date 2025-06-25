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
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const whereCondition = {};
    if (status) {
      whereCondition.status = status;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const { count, rows } = await WarehouseProductsNeed.findAndCountAll({
      where: whereCondition,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        list: rows,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('获取发货需求列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 获取库存统计
router.get('/inventory-stats', async (req, res) => {
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

    res.json({
      code: 0,
      message: '获取成功',
      data: stats
    });
  } catch (error) {
    console.error('获取库存统计失败:', error);
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

module.exports = router; 