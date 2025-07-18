const { sequelize } = require('../models/database');

async function checkTableStructure() {
  try {
    console.log('🔍 检查logistics表结构...');
    
    // 检查表是否存在
    const [results] = await sequelize.query("SHOW TABLES LIKE 'logistics'");
    if (results.length === 0) {
      console.log('❌ logistics表不存在');
      return;
    }
    
    console.log('✅ logistics表存在');
    
    // 获取表结构
    const [columns] = await sequelize.query("DESCRIBE logistics");
    console.log('📋 表结构:');
    columns.forEach(col => {
      console.log(`  ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key || ''}`);
    });
    
    // 检查是否有mrn字段
    const hasMrn = columns.some(col => col.Field === 'mrn');
    console.log(`\n🔍 mrn字段: ${hasMrn ? '✅ 存在' : '❌ 不存在'}`);
    
    // 检查其他可能缺失的字段
    const expectedFields = [
      'shipping_id', 'logistics_provider', 'tracking_number', 'package_count', 
      'product_count', 'channel', 'status', 'departure_date', 'sailing_date',
      'estimated_arrival_date', 'estimated_warehouse_date', 'logistics_node',
      'destination_country', 'destination_warehouse', 'price', 'billing_weight',
      'mrn', 'customs_duty', 'tax_payment_status', 'tax_declaration_status',
      'dimensions', 'payment_status', 'vat_receipt_url', 'vat_receipt_object_name',
      'vat_receipt_file_name', 'vat_receipt_file_size', 'vat_receipt_upload_time'
    ];
    
    console.log('\n📋 字段检查:');
    expectedFields.forEach(field => {
      const exists = columns.some(col => col.Field === field);
      console.log(`  ${field}: ${exists ? '✅' : '❌'}`);
    });
    
  } catch (error) {
    console.error('❌ 检查表结构失败:', error);
  } finally {
    await sequelize.close();
  }
}

checkTableStructure(); 