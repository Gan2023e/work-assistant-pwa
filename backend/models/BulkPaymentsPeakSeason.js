const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const BulkPaymentsPeakSeason = sequelize.define('BulkPaymentsPeakSeason', {
  序列: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '序列ID'
  },
  卖家名称: {
    type: DataTypes.STRING(15),
    allowNull: false,
    comment: '卖家名称'
  },
  付款类型: {
    type: DataTypes.STRING(15),
    allowNull: false,
    comment: '付款类型'
  },
  付款金额: {
    type: DataTypes.DECIMAL(16, 2),
    allowNull: false,
    comment: '付款金额'
  },
  付款时间: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: '付款时间'
  }
}, {
  tableName: 'bulk_payments_peak_season',
  timestamps: false,
  indexes: [
    {
      fields: ['序列']
    },
    {
      fields: ['卖家名称']
    },
    {
      fields: ['付款时间']
    }
  ]
});

module.exports = BulkPaymentsPeakSeason; 