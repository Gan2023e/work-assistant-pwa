const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const SupplierShipmentsPeakSeason = sequelize.define('SupplierShipmentsPeakSeason', {
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: '日期'
  },
  vendor_sku: {
    type: DataTypes.STRING(15),
    allowNull: false,
    comment: '卖家货号'
  },
  sellercolorname: {
    type: DataTypes.STRING(15),
    allowNull: false,
    comment: '卖家颜色'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '数量'
  },
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '序号ID'
  },
  create_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '录入日期'
  }
}, {
  tableName: 'supplier_shipments_peak_season',
  timestamps: false,
  indexes: [
    {
      fields: ['id']
    },
    {
      fields: ['vendor_sku']
    },
    {
      fields: ['date']
    }
  ]
});

module.exports = SupplierShipmentsPeakSeason; 