const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const LocalBox = sequelize.define('LocalBox', {
  sku: DataTypes.STRING,
  total_quantity: DataTypes.INTEGER,
  total_boxes: DataTypes.INTEGER,
  country: DataTypes.STRING,
  time: DataTypes.DATE,
  记录号: { type: DataTypes.STRING, primaryKey: true },
  操作员: DataTypes.STRING,
  打包员: DataTypes.STRING,
  mix_box_num: DataTypes.STRING,
  marketPlace: DataTypes.STRING,
}, {
  tableName: 'local_boxes',
  timestamps: false
});

module.exports = LocalBox;
