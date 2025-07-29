const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const ShipmentItem = sequelize.define('ShipmentItem', {
  shipment_item_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '发货明细ID'
  },
  shipment_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '发货记录ID',
    references: {
      model: 'shipment_records',
      key: 'shipment_id'
    }
  },
  order_item_id: {
    type: DataTypes.INTEGER,
    allowNull: true, // 允许NULL，支持手动发货
    comment: '需求记录ID（NULL表示手动发货）',
    references: {
      model: 'pbi_warehouse_products_need',
      key: 'record_num'
    }
  },
  need_num: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '需求单号'
  },
  local_sku: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '本地SKU'
  },
  amz_sku: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Amazon SKU'
  },
  country: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '国家'
  },
  marketplace: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '平台'
  },
  requested_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '需求数量'
  },
  shipped_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '实际发货数量'
  },
  whole_boxes: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: '整箱数量'
  },
  mixed_box_quantity: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: '混合箱数量'
  },
  box_numbers: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '箱号列表(JSON格式)'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '创建时间'
  }
}, {
  tableName: 'shipment_items',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = ShipmentItem; 