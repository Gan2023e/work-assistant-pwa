'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('local_boxes', 'shipment_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: '发货单ID',
      references: {
        model: 'shipment_records',
        key: 'shipment_id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('local_boxes', 'shipment_id');
  }
};
