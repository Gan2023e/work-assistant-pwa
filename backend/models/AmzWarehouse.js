const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const AmzWarehouse = sequelize.define('AmzWarehouse', {
  warehouse_code: {
    type: DataTypes.STRING(50),
    primaryKey: true,
    allowNull: false,
    comment: '仓库代码'
  },
  recipient_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '收件人'
  },
  address_line1: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: '地址一'
  },
  address_line2: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '地址二'
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '城市'
  },
  state_province: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '州/省'
  },
  postal_code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '邮编'
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '国家'
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '电话'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
    comment: '状态：active-启用，inactive-禁用'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
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
  tableName: 'amz_warehouse_address',
  timestamps: false, // 使用自定义的 created_at 和 updated_at
  indexes: [
    {
      fields: ['country'],
      name: 'idx_country'
    },
    {
      fields: ['state_province'],
      name: 'idx_state_province'
    },
    {
      fields: ['city'],
      name: 'idx_city'
    },
    {
      fields: ['status'],
      name: 'idx_status'
    },
    {
      fields: ['created_at'],
      name: 'idx_created_at'
    }
  ],
  // 添加钩子来自动更新 updated_at
  hooks: {
    beforeUpdate: (warehouse, options) => {
      warehouse.updated_at = new Date();
    }
  }
});

module.exports = AmzWarehouse; 