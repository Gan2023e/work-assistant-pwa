const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const LocalBox = sequelize.define('LocalBox', {
  sku: DataTypes.STRING,
  total_quantity: DataTypes.INTEGER,
  total_boxes: DataTypes.INTEGER,
  country: DataTypes.STRING,
  time: DataTypes.DATE,
  记录号: { type: DataTypes.STRING(20), primaryKey: true },
  操作员: DataTypes.STRING,
  打包员: DataTypes.STRING,
  mix_box_num: DataTypes.STRING,
  marketPlace: DataTypes.STRING,
  shipment_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '发货单ID',
    references: {
      model: 'shipment_records',
      key: 'shipment_id'
    }
  },
  // 新增字段
  status: {
    type: DataTypes.ENUM('待出库', '部分出库', '已出库', '已取消'),
    defaultValue: '待出库',
    comment: '库存状态'
  },
  shipped_quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: '已出库数量'
  },
  remaining_quantity: {
    type: DataTypes.VIRTUAL,
    get() {
      return (this.getDataValue('total_quantity') || 0) - (this.getDataValue('shipped_quantity') || 0);
    },
    comment: '剩余数量(虚拟字段)'
  },
  last_updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '最后修改时间'
  },
  shipped_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '出库时间'
  },
  box_type: {
    type: DataTypes.ENUM('整箱', '混合箱'),
    defaultValue: '整箱',
    comment: '箱型'
  },
  remark: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '操作备注'
  },
  pre_type: {
    type: DataTypes.ENUM('旺季备货', '平时备货'),
    defaultValue: '平时备货',
    comment: '备货类型'
  }
}, {
  tableName: 'local_boxes',
  timestamps: false,
  indexes: [
    {
      name: 'idx_status_time',
      fields: ['status', 'last_updated_at']
    },
    {
      name: 'idx_sku_country_status', 
      fields: ['sku', 'country', 'status']
    },
    {
      name: 'idx_box_type_status',
      fields: ['box_type', 'status']
    },
    {
      name: 'idx_mix_box_num',
      fields: ['mix_box_num']
    },
    {
      name: 'idx_status_shipped_quantity',
      fields: ['status', 'shipped_quantity']
    }
  ]
});

module.exports = LocalBox;
