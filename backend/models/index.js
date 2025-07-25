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
const ShipmentRecord = require('./ShipmentRecord');
const ShipmentItem = require('./ShipmentItem');
const OrderShipmentRelation = require('./OrderShipmentRelation');
const FbaInventory = require('./FbaInventory');
const SheinProduct = require('./SheinProduct');
const PurchaseOrder = require('./PurchaseOrder');
const Invoice = require('./Invoice');

// 设置模型关联关系

// 发货记录与发货明细的关联
ShipmentRecord.hasMany(ShipmentItem, {
  foreignKey: 'shipment_id',
  as: 'shipmentItems'
});
ShipmentItem.belongsTo(ShipmentRecord, {
  foreignKey: 'shipment_id',
  as: 'shipmentRecord'
});

// 需求记录与发货明细的关联
WarehouseProductsNeed.hasMany(ShipmentItem, {
  foreignKey: 'order_item_id',
  sourceKey: 'record_num',
  as: 'shipmentItems'
});
ShipmentItem.belongsTo(WarehouseProductsNeed, {
  foreignKey: 'order_item_id',
  targetKey: 'record_num',
  as: 'orderItem'
});

// 发货记录与需求单关联表的关联
ShipmentRecord.hasMany(OrderShipmentRelation, {
  foreignKey: 'shipment_id',
  as: 'orderRelations'
});
OrderShipmentRelation.belongsTo(ShipmentRecord, {
  foreignKey: 'shipment_id',
  as: 'shipmentRecord'
});

// 采购订单与发票的关联关系
PurchaseOrder.belongsTo(Invoice, {
  foreignKey: 'invoice_id',
  as: 'invoice'
});

Invoice.hasMany(PurchaseOrder, {
  foreignKey: 'invoice_id',
  as: 'purchaseOrders'
});

// 注意：need_num字段使用逻辑关联，不设置数据库级外键约束
// 因为原表没有对need_num字段建立索引

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
  AmzSkuMapping,
  ShipmentRecord,
  ShipmentItem,
  OrderShipmentRelation,
  FbaInventory,
  SheinProduct,
  PurchaseOrder,
  Invoice
};
