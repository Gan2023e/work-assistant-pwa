const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const SellerInventorySku = sequelize.define('SellerInventorySku', {
  skuid: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '主键ID'
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
  }
}, {
  tableName: 'sellerinventory_sku',
  timestamps: false
});

module.exports = SellerInventorySku; 