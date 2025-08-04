const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 开始创建template_links表...');
    
    try {
      await queryInterface.createTable('template_links', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        template_type: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: '模板类型，如amazon'
        },
        country: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: '国家代码，如UK、US、DE等'
        },
        file_name: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: '原始文件名'
        },
        oss_object_name: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: 'OSS对象名'
        },
        oss_url: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: 'OSS文件链接'
        },
        file_size: {
          type: DataTypes.INTEGER,
          comment: '文件大小（字节）'
        },
        upload_time: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,
          comment: '上传时间'
        },
        is_active: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
          comment: '是否激活'
        }
      });
      
      // 创建索引
      await queryInterface.addIndex('template_links', ['template_type', 'country']);
      
      console.log('✅ 成功创建template_links表');
      
    } catch (error) {
      console.error('❌ 创建template_links表失败:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 开始删除template_links表...');
    
    try {
      await queryInterface.dropTable('template_links');
      
      console.log('✅ 成功删除template_links表');
      
    } catch (error) {
      console.error('❌ 删除template_links表失败:', error);
      throw error;
    }
  }
}; 