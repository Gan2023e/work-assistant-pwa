const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 添加重量字段（单位：千克，支持小数点后3位）
    await queryInterface.addColumn('sellerinventory_sku', 'weight', {
      type: DataTypes.DECIMAL(8, 3),
      allowNull: true,
      comment: '产品重量(千克)'
    });

    // 添加重量类型字段（枚举类型：预估/实测）
    await queryInterface.addColumn('sellerinventory_sku', 'weight_type', {
      type: DataTypes.ENUM('estimated', 'measured'),
      allowNull: true,
      defaultValue: 'estimated',
      comment: '重量类型：estimated-预估, measured-实测'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // 回滚：删除添加的字段
    await queryInterface.removeColumn('sellerinventory_sku', 'weight_type');
    await queryInterface.removeColumn('sellerinventory_sku', 'weight');
  }
}; 