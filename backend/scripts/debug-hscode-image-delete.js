require('dotenv').config();
const { HsCode } = require('../models/index');
const { deleteFromOSS } = require('../utils/oss');

async function debugHsCodeImageDelete() {
  try {
    console.log('🔍 开始调试HSCODE图片删除功能...');
    
    // 查找所有有申报图片的记录
    const records = await HsCode.findAll({
      where: {
        declared_image: {
          [require('sequelize').Op.ne]: null
        }
      }
    });
    
    console.log(`📊 找到 ${records.length} 条有申报图片的记录`);
    
    for (const record of records) {
      console.log(`\n🔍 检查记录: ${record.parent_sku}`);
      console.log(`📷 申报图片URL: ${record.declared_image}`);
      
      let objectName = null;
      
      // 检查是否为代理URL格式
      if (record.declared_image && record.declared_image.includes('/api/hscode/image-proxy')) {
        try {
          // 从代理URL中提取objectName
          const urlParams = new URLSearchParams(record.declared_image.split('?')[1]);
          objectName = urlParams.get('url');
          if (objectName) {
            objectName = decodeURIComponent(objectName);
          }
          console.log(`✅ 从代理URL提取objectName: ${objectName}`);
        } catch (e) {
          console.warn(`❌ 解析代理URL失败: ${e.message}`);
        }
      } else if (/aliyuncs\.com[\/:]/.test(record.declared_image)) {
        // 直接OSS链接格式
        try {
          const urlObj = new URL(record.declared_image);
          objectName = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
          console.log(`✅ 从OSS URL提取objectName: ${objectName}`);
        } catch (e) {
          console.warn(`❌ 解析OSS URL失败: ${e.message}`);
        }
      } else {
        console.log(`⚠️ 未知的图片URL格式: ${record.declared_image}`);
      }
      
      // 如果成功提取到objectName，测试删除
      if (objectName) {
        console.log(`🗑️ 测试删除OSS文件: ${objectName}`);
        try {
          const result = await deleteFromOSS(objectName);
          console.log(`📊 删除结果:`, result);
        } catch (e) {
          console.error(`❌ 删除失败: ${e.message}`);
        }
      }
    }
    
    console.log('\n🏁 调试完成');
    
  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  debugHsCodeImageDelete().then(() => {
    console.log('✅ 调试脚本执行完成');
    process.exit(0);
  }).catch(error => {
    console.error('💥 调试脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { debugHsCodeImageDelete }; 