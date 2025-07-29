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
 * 处理部分出库逻辑（优化版本，使用批量查询）
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
          { country: item.country },
          { status: { [Op.in]: ['待出库', '部分出库'] } }
        ]
      };
      
      // 对于整箱确认，查询指定混合箱的所有记录
      if (item.is_whole_box_confirmed && item.original_mix_box_num) {
        return {
          [Op.and]: [
            ...baseCondition[Op.and],
            { mix_box_num: item.original_mix_box_num }
          ]
        };
      }
      
      // 普通出库查询所有可用记录，包括混合箱和整箱
      return baseCondition;
    });

    const allInventoryRecords = await LocalBox.findAll({
      where: { [Op.or]: inventoryConditions },
      order: [['time', 'ASC']], // 按时间先进先出
      transaction
    });

    console.log(`📦 查询到的库存记录总数: ${allInventoryRecords.length}`);
    
    console.log('🔍 查询条件详情:');
    inventoryConditions.forEach((condition, index) => {
      console.log(`条件 ${index + 1}:`, JSON.stringify(condition, null, 2));
    });
    
    console.log('📋 发货项目详情:');
    shipmentItems.forEach((item, index) => {
      console.log(`发货项目 ${index + 1}: SKU=${item.sku}, 数量=${item.quantity}, 国家=${item.country}, 整箱确认=${item.is_whole_box_confirmed}, 混合箱=${item.is_mixed_box}, 原箱号=${item.original_mix_box_num}`);
    });
    
    allInventoryRecords.forEach(record => {
      const remainingQty = (record.total_quantity || 0) - (record.shipped_quantity || 0);
      console.log(`📋 库存记录: ${record.记录号}, SKU: ${record.sku}, 总量: ${record.total_quantity}, 已出库: ${record.shipped_quantity || 0}, 剩余: ${remainingQty}, 状态: ${record.status}, 混合箱: ${record.mix_box_num || '无'}, 国家: ${record.country}, 时间: ${record.time}`);
    });

    // 按SKU和国家分组库存记录
    const inventoryMap = new Map();
    allInventoryRecords.forEach(record => {
      const key = `${record.sku}-${record.country}`;
      if (!inventoryMap.has(key)) {
        inventoryMap.set(key, []);
      }
      // 手动计算剩余数量并添加到记录中
      record.remaining_quantity = (record.total_quantity || 0) - (record.shipped_quantity || 0);
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

        console.log(`🔍 处理SKU: ${sku}, 目标出库数量: ${quantity}, 可用记录: ${inventoryRecords.length}条, 混合箱: ${is_mixed_box}, 指定箱号: ${original_mix_box_num}, 整箱确认: ${is_whole_box_confirmed}`);

        // 过滤出剩余数量大于0的记录
        const availableRecords = inventoryRecords.filter(record => record.remaining_quantity > 0);
        console.log(`📋 过滤后可用记录: ${availableRecords.length}条`);

        if (availableRecords.length === 0) {
          results.errors.push(`SKU ${sku} 在 ${country} 没有可用库存`);
          console.log(`❌ SKU ${sku} 在 ${country} 没有可用库存`);
          continue;
        }

        // 使用过滤后的记录进行后续处理
        inventoryRecords = availableRecords;

        // 特殊处理：整箱确认发出
        if (is_whole_box_confirmed && original_mix_box_num) {
          console.log(`📦 整箱确认模式：直接标记混合箱 ${original_mix_box_num} 为已出库`);
          
          // 找到该混合箱号下的所有记录
          const wholeBoxRecords = inventoryRecords.filter(record => 
            record.mix_box_num === original_mix_box_num
          );
          
          if (wholeBoxRecords.length === 0) {
            results.errors.push(`SKU ${sku} 在混合箱 ${original_mix_box_num} 中没有找到库存记录`);
            continue;
          }
          
          // 对该混合箱的所有记录直接标记为已出库
          wholeBoxRecords.forEach(record => {
            const currentShipped = record.shipped_quantity || 0;
            const newShippedQuantity = record.total_quantity;
            
            // 如果数量还没有完全出库，更新出库数量；如果已经完全出库，只更新状态
            const needsQuantityUpdate = currentShipped < newShippedQuantity;
            
            updateOperations.push({
              where: { 记录号: record.记录号 },
              data: {
                shipped_quantity: newShippedQuantity,
                status: '已出库',
                last_updated_at: new Date(),
                shipped_at: new Date()
              }
            });
            
            console.log(`📋 整箱确认：记录号 ${record.记录号}, SKU: ${sku}, 混合箱: ${record.mix_box_num}, ${needsQuantityUpdate ? `出库: ${currentShipped} → ${newShippedQuantity}` : '状态更新为已出库'}`);
            
            // 计数会在批量更新完成后统计
          });
          
          continue; // 跳过常规的部分出库逻辑
        }

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
        } else {
          // 整箱发货或无指定箱号，按时间先进先出
          inventoryRecords = inventoryRecords.sort((a, b) => new Date(a.time) - new Date(b.time));
          console.log(`📦 整箱发货，按时间先进先出排序`);
        }

        // 按优化后的顺序分配出库数量
        let remainingToShip = quantity;
        
        console.log(`📦 开始分配SKU ${sku}的出库数量，需要出库: ${quantity}`);
        
        for (const record of inventoryRecords) {
          if (remainingToShip <= 0) break;
          
          const currentRemaining = record.remaining_quantity;
          const toShipFromThis = Math.min(remainingToShip, currentRemaining);
          
          // 跳过数量为0的分配
          if (toShipFromThis <= 0) {
            console.log(`⏭️ 跳过记录号 ${record.记录号}: 无需分配数量`);
            continue;
          }
          
          const isMatchedBox = is_mixed_box && original_mix_box_num && record.mix_box_num === original_mix_box_num;
          console.log(`📋 记录号 ${record.记录号}: 剩余 ${currentRemaining}, 本次分配 ${toShipFromThis}, 箱号: ${record.mix_box_num}${isMatchedBox ? ' ✅匹配' : ''}`);
          
          // 计算新的已出库数量
          const newShippedQuantity = (record.shipped_quantity || 0) + toShipFromThis;
          
          // 确定新状态
          let newStatus;
          if (newShippedQuantity === 0) {
            newStatus = '待出库';
          } else if (newShippedQuantity < record.total_quantity) {
            newStatus = '部分出库';
            // 计数会在批量更新完成后统计
          } else {
            newStatus = '已出库';
            // 计数会在批量更新完成后统计
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
          
          console.log(`📋 准备更新库存记录: ${record.记录号}, SKU: ${sku}, 出库: ${toShipFromThis}, 新已出库: ${newShippedQuantity}, 新状态: ${newStatus}`);
          
          remainingToShip -= toShipFromThis;
          // 计数会在批量更新完成后统计
        }
        
        if (remainingToShip > 0) {
          console.log(`⚠️ SKU ${sku} 在 ${country} 库存不足，还需要 ${remainingToShip} 个，缺少库存`);
          results.errors.push(`SKU ${sku} 在 ${country} 库存不足，缺少 ${remainingToShip} 个`);
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
      
      // 显示所有准备更新的操作详情
      updateOperations.forEach((operation, index) => {
        console.log(`📋 更新操作 ${index + 1}: 记录号=${operation.where.记录号}, 新出库量=${operation.data.shipped_quantity}, 新状态=${operation.data.status}`);
      });
      
      try {
        // 重置实际更新计数
        let actualUpdated = 0;
        
        // 分批处理，避免单次更新过多记录
        const batchSize = 50;
        for (let i = 0; i < updateOperations.length; i += batchSize) {
          const batch = updateOperations.slice(i, i + batchSize);
          
          // 并发执行批次内的更新
          const updateResults = await Promise.all(batch.map((operation, batchIndex) => 
            LocalBox.update(operation.data, {
              where: operation.where,
              transaction
            }).catch(error => {
              console.error(`❌ 更新记录号 ${operation.where.记录号} 失败:`, error.message);
              results.errors.push(`更新记录号 ${operation.where.记录号} 失败: ${error.message}`);
              return [0]; // 返回0表示更新失败
            })
          ));
          
          // 统计实际更新的记录数和状态
          updateResults.forEach((result, batchIndex) => {
            if (Array.isArray(result) && result[0] > 0) {
              actualUpdated++;
              
              // 获取对应的更新操作
              const operation = batch[batchIndex];
              const newStatus = operation.data.status;
              
              // 统计状态
              if (newStatus === '部分出库') {
                results.partialShipped++;
              } else if (newStatus === '已出库') {
                results.fullyShipped++;
              }
            }
          });
          
          console.log(`✅ 完成批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(updateOperations.length / batchSize)}，本批次更新: ${updateResults.filter(r => Array.isArray(r) && r[0] > 0).length}条`);
        }
        
        // 更新实际的updated计数
        results.updated = actualUpdated;
        
        console.log('\x1b[32m%s\x1b[0m', '✅ 批量更新完成，实际更新记录:', actualUpdated, '条，预期:', updateOperations.length, '条');
      } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', '❌ 批量更新过程中发生错误:', error.message);
        results.errors.push(`批量更新失败: ${error.message}`);
      }
    } else {
      console.log('\x1b[33m%s\x1b[0m', '⚠️ 没有需要更新的库存记录');
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