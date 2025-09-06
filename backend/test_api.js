const { sequelize } = require('./models/database');

async function testApiQuery() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    // 测试简化的API查询
    const testQuery = `
      SELECT 
        ls.\`listing-id\`,
        ls.\`seller-sku\`,
        ls.\`item-name\`,
        ls.site,
        ls.price,
        ls.quantity,
        ls.status
      FROM listings_sku ls
      LIMIT 5
    `;
    
    console.log('🔍 Testing basic listings_sku query...');
    const basicResults = await sequelize.query(testQuery, {
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log('📊 Basic query results:', basicResults.length);
    if (basicResults.length > 0) {
      console.log('📝 Sample record:', JSON.stringify(basicResults[0], null, 2));
    }
    
    // 测试带JOIN的完整查询
    const fullQuery = `
      SELECT 
        ls.\`listing-id\`,
        ls.\`seller-sku\`,
        ls.\`item-name\`,
        ls.site,
        ls.price,
        ls.quantity,
        ls.status,
        am.local_sku,
        am.country,
        sis.parent_sku,
        sis.child_sku
      FROM listings_sku ls
      LEFT JOIN pbi_amzsku_sku am ON ls.\`seller-sku\` = am.amz_sku AND ls.site = am.site
      LEFT JOIN sellerinventory_sku sis ON am.local_sku = sis.child_sku
      LIMIT 5
    `;
    
    console.log('🔍 Testing full JOIN query...');
    const fullResults = await sequelize.query(fullQuery, {
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log('📊 Full query results:', fullResults.length);
    if (fullResults.length > 0) {
      console.log('📝 Sample joined record:', JSON.stringify(fullResults[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sequelize.close();
  }
}

testApiQuery(); 