const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const SellerInventorySku = sequelize.define('SellerInventorySku', {
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
  }
}, {
  tableName: 'sellerinventory_sku',
  timestamps: false
});

module.exports = SellerInventorySku; 