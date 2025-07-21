const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const HsCode = sequelize.define('HsCode', {
  parent_sku: {
    type: DataTypes.STRING(10),
    primaryKey: true,
    allowNull: false,
    comment: '父SKU - 主键'
  },
  weblink: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '产品链接'
  },
  uk_hscode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '英国HSCODE编码'
  },
  us_hscode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '美国HSCODE编码'
  },
  declared_value_usd: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '美元申报价值'
  },
  declared_value_gbp: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '英镑申报价值'
  },
  declared_image: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '申报图片OSS链接'
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '创建时间'
  }
}, {
  tableName: 'hscode',
  timestamps: false,
  paranoid: false, // 确保真正删除，不是软删除
  indexes: [
    {
      fields: ['weblink']
    },
    {
      fields: ['uk_hscode']
    },
    {
      fields: ['us_hscode']
    },
    {
      fields: ['created_at']
    }
  ]
});

module.exports = HsCode; 