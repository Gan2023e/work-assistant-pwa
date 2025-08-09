const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const PackagePrice = sequelize.define('PackagePrice', {
  type: { 
    type: DataTypes.STRING(50),
    allowNull: false,
    primaryKey: true
  }, // 一般价/特殊价
  sku: { 
    type: DataTypes.STRING(100),
    allowNull: false,
    primaryKey: true
  },
  price: DataTypes.DECIMAL(10,2),
  time: DataTypes.DATE,
}, {
  tableName: 'pbi_package_price',
  timestamps: false,
  // 禁用默认id字段，使用复合主键
  id: false,
  // 定义复合主键的正确方式
  indexes: [
    {
      unique: true,
      fields: ['type', 'sku']
    }
  ]
});

module.exports = PackagePrice; 