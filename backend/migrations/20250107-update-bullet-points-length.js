const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 开始更新product_information表的bullet_point字段长度...');
    
    try {
      // 更新5条bullet_point字段长度从255增加到500
      console.log('📝 更新bullet_point1字段长度...');
      await queryInterface.changeColumn('product_information', 'bullet_point1', {
        type: DataTypes.STRING(500),
        allowNull: true
      });
      
      console.log('📝 更新bullet_point2字段长度...');
      await queryInterface.changeColumn('product_information', 'bullet_point2', {
        type: DataTypes.STRING(500),
        allowNull: true
      });
      
      console.log('📝 更新bullet_point3字段长度...');
      await queryInterface.changeColumn('product_information', 'bullet_point3', {
        type: DataTypes.STRING(500),
        allowNull: true
      });
      
      console.log('📝 更新bullet_point4字段长度...');
      await queryInterface.changeColumn('product_information', 'bullet_point4', {
        type: DataTypes.STRING(500),
        allowNull: true
      });
      
      console.log('📝 更新bullet_point5字段长度...');
      await queryInterface.changeColumn('product_information', 'bullet_point5', {
        type: DataTypes.STRING(500),
        allowNull: true
      });
      
      console.log('✅ 成功更新所有bullet_point字段长度到500字符');
    } catch (error) {
      console.error('❌ 更新bullet_point字段失败:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 开始回滚product_information表的bullet_point字段长度...');
    
    try {
      // 回滚：将bullet_point字段长度恢复到255
      console.log('📝 回滚bullet_point1字段长度...');
      await queryInterface.changeColumn('product_information', 'bullet_point1', {
        type: DataTypes.STRING(255),
        allowNull: true
      });
      
      console.log('📝 回滚bullet_point2字段长度...');
      await queryInterface.changeColumn('product_information', 'bullet_point2', {
        type: DataTypes.STRING(255),
        allowNull: true
      });
      
      console.log('📝 回滚bullet_point3字段长度...');
      await queryInterface.changeColumn('product_information', 'bullet_point3', {
        type: DataTypes.STRING(255),
        allowNull: true
      });
      
      console.log('📝 回滚bullet_point4字段长度...');
      await queryInterface.changeColumn('product_information', 'bullet_point4', {
        type: DataTypes.STRING(255),
        allowNull: true
      });
      
      console.log('📝 回滚bullet_point5字段长度...');
      await queryInterface.changeColumn('product_information', 'bullet_point5', {
        type: DataTypes.STRING(255),
        allowNull: true
      });
      
      console.log('✅ 成功回滚所有bullet_point字段长度到255字符');
    } catch (error) {
      console.error('❌ 回滚bullet_point字段失败:', error);
      throw error;
    }
  }
}; 