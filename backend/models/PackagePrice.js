const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const PackagePrice = sequelize.define('PackagePrice', {
  type: { type: DataTypes.STRING, primaryKey: true }, // 一般价/特殊价
  sku: { type: DataTypes.STRING, primaryKey: true },
  price: DataTypes.DECIMAL(10,2),
  time: DataTypes.DATE,
}, {
  tableName: 'pbi_package_price',
  timestamps: false
});

module.exports = PackagePrice; 