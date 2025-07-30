module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // 添加cpc_files字段到product_weblink表
      await queryInterface.addColumn('product_weblink', 'cpc_files', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'CPC文件信息，JSON格式存储多个文件'
      });
      
      console.log('✅ 成功添加cpc_files字段到product_weblink表');
    } catch (error) {
      console.error('❌ 迁移失败:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // 删除cpc_files字段
      await queryInterface.removeColumn('product_weblink', 'cpc_files');
      
      console.log('✅ 成功删除product_weblink表的cpc_files字段');
    } catch (error) {
      console.error('❌ 回滚失败:', error);
      throw error;
    }
  }
}; 