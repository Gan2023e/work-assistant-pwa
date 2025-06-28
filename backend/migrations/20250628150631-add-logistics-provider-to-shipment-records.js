'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('shipment_records', 'logistics_provider', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: '物流商'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('shipment_records', 'logistics_provider');
  }
};
