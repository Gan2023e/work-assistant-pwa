const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const WarehouseProductsNeed = sequelize.define('WarehouseProductsNeed', {
  record_num: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  need_num: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '需求单号，时间戳生成'
  },
  sku: {
    type: DataTypes.STRING,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '需求数量'
  },
  marketplace: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '平台'
  },
  country: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '发往国家'
  },
  status: {
    type: DataTypes.ENUM('待发货', '已发货', '已取消'),
    defaultValue: '待发货'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  created_by: {
    type: DataTypes.STRING,
    comment: '创建人'
  },
  remark: {
    type: DataTypes.TEXT,
    comment: '备注'
  }
}, {
  tableName: 'pbi_warehouse_products_need',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = WarehouseProductsNeed; 