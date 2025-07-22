require('dotenv').config();
const { checkOSSConfig, createOSSClient } = require('../utils/oss');

async function checkOSSConfiguration() {
  try {
    console.log('🔧 检查OSS配置...');
    
    // 检查环境变量
    const configResult = checkOSSConfig();
    console.log('📋 配置检查结果:', configResult ? '✅ 配置完整' : '❌ 配置缺失');
    
    if (!configResult) {
      console.log('⚠️ 请检查以下环境变量:');
      console.log('  - OSS_ACCESS_KEY_ID');
      console.log('  - OSS_ACCESS_KEY_SECRET');
      console.log('  - OSS_BUCKET');
      console.log('  - OSS_REGION (可选)');
      console.log('  - OSS_ENDPOINT (可选)');
      return;
    }
    
    // 测试创建OSS客户端
    console.log('🔌 测试创建OSS客户端...');
    const client = createOSSClient();
    console.log('✅ OSS客户端创建成功');
    
    // 测试列出Bucket内容
    console.log('📦 测试列出Bucket内容...');
    try {
      const result = await client.list({
        prefix: 'hscode-images/',
        'max-keys': 5
      });
      console.log(`✅ 成功列出Bucket内容，找到 ${result.objects?.length || 0} 个对象`);
      
      if (result.objects && result.objects.length > 0) {
        console.log('📋 前5个对象:');
        result.objects.slice(0, 5).forEach((obj, index) => {
          console.log(`  ${index + 1}. ${obj.name} (${obj.size} bytes)`);
        });
      }
    } catch (error) {
      console.error('❌ 列出Bucket内容失败:', error.message);
      console.log('⚠️ 可能是权限问题，请检查AccessKey权限');
    }
    
    console.log('🏁 OSS配置检查完成');
    
  } catch (error) {
    console.error('❌ OSS配置检查失败:', error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  checkOSSConfiguration().then(() => {
    console.log('✅ 配置检查完成');
    process.exit(0);
  }).catch(error => {
    console.error('💥 配置检查失败:', error);
    process.exit(1);
  });
}

module.exports = { checkOSSConfiguration }; 