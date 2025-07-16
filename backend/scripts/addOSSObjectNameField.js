const { sequelize } = require('../models/database');

async function addOSSObjectNameField() {
  try {
    console.log('🔄 开始添加OSS对象名字段到发票表...');
    
    // 添加invoice_file_object_name字段
    try {
      await sequelize.query(`
        ALTER TABLE invoices 
        ADD COLUMN invoice_file_object_name VARCHAR(500) NULL COMMENT '发票文件OSS对象名称' 
        AFTER invoice_file_url
      `);
      console.log('✅ invoice_file_object_name字段已成功添加到发票表');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('ℹ️ invoice_file_object_name字段已存在，跳过');
      } else {
        throw error;
      }
    }
    
    // 检查字段是否存在
    const [results] = await sequelize.query(`
      SHOW COLUMNS FROM invoices LIKE 'invoice_file_object_name'
    `);
    
    if (results.length > 0) {
      console.log('✅ OSS对象名字段添加成功完成！');
      console.log('📋 字段信息:', results[0]);
    } else {
      console.log('❌ 字段添加失败');
    }
    
  } catch (error) {
    console.error('❌ 添加OSS对象名字段失败:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  addOSSObjectNameField()
    .then(() => {
      console.log('🎉 脚本执行完毕');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = addOSSObjectNameField; 