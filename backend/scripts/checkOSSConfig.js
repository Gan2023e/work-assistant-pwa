require('dotenv').config();
const { checkOSSConfig } = require('../utils/oss');

console.log('=== OSS配置检查工具 ===\n');

// 检查环境变量
console.log('📋 环境变量检查:');
const requiredEnvVars = [
  'OSS_REGION',
  'OSS_ACCESS_KEY_ID', 
  'OSS_ACCESS_KEY_SECRET',
  'OSS_BUCKET',
  'OSS_ENDPOINT'
];

let missingVars = [];
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    if (varName.includes('SECRET') || varName.includes('KEY')) {
      console.log(`✅ ${varName}: ${value.substring(0, 8)}...`);
    } else {
      console.log(`✅ ${varName}: ${value}`);
    }
  } else {
    console.log(`❌ ${varName}: 未设置`);
    missingVars.push(varName);
  }
});

console.log('\n🔍 配置完整性检查:');
const isConfigComplete = checkOSSConfig();
if (isConfigComplete) {
  console.log('✅ OSS配置完整');
} else {
  console.log('❌ OSS配置不完整');
}

if (missingVars.length > 0) {
  console.log('\n📝 缺失的环境变量:');
  missingVars.forEach(varName => {
    console.log(`   - ${varName}`);
  });
  
  console.log('\n🔧 解决方案:');
  console.log('1. 在项目根目录创建 .env 文件');
  console.log('2. 添加以下环境变量:');
  console.log('');
  console.log('   OSS_REGION=oss-cn-hangzhou');
  console.log('   OSS_ACCESS_KEY_ID=your_access_key_id');
  console.log('   OSS_ACCESS_KEY_SECRET=your_access_key_secret');
  console.log('   OSS_BUCKET=your_bucket_name');
  console.log('   OSS_ENDPOINT=your_endpoint_url');
  console.log('');
  console.log('3. 重启后端服务');
  console.log('');
  console.log('📚 参考文档: OSS_CONFIG.md');
}

// 如果配置完整，测试连接
if (isConfigComplete) {
  console.log('\n🧪 测试OSS连接...');
  const OSS = require('ali-oss');
  
  try {
    const client = new OSS({
      region: process.env.OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      endpoint: process.env.OSS_ENDPOINT
    });
    
    // 测试列出对象
    client.list({
      'max-keys': 1
    }).then(() => {
      console.log('✅ OSS连接测试成功');
    }).catch(error => {
      console.log('❌ OSS连接测试失败:', error.message);
      console.log('请检查AccessKey权限和网络连接');
    });
    
  } catch (error) {
    console.log('❌ OSS客户端创建失败:', error.message);
  }
} 