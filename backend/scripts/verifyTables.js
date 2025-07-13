const { sequelize } = require('../models/database');

async function verifyTables() {
  try {
    console.log('🔍 验证采购发票管理数据表...');
    
    // 连接数据库
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    
    // 1. 查看invoices表结构
    console.log('\n📋 发票表 (invoices) 结构:');
    const [invoicesStructure] = await sequelize.query('DESCRIBE invoices');
    console.table(invoicesStructure);
    
    // 2. 查看purchase_orders表结构  
    console.log('\n📋 采购订单表 (purchase_orders) 结构:');
    const [ordersStructure] = await sequelize.query('DESCRIBE purchase_orders');
    console.table(ordersStructure);
    
    // 3. 查看示例数据
    console.log('\n📊 发票表示例数据:');
    const [invoicesData] = await sequelize.query('SELECT * FROM invoices');
    console.table(invoicesData);
    
    console.log('\n📊 采购订单表示例数据:');
    const [ordersData] = await sequelize.query('SELECT * FROM purchase_orders');
    console.table(ordersData);
    
    // 4. 验证关联关系
    console.log('\n🔗 验证关联关系 - 查看已开票的订单及其对应发票:');
    const [relationData] = await sequelize.query(`
      SELECT 
        po.order_number as '订单号',
        po.amount as '订单金额',
        po.seller_name as '卖家',
        po.invoice_status as '开票状态',
        i.invoice_number as '发票号',
        i.total_amount as '发票金额',
        i.invoice_type as '发票类型'
      FROM purchase_orders po
      LEFT JOIN invoices i ON po.invoice_id = i.id
      WHERE po.invoice_status = '已开票'
    `);
    console.table(relationData);
    
    // 5. 统计信息
    console.log('\n📈 数据统计:');
    const [stats] = await sequelize.query(`
      SELECT 
        'invoices' as table_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN status = '正常' THEN 1 END) as normal_invoices,
        ROUND(SUM(total_amount), 2) as total_amount
      FROM invoices
      UNION ALL
      SELECT 
        'purchase_orders' as table_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN invoice_status = '已开票' THEN 1 END) as invoiced_orders,
        ROUND(SUM(amount), 2) as total_amount
      FROM purchase_orders
    `);
    console.table(stats);
    
    console.log('\n✅ 数据表验证完成！');
    
  } catch (error) {
    console.error('❌ 验证失败:', error);
  } finally {
    await sequelize.close();
    console.log('🔐 数据库连接已关闭');
  }
}

// 执行验证
verifyTables()
  .then(() => {
    console.log('\n🎯 验证脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 验证脚本执行失败:', error);
    process.exit(1);
  }); 