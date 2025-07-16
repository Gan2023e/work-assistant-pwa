const { sequelize } = require('../models/database');

async function runMigration() {
  try {
    console.log('🔄 开始运行数据库迁移...');
    
    // 添加税率字段到发票表
    try {
      await sequelize.query(`
        ALTER TABLE invoices 
        ADD COLUMN tax_rate VARCHAR(10) NULL COMMENT '税率' 
        AFTER tax_amount
      `);
      console.log('✅ 税率字段已成功添加到发票表');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ 税率字段已存在，跳过');
      } else {
        throw error;
      }
    }
    
    // 添加金额差异截图字段到发票表
    try {
      await sequelize.query(`
        ALTER TABLE invoices 
        ADD COLUMN amount_difference_screenshot TEXT NULL COMMENT '金额差异截图信息(JSON格式存储OSS链接等信息)' 
        AFTER remarks
      `);
      console.log('✅ 金额差异截图字段已成功添加到发票表');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ 金额差异截图字段已存在，跳过');
      } else {
        throw error;
      }
    }
    
    // 检查字段是否存在
    const [taxRateResults] = await sequelize.query(`
      SHOW COLUMNS FROM invoices LIKE 'tax_rate'
    `);
    
    const [screenshotResults] = await sequelize.query(`
      SHOW COLUMNS FROM invoices LIKE 'amount_difference_screenshot'
    `);
    
    if (taxRateResults.length > 0 && screenshotResults.length > 0) {
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