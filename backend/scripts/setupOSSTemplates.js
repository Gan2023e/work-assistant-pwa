require('dotenv').config();
const { checkOSSConfig } = require('../utils/oss');
const OSS = require('ali-oss');

// 创建OSS客户端
function createClient() {
  if (!checkOSSConfig()) {
    throw new Error('OSS配置不完整');
  }
  
  const ossConfig = {
    region: process.env.OSS_REGION || 'oss-cn-hangzhou',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET,
    endpoint: process.env.OSS_ENDPOINT
  };
  
  return new OSS(ossConfig);
}

// 创建文件夹（通过上传一个空文件来标记文件夹）
async function createFolder(client, folderPath) {
  try {
    // 确保文件夹路径以 / 结尾
    const normalizedPath = folderPath.endsWith('/') ? folderPath : folderPath + '/';
    
    // 创建一个空的placeholder文件来标记文件夹存在
    const placeholderPath = normalizedPath + '.placeholder';
    await client.put(placeholderPath, Buffer.from(''));
    
    console.log(`✅ 文件夹创建成功: ${normalizedPath}`);
    return true;
  } catch (error) {
    console.error(`❌ 创建文件夹失败: ${folderPath}`, error.message);
    return false;
  }
}

// 设置模板文件夹结构
async function setupTemplateFolders() {
  console.log('🔧 开始设置OSS模板文件夹结构...\n');
  
  try {
    const client = createClient();
    
    // 定义模板文件夹结构
    const folders = [
      // 主模板文件夹
      'templates/',
      
      // Excel模板分类
      'templates/excel/',
      
      // 亚马逊发货模板
      'templates/excel/amazon/',
      'templates/excel/amazon/US/',     // 美国亚马逊模板
      'templates/excel/amazon/UK/',     // 英国亚马逊模板
      'templates/excel/amazon/DE/',     // 德国亚马逊模板
      'templates/excel/amazon/FR/',     // 法国亚马逊模板
      'templates/excel/amazon/IT/',     // 意大利亚马逊模板
      'templates/excel/amazon/ES/',     // 西班牙亚马逊模板
      'templates/excel/amazon/CA/',     // 加拿大亚马逊模板
      'templates/excel/amazon/JP/',     // 日本亚马逊模板
      
      // 物流商发票模板
      'templates/excel/logistics/',
      'templates/excel/logistics/yushengtai/',    // 裕盛泰物流商
      'templates/excel/logistics/dongfangruida/', // 东方瑞达物流商
      'templates/excel/logistics/others/',        // 其他物流商
      
      // 按国家分类的物流发票模板
      'templates/excel/logistics/yushengtai/US/',
      'templates/excel/logistics/yushengtai/UK/',
      'templates/excel/logistics/yushengtai/DE/',
      'templates/excel/logistics/dongfangruida/US/',
      'templates/excel/logistics/dongfangruida/UK/',
      'templates/excel/logistics/dongfangruida/DE/',
      
      // 装箱单模板
      'templates/excel/packing-list/',
      
      // 其他模板
      'templates/excel/others/',
      
      // 模板备份
      'templates/backup/',
      'templates/backup/amazon/',
      'templates/backup/logistics/',
      
      // 临时模板存储
      'templates/temp/'
    ];
    
    console.log('📁 将创建以下文件夹结构:');
    folders.forEach(folder => {
      console.log(`   - ${folder}`);
    });
    console.log();
    
    // 创建所有文件夹
    console.log('🚀 开始创建文件夹...');
    let successCount = 0;
    for (const folder of folders) {
      const success = await createFolder(client, folder);
      if (success) successCount++;
      
      // 添加小延时，避免请求过于频繁
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n✅ 文件夹结构创建完成！成功创建 ${successCount}/${folders.length} 个文件夹`);
    
    // 验证文件夹是否创建成功
    console.log('\n🔍 验证文件夹结构...');
    const listResult = await client.list({
      prefix: 'templates/',
      delimiter: '/'
    });
    
    if (listResult.prefixes && listResult.prefixes.length > 0) {
      console.log('📋 发现的主要文件夹:');
      listResult.prefixes.forEach(prefix => {
        console.log(`   - ${prefix}`);
      });
    }
    
    console.log('\n🎉 OSS模板文件夹设置完成！');
    
    // 提供使用建议
    console.log('\n💡 使用说明:');
    console.log('   - 亚马逊模板: templates/excel/amazon/{COUNTRY}/');
    console.log('   - 物流商发票模板: templates/excel/logistics/{PROVIDER}/{COUNTRY}/');
    console.log('   - 装箱单模板: templates/excel/packing-list/');
    console.log('   - 模板备份: templates/backup/');
    console.log('   - 临时文件: templates/temp/');
    
    return true;
    
  } catch (error) {
    console.error('❌ 设置文件夹结构失败:', error.message);
    
    // 提供错误处理建议
    if (error.code === 'NoSuchBucket') {
      console.log('💡 建议: 请检查OSS_BUCKET名称是否正确');
    } else if (error.code === 'InvalidAccessKeyId') {
      console.log('💡 建议: 请检查OSS_ACCESS_KEY_ID是否正确');
    } else if (error.code === 'SignatureDoesNotMatch') {
      console.log('💡 建议: 请检查OSS_ACCESS_KEY_SECRET是否正确');
    }
    
    return false;
  }
}

// 主函数
async function main() {
  console.log('🎯 OSS模板文件夹设置工具\n');
  
  // 检查配置
  console.log('1. 检查OSS配置...');
  if (!checkOSSConfig()) {
    console.log('❌ OSS配置不完整，请检查环境变量');
    process.exit(1);
  }
  console.log('✅ OSS配置正常\n');
  
  // 设置文件夹结构
  console.log('2. 设置模板文件夹结构...');
  const success = await setupTemplateFolders();
  
  if (success) {
    console.log('\n🎉 所有任务完成！您的OSS模板文件夹已准备就绪。');
    console.log('\n📚 下一步:');
    console.log('   1. 可以开始上传亚马逊发货模板到对应国家文件夹');
    console.log('   2. 可以上传物流商发票模板到对应物流商和国家文件夹');
    console.log('   3. 使用发货操作页面的模板管理功能进行配置');
  } else {
    console.log('\n❌ 设置失败，请检查错误信息并重试。');
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  setupTemplateFolders,
  createFolder
}; 