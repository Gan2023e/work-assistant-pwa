'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 添加新的 is_remote 字段
    await queryInterface.addColumn('amz_warehouse_address', 'is_remote', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: '是否偏远地区：true-是，false-否'
    });

    // 删除旧的 phone 字段
    await queryInterface.removeColumn('amz_warehouse_address', 'phone');

    // 添加索引
    await queryInterface.addIndex('amz_warehouse_address', ['is_remote'], {
      name: 'idx_is_remote'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // 恢复 phone 字段
    await queryInterface.addColumn('amz_warehouse_address', 'phone', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: '电话'
    });

    // 删除 is_remote 字段
    await queryInterface.removeColumn('amz_warehouse_address', 'is_remote');

    // 删除索引
    await queryInterface.removeIndex('amz_warehouse_address', 'idx_is_remote');
  }
}; 