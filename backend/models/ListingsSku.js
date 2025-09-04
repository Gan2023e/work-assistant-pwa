const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const ListingsSku = sequelize.define('ListingsSku', {
  'item-name': {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '商品名称'
  },
  'item-description': {
    type: DataTypes.STRING(3000),
    allowNull: true,
    comment: '商品描述'
  },
  'listing-id': {
    type: DataTypes.STRING(32),
    allowNull: false,
    primaryKey: true,
    comment: 'Listing ID'
  },
  'seller-sku': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '卖家SKU'
  },
  price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    comment: '价格'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '可售数量'
  },
  'open-date': {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '开放日期'
  },
  'image-url': {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '图片链接'
  },
  'item-is-marketplace': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '是否市场商品'
  },
  'product-id-type': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '产品ID类型'
  },
  'zshop-shipping-fee': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '运费'
  },
  'item-note': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '商品备注'
  },
  'item-condition': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '商品状态'
  },
  'zshop-category1': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '商品分类1'
  },
  'zshop-browse-path': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '浏览路径'
  },
  'zshop-storefront-feature': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '店面特色'
  },
  asin1: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: 'ASIN1'
  },
  asin2: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: 'ASIN2'
  },
  asin3: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: 'ASIN3'
  },
  'will-ship-internationally': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '是否国际配送'
  },
  'expedited-shipping': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '是否加急配送'
  },
  'zshop-boldface': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '粗体显示'
  },
  'product-id': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '产品ID'
  },
  'bid-for-featured-placement': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '竞价推荐位'
  },
  'add-delete': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '添加删除标识'
  },
  'pending-quantity': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '待处理数量'
  },
  'merchant-shipping-group': {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '商家配送组'
  },
  status: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '状态'
  },
  'Minimum order quantity': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '最小订购量'
  },
  'Sell remainder': {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '销售余量'
  },
  site: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '站点'
  },
  'price-designation': {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: '价格标识'
  },
  'fulfillment-channel': {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '履行渠道'
  }
}, {
  tableName: 'listings_sku',
  timestamps: false,
  indexes: [
    {
      unique: false,
      fields: ['seller-sku']
    },
    {
      unique: false,
      fields: ['site']
    },
    {
      unique: false,
      fields: ['fulfillment-channel']
    }
  ]
});

module.exports = ListingsSku; 