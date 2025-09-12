const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const PeakSeasonInventoryPrep = sequelize.define('PeakSeasonInventoryPrep', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '记录ID'
  },
  country: {
    type: DataTypes.STRING(10),
    allowNull: false,
    comment: '国家'
  },
  local_sku: {
    type: DataTypes.STRING(10),
    allowNull: false,
    comment: '本地SKU'
  },
  qty: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '数量'
  },
  upate_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '更新日期'
  }
}, {
  tableName: 'peak_season_inventory_prep',
  timestamps: false,
  indexes: [
    {
      fields: ['id']
    },
    {
      fields: ['local_sku']
    },
    {
      fields: ['country']
    }
  ]
});

module.exports = PeakSeasonInventoryPrep; 