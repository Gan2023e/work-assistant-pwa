'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('invoices', 'amount_difference_screenshot', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: '金额差异截图信息(JSON格式存储OSS链接等信息)',
      after: 'remarks'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('invoices', 'amount_difference_screenshot');
  }
}; 