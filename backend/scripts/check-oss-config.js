require('dotenv').config();
const { checkOSSConfig } = require('../utils/oss');

function checkOSSConfigStatus() {
  console.log('🔍 检查OSS配置状态...');
  
  const requiredVars = [
    'OSS_REGION',
    'OSS_ACCESS_KEY_ID', 
    'OSS_ACCESS_KEY_SECRET',
    'OSS_BUCKET',
    'OSS_ENDPOINT'
  ];
  
  console.log('\n📋 必需的环境变量:');
  let missingCount = 0;
  
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${varName.includes('SECRET') ? '***已配置***' : value}`);
    } else {
      console.log(`❌ ${varName}: 未配置`);
      missingCount++;
    }
  });
  
  console.log(`\n📊 配置状态: ${missingCount === 0 ? '✅ 完整' : `❌ 缺少 ${missingCount} 个变量`}`);
  
  if (missingCount > 0) {
    console.log('\n🔧 配置步骤:');
    console.log('1. 在阿里云OSS控制台获取以下信息:');
    console.log('   - AccessKey ID');
    console.log('   - AccessKey Secret');
    console.log('   - Bucket名称');
    console.log('   - Endpoint地址');
    console.log('   - Region区域');
    console.log('\n2. 在 .env 文件中添加:');
    console.log('   OSS_REGION=oss-cn-hangzhou');
    console.log('   OSS_ACCESS_KEY_ID=your_access_key_id');
    console.log('   OSS_ACCESS_KEY_SECRET=your_access_key_secret');
    console.log('   OSS_BUCKET=your_bucket_name');
    console.log('   OSS_ENDPOINT=your_endpoint');
    console.log('\n3. 重启后端服务');
  } else {
    console.log('\n✅ OSS配置完整，图片功能应该可以正常工作');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  checkOSSConfigStatus();
  process.exit(0);
}

module.exports = { checkOSSConfigStatus }; 