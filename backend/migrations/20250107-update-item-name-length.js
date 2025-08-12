const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 开始更新product_information表的item_name字段长度...');
    
    try {
      // 修改item_name字段长度从255增加到500
      await queryInterface.changeColumn('product_information', 'item_name', {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: '商品名称'
      });
      
      console.log('✅ 成功更新item_name字段长度到500字符');
    } catch (error) {
      console.error('❌ 更新item_name字段失败:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 开始回滚product_information表的item_name字段长度...');
    
    try {
      // 回滚：将item_name字段长度恢复到255
      await queryInterface.changeColumn('product_information', 'item_name', {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: '商品名称'
      });
      
      console.log('✅ 成功回滚item_name字段长度到255字符');
    } catch (error) {
      console.error('❌ 回滚item_name字段失败:', error);
      throw error;
    }
  }
}; 