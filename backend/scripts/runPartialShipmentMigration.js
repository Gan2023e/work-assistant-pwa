const { Sequelize } = require('sequelize');
const path = require('path');

// 导入数据库配置
const { sequelize } = require('../models/database');

// 导入迁移文件
const migration = require('../migrations/20250103-add-partial-shipment-support');

async function runPartialShipmentMigration() {
  console.log('🚀 开始执行部分出库功能迁移...');
  console.log('=====================================');
  
  try {
    // 检查数据库连接
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    
    // 创建 QueryInterface
    const queryInterface = sequelize.getQueryInterface();
    
    // 检查是否已经应用过此迁移
    try {
      const tableDesc = await queryInterface.describeTable('local_boxes');
      
      if (tableDesc.shipped_quantity) {
        console.log('⚠️ 迁移已经应用过，跳过执行');
        return;
      }
    } catch (error) {
      console.log('📋 检查表结构时出现错误，继续执行迁移');
    }
    
    // 执行迁移
    console.log('🔄 开始执行迁移...');
    await migration.up(queryInterface, Sequelize);
    
    console.log('=====================================');
    console.log('✅ 部分出库功能迁移执行成功！');
    console.log('');
    console.log('📊 新增功能：');
    console.log('  - status 字段新增 "部分出库" 状态');
    console.log('  - 新增 shipped_quantity 字段记录已出库数量');
    console.log('  - 新增 remaining_quantity 虚拟字段计算剩余数量');
    console.log('  - 新增索引优化查询性能');
    console.log('');
    console.log('🔧 新增API端点：');
    console.log('  - GET /api/shipping/inventory-status-summary');
    console.log('  - GET /api/shipping/check-partial-shipment/:sku/:country');
    console.log('');
    console.log('现在你可以：');
    console.log('1. 通过 status = "待出库" 查看在库货件');
    console.log('2. 通过 status = "部分出库" 查看部分出库货件');
    console.log('3. 通过 remaining_quantity 字段查看剩余数量');
    console.log('4. 支持整箱货物的部分出库操作');
    
  } catch (error) {
    console.error('❌ 迁移执行失败:', error);
    console.error('');
    console.error('可能的解决方案：');
    console.error('1. 检查数据库连接配置');
    console.error('2. 确保数据库用户有足够的权限');
    console.error('3. 检查是否有其他进程在使用数据库');
    console.error('4. 手动执行 SQL 命令');
    
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runPartialShipmentMigration()
    .then(() => {
      console.log('🎉 脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { runPartialShipmentMigration }; 