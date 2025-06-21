const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const PackagePrice = sequelize.define('PackagePrice', {
  type: { 
    type: DataTypes.STRING,
    allowNull: false
  }, // 一般价/特殊价
  sku: { 
    type: DataTypes.STRING,
    allowNull: false
  },
  price: DataTypes.DECIMAL(10,2),
  time: DataTypes.DATE,
}, {
  tableName: 'pbi_package_price',
  timestamps: false,
  // 定义复合主键的正确方式
  indexes: [
    {
      unique: true,
      fields: ['type', 'sku']
    }
  ]
});

module.exports = PackagePrice; 