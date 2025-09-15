const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const SellerInventorySku = sequelize.define('SellerInventorySku', {
  skuid: {
    type: DataTypes.STRING,
    primaryKey: true,
    autoIncrement: false,
    comment: '产品SKU ID'
  },
  parent_sku: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '父SKU'
  },
  child_sku: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '子SKU'
  },
  vendor_sku: {
    type: DataTypes.STRING(15),
    allowNull: true,
    comment: '厂商货号，用于关联发货记录'
  },
  sellercolorname: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '卖家颜色名称'
  },
  sellersizename: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '卖家尺寸名称'
  },
  qty_per_box: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '单箱产品数量'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '产品价格'
  }
}, {
  tableName: 'sellerinventory_sku',
  timestamps: false
});

module.exports = SellerInventorySku; 