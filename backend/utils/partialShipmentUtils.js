const { LocalBox, sequelize } = require('../models/index');
const { Op } = require('sequelize');

/**
 * 处理部分出库逻辑
 * @param {Array} shipmentItems - 出库项目列表
 * @param {Object} transaction - 数据库事务
 * @returns {Object} 处理结果
 */
async function processPartialShipment(shipmentItems, transaction) {
  console.log('\x1b[32m%s\x1b[0m', '🔄 开始处理部分出库逻辑');
  
  const results = {
    updated: 0,
    partialShipped: 0,
    fullyShipped: 0,
    errors: []
  };

  for (const item of shipmentItems) {
    try {
      const { sku, quantity, country } = item;
      
      // 1. 查找对应的库存记录（状态为待出库或部分出库）
      const inventoryRecords = await LocalBox.findAll({
        where: {
          sku: sku,
          country: country,
          status: { [Op.in]: ['待出库', '部分出库'] },
          remaining_quantity: { [Op.gt]: 0 }
        },
        order: [['time', 'ASC']], // 按时间先进先出
        transaction
      });

      if (inventoryRecords.length === 0) {
        results.errors.push(`SKU ${sku} 在 ${country} 没有可用库存`);
        continue;
      }

      // 2. 按先进先出原则分配出库数量
      let remainingToShip = quantity;
      
      for (const record of inventoryRecords) {
        if (remainingToShip <= 0) break;
        
        const currentRemaining = record.remaining_quantity;
        const toShipFromThis = Math.min(remainingToShip, currentRemaining);
        
        // 3. 更新已出库数量
        const newShippedQuantity = (record.shipped_quantity || 0) + toShipFromThis;
        
        // 4. 确定新状态
        let newStatus;
        if (newShippedQuantity === 0) {
          newStatus = '待出库';
        } else if (newShippedQuantity < record.total_quantity) {
          newStatus = '部分出库';
          results.partialShipped++;
        } else {
          newStatus = '已出库';
          results.fullyShipped++;
        }
        
        // 5. 更新记录
        await LocalBox.update({
          shipped_quantity: newShippedQuantity,
          status: newStatus,
          last_updated_at: new Date(),
          shipped_at: newStatus === '已出库' ? new Date() : record.shipped_at
        }, {
          where: { 记录号: record.记录号 },
          transaction
        });
        
        console.log(`✅ 更新库存记录: ${record.记录号}, SKU: ${sku}, 出库: ${toShipFromThis}, 新状态: ${newStatus}`);
        
        remainingToShip -= toShipFromThis;
        results.updated++;
      }
      
      if (remainingToShip > 0) {
        results.errors.push(`SKU ${sku} 库存不足，还需要 ${remainingToShip} 件`);
      }
      
    } catch (error) {
      console.error(`❌ 处理SKU ${item.sku} 出库失败:`, error);
      results.errors.push(`SKU ${item.sku} 处理失败: ${error.message}`);
    }
  }
  
  console.log('\x1b[32m%s\x1b[0m', '✅ 部分出库处理完成:', results);
  return results;
}

/**
 * 获取库存状态汇总
 * @param {Object} filters - 筛选条件
 * @returns {Array} 库存状态汇总
 */
async function getInventoryStatusSummary(filters = {}) {
  const whereCondition = {
    status: { [Op.in]: ['待出库', '部分出库'] },
    ...filters
  };

  const summary = await LocalBox.findAll({
    attributes: [
      'sku',
      'country',
      'status',
      [sequelize.fn('SUM', sequelize.col('total_quantity')), 'total_quantity'],
      [sequelize.fn('SUM', sequelize.col('shipped_quantity')), 'shipped_quantity'],
      [sequelize.fn('SUM', sequelize.literal('total_quantity - shipped_quantity')), 'remaining_quantity'],
      [sequelize.fn('COUNT', sequelize.col('记录号')), 'record_count']
    ],
    where: whereCondition,
    group: ['sku', 'country', 'status'],
    raw: true
  });

  return summary;
}

/**
 * 检查SKU是否有部分出库记录
 * @param {string} sku - SKU
 * @param {string} country - 国家
 * @returns {Object} 检查结果
 */
async function checkPartialShipmentStatus(sku, country) {
  const records = await LocalBox.findAll({
    where: {
      sku: sku,
      country: country,
      status: '部分出库'
    },
    attributes: [
      '记录号',
      'total_quantity',
      'shipped_quantity',
      'remaining_quantity',
      'time',
      'shipped_at'
    ],
    raw: true
  });

  const summary = {
    hasPartialShipment: records.length > 0,
    totalRecords: records.length,
    totalQuantity: records.reduce((sum, r) => sum + r.total_quantity, 0),
    shippedQuantity: records.reduce((sum, r) => sum + r.shipped_quantity, 0),
    remainingQuantity: records.reduce((sum, r) => sum + r.remaining_quantity, 0),
    records: records
  };

  return summary;
}

module.exports = {
  processPartialShipment,
  getInventoryStatusSummary,
  checkPartialShipmentStatus
}; 