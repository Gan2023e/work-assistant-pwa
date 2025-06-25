const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const WarehouseProductsNeed = sequelize.define('WarehouseProductsNeed', {
  record_num: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  need_num: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '需求单号'
  },
  ori_quantity: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '原始数量'
  },
  country: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '发往国家'
  },
  shipping_method: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '运输方式'
  },
  send_out_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '发出日期'
  },
  marketplace: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '平台'
  },
  expired_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '过期日期'
  },
  expect_sold_out_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '预期售完日期'
  },
  status: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '状态'
  }
}, {
  tableName: 'pbi_warehouse_products_need',
  timestamps: false
});

module.exports = WarehouseProductsNeed; 