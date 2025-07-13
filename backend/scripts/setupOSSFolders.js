require('dotenv').config();
const { createOSSClient, checkOSSConfig } = require('../utils/oss');
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

// 创建文件夹（通过上传空文件实现）
async function createFolder(client, folderPath) {
  try {
    const result = await client.put(`${folderPath}.keep`, Buffer.from(''));
    console.log('✅ 文件夹创建成功:', folderPath);
    return result;
  } catch (error) {
    console.error('❌ 文件夹创建失败:', folderPath, error.message);
    throw error;
  }
}

// 设置发票文件夹结构
async function setupInvoiceFolders() {
  console.log('🔧 开始设置OSS发票文件夹结构...\n');
  
  try {
    const client = createClient();
    
    // 获取当前年份
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    // 定义文件夹结构
    const folders = [
      // 主发票文件夹
      'invoices/',
      
      // 按年份分类
      `invoices/${currentYear}/`,
      `invoices/${currentYear - 1}/`,
      
      // 按月份分类（当前年份）
      `invoices/${currentYear}/${currentMonth.toString().padStart(2, '0')}/`,
      `invoices/${currentYear}/${(currentMonth + 1).toString().padStart(2, '0')}/`,
      
      // 按类型分类
      'invoices/purchase/',           // 采购发票
      'invoices/sales/',             // 销售发票
      'invoices/temp/',              // 临时文件
      'invoices/archive/',           // 归档文件
      
      // 按年份和类型的组合
      `invoices/purchase/${currentYear}/`,
      `invoices/sales/${currentYear}/`,
    ];
    
    console.log('📁 创建以下文件夹结构:');
    folders.forEach(folder => {
      console.log(`   - ${folder}`);
    });
    console.log();
    
    // 创建所有文件夹
    console.log('🚀 开始创建文件夹...');
    for (const folder of folders) {
      await createFolder(client, folder);
    }
    
    console.log('\n✅ 文件夹结构创建完成！');
    
    // 验证文件夹是否创建成功
    console.log('\n🔍 验证文件夹结构...');
    const listResult = await client.list({
      prefix: 'invoices/',
      delimiter: '/'
    });
    
    if (listResult.prefixes && listResult.prefixes.length > 0) {
      console.log('📋 发现的文件夹:');
      listResult.prefixes.forEach(prefix => {
        console.log(`   - ${prefix}`);
      });
    }
    
    if (listResult.objects && listResult.objects.length > 0) {
      console.log('📄 发现的文件:');
      listResult.objects.forEach(obj => {
        console.log(`   - ${obj.name}`);
      });
    }
    
    console.log('\n🎉 OSS发票文件夹设置完成！');
    
    // 提供使用建议
    console.log('\n💡 使用建议:');
    console.log('   - 采购发票: invoices/purchase/YYYY/MM/');
    console.log('   - 销售发票: invoices/sales/YYYY/MM/');
    console.log('   - 临时文件: invoices/temp/');
    console.log('   - 归档文件: invoices/archive/YYYY/');
    
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
  console.log('🎯 OSS发票文件夹设置工具\n');
  
  // 检查配置
  console.log('1. 检查OSS配置...');
  if (!checkOSSConfig()) {
    console.log('❌ OSS配置不完整，请检查环境变量');
    process.exit(1);
  }
  console.log('✅ OSS配置正常\n');
  
  // 设置文件夹结构
  console.log('2. 设置文件夹结构...');
  const success = await setupInvoiceFolders();
  
  if (success) {
    console.log('\n🎉 所有任务完成！您的OSS发票文件夹已准备就绪。');
  } else {
    console.log('\n❌ 设置失败，请检查错误信息并重试。');
    process.exit(1);
  }
}

// 运行主函数
main().catch(error => {
  console.error('❌ 程序执行失败:', error);
  process.exit(1);
}); 