const { sequelize, OrderShipmentRelation, ShipmentRecord } = require('./models');

async function testOrderShipmentRelations() {
  console.log('🔍 开始测试 order_shipment_relations 表的读写功能...');
  
  try {
    // 测试1: 检查表结构
    console.log('\n📋 测试1: 检查表结构');
    const tableInfo = await sequelize.getQueryInterface().describeTable('order_shipment_relations');
    console.log('表结构:', JSON.stringify(tableInfo, null, 2));
    
    // 测试2: 查询现有记录
    console.log('\n📋 测试2: 查询现有记录');
    const existingRecords = await OrderShipmentRelation.findAll({
      limit: 5,
      order: [['created_at', 'DESC']]
    });
    console.log(`现有记录数量: ${existingRecords.length}`);
    if (existingRecords.length > 0) {
      console.log('最新的几条记录:', JSON.stringify(existingRecords, null, 2));
    }
    
    // 测试3: 查询最新的发货记录，用于测试插入
    console.log('\n📋 测试3: 查询最新的发货记录');
    const latestShipment = await ShipmentRecord.findOne({
      order: [['shipment_id', 'DESC']],
      attributes: ['shipment_id', 'shipment_number']
    });
    
    if (!latestShipment) {
      console.log('❌ 没有找到发货记录，无法进行插入测试');
      return;
    }
    
    console.log(`最新发货记录: ID=${latestShipment.shipment_id}, 编号=${latestShipment.shipment_number}`);
    
    // 测试4: 尝试插入一条测试记录
    console.log('\n📋 测试4: 尝试插入测试记录');
    const testRecord = {
      need_num: `TEST-${Date.now()}`,
      shipment_id: latestShipment.shipment_id,
      total_requested: 100,
      total_shipped: 100,
      completion_status: '全部完成'
    };
    
    console.log('准备插入的测试记录:', JSON.stringify(testRecord, null, 2));
    
    const insertedRecord = await OrderShipmentRelation.create(testRecord);
    console.log('✅ 插入成功! 新记录ID:', insertedRecord.relation_id);
    
    // 测试5: 验证插入的记录
    console.log('\n📋 测试5: 验证插入的记录');
    const verifyRecord = await OrderShipmentRelation.findByPk(insertedRecord.relation_id);
    console.log('验证插入的记录:', JSON.stringify(verifyRecord, null, 2));
    
    // 测试6: 清理测试记录
    console.log('\n📋 测试6: 清理测试记录');
    await OrderShipmentRelation.destroy({
      where: { relation_id: insertedRecord.relation_id }
    });
    console.log('✅ 测试记录已清理');
    
    // 测试7: 测试批量插入
    console.log('\n📋 测试7: 测试批量插入');
    const batchRecords = [
      {
        need_num: `BATCH-TEST-1-${Date.now()}`,
        shipment_id: latestShipment.shipment_id,
        total_requested: 50,
        total_shipped: 50,
        completion_status: '全部完成'
      },
      {
        need_num: `BATCH-TEST-2-${Date.now()}`,
        shipment_id: latestShipment.shipment_id,
        total_requested: 75,
        total_shipped: 75,
        completion_status: '全部完成'
      }
    ];
    
    const batchInserted = await OrderShipmentRelation.bulkCreate(batchRecords);
    console.log(`✅ 批量插入成功! 插入了 ${batchInserted.length} 条记录`);
    
    // 清理批量测试记录
    await OrderShipmentRelation.destroy({
      where: { 
        need_num: {
          [sequelize.Sequelize.Op.like]: `BATCH-TEST-%`
        }
      }
    });
    console.log('✅ 批量测试记录已清理');
    
    console.log('\n🎉 所有测试完成！order_shipment_relations 表读写功能正常');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
  } finally {
    // 关闭数据库连接
    await sequelize.close();
    console.log('🔐 数据库连接已关闭');
  }
}

// 运行测试
testOrderShipmentRelations(); 