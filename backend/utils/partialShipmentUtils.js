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
          [Op.and]: [
            // 使用原始字段计算剩余数量 > 0
            LocalBox.sequelize.literal('(total_quantity - COALESCE(shipped_quantity, 0)) > 0')
          ]
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
 * 处理部分出库逻辑（优化版本，使用批量判断和时间排序）
 * @param {Array} shipmentItems - 出库项目列表
 * @param {Object} transaction - 数据库事务
 * @returns {Object} 处理结果
 */
async function processPartialShipmentOptimized(shipmentItems, transaction) {
  console.log('\x1b[32m%s\x1b[0m', '🔄 开始处理部分出库逻辑（批量优化版）');
  
  const results = {
    updated: 0,
    partialShipped: 0,
    fullyShipped: 0,
    errors: []
  };

  if (shipmentItems.length === 0) {
    return results;
  }

  console.log('\x1b[33m%s\x1b[0m', '📦 批量查询库存记录，总计:', shipmentItems.length, '个SKU');

  try {
    // 批量查询所有需要的库存记录（区分整箱确认和普通出库）
    const inventoryConditions = shipmentItems.map(item => {
      const baseCondition = {
        [Op.and]: [
          { sku: item.sku },
          { country: item.country }
        ]
      };
      
      // 对于整箱确认，查询指定混合箱的所有记录（包括已全部出库但状态未更新的）
      if (item.is_whole_box_confirmed && item.original_mix_box_num) {
        return {
          [Op.and]: [
            ...baseCondition[Op.and],
            { mix_box_num: item.original_mix_box_num },
            { status: { [Op.in]: ['待出库', '部分出库', '已出库'] } }
          ]
        };
      }
      
      // 普通出库查询所有相关记录（包括已部分出库的）
      return {
        [Op.and]: [
          ...baseCondition[Op.and],
          { 
            status: { [Op.in]: ['待出库', '部分出库'] }
          }
        ]
      };
    });

    const allInventoryRecords = await LocalBox.findAll({
      where: { [Op.or]: inventoryConditions },
      order: [['time', 'ASC']], // 按时间先进先出排序
      transaction
    });

    // 按SKU和国家分组库存记录
    const inventoryMap = new Map();
    allInventoryRecords.forEach(record => {
      const key = `${record.sku}-${record.country}`;
      if (!inventoryMap.has(key)) {
        inventoryMap.set(key, []);
      }
      inventoryMap.get(key).push(record);
    });

    console.log('\x1b[32m%s\x1b[0m', '✅ 批量查询完成，找到库存记录:', allInventoryRecords.length, '条');

    // 准备批量更新的数据
    const updateOperations = [];

    // 处理每个SKU
    for (const item of shipmentItems) {
      try {
        const { sku, quantity, country, is_mixed_box, original_mix_box_num, is_whole_box_confirmed } = item;
        const key = `${sku}-${country}`;
        let inventoryRecords = inventoryMap.get(key) || [];

        console.log(`🔍 处理SKU: ${sku}, 目标出库数量: ${quantity}, 可用记录: ${inventoryRecords.length}条`);

        if (inventoryRecords.length === 0) {
          results.errors.push(`SKU ${sku} 在 ${country} 没有可用库存`);
          console.error(`❌ SKU ${sku} 在 ${country} 没有找到库存记录`);
          continue;
        }

        // 特殊处理：整箱确认发出（修正逻辑：根据实际发货数量判断状态）
        if (is_whole_box_confirmed && original_mix_box_num) {
          console.log(`📦 整箱确认模式：处理混合箱 ${original_mix_box_num}，根据实际发货数量判断状态`);
          
          // 找到该混合箱号下的所有记录
          const wholeBoxRecords = inventoryRecords.filter(record => 
            record.mix_box_num === original_mix_box_num
          );
          
          if (wholeBoxRecords.length === 0) {
            results.errors.push(`SKU ${sku} 在混合箱 ${original_mix_box_num} 中没有找到库存记录`);
            continue;
          }
          
          // 🎯 修正：根据实际发货数量判断状态，而不是直接标记为已出库
          let remainingToAllocate = quantity;
          
          // 按时间排序处理混合箱内的记录
          const sortedWholeBoxRecords = wholeBoxRecords.sort((a, b) => new Date(a.time) - new Date(b.time));
          
          for (const record of sortedWholeBoxRecords) {
            if (remainingToAllocate <= 0) break;
            
            const currentShipped = record.shipped_quantity || 0;
            const totalQuantity = record.total_quantity || 0;
            const currentRemaining = Math.max(0, totalQuantity - currentShipped);
            
            if (currentRemaining <= 0) continue;
            
            // 计算本记录需要分配的数量
            const toAllocateFromThis = Math.min(remainingToAllocate, currentRemaining);
            const newShippedQuantity = currentShipped + toAllocateFromThis;
            
            // 🎯 关键修正：根据实际数量判断状态
            let newStatus;
            if (newShippedQuantity === totalQuantity) {
              newStatus = '已出库';
              results.fullyShipped++;
              console.log(`📋 整箱确认 - 记录号 ${record.记录号}: 发货量 ${newShippedQuantity} = 总量 ${totalQuantity} → 标记为已出库`);
            } else if (newShippedQuantity < totalQuantity) {
              if (newShippedQuantity === 0) {
                newStatus = '待出库';
              } else {
                newStatus = '部分出库';
                results.partialShipped++;
              }
              console.log(`📋 整箱确认 - 记录号 ${record.记录号}: 发货量 ${newShippedQuantity} < 总量 ${totalQuantity} → 标记为${newStatus}`);
            } else {
              console.warn(`⚠️ 整箱确认 - 记录号 ${record.记录号}: 发货量 ${newShippedQuantity} > 总量 ${totalQuantity}，修正为已出库`);
              newStatus = '已出库';
              results.fullyShipped++;
            }
            
            updateOperations.push({
              where: { 记录号: record.记录号 },
              data: {
                shipped_quantity: newShippedQuantity,
                status: newStatus,
                last_updated_at: new Date(),
                shipped_at: newStatus === '已出库' ? new Date() : record.shipped_at
              }
            });
            
            console.log(`📋 整箱确认 - 准备更新: ${record.记录号}, SKU: ${sku}, 分配: ${toAllocateFromThis}, 新已出库: ${newShippedQuantity}/${totalQuantity}, 新状态: ${newStatus}`);
            
            remainingToAllocate -= toAllocateFromThis;
            results.updated++;
          }
          
          if (remainingToAllocate > 0) {
            console.log(`⚠️ 整箱确认 - SKU ${sku} 在混合箱 ${original_mix_box_num} 库存不足，还需要 ${remainingToAllocate} 个`);
            results.errors.push(`SKU ${sku} 在混合箱 ${original_mix_box_num} 库存不足，缺少 ${remainingToAllocate} 个`);
          } else {
            console.log(`✅ 整箱确认 - SKU ${sku} 在混合箱 ${original_mix_box_num} 出库分配完成，共出库 ${quantity} 个`);
          }
          
          continue; // 跳过常规的部分出库逻辑
        }

        // 🎯 新的批量判断逻辑：计算总发货量并与total_quantity比较
        
        // 按时间排序（最早的在前）
        inventoryRecords = inventoryRecords.sort((a, b) => new Date(a.time) - new Date(b.time));
        
        // 如果是混合箱发货且有指定箱号，按混合箱号优先级排序
        if (is_mixed_box && original_mix_box_num) {
          inventoryRecords = inventoryRecords.sort((a, b) => {
            // 优先匹配指定的混合箱号
            if (a.mix_box_num === original_mix_box_num && b.mix_box_num !== original_mix_box_num) return -1;
            if (b.mix_box_num === original_mix_box_num && a.mix_box_num !== original_mix_box_num) return 1;
            // 其他记录按时间先进先出
            return new Date(a.time) - new Date(b.time);
          });
          console.log(`📦 混合箱发货，按箱号 ${original_mix_box_num} 优先级排序`);
        }

        console.log(`📦 开始批量判断SKU ${sku}的发货状态更新策略`);
        
        // 计算当前总的已发货数量
        const currentTotalShipped = inventoryRecords.reduce((sum, record) => 
          sum + (record.shipped_quantity || 0), 0
        );
        
        // 计算新的总发货量
        const newTotalShipped = currentTotalShipped + quantity;
        
        console.log(`📊 SKU ${sku} 发货量分析:`);
        console.log(`   当前已发货: ${currentTotalShipped}`);
        console.log(`   本次发货: ${quantity}`);
        console.log(`   新总发货: ${newTotalShipped}`);
        
        // 批量状态判断逻辑
        let remainingToAllocate = quantity;
        
        for (const record of inventoryRecords) {
          if (remainingToAllocate <= 0) break;
          
          const currentShipped = record.shipped_quantity || 0;
          const totalQuantity = record.total_quantity || 0;
          const currentRemaining = Math.max(0, totalQuantity - currentShipped);
          
          if (currentRemaining <= 0) continue; // 跳过已完全出库的记录
          
          // 计算本记录需要分配的数量
          const toAllocateFromThis = Math.min(remainingToAllocate, currentRemaining);
          const newShippedQuantity = currentShipped + toAllocateFromThis;
          
          // 🎯 核心逻辑：批量判断状态
          let newStatus;
          if (newShippedQuantity === totalQuantity) {
            newStatus = '已出库';
            results.fullyShipped++;
            console.log(`📋 记录号 ${record.记录号}: 发货量 ${newShippedQuantity} = 总量 ${totalQuantity} → 标记为已出库`);
          } else if (newShippedQuantity < totalQuantity) {
            if (newShippedQuantity === 0) {
              newStatus = '待出库';
            } else {
              newStatus = '部分出库';
              results.partialShipped++;
            }
            console.log(`📋 记录号 ${record.记录号}: 发货量 ${newShippedQuantity} < 总量 ${totalQuantity} → 标记为${newStatus}`);
          } else {
            // 这种情况不应该发生，但作为安全检查
            console.warn(`⚠️ 记录号 ${record.记录号}: 发货量 ${newShippedQuantity} > 总量 ${totalQuantity}，修正为已出库`);
            newStatus = '已出库';
            results.fullyShipped++;
          }
          
          // 添加到批量更新队列
          updateOperations.push({
            where: { 记录号: record.记录号 },
            data: {
              shipped_quantity: newShippedQuantity,
              status: newStatus,
              last_updated_at: new Date(),
              shipped_at: newStatus === '已出库' ? new Date() : record.shipped_at
            }
          });
          
          console.log(`📋 准备更新库存记录: ${record.记录号}, SKU: ${sku}, 分配: ${toAllocateFromThis}, 新已出库: ${newShippedQuantity}/${totalQuantity}, 新状态: ${newStatus}`);
          
          remainingToAllocate -= toAllocateFromThis;
          results.updated++;
        }
        
        if (remainingToAllocate > 0) {
          console.log(`⚠️ SKU ${sku} 在 ${country} 库存不足，还需要 ${remainingToAllocate} 个，缺少库存`);
          results.errors.push(`SKU ${sku} 在 ${country} 库存不足，缺少 ${remainingToAllocate} 个`);
        } else {
          console.log(`✅ SKU ${sku} 出库分配完成，共出库 ${quantity} 个`);
        }
        
      } catch (error) {
        console.error(`❌ 处理SKU ${item.sku} 时出错:`, error.message);
        results.errors.push(`SKU ${item.sku} 处理失败: ${error.message}`);
      }
    }

    // 执行批量更新
    if (updateOperations.length > 0) {
      console.log('\x1b[33m%s\x1b[0m', '📦 开始批量更新库存记录，总计:', updateOperations.length, '条');
      
      // 分批处理，避免单次更新过多记录
      const batchSize = 50;
      for (let i = 0; i < updateOperations.length; i += batchSize) {
        const batch = updateOperations.slice(i, i + batchSize);
        
        // 并发执行批次内的更新
        await Promise.all(batch.map(operation => 
          LocalBox.update(operation.data, {
            where: operation.where,
            transaction
          })
        ));
        
        console.log(`✅ 完成批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(updateOperations.length / batchSize)}`);
      }
      
      console.log('\x1b[32m%s\x1b[0m', '✅ 批量更新完成，更新记录:', updateOperations.length, '条');
    }

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 批量处理出库逻辑失败:', error.message);
    results.errors.push(`批量处理失败: ${error.message}`);
  }

  console.log('\x1b[32m%s\x1b[0m', '🎯 部分出库处理完成:', results);
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
  processPartialShipmentOptimized, // 新增优化版本
  getInventoryStatusSummary,
  checkPartialShipmentStatus
}; 