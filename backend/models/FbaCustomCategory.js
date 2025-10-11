const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const FbaCustomCategory = sequelize.define('FbaCustomCategory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '类目ID'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: '类目名称'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '类目描述'
  },
  color: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: '#1890ff',
    comment: '类目颜色（用于前端显示）'
  }
}, {
  tableName: 'fba_custom_categories',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['name']
    }
  ]
});

module.exports = FbaCustomCategory;
