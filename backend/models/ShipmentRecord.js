const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const ShipmentRecord = sequelize.define('ShipmentRecord', {
  shipment_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '发货记录ID'
  },
  shipment_number: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: '发货单号'
  },
  operator: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '操作员'
  },
  total_boxes: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '总箱数'
  },
  total_items: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '总件数'
  },
  shipping_method: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '运输方式'
  },
  status: {
    type: DataTypes.ENUM('准备中', '已发货', '已取消'),
    defaultValue: '准备中',
    comment: '发货状态'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  },
  logistics_provider: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '物流商'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '创建时间'
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '更新时间'
  }
}, {
  tableName: 'shipment_records',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = ShipmentRecord; 