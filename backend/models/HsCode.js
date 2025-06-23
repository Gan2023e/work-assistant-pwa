const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const HsCode = sequelize.define('HsCode', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  hsCode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    comment: 'HSCODE编码'
  },
  productName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '产品名称'
  },
  productNameEn: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '产品英文名称'
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '产品类别'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '产品描述'
  },
  declaredValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '申报价值'
  },
  declaredValueCurrency: {
    type: DataTypes.STRING(10),
    defaultValue: 'USD',
    comment: '申报价值货币'
  },
  tariffRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: '关税税率(%)'
  },
  imageUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '产品图片URL'
  },
  imageName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '图片文件名'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
    comment: '状态'
  },
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '使用次数'
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最后使用时间'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  }
}, {
  tableName: 'hscode',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['hsCode']
    },
    {
      fields: ['category']
    },
    {
      fields: ['status']
    },
    {
      fields: ['productName']
    }
  ]
});

module.exports = HsCode; 