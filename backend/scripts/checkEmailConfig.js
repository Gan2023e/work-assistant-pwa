require('dotenv').config();

function checkEmailConfig() {
  console.log('🔍 检查邮件配置...');
  
  // 检查环境
  console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
  
  // 检查必要的邮件配置
  const requiredConfigs = [
    'SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_RECEIVER'
  ];
  
  const missingConfigs = requiredConfigs.filter(key => !process.env[key]);
  
  if (missingConfigs.length > 0) {
    console.error('❌ 缺少必要的邮件配置:', missingConfigs.join(', '));
    return false;
  }
  
  console.log('✅ 邮件配置完整');
  
  // 检查邮件内容配置
  const contentConfigs = [
    'EMAIL_SUBJECT', 'PRODUCT_OFFLINE_STATUS', 'PRODUCT_ONLINE_STATUS',
    'PRODUCT_ONLINE_ACTION', 'PRODUCT_OFFLINE_ACTION'
  ];
  
  const missingContentConfigs = contentConfigs.filter(key => !process.env[key]);
  
  if (missingContentConfigs.length > 0) {
    console.warn('⚠️  缺少邮件内容配置，将使用默认值:', missingContentConfigs.join(', '));
  } else {
    console.log('✅ 邮件内容配置完整');
  }
  
  console.log('\n📧 邮件功能已集成到批量状态修改中');
  console.log('当用户在采购链接管理页面进行批量状态修改时，系统会自动发送邮件通知');
  
  return true;
}

checkEmailConfig();
