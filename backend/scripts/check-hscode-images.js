const { HsCode } = require('../models/index');
const { Op } = require('sequelize');

async function checkHsCodeImages() {
  try {
    console.log('🔍 检查HSCode图片URL格式...');
    
    // 查找所有有图片的记录
    const records = await HsCode.findAll({
      where: {
        declared_image: {
          [Op.ne]: null
        }
      }
    });
    
    console.log(`📊 找到 ${records.length} 条包含图片的记录`);
    
    for (const record of records) {
      console.log(`📋 ${record.parent_sku}: ${record.declared_image}`);
    }
    
    if (records.length === 0) {
      console.log('ℹ️ 数据库中没有图片记录');
    }
    
  } catch (error) {
    console.error('❌ 检查HSCode图片URL失败:', error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  checkHsCodeImages().then(() => {
    console.log('检查完成');
    process.exit(0);
  }).catch((error) => {
    console.error('检查失败:', error);
    process.exit(1);
  });
}

module.exports = { checkHsCodeImages }; 