'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('invoices', 'tax_rate', {
      type: Sequelize.STRING(10),
      allowNull: true,
      comment: '税率',
      after: 'tax_amount'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('invoices', 'tax_rate');
  }
}; 