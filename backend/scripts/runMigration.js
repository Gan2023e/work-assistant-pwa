const { sequelize } = require('../models/database');

async function runMigration() {
  try {
    console.log('🔄 开始运行数据库迁移...');
    
    // 添加税率字段到发票表
    await sequelize.query(`
      ALTER TABLE invoices 
      ADD COLUMN tax_rate VARCHAR(10) NULL COMMENT '税率' 
      AFTER tax_amount
    `);
    
    console.log('✅ 税率字段已成功添加到发票表');
    
    // 检查字段是否存在
    const [results] = await sequelize.query(`
      SHOW COLUMNS FROM invoices LIKE 'tax_rate'
    `);
    
    if (results.length > 0) {
      console.log('✅ 数据库迁移成功完成！');
    } else {
      console.log('❌ 数据库迁移失败');
    }
    
  } catch (error) {
    if (error.message.includes('Duplicate column name')) {
      console.log('ℹ️ 税率字段已存在，跳过迁移');
    } else {
      console.error('❌ 数据库迁移失败:', error.message);
    }
  } finally {
    await sequelize.close();
  }
}

runMigration(); 