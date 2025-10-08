const express = require('express');
const router = express.Router();
const resendService = require('../utils/resendService');

/**
 * 发送产品状态邮件
 * POST /api/resend/product-status
 */
router.post('/product-status', async (req, res) => {
  try {
    const { action, parentSkus } = req.body;

    if (!action || !parentSkus || !Array.isArray(parentSkus)) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：action 和 parentSkus'
      });
    }

    const result = await resendService.sendProductStatusEmail(action, parentSkus);
    
    if (result.success) {
      res.json({
        success: true,
        message: '邮件发送成功',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('发送产品状态邮件失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * 发送自定义邮件
 * POST /api/resend/custom
 */
router.post('/custom', async (req, res) => {
  try {
    const { subject, content, htmlContent } = req.body;

    if (!subject || !content) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：subject 和 content'
      });
    }

    const result = await resendService.sendCustomEmail(subject, content, htmlContent);
    
    if (result.success) {
      res.json({
        success: true,
        message: '邮件发送成功',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('发送自定义邮件失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * 发送批量邮件
 * POST /api/resend/bulk
 */
router.post('/bulk', async (req, res) => {
  try {
    const { recipients, subject, content, htmlContent } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：recipients（收件人列表）'
      });
    }

    if (!subject || !content) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：subject 和 content'
      });
    }

    const result = await resendService.sendBulkEmail(recipients, subject, content, htmlContent);
    
    if (result.success) {
      res.json({
        success: true,
        message: '批量邮件发送成功',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('发送批量邮件失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * 发送带附件的邮件
 * POST /api/resend/with-attachments
 */
router.post('/with-attachments', async (req, res) => {
  try {
    const { subject, content, attachments, htmlContent } = req.body;

    if (!subject || !content) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：subject 和 content'
      });
    }

    const result = await resendService.sendEmailWithAttachments(subject, content, attachments, htmlContent);
    
    if (result.success) {
      res.json({
        success: true,
        message: '带附件邮件发送成功',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('发送带附件邮件失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * 测试 Resend 连接
 * GET /api/resend/test
 */
router.get('/test', async (req, res) => {
  try {
    // 发送测试邮件
    const testResult = await resendService.sendCustomEmail(
      'Resend 连接测试',
      '这是一封测试邮件，用于验证 Resend 服务是否正常工作。\n\n发送时间: ' + new Date().toLocaleString('zh-CN'),
      `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; border-left: 4px solid #4caf50;">
            <h2 style="color: #2e7d32; margin: 0 0 10px 0;">✅ Resend 连接测试</h2>
            <p style="color: #333; margin: 0;">这是一封测试邮件，用于验证 Resend 服务是否正常工作。</p>
            <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">
              发送时间: ${new Date().toLocaleString('zh-CN')}
            </p>
          </div>
        </div>
      `
    );

    if (testResult.success) {
      res.json({
        success: true,
        message: 'Resend 连接测试成功',
        messageId: testResult.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        error: testResult.error
      });
    }
  } catch (error) {
    console.error('Resend 连接测试失败:', error);
    res.status(500).json({
      success: false,
      error: 'Resend 连接测试失败: ' + error.message
    });
  }
});

module.exports = router;
