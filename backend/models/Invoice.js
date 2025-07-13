const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '发票ID'
  },
  invoice_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '发票号'
  },
  invoice_date: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '开票日期'
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '发票总金额'
  },
  tax_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '税额'
  },
  tax_rate: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: '税率'
  },
  invoice_file_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '发票文件OSS链接'
  },
  invoice_file_name: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '发票文件名'
  },
  file_size: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '文件大小（字节）'
  },
  seller_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '开票方名称'
  },
  buyer_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '收票方名称'
  },
  invoice_type: {
    type: DataTypes.ENUM('增值税专用发票', '增值税普通发票', '收据', '其他'),
    defaultValue: '增值税专用发票',
    comment: '发票类型'
  },
  status: {
    type: DataTypes.ENUM('正常', '作废', '红冲'),
    defaultValue: '正常',
    comment: '发票状态'
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
  tableName: 'invoices',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['invoice_number']
    },
    {
      fields: ['seller_name']
    },
    {
      fields: ['invoice_date']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = Invoice; 