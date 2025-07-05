const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const SheinProduct = sequelize.define('SheinProduct', {
  SPU: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: 'SPU'
  },
  SKC: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'SKC'
  },
  主规格名: {
    type: DataTypes.STRING(10),
    allowNull: false,
    comment: '主规格名'
  },
  主规格值: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '主规格值'
  },
  次规格名1: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: '次规格名1'
  },
  次规格值1: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: '次规格值1'
  },
  商品名称: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '商品名称'
  },
  货号: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '货号'
  },
  SKU: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: '母SKU'
  },
  卖家SKU: {
    type: DataTypes.STRING(30),
    allowNull: false,
    primaryKey: true,
    comment: '卖家SKU（主键）'
  },
  '原价(USD)': {
    type: DataTypes.DECIMAL(10, 0),
    allowNull: false,
    comment: '原价(USD)'
  },
  '特价(USD)': {
    type: DataTypes.DECIMAL(10, 0),
    allowNull: false,
    comment: '特价(USD)'
  },
  当前库存: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '当前库存'
  },
  FBA库存: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'FBA库存'
  }
}, {
  tableName: 'shein产品信息',
  timestamps: false,
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci',
  indexes: [
    {
      unique: false,
      fields: ['SPU']
    },
    {
      unique: false,
      fields: ['SKU']
    }
  ]
});

module.exports = SheinProduct; 