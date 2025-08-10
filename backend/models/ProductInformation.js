const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const ProductInformation = sequelize.define('ProductInformation', {
  site: {
    type: DataTypes.STRING(10),
    primaryKey: true,
    allowNull: false,
    comment: '站点/国家信息'
  },
  item_sku: {
    type: DataTypes.STRING(30),
    primaryKey: true,
    allowNull: false,
    comment: '商品SKU'
  },
  original_parent_sku: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: '原始父SKU，去掉前两个字符后的结果'
  },
  item_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '商品名称'
  },
  external_product_id: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  external_product_id_type: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  brand_name: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  product_description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  bullet_point1: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  bullet_point2: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  bullet_point3: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  bullet_point4: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  bullet_point5: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  generic_keywords: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  main_image_url: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  swatch_image_url: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  other_image_url1: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  other_image_url2: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  other_image_url3: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  other_image_url4: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  other_image_url5: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  other_image_url6: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  other_image_url7: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  other_image_url8: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  parent_child: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  parent_sku: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  relationship_type: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  variation_theme: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  color_name: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  color_map: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  size_name: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  size_map: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'product_information',
  timestamps: true,
  underscored: true
});

module.exports = ProductInformation; 