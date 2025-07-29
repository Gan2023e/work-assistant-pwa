const { LocalBox, sequelize } = require('../models/index');

/**
 * 检查并修复库存状态一致性
 * @param {boolean} dryRun - 是否只检查不修复
 * @returns {Object} 检查结果
 */
async function checkAndFixStatusConsistency(dryRun = false) {
  const transaction = await sequelize.transaction();
  
  try {
    console.log(`🔍 ${dryRun ? '检查' : '检查并修复'}库存状态一致性...`);
    
    // 查找状态不一致的记录
    const inconsistencies = {
      shouldBeShipped: [], // shipped_quantity = total_quantity 但状态不是"已出库"
      shouldBePartial: [], // 0 < shipped_quantity < total_quantity 但状态不是"部分出库"
      shouldBePending: []  // shipped_quantity = 0 但状态不是"待出库"
    };
    
    // 1. 应该是"已出库"但不是的记录
    inconsistencies.shouldBeShipped = await LocalBox.findAll({
      where: {
        [sequelize.Sequelize.Op.and]: [
          sequelize.literal('shipped_quantity = total_quantity'),
          sequelize.literal('shipped_quantity > 0'),
          { status: { [sequelize.Sequelize.Op.ne]: '已出库' } }
        ]
      },
      transaction
    });
    
    // 2. 应该是"部分出库"但不是的记录
    inconsistencies.shouldBePartial = await LocalBox.findAll({
      where: {
        [sequelize.Sequelize.Op.and]: [
          sequelize.literal('shipped_quantity > 0'),
          sequelize.literal('shipped_quantity < total_quantity'),
          { status: { [sequelize.Sequelize.Op.notIn]: ['部分出库'] } }
        ]
      },
      transaction
    });
    
    // 3. 应该是"待出库"但不是的记录
    inconsistencies.shouldBePending = await LocalBox.findAll({
      where: {
        [sequelize.Sequelize.Op.and]: [
          { shipped_quantity: 0 },
          { status: { [sequelize.Sequelize.Op.notIn]: ['待出库', '已取消'] } }
        ]
      },
      transaction
    });
    
    const totalInconsistencies = inconsistencies.shouldBeShipped.length + 
                                inconsistencies.shouldBePartial.length + 
                                inconsistencies.shouldBePending.length;
    
    if (totalInconsistencies === 0) {
      console.log('✅ 没有发现状态不一致的记录');
      await transaction.rollback();
      return { success: true, fixed: 0, inconsistencies: [] };
    }
    
    console.log(`📋 发现 ${totalInconsistencies} 条状态不一致的记录:`);
    console.log(`  - 应该是"已出库": ${inconsistencies.shouldBeShipped.length}条`);
    console.log(`  - 应该是"部分出库": ${inconsistencies.shouldBePartial.length}条`);
    console.log(`  - 应该是"待出库": ${inconsistencies.shouldBePending.length}条`);
    
    if (dryRun) {
      // 只检查，不修复
      console.log('\n🔍 仅检查模式，不执行修复');
      await transaction.rollback();
      return { 
        success: true, 
        fixed: 0, 
        totalFound: totalInconsistencies,
        inconsistencies 
      };
    }
    
    // 执行修复
    let totalFixed = 0;
    
    // 修复"已出库"状态
    if (inconsistencies.shouldBeShipped.length > 0) {
      const [fixedShipped] = await LocalBox.update({
        status: '已出库',
        shipped_at: new Date(),
        last_updated_at: new Date()
      }, {
        where: {
          记录号: inconsistencies.shouldBeShipped.map(r => r.记录号)
        },
        transaction
      });
      totalFixed += fixedShipped;
      console.log(`✅ 修复"已出库"状态: ${fixedShipped}条`);
    }
    
    // 修复"部分出库"状态
    if (inconsistencies.shouldBePartial.length > 0) {
      const [fixedPartial] = await LocalBox.update({
        status: '部分出库',
        last_updated_at: new Date()
      }, {
        where: {
          记录号: inconsistencies.shouldBePartial.map(r => r.记录号)
        },
        transaction
      });
      totalFixed += fixedPartial;
      console.log(`✅ 修复"部分出库"状态: ${fixedPartial}条`);
    }
    
    // 修复"待出库"状态
    if (inconsistencies.shouldBePending.length > 0) {
      const [fixedPending] = await LocalBox.update({
        status: '待出库',
        shipped_at: null,
        last_updated_at: new Date()
      }, {
        where: {
          记录号: inconsistencies.shouldBePending.map(r => r.记录号)
        },
        transaction
      });
      totalFixed += fixedPending;
      console.log(`✅ 修复"待出库"状态: ${fixedPending}条`);
    }
    
    await transaction.commit();
    console.log(`\n🎉 状态一致性修复完成，共修复 ${totalFixed} 条记录`);
    
    return { 
      success: true, 
      fixed: totalFixed, 
      totalFound: totalInconsistencies,
      inconsistencies 
    };
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ 状态一致性检查失败:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { checkAndFixStatusConsistency }; 