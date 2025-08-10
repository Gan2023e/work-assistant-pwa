const { sequelize } = require('../models/database');
const fs = require('fs');
const path = require('path');

async function createMissingTables() {
  try {
    console.log('🔄 开始创建缺失的数据库表...');
    
    // 检查template_links表是否存在
    try {
      const [templatesResults] = await sequelize.query(`
        SHOW TABLES LIKE 'template_links'
      `);
      
      if (templatesResults.length === 0) {
        console.log('📋 template_links表不存在，正在创建...');
        const templateMigration = require('../migrations/20250105-create-template-links-table');
        await templateMigration.up(sequelize.getQueryInterface(), sequelize);
      } else {
        console.log('✅ template_links表已存在');
      }
    } catch (error) {
      console.error('❌ 检查/创建template_links表失败:', error.message);
    }
    
    // 检查product_information表是否存在
    try {
      const [productResults] = await sequelize.query(`
        SHOW TABLES LIKE 'product_information'
      `);
      
      if (productResults.length === 0) {
        console.log('📋 product_information表不存在，正在创建...');
        const productMigration = require('../migrations/20250106-create-product-information-table');
        await productMigration.up(sequelize.getQueryInterface(), sequelize);
      } else {
        console.log('✅ product_information表已存在');
      }
    } catch (error) {
      console.error('❌ 检查/创建product_information表失败:', error.message);
    }
    
    // 最终检查
    const [finalTemplatesCheck] = await sequelize.query(`SHOW TABLES LIKE 'template_links'`);
    const [finalProductCheck] = await sequelize.query(`SHOW TABLES LIKE 'product_information'`);
    
    if (finalTemplatesCheck.length > 0 && finalProductCheck.length > 0) {
      console.log('✅ 所有必需的数据库表创建成功！');
      console.log('📊 现在您可以正常使用"生成其他站点资料表"功能了');
    } else {
      console.log('❌ 部分表创建失败，请检查错误信息');
    }
    
  } catch (error) {
    console.error('❌ 创建数据库表失败:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

// 运行脚本
if (require.main === module) {
  createMissingTables();
}

module.exports = createMissingTables; 