const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const ProductWeblink = sequelize.define('ProductWeblink', {
  parent_sku: DataTypes.STRING,
  weblink: DataTypes.STRING,
  update_time: DataTypes.DATE,
  check_time: DataTypes.DATE,
  status: DataTypes.STRING,
  notice: DataTypes.STRING,
  cpc_recommend: DataTypes.STRING,
  cpc_status: DataTypes.STRING,
  cpc_submit: DataTypes.STRING,
  model_number: DataTypes.STRING,
  recommend_age: DataTypes.STRING,
  ads_add: DataTypes.STRING,
  list_parent_sku: DataTypes.STRING,
  no_inventory_rate: DataTypes.STRING,
  sales_30days: DataTypes.STRING,
  seller_name: DataTypes.STRING,
}, {
  tableName: 'product_weblink',
  timestamps: false,
});

module.exports = ProductWeblink; 