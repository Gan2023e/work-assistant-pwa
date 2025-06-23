const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const AmzWarehouse = sequelize.define('AmzWarehouse', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  warehouseName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '仓库名称'
  },
  warehouseCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '仓库代码'
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '国家'
  },
  state: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '州/省'
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '城市'
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '详细地址'
  },
  zipCode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '邮编'
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '电话'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
    comment: '状态'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'amz_warehouse_address',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['warehouseCode']
    },
    {
      fields: ['country']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = AmzWarehouse; 