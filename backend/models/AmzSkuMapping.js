const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const AmzSkuMapping = sequelize.define('AmzSkuMapping', {
  amz_sku: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Amazon SKU'
  },
  site: {
    type: DataTypes.STRING,
    allowNull: true,
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
  // 定义复合主键或唯一索引
  indexes: [
    {
      unique: true,
      fields: ['amz_sku', 'country']
    }
  ]
});

module.exports = AmzSkuMapping; 