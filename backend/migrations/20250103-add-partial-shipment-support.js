const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 开始添加部分出库支持...');
    
    try {
      // 1. 修改 status 字段，添加 '部分出库' 状态
      await queryInterface.changeColumn('local_boxes', 'status', {
        type: DataTypes.ENUM('待出库', '部分出库', '已出库', '已取消'),
        defaultValue: '待出库',
        comment: '库存状态'
      });
      console.log('✅ status 字段已更新');

      // 2. 添加 shipped_quantity 字段
      await queryInterface.addColumn('local_boxes', 'shipped_quantity', {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: '已出库数量'
      });
      console.log('✅ shipped_quantity 字段已添加');

      // 3. 添加 remaining_quantity 计算列（对于支持的数据库）
      // 注意：SQLite 不支持计算列，MySQL 5.7+ 支持
      try {
        await queryInterface.addColumn('local_boxes', 'remaining_quantity', {
          type: DataTypes.VIRTUAL(DataTypes.INTEGER, ['total_quantity', 'shipped_quantity']),
          get() {
            return this.getDataValue('total_quantity') - this.getDataValue('shipped_quantity');
          },
          comment: '剩余数量(虚拟列)'
        });
        console.log('✅ remaining_quantity 虚拟列已添加');
      } catch (error) {
        console.log('⚠️ 虚拟列不支持，将在模型中处理剩余数量计算');
      }

      // 4. 添加索引优化查询性能
      await queryInterface.addIndex('local_boxes', ['status', 'shipped_quantity'], {
        name: 'idx_status_shipped_quantity'
      });
      console.log('✅ 索引已添加');

      // 5. 更新现有数据：将已出库记录标记正确的状态
      await queryInterface.sequelize.query(`
        UPDATE local_boxes 
        SET shipped_quantity = ABS(total_quantity),
            status = '已出库'
        WHERE total_quantity < 0 AND status = '已出库'
      `);
      console.log('✅ 现有数据已更新');

    } catch (error) {
      console.error('❌ 迁移失败:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 开始回滚部分出库支持...');
    
    try {
      // 删除添加的字段和索引
      await queryInterface.removeIndex('local_boxes', 'idx_status_shipped_quantity');
      await queryInterface.removeColumn('local_boxes', 'remaining_quantity');
      await queryInterface.removeColumn('local_boxes', 'shipped_quantity');
      
      // 恢复原始 status 枚举
      await queryInterface.changeColumn('local_boxes', 'status', {
        type: DataTypes.ENUM('待出库', '已出库', '已取消'),
        defaultValue: '待出库',
        comment: '库存状态'
      });
      
      console.log('✅ 回滚完成');
    } catch (error) {
      console.error('❌ 回滚失败:', error);
      throw error;
    }
  }
}; 