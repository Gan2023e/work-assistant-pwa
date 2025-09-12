const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const SupplierShipmentsPeakSeason = sequelize.define('SupplierShipmentsPeakSeason', {
  序号: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '序号ID'
  },
  日期: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: '日期'
  },
  卖家货号: {
    type: DataTypes.STRING(15),
    allowNull: false,
    comment: '卖家货号'
  },
  卖家颜色: {
    type: DataTypes.STRING(15),
    allowNull: false,
    comment: '卖家颜色'
  },
  数量: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '数量'
  },
  录入日期: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '录入日期'
  }
}, {
  tableName: 'supplier_shipments_peak_season',
  timestamps: false,
  indexes: [
    {
      fields: ['序号']
    },
    {
      fields: ['卖家货号']
    },
    {
      fields: ['日期']
    }
  ]
});

module.exports = SupplierShipmentsPeakSeason; 