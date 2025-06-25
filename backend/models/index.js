// 从独立的数据库配置文件导入sequelize
const { sequelize } = require('./database');

// 在sequelize初始化后再导入模型
const User = require('./User');
const LocalBox = require('./LocalBox');
const WarehouseProductsNeed = require('./WarehouseProductsNeed');
const AmzWarehouse = require('./AmzWarehouse');
const HsCode = require('./HsCode');
const Logistics = require('./Logistics');
const PackagePrice = require('./PackagePrice');
const ProductWeblink = require('./ProductWeblink');
const SellerInventorySku = require('./SellerInventorySku');
const AmzSkuMapping = require('./AmzSkuMapping');

module.exports = { 
  sequelize,
  User,
  LocalBox,
  WarehouseProductsNeed,
  AmzWarehouse,
  HsCode,
  Logistics,
  PackagePrice,
  ProductWeblink,
  SellerInventorySku,
  AmzSkuMapping
};
