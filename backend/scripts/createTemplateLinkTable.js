const { sequelize } = require('../models/database');

async function createTemplateLinkTable() {
  try {
    console.log('🔄 开始创建template_links表...');
    
    // 检查表是否已存在
    const [results] = await sequelize.query(`
      SHOW TABLES LIKE 'template_links'
    `);
    
    if (results.length > 0) {
      console.log('ℹ️ template_links表已存在，跳过创建');
      return;
    }
    
    // 创建template_links表
    await sequelize.query(`
      CREATE TABLE template_links (
        id INT AUTO_INCREMENT PRIMARY KEY,
        template_type VARCHAR(255) NOT NULL COMMENT '模板类型，如amazon',
        country VARCHAR(255) NOT NULL COMMENT '国家代码，如UK、US、DE等',
        file_name VARCHAR(255) NOT NULL COMMENT '原始文件名',
        oss_object_name VARCHAR(255) NOT NULL COMMENT 'OSS对象名',
        oss_url VARCHAR(255) NOT NULL COMMENT 'OSS文件链接',
        file_size INT COMMENT '文件大小（字节）',
        upload_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
        is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活'
      )
    `);
    
    console.log('✅ template_links表创建成功');
    
    // 创建索引
    await sequelize.query(`
      CREATE INDEX idx_template_type_country ON template_links (template_type, country)
    `);
    
    console.log('✅ template_links表索引创建成功');
    
    // 验证表是否创建成功
    const [verifyResults] = await sequelize.query(`
      SHOW TABLES LIKE 'template_links'
    `);
    
    if (verifyResults.length > 0) {
      console.log('✅ template_links表创建和验证成功！');
    } else {
      console.log('❌ template_links表创建失败');
    }
    
  } catch (error) {
    console.error('❌ 创建template_links表失败:', error.message);
    console.error('详细错误:', error);
  } finally {
    await sequelize.close();
  }
}

createTemplateLinkTable(); 