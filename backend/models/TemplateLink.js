const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const TemplateLink = sequelize.define('TemplateLink', {
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
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'backpack',
    comment: '模板类目，如电子产品、服装、家居等'
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
}, {
  tableName: 'template_links',
  timestamps: false,
  indexes: [
    {
      unique: false,
      fields: ['template_type', 'country']
    },
    {
      unique: false,
      fields: ['template_type', 'country', 'category']
    }
  ]
});

module.exports = TemplateLink; 