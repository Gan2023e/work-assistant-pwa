const fs = require('fs');
const path = require('path');
const { sequelize } = require('../models/database');

async function createPurchaseInvoiceTables() {
  try {
    console.log('🚀 开始创建采购发票管理数据表...');
    
    // 测试数据库连接
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    
    // 读取SQL文件
    const sqlFilePath = path.join(__dirname, '../sql/create_purchase_invoice_tables.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // 清理SQL内容，移除注释行
    const cleanedSQL = sqlContent
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
      .join('\n');
    
    // 将SQL内容按分号分割成多个语句
    const statements = cleanedSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`📝 共找到 ${statements.length} 条SQL语句`);
    
    // 逐个执行SQL语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`🔄 执行第 ${i + 1} 条SQL语句...`);
          console.log(`   ${statement.substring(0, 50)}...`);
          
          await sequelize.query(statement);
          console.log(`✅ 第 ${i + 1} 条SQL语句执行成功`);
        } catch (error) {
          console.error(`❌ 第 ${i + 1} 条SQL语句执行失败:`, error.message);
          if (!error.message.includes('already exists')) {
            throw error;
          }
        }
      }
    }
    
    console.log('🎉 采购发票管理数据表创建完成！');
    
    // 验证表是否创建成功
    console.log('\n📊 验证表结构...');
    
    try {
      const [invoicesResult] = await sequelize.query('DESCRIBE invoices');
      console.log('✅ invoices表结构:', invoicesResult.length, '个字段');
      
      const [ordersResult] = await sequelize.query('DESCRIBE purchase_orders');
      console.log('✅ purchase_orders表结构:', ordersResult.length, '个字段');
      
      // 查看示例数据
      const [invoicesCount] = await sequelize.query('SELECT COUNT(*) as count FROM invoices');
      const [ordersCount] = await sequelize.query('SELECT COUNT(*) as count FROM purchase_orders');
      
      console.log('\n📈 数据统计:');
      console.log(`- 发票表记录数: ${invoicesCount[0].count}`);
      console.log(`- 采购订单表记录数: ${ordersCount[0].count}`);
      
    } catch (error) {
      console.error('❌ 验证表结构失败:', error.message);
    }
    
  } catch (error) {
    console.error('❌ 创建数据表失败:', error);
    throw error;
  } finally {
    await sequelize.close();
    console.log('🔐 数据库连接已关闭');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  createPurchaseInvoiceTables()
    .then(() => {
      console.log('\n🎯 脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = createPurchaseInvoiceTables; 