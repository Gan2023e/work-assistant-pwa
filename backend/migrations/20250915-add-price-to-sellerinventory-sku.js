const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 开始为sellerinventory_sku表添加price字段...');
    
    try {
      // 添加price字段
      await queryInterface.addColumn('sellerinventory_sku', 'price', {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: '产品价格',
        after: 'qty_per_box'
      });
      
      console.log('✅ 成功添加price字段到sellerinventory_sku表');
      
    } catch (error) {
      console.error('❌ 添加price字段失败:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 开始移除sellerinventory_sku表的price字段...');
    
    try {
      // 移除price字段
      await queryInterface.removeColumn('sellerinventory_sku', 'price');
      
      console.log('✅ 成功移除sellerinventory_sku表的price字段');
      
    } catch (error) {
      console.error('❌ 移除price字段失败:', error);
      throw error;
    }
  }
}; 