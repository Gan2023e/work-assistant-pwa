const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const SupplierShippingCost = sequelize.define('SupplierShippingCost', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '运费记录ID'
  },
  supplier_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '供应商名称'
  },
  shipping_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: '发货日期'
  },
  shipping_cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: '运费金额'
  },
  logistics_provider: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '物流商'
  },
  tracking_number: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '物流单号'
  },
  package_count: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: '包裹数量'
  },
  total_weight: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '总重量(kg)'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注说明'
  }
}, {
  tableName: 'supplier_shipping_costs',
  timestamps: true,
  createdAt: 'create_time',
  updatedAt: 'update_time',
  indexes: [
    {
      unique: true,
      fields: ['supplier_name', 'shipping_date'],
      name: 'unique_supplier_date'
    },
    {
      fields: ['supplier_name']
    },
    {
      fields: ['shipping_date']
    }
  ]
});

module.exports = SupplierShippingCost; 