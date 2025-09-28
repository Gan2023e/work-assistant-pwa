const nodemailer = require('nodemailer');

// 创建邮件传输器
const createTransporter = () => {
  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    },
    tls: {
      rejectUnauthorized: false // 忽略SSL证书验证
    }
  };
  
  // 生产环境不输出敏感配置信息
  if (process.env.NODE_ENV === 'development') {
    console.log('邮件配置:', {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.auth.user
    });
  }
  
  return nodemailer.createTransport(config);
};

// 发送产品上下架邮件
const sendProductStatusEmail = async (action, parentSkus) => {
  try {
    // 检查邮件配置
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.error('邮件配置不完整，无法发送邮件');
      return { success: false, error: '邮件配置不完整' };
    }

    const transporter = createTransporter();
    
    // 构建邮件内容
    const subject = process.env.EMAIL_SUBJECT || '产品手动上下架及数量调整';
    const content = `${action}\n${parentSkus.join('\n')}`;
    
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: process.env.EMAIL_RECEIVER,
      subject: subject,
      text: content,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h3>${action}</h3>
          <div style="margin-top: 20px;">
            ${parentSkus.map(sku => `<div>${sku}</div>`).join('')}
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    
    // 生产环境只记录简要信息
    if (process.env.NODE_ENV === 'development') {
      console.log('邮件发送成功:', result.messageId);
    } else {
      console.log(`邮件发送成功: ${action}, 母SKU数量: ${parentSkus.length}`);
    }
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('邮件发送失败:', error);
    return { success: false, error: error.message };
  }
};

// 发送自定义内容邮件
const sendCustomEmail = async (subject, content) => {
  try {
    // 检查邮件配置
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !process.env.EMAIL_RECEIVER) {
      console.error('邮件配置不完整，无法发送邮件');
      return { success: false, error: '邮件配置不完整' };
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: process.env.EMAIL_RECEIVER,
      subject: subject,
      text: content,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <div style="white-space: pre-line;">${content}</div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    
    // 生产环境只记录简要信息
    if (process.env.NODE_ENV === 'development') {
      console.log('邮件发送成功:', result.messageId);
    } else {
      console.log(`邮件发送成功: ${subject}`);
    }
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('邮件发送失败:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendProductStatusEmail,
  sendCustomEmail
};
