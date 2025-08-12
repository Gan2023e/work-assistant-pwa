const { sequelize } = require('../models/database');
const migration = require('../migrations/20250107-add-missing-fields-to-product-information');

async function addMissingFieldsToProductInformation() {
  try {
    console.log('🔄 开始运行product_information表添加缺失字段迁移...');
    
    // 获取queryInterface
    const queryInterface = sequelize.getQueryInterface();
    
    // 运行迁移
    await migration.up(queryInterface, sequelize);
    
    console.log('✅ product_information表添加缺失字段迁移完成！');
    console.log('📋 现在ProductInformation模型支持完整的商品信息存储，包括：');
    console.log('   - 产品基础信息：产品类型、型号、制造商、价格等');
    console.log('   - 产品属性：闭合类型、材料、护理说明、年龄范围等');
    console.log('   - 季节和生活方式：季节、材料类型、生活方式等');
    console.log('   - 尺寸和容量：存储容量、各方向尺寸等');
    console.log('   - 合规信息：CPSIA声明、进口标识、原产国等');
    console.log('🎉 "生成其他站点资料表"功能现在可以保存完整的商品信息了！');
    
  } catch (error) {
    console.error('❌ 运行添加缺失字段迁移失败:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  addMissingFieldsToProductInformation().catch(console.error);
}

module.exports = addMissingFieldsToProductInformation; 