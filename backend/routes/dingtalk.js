const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

// 统一的钉钉通知发送函数
async function sendDingTalkMessage(webhookUrl, secretKey, message, atMobiles = [], isAtAll = false) {
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

    const dingTalkData = {
      msgtype: 'text',
      text: {
        content: message
      },
      at: {
        atMobiles: atMobiles,
        isAtAll: isAtAll
      }
    };

    const response = await axios.post(url, dingTalkData);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ 钉钉消息发送失败:', error.message);
    throw error;
  }
}

// 发送通用钉钉消息
router.post('/send-message', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '📱 发送钉钉消息请求:', JSON.stringify(req.body, null, 2));
  
  try {
    const { message, type, atMobiles = [], isAtAll = false } = req.body;
    
    if (!message) {
      return res.status(400).json({
        code: 1,
        message: '消息内容不能为空'
      });
    }

    const webhookUrl = process.env.DINGTALK_WEBHOOK;
    const secretKey = process.env.SECRET_KEY;
    
    if (!webhookUrl) {
      console.log('⚠️ 钉钉Webhook未配置，跳过通知');
      return res.json({
        code: 0,
        message: '钉钉Webhook未配置，消息未发送',
        data: { sent: false, reason: 'webhook_not_configured' }
      });
    }

    // 根据消息类型添加默认@人员
    let finalAtMobiles = [...atMobiles];
    if (type === 'warehouse_demand_update') {
      const mobileNumMom = process.env.MOBILE_NUM_MOM;
      if (mobileNumMom && !finalAtMobiles.includes(mobileNumMom)) {
        finalAtMobiles.push(mobileNumMom);
      }
    }

    const result = await sendDingTalkMessage(webhookUrl, secretKey, message, finalAtMobiles, isAtAll);
    
    console.log('\x1b[32m%s\x1b[0m', '✅ 钉钉消息发送成功');
    
    res.json({
      code: 0,
      message: '消息发送成功',
      data: { sent: true, result: result.data }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 发送钉钉消息失败:', error);
    res.status(500).json({
      code: 1,
      message: '发送失败',
      error: error.message
    });
  }
});

// 发送海外仓补货需求通知
router.post('/warehouse-demand', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '📦 发送海外仓补货需求通知:', JSON.stringify(req.body, null, 2));
  
  try {
    const { 
      needNum,
      country, 
      shipping_method, 
      marketplace, 
      send_out_date, 
      expect_sold_out_date, 
      skuList,
      operator 
    } = req.body;

    const message = `📦 海外仓补货需求通知

🆔 需求单号：${needNum}
📅 截止日期：${new Date(send_out_date).toLocaleDateString('zh-CN')}
🌍 目的国：${country}
🚚 物流方式：${shipping_method}
🛒 销售平台：${marketplace}
📦 SKU及数量：
${skuList.join('\n')}

⏰ 创建时间：${new Date().toLocaleString('zh-CN')}
👤 操作员：${operator || '未知'}`;

    const webhookUrl = process.env.DINGTALK_WEBHOOK;
    const secretKey = process.env.SECRET_KEY;
    const mobileNumMom = process.env.MOBILE_NUM_MOM;
    
    if (!webhookUrl) {
      console.log('⚠️ 钉钉Webhook未配置，跳过通知');
      return res.json({
        code: 0,
        message: '钉钉Webhook未配置，通知未发送',
        data: { sent: false, reason: 'webhook_not_configured' }
      });
    }

    const atMobiles = mobileNumMom ? [mobileNumMom] : [];
    const result = await sendDingTalkMessage(webhookUrl, secretKey, message, atMobiles);
    
    console.log('\x1b[32m%s\x1b[0m', '✅ 海外仓补货需求通知发送成功');
    
    res.json({
      code: 0,
      message: '通知发送成功',
      data: { sent: true, result: result.data }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 发送海外仓补货需求通知失败:', error);
    res.status(500).json({
      code: 1,
      message: '发送失败',
      error: error.message
    });
  }
});

module.exports = router; 