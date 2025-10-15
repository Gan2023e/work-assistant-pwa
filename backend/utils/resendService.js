const { Resend } = require('resend');

// 创建 Resend 实例（仅在API密钥存在时）
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

/**
 * 发送产品上下架邮件 - 使用 Resend
 * @param {string} action - 操作类型（如：产品上架、下架等）
 * @param {Array} parentSkus - 母SKU列表
 * @returns {Object} 发送结果
 */
const sendProductStatusEmail = async (action, parentSkus) => {
  try {
    // 检查 Resend API Key 配置
    if (!resend || !process.env.RESEND_API_KEY || !process.env.EMAIL_RECEIVER) {
      console.error('Resend 配置不完整，无法发送邮件');
      return { success: false, error: 'Resend 配置不完整' };
    }

    const subject = process.env.EMAIL_SUBJECT || '产品手动上下架及数量调整';
    
    // 构建 HTML 内容
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin: 0 0 10px 0;">${action}</h2>
          <p style="color: #666; margin: 0;">时间: ${new Date().toLocaleString('zh-CN')}</p>
        </div>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="color: #333; margin: 0 0 15px 0;">涉及的母SKU:</h3>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px;">
            ${parentSkus.map(sku => `<div style="padding: 5px 0; border-bottom: 1px solid #eee;">${sku}</div>`).join('')}
          </div>
          <p style="color: #666; margin: 15px 0 0 0; font-size: 14px;">
            共 ${parentSkus.length} 个母SKU
          </p>
        </div>
      </div>
    `;

    // 构建收件人列表
    const recipients = [process.env.EMAIL_RECEIVER];
    const ccRecipients = process.env.EMAIL_CC ? [process.env.EMAIL_CC] : [];
    
    const emailData = {
      from: process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com',
      to: recipients,
      subject: subject,
      html: htmlContent,
    };
    
    // 如果有抄送邮箱，添加到邮件数据中
    if (ccRecipients.length > 0) {
      emailData.cc = ccRecipients;
    }

    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      console.error('Resend 邮件发送失败:', error);
      return { success: false, error: error.message };
    }

    // 生产环境只记录简要信息
    if (process.env.NODE_ENV === 'development') {
      console.log('Resend 邮件发送成功:', data.id);
    } else {
      console.log(`Resend 邮件发送成功: ${action}, 母SKU数量: ${parentSkus.length}`);
    }

    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Resend 邮件发送异常:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 发送自定义内容邮件 - 使用 Resend
 * @param {string} subject - 邮件主题
 * @param {string} content - 邮件内容
 * @param {string} htmlContent - HTML 内容（可选）
 * @returns {Object} 发送结果
 */
const sendCustomEmail = async (subject, content, htmlContent = null) => {
  try {
    // 检查 Resend API Key 配置
    if (!resend || !process.env.RESEND_API_KEY || !process.env.EMAIL_RECEIVER) {
      console.error('Resend 配置不完整，无法发送邮件');
      return { success: false, error: 'Resend 配置不完整' };
    }

    // 如果没有提供 HTML 内容，则从纯文本生成
    const finalHtmlContent = htmlContent || `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
        <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="white-space: pre-line;">${content}</div>
        </div>
      </div>
    `;

    // 构建收件人列表
    const recipients = [process.env.EMAIL_RECEIVER];
    const ccRecipients = process.env.EMAIL_CC ? [process.env.EMAIL_CC] : [];
    
    const emailData = {
      from: process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com',
      to: recipients,
      subject: subject,
      html: finalHtmlContent,
    };
    
    // 如果有抄送邮箱，添加到邮件数据中
    if (ccRecipients.length > 0) {
      emailData.cc = ccRecipients;
    }

    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      console.error('Resend 邮件发送失败:', error);
      return { success: false, error: error.message };
    }

    // 生产环境只记录简要信息
    if (process.env.NODE_ENV === 'development') {
      console.log('Resend 邮件发送成功:', data.id);
    } else {
      console.log(`Resend 邮件发送成功: ${subject}`);
    }

    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Resend 邮件发送异常:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 发送批量邮件 - 使用 Resend
 * @param {Array} recipients - 收件人列表
 * @param {string} subject - 邮件主题
 * @param {string} content - 邮件内容
 * @param {string} htmlContent - HTML 内容（可选）
 * @returns {Object} 发送结果
 */
const sendBulkEmail = async (recipients, subject, content, htmlContent = null) => {
  try {
    // 检查 Resend API Key 配置
    if (!resend || !process.env.RESEND_API_KEY || !recipients || recipients.length === 0) {
      console.error('Resend 配置不完整或收件人列表为空');
      return { success: false, error: 'Resend 配置不完整或收件人列表为空' };
    }

    // 如果没有提供 HTML 内容，则从纯文本生成
    const finalHtmlContent = htmlContent || `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
        <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="white-space: pre-line;">${content}</div>
        </div>
      </div>
    `;

    // 构建抄送收件人列表
    const ccRecipients = process.env.EMAIL_CC ? [process.env.EMAIL_CC] : [];
    
    const emailData = {
      from: process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com',
      to: recipients,
      subject: subject,
      html: finalHtmlContent,
    };
    
    // 如果有抄送邮箱，添加到邮件数据中
    if (ccRecipients.length > 0) {
      emailData.cc = ccRecipients;
    }

    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      console.error('Resend 批量邮件发送失败:', error);
      return { success: false, error: error.message };
    }

    console.log(`Resend 批量邮件发送成功: ${subject}, 收件人数量: ${recipients.length}`);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Resend 批量邮件发送异常:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 发送带附件的邮件 - 使用 Resend
 * @param {string} subject - 邮件主题
 * @param {string} content - 邮件内容
 * @param {Array} attachments - 附件列表
 * @param {string} htmlContent - HTML 内容（可选）
 * @returns {Object} 发送结果
 */
const sendEmailWithAttachments = async (subject, content, attachments = [], htmlContent = null) => {
  try {
    // 检查 Resend API Key 配置
    if (!resend || !process.env.RESEND_API_KEY || !process.env.EMAIL_RECEIVER) {
      console.error('Resend 配置不完整，无法发送邮件');
      return { success: false, error: 'Resend 配置不完整' };
    }

    // 如果没有提供 HTML 内容，则从纯文本生成
    const finalHtmlContent = htmlContent || `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
        <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="white-space: pre-line;">${content}</div>
        </div>
      </div>
    `;

    // 构建收件人列表
    const recipients = [process.env.EMAIL_RECEIVER];
    const ccRecipients = process.env.EMAIL_CC ? [process.env.EMAIL_CC] : [];
    
    const emailData = {
      from: process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com',
      to: recipients,
      subject: subject,
      html: finalHtmlContent,
    };
    
    // 如果有抄送邮箱，添加到邮件数据中
    if (ccRecipients.length > 0) {
      emailData.cc = ccRecipients;
    }

    // 如果有附件，添加附件信息
    if (attachments && attachments.length > 0) {
      emailData.attachments = attachments.map(attachment => ({
        filename: attachment.filename,
        content: attachment.content, // Base64 编码的内容
        contentType: attachment.contentType || 'application/octet-stream'
      }));
    }

    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      console.error('Resend 带附件邮件发送失败:', error);
      return { success: false, error: error.message };
    }

    console.log(`Resend 带附件邮件发送成功: ${subject}, 附件数量: ${attachments.length}`);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Resend 带附件邮件发送异常:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendProductStatusEmail,
  sendCustomEmail,
  sendBulkEmail,
  sendEmailWithAttachments
};
