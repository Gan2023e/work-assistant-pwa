require('dotenv').config();
const { HsCode } = require('../models');

async function checkProductionHscode() {
  try {
    console.log('🔍 检查生产环境HSCode图片配置...');
    
    // 1. 检查数据库中的图片URL格式
    const hsCodes = await HsCode.findAll({
      where: {
        declared_image: {
          [require('sequelize').Op.not]: null
        }
      }
    });
    
    console.log(`📊 找到 ${hsCodes.length} 个有图片的HSCode记录`);
    
    hsCodes.forEach((record, index) => {
      console.log(`\n${index + 1}. parent_sku: ${record.parent_sku}`);
      console.log(`   图片URL: ${record.declared_image}`);
      
      // 检查URL格式
      if (record.declared_image.includes('/api/hscode/image-proxy')) {
        console.log('   ✅ URL格式正确 (代理格式)');
        
        // 提取objectKey
        const urlParams = new URLSearchParams(record.declared_image.split('?')[1]);
        const objectKey = urlParams.get('url');
        if (objectKey) {
          console.log(`   📁 ObjectKey: ${decodeURIComponent(objectKey)}`);
        }
      } else if (record.declared_image.includes('aliyuncs.com')) {
        console.log('   ⚠️  URL格式为直链 (需要修复)');
      } else {
        console.log('   ❓ 未知URL格式');
      }
    });
    
    // 2. 检查OSS配置
    console.log('\n🔧 检查OSS配置...');
    const requiredEnvVars = [
      'OSS_REGION',
      'OSS_ACCESS_KEY_ID', 
      'OSS_ACCESS_KEY_SECRET',
      'OSS_BUCKET',
      'OSS_ENDPOINT'
    ];
    
    const missingVars = [];
    requiredEnvVars.forEach(varName => {
      if (!process.env[varName]) {
        missingVars.push(varName);
      }
    });
    
    if (missingVars.length > 0) {
      console.log(`❌ 缺少OSS环境变量: ${missingVars.join(', ')}`);
    } else {
      console.log('✅ OSS环境变量配置完整');
      console.log(`   区域: ${process.env.OSS_REGION}`);
      console.log(`   Bucket: ${process.env.OSS_BUCKET}`);
      console.log(`   端点: ${process.env.OSS_ENDPOINT}`);
    }
    
    // 3. 测试OSS连接
    if (missingVars.length === 0) {
      console.log('\n🔗 测试OSS连接...');
      try {
        const OSS = require('ali-oss');
        const client = new OSS({
          region: process.env.OSS_REGION,
          accessKeyId: process.env.OSS_ACCESS_KEY_ID,
          accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
          bucket: process.env.OSS_BUCKET,
          endpoint: process.env.OSS_ENDPOINT,
          secure: true
        });
        
        // 测试列出文件
        const result = await client.list({
          prefix: 'hscode-images/',
          'max-keys': 5
        });
        
        console.log(`✅ OSS连接成功，找到 ${result.objects.length} 个文件`);
        result.objects.forEach(obj => {
          console.log(`   📄 ${obj.name} (${obj.size} bytes)`);
        });
        
      } catch (error) {
        console.log(`❌ OSS连接失败: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  }
}

checkProductionHscode(); 