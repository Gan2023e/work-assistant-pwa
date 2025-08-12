const { sequelize } = require('../models/database');
const migration = require('../migrations/20250107-update-bullet-points-length');

async function updateBulletPointsLength() {
  try {
    console.log('🔄 开始运行bullet_point字段长度更新迁移...');
    
    // 获取queryInterface
    const queryInterface = sequelize.getQueryInterface();
    
    // 运行迁移
    await migration.up(queryInterface, sequelize);
    
    console.log('✅ bullet_point字段长度更新迁移完成！');
    console.log('📋 所有bullet_point字段长度已从255字符增加到500字符：');
    console.log('   - bullet_point1: 255 → 500 字符');
    console.log('   - bullet_point2: 255 → 500 字符');
    console.log('   - bullet_point3: 255 → 500 字符');
    console.log('   - bullet_point4: 255 → 500 字符');
    console.log('   - bullet_point5: 255 → 500 字符');
    console.log('🎉 现在可以存储更长的商品特点描述了！');
    
  } catch (error) {
    console.error('❌ 运行bullet_point字段长度更新迁移失败:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  updateBulletPointsLength().catch(console.error);
}

module.exports = updateBulletPointsLength; 