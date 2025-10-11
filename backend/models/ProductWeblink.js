const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const ProductWeblink = sequelize.define('ProductWeblink', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
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
  // 新增CPC文件相关字段
  cpc_files: {
    type: DataTypes.TEXT,
    comment: 'CPC文件信息，JSON格式存储多个文件'
  },
  // 新增重点款字段
  is_key_product: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否为重点款'
  },
  // 新增竞争对手链接字段
  competitor_links: {
    type: DataTypes.TEXT,
    comment: '竞争对手链接，JSON格式存储多个链接'
  },
  // 新增自定义类目字段
  custom_category: {
    type: DataTypes.STRING(100),
    defaultValue: null,
    comment: '自定义类目'
  }
}, {
  tableName: 'product_weblink',
  timestamps: false,
});

module.exports = ProductWeblink; 