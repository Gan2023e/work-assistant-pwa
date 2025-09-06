const { sequelize } = require('./models/database');

async function checkTablesAndData() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    // 检查listings_sku表
    const listingsSkuCheck = await sequelize.query(
      "SHOW TABLES LIKE 'listings_sku'", 
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log('📋 listings_sku table exists:', listingsSkuCheck.length > 0);
    
    if (listingsSkuCheck.length > 0) {
      const count = await sequelize.query(
        "SELECT COUNT(*) as count FROM listings_sku LIMIT 1",
        { type: sequelize.QueryTypes.SELECT }
      );
      console.log('📊 listings_sku record count:', count[0].count);
    }
    
    // 检查sellerinventory_sku表
    const inventorySkuCheck = await sequelize.query(
      "SHOW TABLES LIKE 'sellerinventory_sku'", 
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log('📋 sellerinventory_sku table exists:', inventorySkuCheck.length > 0);
    
    if (inventorySkuCheck.length > 0) {
      const count = await sequelize.query(
        "SELECT COUNT(*) as count FROM sellerinventory_sku LIMIT 1",
        { type: sequelize.QueryTypes.SELECT }
      );
      console.log('📊 sellerinventory_sku record count:', count[0].count);
    }
    
    // 检查pbi_amzsku_sku表
    const amzSkuCheck = await sequelize.query(
      "SHOW TABLES LIKE 'pbi_amzsku_sku'", 
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log('📋 pbi_amzsku_sku table exists:', amzSkuCheck.length > 0);
    
    if (amzSkuCheck.length > 0) {
      const count = await sequelize.query(
        "SELECT COUNT(*) as count FROM pbi_amzsku_sku LIMIT 1",
        { type: sequelize.QueryTypes.SELECT }
      );
      console.log('📊 pbi_amzsku_sku record count:', count[0].count);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkTablesAndData(); 