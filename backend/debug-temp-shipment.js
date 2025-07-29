const { sequelize, OrderShipmentRelation, ShipmentRecord, ShipmentItem, LocalBox } = require('./models');

async function debugTempShipment() {
  console.log('🔍 开始调试临时发货场景...');
  
  try {
    // 模拟前端传递的数据 (基于用户之前的日志)
    const mockUpdateItems = [{
      sku: 'MK024A4',
      record_num: -4,  // 负数record_num
      need_num: '',    // 空字符串need_num
      quantity: 80,
      country: '英国',
      is_mixed_box: true,
      amz_sku: 'UNWK024A4',
      marketplace: '亚马逊'
    }];
    
    console.log('📋 模拟的前端数据:', JSON.stringify(mockUpdateItems, null, 2));
    
    // 模拟处理逻辑
    for (const updateItem of mockUpdateItems) {
      const {
        sku,
        quantity,
        country,
        record_num = null,
        need_num = null,
        amz_sku = null,
        marketplace = '亚马逊'
      } = updateItem;
      
      console.log(`\n🔍 处理项目: SKU=${sku}, record_num=${record_num}, need_num='${need_num}'`);
      
      // 检查是否为临时发货的逻辑 (复制自实际代码)
      let isTemporaryShipment = false;
      
      console.log(`🔍 检查发货类型: record_num=${record_num}, need_num=${need_num}, sku=${sku}`);
      
      if (record_num && record_num < 0) {
        console.log(`📦 检测到临时发货: record_num=${record_num} (负数表示临时发货)`);
        isTemporaryShipment = true;
      } else if (record_num && need_num && need_num.trim() !== '' && record_num > 0) {
        console.log(`📋 使用前端传递的需求记录: record_num=${record_num}, need_num=${need_num}`);
        isTemporaryShipment = false;
      } else {
        console.log(`🔍 通过SKU和国家查找需求记录: ${sku} (${country})`);
        isTemporaryShipment = true; // 模拟找不到需求记录的情况
      }
      
      console.log(`📊 进入发货处理分支: ${isTemporaryShipment ? '临时发货分支' : '正常发货分支'}`);
      
      if (isTemporaryShipment) {
        console.log(`📦 创建临时发货记录: SKU ${sku} (${country}), 数量: ${quantity}`);
        
        // 使用系统生成的MANUAL开头的need_num，如果没有则生成一个
        let effectiveNeedNum;
        if (need_num && need_num.trim() !== '') {
          effectiveNeedNum = need_num;
        } else {
          effectiveNeedNum = `MANUAL-${Date.now()}`;
        }
        
        console.log(`🔍 临时发货need_num处理: 原值='${need_num}', 有效值='${effectiveNeedNum}' (MANUAL格式)`);
        
        // 模拟创建orderSummary
        const orderSummary = new Map();
        const orderSummaryData = {
          total_requested: Math.abs(quantity),
          total_shipped: Math.abs(quantity),
          items: [],
          is_temporary: true,
          manual_need_num: effectiveNeedNum,
          negative_record_num: record_num
        };
        
        console.log(`📋 临时发货关联记录: MANUAL需求单='${effectiveNeedNum}', 负数记录号=${record_num}, 数量=${Math.abs(quantity)}`);
        orderSummary.set(effectiveNeedNum, orderSummaryData);
        console.log(`✅ 已添加临时发货到orderSummary, 当前大小: ${orderSummary.size}`);
        
        // 模拟创建orderRelations
        const orderRelations = [];
        for (const [needNum, summary] of orderSummary) {
          const completionStatus = summary.total_shipped >= summary.total_requested ? '全部完成' : '部分完成';
          
          const relationRecord = {
            need_num: needNum,
            shipment_id: 999, // 模拟的shipment_id
            total_requested: summary.total_requested,
            total_shipped: summary.total_shipped,
            completion_status: completionStatus
          };
          
          orderRelations.push(relationRecord);
          console.log(`📦 添加临时发货关联记录: MANUAL需求单='${needNum}', 负数记录=${summary.negative_record_num || 'N/A'}, 数量=${summary.total_shipped}`);
        }
        
        console.log(`🔍 最终orderRelations数组长度: ${orderRelations.length}`);
        console.log(`📋 准备插入的orderRelations:`, JSON.stringify(orderRelations, null, 2));
        
        // 这里不实际插入数据库，只是模拟
        if (orderRelations.length > 0) {
          console.log(`✅ 模拟创建了 ${orderRelations.length} 条需求单发货关联记录`);
        } else {
          console.warn(`⚠️ orderRelations数组为空，没有创建任何order_shipment_relations记录！`);
        }
      }
    }
    
    console.log('\n🎉 调试完成！');
    
  } catch (error) {
    console.error('❌ 调试过程中发生错误:', error);
    console.error('错误详情:', error.message);
  } finally {
    await sequelize.close();
    console.log('🔐 数据库连接已关闭');
  }
}

// 运行调试
debugTempShipment(); 