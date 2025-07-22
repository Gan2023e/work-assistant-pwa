const { HsCode } = require('../models/index');
const { Op } = require('sequelize');

async function fixHsCodeImageUrls() {
  try {
    console.log('🔧 开始修复HSCode图片URL...');
    
    // 查找所有包含OSS直链的记录
    const records = await HsCode.findAll({
      where: {
        declared_image: {
          [Op.like]: '%aliyuncs.com%'
        }
      }
    });
    
    console.log(`📊 找到 ${records.length} 条包含OSS直链的记录`);
    
    let updatedCount = 0;
    
    for (const record of records) {
      try {
        const oldUrl = record.declared_image;
        
        // 从OSS直链中提取objectName
        const urlObj = new URL(oldUrl);
        const objectName = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
        
        // 生成新的代理URL
        const newUrl = `/api/hscode/image-proxy?url=${encodeURIComponent(objectName)}`;
        
        // 更新数据库
        await HsCode.update({
          declared_image: newUrl
        }, {
          where: { parent_sku: record.parent_sku }
        });
        
        console.log(`✅ 已更新 ${record.parent_sku}: ${oldUrl} -> ${newUrl}`);
        updatedCount++;
        
      } catch (error) {
        console.error(`❌ 更新 ${record.parent_sku} 失败:`, error.message);
      }
    }
    
    console.log(`🎉 修复完成！共更新 ${updatedCount} 条记录`);
    
  } catch (error) {
    console.error('❌ 修复HSCode图片URL失败:', error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  fixHsCodeImageUrls().then(() => {
    console.log('脚本执行完成');
    process.exit(0);
  }).catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { fixHsCodeImageUrls }; 