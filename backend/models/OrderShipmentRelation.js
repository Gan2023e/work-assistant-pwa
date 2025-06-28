const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const OrderShipmentRelation = sequelize.define('OrderShipmentRelation', {
  relation_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '关联ID'
  },
  need_num: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '需求单号'
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
  total_requested: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '该需求单在此次发货中的总需求数量'
  },
  total_shipped: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '该需求单在此次发货中的实际发货数量'
  },
  completion_status: {
    type: DataTypes.ENUM('部分完成', '全部完成'),
    allowNull: false,
    comment: '该需求单在此次发货中的完成状态'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '创建时间'
  }
}, {
  tableName: 'order_shipment_relations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      fields: ['need_num']
    },
    {
      fields: ['shipment_id']
    }
  ]
});

module.exports = OrderShipmentRelation; 