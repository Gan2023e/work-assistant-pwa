const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const FbaInventory = sequelize.define('FbaInventory', {
  sku: {
    type: DataTypes.STRING(32),
    allowNull: false,
    primaryKey: true,
    comment: 'SKU编码'
  },
  fnsku: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: 'FNSKU编码'
  },
  asin: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: 'ASIN编码'
  },
  'product-name': {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '产品名称'
  },
  condition: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '商品状态'
  },
  'your-price': {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '售价'
  },
  'mfn-listing-exists': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: 'MFN Listing是否存在'
  },
  'mfn-fulfillable-quantity': {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'MFN可售数量'
  },
  'afn-listing-exists': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: 'AFN Listing是否存在'
  },
  'afn-warehouse-quantity': {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'AFN仓库数量'
  },
  'afn-fulfillable-quantity': {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'AFN可售数量'
  },
  'afn-unsellable-quantity': {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'AFN不可售数量'
  },
  'afn-reserved-quantity': {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'AFN预留数量'
  },
  'afn-total-quantity': {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'AFN总数量'
  },
  'per-unit-volume': {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '单位体积'
  },
  'afn-inbound-working-quantity': {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'AFN入库处理中数量'
  },
  'afn-inbound-shipped-quantity': {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'AFN入库运输中数量'
  },
  'afn-inbound-receiving-quantity': {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'AFN入库接收中数量'
  },
  'afn-researching-quantity': {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'AFN研究中数量'
  },
  'afn-reserved-future-supply': {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'AFN预留未来供应'
  },
  'afn-future-supply-buyable': {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'AFN未来供应可购买'
  },
  site: {
    type: DataTypes.STRING(32),
    allowNull: false,
    primaryKey: true,
    comment: '站点'
  },
  'afn-fulfillable-quantity-local': {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'AFN本地可售数量'
  },
  'afn-fulfillable-quantity-remote': {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'AFN远程可售数量'
  },
  store: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '店铺'
  }
}, {
  tableName: 'fba_inventory',
  timestamps: false, // 实际表没有时间戳字段
  indexes: [
    {
      unique: false,
      fields: ['sku']
    },
    {
      unique: false,
      fields: ['site']
    },
    {
      unique: false,
      fields: ['store']
    }
  ]
});

module.exports = FbaInventory; 