const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 开始修改 shipment_items 表的 order_item_id 字段...');
    
    try {
      // 修改 order_item_id 字段，允许 NULL 值
      await queryInterface.changeColumn('shipment_items', 'order_item_id', {
        type: DataTypes.INTEGER,
        allowNull: true, // 允许NULL，支持手动发货
        comment: '需求记录ID（NULL表示手动发货）',
        references: {
          model: 'pbi_warehouse_products_need',
          key: 'record_num'
        }
      });
      
      console.log('✅ shipment_items.order_item_id 字段修改成功，现在支持 NULL 值');
      
    } catch (error) {
      console.error('❌ 修改字段失败:', error.message);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 回滚 shipment_items 表的 order_item_id 字段...');
    
    try {
      // 回滚：将字段改回不允许 NULL
      await queryInterface.changeColumn('shipment_items', 'order_item_id', {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '需求记录ID',
        references: {
          model: 'pbi_warehouse_products_need',
          key: 'record_num'
        }
      });
      
      console.log('✅ shipment_items.order_item_id 字段回滚成功');
      
    } catch (error) {
      console.error('❌ 回滚字段失败:', error.message);
      throw error;
    }
  }
}; 