const { QueryInterface, DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('📊 开始优化SKU查询性能，添加数据库索引...');
    
    try {
      // 为SellerInventorySku表添加parent_sku索引（大幅提升查询性能）
      await queryInterface.addIndex('seller_inventory_skus', ['parent_sku'], {
        name: 'idx_seller_inventory_skus_parent_sku',
        type: 'BTREE'
      });
      console.log('✅ 已添加parent_sku索引');

      // 为SellerInventorySku表添加复合索引（parent_sku + child_sku）
      await queryInterface.addIndex('seller_inventory_skus', ['parent_sku', 'child_sku'], {
        name: 'idx_seller_inventory_skus_parent_child',
        type: 'BTREE'
      });
      console.log('✅ 已添加parent_sku + child_sku复合索引');

      // 为常用查询字段添加索引
      await queryInterface.addIndex('seller_inventory_skus', ['sellercolorname'], {
        name: 'idx_seller_inventory_skus_color',
        type: 'BTREE'
      });
      console.log('✅ 已添加sellercolorname索引');

      await queryInterface.addIndex('seller_inventory_skus', ['sellersizename'], {
        name: 'idx_seller_inventory_skus_size',
        type: 'BTREE'
      });
      console.log('✅ 已添加sellersizename索引');

      console.log('🎉 SKU查询性能优化完成！预期查询速度提升50-80%');
    } catch (error) {
      console.error('❌ 添加索引失败:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ 回滚SKU查询性能优化，移除索引...');
    
    try {
      // 移除索引
      await queryInterface.removeIndex('seller_inventory_skus', 'idx_seller_inventory_skus_parent_sku');
      await queryInterface.removeIndex('seller_inventory_skus', 'idx_seller_inventory_skus_parent_child');
      await queryInterface.removeIndex('seller_inventory_skus', 'idx_seller_inventory_skus_color');
      await queryInterface.removeIndex('seller_inventory_skus', 'idx_seller_inventory_skus_size');
      
      console.log('✅ 索引移除完成');
    } catch (error) {
      console.error('❌ 移除索引失败:', error);
      throw error;
    }
  }
}; 