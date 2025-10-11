const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const FbaSkuCategory = sequelize.define('FbaSkuCategory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: '映射ID'
  },
  sku: {
    type: DataTypes.STRING(32),
    allowNull: false,
    comment: 'SKU编码'
  },
  site: {
    type: DataTypes.STRING(32),
    allowNull: false,
    comment: '站点'
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '类目ID',
    references: {
      model: 'fba_custom_categories',
      key: 'id'
    }
  }
}, {
  tableName: 'fba_sku_categories',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['sku', 'site', 'category_id']
    },
    {
      fields: ['sku', 'site']
    },
    {
      fields: ['category_id']
    }
  ]
});

module.exports = FbaSkuCategory;
