'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 添加 pre_type 字段
    await queryInterface.addColumn('local_boxes', 'pre_type', {
      type: Sequelize.ENUM('旺季备货', '平时备货'),
      defaultValue: '平时备货',
      comment: '备货类型'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // 删除 pre_type 字段
    await queryInterface.removeColumn('local_boxes', 'pre_type');
  }
}; 