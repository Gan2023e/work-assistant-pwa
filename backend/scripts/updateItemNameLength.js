const { sequelize } = require('../models/database');
const migration = require('../migrations/20250107-update-item-name-length');

async function updateItemNameLength() {
  try {
    console.log('🔄 开始运行item_name字段长度更新迁移...');
    
    // 获取queryInterface
    const queryInterface = sequelize.getQueryInterface();
    
    // 运行迁移
    await migration.up(queryInterface, sequelize);
    
    console.log('✅ item_name字段长度更新迁移完成！');
    
  } catch (error) {
    console.error('❌ 运行item_name字段长度更新迁移失败:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  updateItemNameLength().catch(console.error);
}

module.exports = updateItemNameLength; 