const { sequelize } = require('../models/database');

async function checkProductionDatabase() {
  try {
    console.log('🔍 检查生产环境数据库状态...');
    
    // 检查数据库连接
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    
    // 检查template_links表
    try {
      const [templatesResults] = await sequelize.query(`
        SHOW TABLES LIKE 'template_links'
      `);
      
      if (templatesResults.length > 0) {
        console.log('✅ template_links表存在');
        
        // 检查表结构
        const [templateColumns] = await sequelize.query(`
          SHOW COLUMNS FROM template_links
        `);
        console.log('📋 template_links表字段:', templateColumns.map(col => col.Field).join(', '));
        
        // 检查数据
        const [templateCount] = await sequelize.query(`
          SELECT COUNT(*) as count FROM template_links
        `);
        console.log(`📊 template_links表记录数: ${templateCount[0].count}`);
        
        // 查看模板列表
        const [templates] = await sequelize.query(`
          SELECT template_type, country, file_name FROM template_links WHERE is_active = 1 LIMIT 10
        `);
        console.log('📁 活跃模板列表:');
        templates.forEach(template => {
          console.log(`  - ${template.template_type}/${template.country}: ${template.file_name}`);
        });
      } else {
        console.log('❌ template_links表不存在');
      }
    } catch (error) {
      console.error('❌ 检查template_links表失败:', error.message);
    }
    
    // 检查product_information表
    try {
      const [productResults] = await sequelize.query(`
        SHOW TABLES LIKE 'product_information'
      `);
      
      if (productResults.length > 0) {
        console.log('✅ product_information表存在');
        
        // 检查表结构
        const [productColumns] = await sequelize.query(`
          SHOW COLUMNS FROM product_information
        `);
        console.log('📋 product_information表字段:', productColumns.map(col => col.Field).join(', '));
        
        // 检查数据
        const [productCount] = await sequelize.query(`
          SELECT COUNT(*) as count FROM product_information
        `);
        console.log(`📊 product_information表记录数: ${productCount[0].count}`);
        
        // 查看最近的记录
        const [recentProducts] = await sequelize.query(`
          SELECT site, item_sku, created_at FROM product_information ORDER BY created_at DESC LIMIT 5
        `);
        console.log('📁 最近的产品信息记录:');
        recentProducts.forEach(product => {
          console.log(`  - ${product.site}: ${product.item_sku} (${product.created_at})`);
        });
      } else {
        console.log('❌ product_information表不存在');
      }
    } catch (error) {
      console.error('❌ 检查product_information表失败:', error.message);
    }
    
    // 检查是否有最新的代码修复（通过检查路由文件的修改时间）
    console.log('\n🔧 检查代码版本信息...');
    const fs = require('fs');
    const path = require('path');
    
    try {
      const routePath = path.join(__dirname, '../routes/productWeblink.js');
      const stats = fs.statSync(routePath);
      console.log(`📝 productWeblink.js 最后修改时间: ${stats.mtime}`);
      
      // 检查文件内容是否包含重复导入（这是我们修复的问题）
      const content = fs.readFileSync(routePath, 'utf8');
      const duplicateImports = content.match(/const \{ ProductInformation \} = require\('\.\.\/models'\);/g);
      if (duplicateImports && duplicateImports.length > 0) {
        console.log(`❌ 发现 ${duplicateImports.length} 个重复的ProductInformation导入`);
      } else {
        console.log('✅ 未发现重复的ProductInformation导入');
      }
    } catch (error) {
      console.error('❌ 检查代码文件失败:', error.message);
    }
    
    console.log('\n✅ 生产环境数据库检查完成');
    
  } catch (error) {
    console.error('❌ 检查生产环境数据库失败:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

// 运行脚本
if (require.main === module) {
  checkProductionDatabase();
}

module.exports = checkProductionDatabase; 