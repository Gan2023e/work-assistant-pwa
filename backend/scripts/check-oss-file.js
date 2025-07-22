require('dotenv').config();
const { checkOSSConfig } = require('../utils/oss');

async function checkOSSFile() {
  try {
    console.log('🔍 检查OSS文件...');
    
    // 检查OSS配置
    if (!checkOSSConfig()) {
      console.log('❌ OSS配置不完整');
      return;
    }
    
    console.log('✅ OSS配置正常');
    
    // 检查特定文件
    const objectName = 'hscode-images/2025/07/5d2baa34-2d67-4ef6-8d17-10719e970c82.jpg';
    
    const OSS = require('ali-oss');
    const client = new OSS({
      region: process.env.OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      endpoint: process.env.OSS_ENDPOINT,
      secure: true
    });
    
    try {
      const result = await client.head(objectName);
      console.log('✅ 文件存在:', {
        size: result.res.headers['content-length'],
        lastModified: result.res.headers['last-modified'],
        contentType: result.res.headers['content-type']
      });
    } catch (error) {
      console.log('❌ 文件不存在:', error.message);
      
      // 列出目录下的文件
      try {
        const listResult = await client.list({
          prefix: 'hscode-images/',
          delimiter: '/',
          'max-keys': 10
        });
        
        console.log('📁 OSS目录内容:');
        if (listResult.objects && listResult.objects.length > 0) {
          listResult.objects.forEach(obj => {
            console.log(`  - ${obj.name} (${obj.size} bytes)`);
          });
        } else {
          console.log('  (空目录)');
        }
      } catch (listError) {
        console.log('❌ 无法列出目录:', listError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ 检查OSS文件失败:', error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  checkOSSFile().then(() => {
    console.log('检查完成');
    process.exit(0);
  }).catch((error) => {
    console.error('检查失败:', error);
    process.exit(1);
  });
}

module.exports = { checkOSSFile }; 