const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const FbaInventory = sequelize.define('FbaInventory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: 'FBA库存ID'
  },
  sku: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'SKU编码'
  },
  asin: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'ASIN编码'
  },
  fnsku: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'FNSKU编码'
  },
  product_name: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '产品名称'
  },
  marketplace: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '市场站点'
  },
  country: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '国家'
  },
  fulfillment_center: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '履约中心'
  },
  available_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '可用数量'
  },
  inbound_working_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '入库处理中数量'
  },
  inbound_shipped_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '入库运输中数量'
  },
  inbound_receiving_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '入库接收中数量'
  },
  reserved_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '预留数量'
  },
  unfulfillable_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '不可售数量'
  },
  total_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '总数量'
  },
  last_updated: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最后更新时间'
  },
  snapshot_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: '快照日期'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '创建时间'
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '更新时间'
  }
}, {
  tableName: 'fba_inventory',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: false,
      fields: ['sku']
    },
    {
      unique: false,
      fields: ['marketplace']
    },
    {
      unique: false,
      fields: ['country']
    },
    {
      unique: false,
      fields: ['snapshot_date']
    },
    {
      unique: true,
      fields: ['sku', 'marketplace', 'snapshot_date'],
      name: 'unique_sku_marketplace_snapshot'
    }
  ]
});

module.exports = FbaInventory; 