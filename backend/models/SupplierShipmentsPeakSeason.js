const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const SupplierShipmentsPeakSeason = sequelize.define('SupplierShipmentsPeakSeason', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '序号ID',
    field: 'id' // 映射到数据库的id字段
  },
  日期: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: '日期',
    field: 'date' // 映射到数据库的date字段
  },
  卖家货号: {
    type: DataTypes.STRING(15),
    allowNull: false,
    comment: '卖家货号',
    field: 'vendor_sku' // 映射到数据库的vendor_sku字段
  },
  卖家颜色: {
    type: DataTypes.STRING(15),
    allowNull: false,
    comment: '卖家颜色',
    field: 'sellercolorname' // 映射到数据库的sellercolorname字段
  },
  数量: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '数量',
    field: 'quantity' // 映射到数据库的quantity字段
  },
  录入日期: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '录入日期',
    field: 'create_date' // 映射到数据库的create_date字段
  }
}, {
  tableName: 'supplier_shipments_peak_season',
  timestamps: false,
  indexes: [
    {
      fields: ['id']
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