const { sequelize, ShipmentRecord, ShipmentItem, OrderShipmentRelation } = require('../models/index');

async function syncNewTables() {
  try {
    console.log('🔄 开始同步新的发货管理表...');
    
    // 创建发货记录表
    console.log('📝 创建发货记录表 (shipment_records)...');
    await ShipmentRecord.sync({ alter: true });
    console.log('✅ 发货记录表创建成功');
    
    // 创建发货明细表
    console.log('📝 创建发货明细表 (shipment_items)...');
    await ShipmentItem.sync({ alter: true });
    console.log('✅ 发货明细表创建成功');
    
    // 创建需求单发货关联表
    console.log('📝 创建需求单发货关联表 (order_shipment_relations)...');
    await OrderShipmentRelation.sync({ alter: true });
    console.log('✅ 需求单发货关联表创建成功');
    
    console.log('🎉 所有新表同步完成！');
    console.log('');
    console.log('📊 表结构说明：');
    console.log('- shipment_records: 发货记录主表，记录每次发货操作');
    console.log('- shipment_items: 发货明细表，记录具体的SKU发货信息');
    console.log('- order_shipment_relations: 需求单与发货记录关联表，支持跨需求单发货');
    
  } catch (error) {
    console.error('❌ 同步数据库表失败:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  syncNewTables()
    .then(() => {
      console.log('✅ 数据库同步完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 数据库同步失败:', error);
      process.exit(1);
    });
}

module.exports = syncNewTables; 