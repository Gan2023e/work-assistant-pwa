const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const PurchaseOrder = sequelize.define('PurchaseOrder', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '采购订单ID'
  },
  order_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '采购订单号'
  },
  order_date: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '订单日期'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '订单金额'
  },
  seller_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '卖家名称'
  },
  payment_account: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '支付账户'
  },
  invoice_status: {
    type: DataTypes.ENUM('未开票', '已开票', '部分开票'),
    defaultValue: '未开票',
    comment: '开票情况'
  },
  invoice_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '关联的发票ID',
    references: {
      model: 'invoices',
      key: 'id'
    }
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注信息'
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '创建时间'
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '更新时间'
  }
}, {
  tableName: 'purchase_orders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['order_number']
    },
    {
      fields: ['seller_name']
    },
    {
      fields: ['invoice_status']
    },
    {
      fields: ['order_date']
    }
  ]
});

module.exports = PurchaseOrder; 