const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 开始添加OSS对象名字段到发票表...');
    
    try {
      // 添加invoice_file_object_name字段
      await queryInterface.addColumn('invoices', 'invoice_file_object_name', {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: '发票文件OSS对象名称',
        after: 'invoice_file_url'
      });
      
      console.log('✅ 成功添加invoice_file_object_name字段');
      
    } catch (error) {
      console.error('❌ 添加OSS对象名字段失败:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 开始移除OSS对象名字段...');
    
    try {
      // 移除invoice_file_object_name字段
      await queryInterface.removeColumn('invoices', 'invoice_file_object_name');
      
      console.log('✅ 成功移除invoice_file_object_name字段');
      
    } catch (error) {
      console.error('❌ 移除OSS对象名字段失败:', error);
      throw error;
    }
  }
}; 