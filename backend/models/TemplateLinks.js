const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const TemplateLinks = sequelize.define('TemplateLinks', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  template_type: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '模板类型：amazon, logistics, packing-list, others'
  },
  country: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '国家代码：US, UK, DE, FR, IT, ES, CA, JP'
  },
  provider: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '提供商（物流商等）'
  },
  file_name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '原始文件名'
  },
  oss_object_name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'OSS对象名称'
  },
  file_url: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '文件访问URL'
  },
  file_size: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '文件大小（字节）'
  },
  upload_time: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '上传时间'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: '是否有效'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '模板描述'
  }
}, {
  tableName: 'template_links',
  timestamps: false,
  indexes: [
    {
      unique: false,
      fields: ['template_type', 'country', 'provider']
    },
    {
      unique: false,
      fields: ['template_type', 'country', 'is_active']
    }
  ]
});

module.exports = TemplateLinks; 