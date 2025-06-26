const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const AmzSkuMapping = sequelize.define('AmzSkuMapping', {
  amz_sku: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
    comment: 'Amazon SKU'
  },
  site: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
    comment: '站点'
  },
  country: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '国家'
  },
  local_sku: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '本地SKU'
  },
  update_time: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '更新时间'
  }
}, {
  tableName: 'pbi_amzsku_sku',
  timestamps: false,
  // 使用amz_sku和site作为复合主键
  // 主键已在字段定义中设置，无需额外的indexes配置
});

module.exports = AmzSkuMapping; 