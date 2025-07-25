'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 添加 qty_per_box 字段
    await queryInterface.addColumn('sellerinventory_sku', 'qty_per_box', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: '单箱产品数量'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // 删除 qty_per_box 字段
    await queryInterface.removeColumn('sellerinventory_sku', 'qty_per_box');
  }
}; 