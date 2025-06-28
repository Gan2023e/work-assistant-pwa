const express = require('express');
const router = express.Router();
const { WarehouseProductsNeed, LocalBox, AmzSkuMapping, sequelize, ShipmentRecord, ShipmentItem, OrderShipmentRelation } = require('../models/index');
const { Sequelize, Op } = require('sequelize');
const axios = require('axios');
const crypto = require('crypto');

// 钉钉通知函数
async function sendDingTalkNotification(message, atMobiles = []) {
  const webhookUrl = process.env.DINGTALK_WEBHOOK;
  const secretKey = process.env.SECRET_KEY;
  
  if (!webhookUrl) {
    console.log('⚠️ 钉钉Webhook未配置，跳过通知');
    return;
  }

  try {
    let url = webhookUrl;
    
    // 如果有签名密钥，生成签名
    if (secretKey) {
      const timestamp = Date.now();
      const stringToSign = `${timestamp}\n${secretKey}`;
      const sign = crypto
        .createHmac('sha256', secretKey)
        .update(stringToSign)
        .digest('base64');
      
      url += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
    }

    const data = {
      msgtype: 'text',
      text: {
        content: message
      },
      at: {
        atMobiles: atMobiles,
        isAtAll: false
      }
    };

    await axios.post(url, data);
    console.log('✅ 钉钉通知发送成功');
  } catch (error) {
    console.error('❌ 钉钉通知发送失败:', error.message);
  }
}

// 获取发货需求列表
router.get('/needs', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到发货需求查询请求:', JSON.stringify(req.query, null, 2));
  
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const whereCondition = {};
    if (status) {
      whereCondition.status = status;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    console.log('\x1b[35m%s\x1b[0m', '🔍 查询条件:', JSON.stringify({ whereCondition, offset, limit: parseInt(limit) }, null, 2));
    
    const { count, rows } = await WarehouseProductsNeed.findAndCountAll({
      where: whereCondition,
      order: [['record_num', 'DESC']],  // 改为按record_num排序，因为created_at字段不存在
      limit: parseInt(limit),
      offset: offset
    });

    console.log('\x1b[32m%s\x1b[0m', '📊 查询结果:', { count, rowsLength: rows.length });
    
    // 数据字段映射，将数据库字段映射为前端期望的字段
    const mappedRows = rows.map(row => ({
      record_num: row.record_num,
      need_num: row.need_num || '',
      sku: row.sku || '',
      quantity: row.ori_quantity || 0, // 使用ori_quantity映射到quantity
      shipping_method: row.shipping_method || '',
      marketplace: row.marketplace || '',
      country: row.country || '',
      status: row.status || '待发货',
      created_at: row.create_date || new Date().toISOString(), // 使用create_date作为创建时间
      updated_at: row.create_date || new Date().toISOString(),
      created_by: 'System', // 实际表中没有此字段
      remark: '', // 实际表中没有此字段
      send_out_date: row.send_out_date,
      expired_date: row.expired_date,
      expect_sold_out_date: row.expect_sold_out_date
    }));

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        list: mappedRows,  // 使用映射后的数据
        total: count,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取发货需求列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 获取库存统计
router.get('/inventory-stats', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到库存统计查询请求');
  
  try {
    // 查询所有库存数据
    const allData = await LocalBox.findAll({
      attributes: ['sku', 'country', 'mix_box_num', 'total_quantity', 'total_boxes'],
      raw: true
    });

    console.log('\x1b[33m%s\x1b[0m', '🔍 原始数据总数:', allData.length);

    // 按SKU和国家分组，分别计算整箱和混合箱数据
    const skuStats = {};
    
    allData.forEach(item => {
      const key = `${item.sku}_${item.country}`;
      
      if (!skuStats[key]) {
        skuStats[key] = {
          sku: item.sku || '',
          country: item.country || '',
          // 整箱数据（mix_box_num为空或null）
          whole_box_quantity: 0,
          whole_box_count: 0,
          // 混合箱数据（有mix_box_num）
          mixed_box_quantity: 0,
          mixed_box_numbers: new Set() // 用于统计不同的混合箱号
        };
      }
      
      const quantity = parseInt(item.total_quantity) || 0;
      const boxes = parseInt(item.total_boxes) || 0;
      
      if (!item.mix_box_num || item.mix_box_num.trim() === '') {
        // 整箱数据
        skuStats[key].whole_box_quantity += quantity;
        skuStats[key].whole_box_count += boxes;
      } else {
        // 混合箱数据
        skuStats[key].mixed_box_quantity += quantity;
        skuStats[key].mixed_box_numbers.add(item.mix_box_num);
      }
    });

    // 转换为数组格式，并过滤掉总数量为0的记录
    const formattedStats = Object.values(skuStats)
      .map(item => ({
        sku: item.sku,
        country: item.country,
        whole_box_quantity: item.whole_box_quantity,
        whole_box_count: item.whole_box_count,
        mixed_box_quantity: item.mixed_box_quantity,
        total_quantity: item.whole_box_quantity + item.mixed_box_quantity
      }))
      .filter(item => item.total_quantity !== 0); // 过滤掉总数量为0的记录

    console.log('\x1b[32m%s\x1b[0m', '📊 汇总后库存统计数量:', formattedStats.length);
    console.log('\x1b[35m%s\x1b[0m', '📊 统计详情（前5条）:', formattedStats.slice(0, 5));

    res.json({
      code: 0,
      message: '获取成功',
      data: formattedStats
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取库存统计失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 获取按国家汇总的库存数据（排除已发货状态的记录）
router.get('/inventory-by-country', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到按国家汇总库存查询请求');
  
  try {
    // 第一步：查询所有已发货的需求记录
    const shippedNeeds = await WarehouseProductsNeed.findAll({
      where: {
        status: '已发货'
      },
      attributes: ['sku', 'country'],
      raw: true
    });

    console.log('\x1b[33m%s\x1b[0m', '🔍 已发货需求数量:', shippedNeeds.length);

    // 创建已发货SKU的查找集合，用于快速排除
    const shippedSkuSet = new Set();
    shippedNeeds.forEach(need => {
      const key = `${need.sku}_${need.country}`;
      shippedSkuSet.add(key);
    });

    console.log('\x1b[33m%s\x1b[0m', '🔍 已发货SKU组合数量:', shippedSkuSet.size);

    // 第二步：查询所有库存数据
    const allInventory = await LocalBox.findAll({
      attributes: ['sku', 'country', 'mix_box_num', 'total_quantity', 'total_boxes'],
      raw: true
    });

    console.log('\x1b[33m%s\x1b[0m', '🔍 总库存记录数量:', allInventory.length);

    // 第三步：分别处理整箱和混合箱数据
    
    // 步骤3.1：处理整箱数据 - 按SKU+国家分组汇总
    const wholeBoxStats = {};
    
    allInventory.forEach(item => {
      // 只处理整箱数据（mix_box_num为空）
      if (item.mix_box_num && item.mix_box_num.trim() !== '') {
        return;
      }
      
      const skuKey = `${item.sku}_${item.country}`;
      
      // 跳过已发货的SKU
      if (shippedSkuSet.has(skuKey)) {
        console.log('\x1b[31m%s\x1b[0m', `🚫 跳过已发货整箱SKU: ${item.sku} (${item.country})`);
        return;
      }
      
      if (!wholeBoxStats[skuKey]) {
        wholeBoxStats[skuKey] = {
          sku: item.sku,
          country: item.country,
          quantity: 0,
          boxes: 0
        };
      }
      
      const quantity = parseInt(item.total_quantity) || 0;
      const boxes = parseInt(item.total_boxes) || 0;
      
      wholeBoxStats[skuKey].quantity += quantity;
      wholeBoxStats[skuKey].boxes += boxes;
    });

    // 步骤3.2：处理混合箱数据 - 先按混合箱号汇总，再筛选有效混合箱
    const mixedBoxStats = {};
    
    allInventory.forEach(item => {
      // 只处理混合箱数据（mix_box_num不为空）
      if (!item.mix_box_num || item.mix_box_num.trim() === '') {
        return;
      }
      
      const skuKey = `${item.sku}_${item.country}`;
      
      // 跳过已发货的SKU
      if (shippedSkuSet.has(skuKey)) {
        console.log('\x1b[31m%s\x1b[0m', `🚫 跳过已发货混合箱SKU: ${item.sku} (${item.country}) 混合箱:${item.mix_box_num}`);
        return;
      }
      
      // 按混合箱号+国家分组汇总
      const mixedBoxKey = `${item.mix_box_num}_${item.country}`;
      
      if (!mixedBoxStats[mixedBoxKey]) {
        mixedBoxStats[mixedBoxKey] = {
          mix_box_num: item.mix_box_num,
          country: item.country,
          total_quantity: 0
        };
      }
      
      const quantity = parseInt(item.total_quantity) || 0;
      mixedBoxStats[mixedBoxKey].total_quantity += quantity;
    });

    console.log('\x1b[33m%s\x1b[0m', '🔍 整箱SKU统计:', Object.keys(wholeBoxStats).length);
    console.log('\x1b[33m%s\x1b[0m', '🔍 混合箱统计:', Object.keys(mixedBoxStats).length);

    // 步骤3.3：筛选有效的混合箱（汇总后数量大于0）
    const validMixedBoxes = Object.values(mixedBoxStats).filter(box => box.total_quantity > 0);
    console.log('\x1b[33m%s\x1b[0m', '🔍 有效混合箱数量:', validMixedBoxes.length);

    // 步骤3.4：按国家汇总数据
    const countryStats = {};
    
    // 汇总整箱数据
    Object.values(wholeBoxStats).forEach(stat => {
      if (stat.quantity <= 0) {
        console.log('\x1b[31m%s\x1b[0m', `🚫 跳过数量为${stat.quantity}的整箱SKU: ${stat.sku} (${stat.country})`);
        return;
      }
      
      if (!countryStats[stat.country]) {
        countryStats[stat.country] = {
          country: stat.country,
          whole_box_quantity: 0,
          whole_box_count: 0,
          mixed_box_quantity: 0,
          valid_mixed_boxes: 0,
          total_quantity: 0
        };
      }
      
      countryStats[stat.country].whole_box_quantity += stat.quantity;
      countryStats[stat.country].whole_box_count += stat.boxes;
      countryStats[stat.country].total_quantity += stat.quantity;
    });
    
    // 汇总混合箱数据
    validMixedBoxes.forEach(box => {
      if (!countryStats[box.country]) {
        countryStats[box.country] = {
          country: box.country,
          whole_box_quantity: 0,
          whole_box_count: 0,
          mixed_box_quantity: 0,
          valid_mixed_boxes: 0,
          total_quantity: 0
        };
      }
      
      countryStats[box.country].mixed_box_quantity += box.total_quantity;
      countryStats[box.country].valid_mixed_boxes += 1; // 每个有效混合箱计数+1
      countryStats[box.country].total_quantity += box.total_quantity;
    });

    // 第四步：格式化并过滤数据
    const formattedData = Object.values(countryStats)
      .map(item => ({
        country: item.country || '未知',
        whole_box_quantity: item.whole_box_quantity,
        whole_box_count: item.whole_box_count,
        mixed_box_quantity: item.mixed_box_quantity,
        mixed_box_count: item.valid_mixed_boxes, // 混合箱数量 = 有效混合箱的数量
        total_quantity: item.total_quantity
      }))
      .filter(item => item.total_quantity > 0) // 确保总数量大于0
      .sort((a, b) => b.total_quantity - a.total_quantity); // 按总数量降序排列

    console.log('\x1b[32m%s\x1b[0m', '📊 格式化后国家库存数据（排除已发货）:', formattedData.length);
    console.log('\x1b[35m%s\x1b[0m', '📊 详细国家统计结果:', formattedData.map(item => 
      `${item.country}: 整箱${item.whole_box_count}箱${item.whole_box_quantity}件, 混合箱${item.mixed_box_count}箱${item.mixed_box_quantity}件, 总计${item.total_quantity}件`
    ));
    
    // 额外的调试信息：显示有效混合箱的详细信息
    console.log('\x1b[36m%s\x1b[0m', '📦 有效混合箱详情:', validMixedBoxes.map(box => 
      `${box.mix_box_num}(${box.country}): ${box.total_quantity}件`
    ));

    res.json({
      code: 0,
      message: '获取成功',
      data: formattedData
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取按国家汇总库存失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 获取混合箱和整箱数据
router.post('/mixed-boxes', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到混合箱数据查询请求:', JSON.stringify(req.body, null, 2));
  
  try {
    const { records } = req.body;
    
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '记录数据不能为空'
      });
    }

    // 收集所有sku和country的组合
    const skuCountryPairs = records.map(record => ({
      sku: record.local_sku || record.amz_sku, // 优先使用local_sku，如果没有则使用amz_sku
      country: record.country,
      original_record: record // 保存原始记录以便后续使用
    }));

    if (skuCountryPairs.length === 0) {
      return res.json({
        code: 0,
        message: '没有可处理的SKU数据',
        data: {
          mixed_boxes: [],
          whole_boxes: []
        }
      });
    }

    // 构建查询条件
    const whereConditions = skuCountryPairs.map(pair => ({
      sku: pair.sku,
      country: pair.country
    }));

    // 查询库存数据
    const inventoryData = await LocalBox.findAll({
      where: {
        [Op.or]: whereConditions
      },
      attributes: ['sku', 'country', 'mix_box_num', 'total_quantity', 'total_boxes'],
      raw: true
    });

    console.log('\x1b[33m%s\x1b[0m', '🔍 查询到的库存数据:', inventoryData.length);

    // 第一步：找到选中记录对应的混合箱号
    const selectedMixedBoxNums = new Set();
    inventoryData.forEach(item => {
      if (item.mix_box_num && item.mix_box_num.trim() !== '') {
        // 检查这个SKU是否在选中的记录中
        const correspondingRecord = records.find(r => 
          (r.local_sku === item.sku || r.amz_sku === item.sku) && r.country === item.country
        );
        
        if (correspondingRecord) {
          selectedMixedBoxNums.add(item.mix_box_num);
        }
      }
    });

    console.log('\x1b[33m%s\x1b[0m', '🔍 选中的混合箱号:', Array.from(selectedMixedBoxNums));

    // 第二步：查询这些混合箱号下的所有SKU
    let allMixedBoxData = [];
    if (selectedMixedBoxNums.size > 0) {
      const allMixedBoxItems = await LocalBox.findAll({
        where: {
          mix_box_num: {
            [Op.in]: Array.from(selectedMixedBoxNums)
          }
        },
        attributes: ['sku', 'country', 'mix_box_num', 'total_quantity'],
        raw: true
      });

      console.log('\x1b[33m%s\x1b[0m', '🔍 混合箱内所有SKU数据:', allMixedBoxItems.length);

      // 批量查询所有需要的SKU映射关系（性能优化）
      const skuMappingConditions = allMixedBoxItems.map(item => ({
        local_sku: item.sku,
        country: item.country
      }));
      
      let allMappings = [];
      if (skuMappingConditions.length > 0) {
        try {
          allMappings = await AmzSkuMapping.findAll({
            where: {
              [Op.or]: skuMappingConditions
            },
            attributes: ['local_sku', 'country', 'amz_sku'],
            raw: true
          });
          console.log('\x1b[33m%s\x1b[0m', '🔍 批量查询到的映射关系:', allMappings.length);
        } catch (mappingError) {
          console.log('\x1b[33m%s\x1b[0m', '⚠️ 批量查找映射失败:', mappingError.message);
        }
      }
      
      // 创建映射关系的快速查找表
      const mappingMap = new Map();
      allMappings.forEach(mapping => {
        const key = `${mapping.local_sku}_${mapping.country}`;
        mappingMap.set(key, mapping.amz_sku);
      });

      // 按SKU+混合箱号分组汇总数量（关键优化：过滤已出库的SKU）
      const skuSummaryMap = new Map();
      allMixedBoxItems.forEach(item => {
        const summaryKey = `${item.sku}_${item.country}_${item.mix_box_num}`;
        const quantity = parseInt(item.total_quantity) || 0;
        
        if (skuSummaryMap.has(summaryKey)) {
          skuSummaryMap.set(summaryKey, skuSummaryMap.get(summaryKey) + quantity);
        } else {
          skuSummaryMap.set(summaryKey, quantity);
        }
      });

      console.log('\x1b[33m%s\x1b[0m', '🔍 SKU汇总后数据:', skuSummaryMap.size);

      // 只处理汇总后数量大于0的SKU（过滤掉已完全出库的SKU）
      skuSummaryMap.forEach((totalQuantity, summaryKey) => {
        if (totalQuantity > 0) { // 只处理库存为正的SKU
          const [sku, country, mixBoxNum] = summaryKey.split('_');
          const mappingKey = `${sku}_${country}`;
          const amazonSku = mappingMap.get(mappingKey) || sku;

          allMixedBoxData.push({
            box_num: mixBoxNum,
            sku: sku,
            amz_sku: amazonSku,
            quantity: totalQuantity
          });
        } else {
          // 记录已出库的SKU
          const [sku, country, mixBoxNum] = summaryKey.split('_');
          console.log('\x1b[31m%s\x1b[0m', `🚫 已完全出库的SKU: ${sku} (混合箱: ${mixBoxNum}, 汇总数量: ${totalQuantity})`);
        }
      });
    }

    // 第三步：处理整箱数据（仅选中的记录，并过滤已出库的SKU）
    const wholeBoxData = {};
    inventoryData.forEach(item => {
      if (!item.mix_box_num || item.mix_box_num.trim() === '') {
        // 整箱数据
        const correspondingRecord = records.find(r => 
          (r.local_sku === item.sku || r.amz_sku === item.sku) && r.country === item.country
        );
        
        if (correspondingRecord) {
          const key = `${item.sku}_${item.country}`;
          if (!wholeBoxData[key]) {
            wholeBoxData[key] = {
              amz_sku: correspondingRecord.amz_sku || item.sku,
              local_sku: item.sku,
              country: item.country,
              total_quantity: 0,
              total_boxes: 0
            };
          }
          
          wholeBoxData[key].total_quantity += parseInt(item.total_quantity) || 0;
          wholeBoxData[key].total_boxes += parseInt(item.total_boxes) || 0;
        }
      }
    });

    // 过滤掉已完全出库的整箱SKU（数量小于等于0的）
    const wholeBoxArray = Object.values(wholeBoxData).filter(item => {
      if (item.total_quantity > 0) {
        return true;
      } else {
        console.log('\x1b[31m%s\x1b[0m', `🚫 已完全出库的整箱SKU: ${item.local_sku} (汇总数量: ${item.total_quantity})`);
        return false;
      }
    });

    console.log('\x1b[32m%s\x1b[0m', '📊 混合箱数据数量:', allMixedBoxData.length);
    console.log('\x1b[32m%s\x1b[0m', '📊 整箱数据数量:', wholeBoxArray.length);

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        mixed_boxes: allMixedBoxData,
        whole_boxes: wholeBoxArray
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取混合箱数据失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 创建发货需求
router.post('/needs', async (req, res) => {
  try {
    const { needs, created_by } = req.body;
    
    if (!needs || !Array.isArray(needs) || needs.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '需求数据不能为空'
      });
    }

    // 生成需求单号（时间戳）
    const need_num = Date.now().toString();
    
    // 批量创建需求
    const createdNeeds = await Promise.all(
      needs.map(need => 
        WarehouseProductsNeed.create({
          ...need,
          need_num,
          created_by: created_by || '系统'
        })
      )
    );

    // 发送钉钉通知
    const mobileNumMom = process.env.MOBILE_NUM_MOM;
    if (mobileNumMom) {
      const message = `新增发货需求 ${needs.length} 个SKU，需求单号：${need_num}`;
      await sendDingTalkNotification(message, [mobileNumMom]);
    }

    res.json({
      code: 0,
      message: '创建成功',
      data: createdNeeds
    });
  } catch (error) {
    console.error('创建发货需求失败:', error);
    res.status(500).json({
      code: 1,
      message: '创建失败',
      error: error.message
    });
  }
});

// 更新发货需求
router.put('/needs/:id', async (req, res) => {
  try {
    const [updated] = await WarehouseProductsNeed.update(req.body, {
      where: { record_num: req.params.id }
    });
    
    if (updated) {
      const need = await WarehouseProductsNeed.findByPk(req.params.id);
      res.json({
        code: 0,
        message: '更新成功',
        data: need
      });
    } else {
      res.status(404).json({
        code: 1,
        message: '需求不存在'
      });
    }
  } catch (error) {
    console.error('更新发货需求失败:', error);
    res.status(500).json({
      code: 1,
      message: '更新失败',
      error: error.message
    });
  }
});

// 删除发货需求
router.delete('/needs/:id', async (req, res) => {
  try {
    const deleted = await WarehouseProductsNeed.destroy({
      where: { record_num: req.params.id }
    });
    
    if (deleted) {
      res.json({
        code: 0,
        message: '删除成功'
      });
    } else {
      res.status(404).json({
        code: 1,
        message: '需求不存在'
      });
    }
  } catch (error) {
    console.error('删除发货需求失败:', error);
    res.status(500).json({
      code: 1,
      message: '删除失败',
      error: error.message
    });
  }
});

// 批量更新需求状态
router.put('/needs/batch-status', async (req, res) => {
  try {
    const { ids, status } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        code: 1,
        message: 'ID列表不能为空'
      });
    }

    const [updated] = await WarehouseProductsNeed.update(
      { status },
      { where: { record_num: ids } }
    );
    
    res.json({
      code: 0,
      message: `批量更新成功，影响 ${updated} 条记录`,
      data: { updated }
    });
  } catch (error) {
    console.error('批量更新状态失败:', error);
    res.status(500).json({
      code: 1,
      message: '批量更新失败',
      error: error.message
    });
  }
});

// 健康检查和测试端点
router.get('/health', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 发货需求模块健康检查');
  
  try {
    // 检查数据表是否存在
    await WarehouseProductsNeed.describe();
    await LocalBox.describe();
    await AmzSkuMapping.describe();
    
    // 检查数据表记录数
    const needsCount = await WarehouseProductsNeed.count();
    const localBoxCount = await LocalBox.count();
    const mappingCount = await AmzSkuMapping.count();
    
    // 获取一些示例数据用于调试
    const sampleNeeds = await WarehouseProductsNeed.findAll({
      limit: 3,
      attributes: ['sku', 'country', 'status'],
      raw: true
    });
    
    const sampleMappings = await AmzSkuMapping.findAll({
      limit: 5,
      attributes: ['amz_sku', 'country', 'local_sku'],
      raw: true
    });
    
    console.log('\x1b[32m%s\x1b[0m', '📊 数据表状态:', {
      pbi_warehouse_products_need: `${needsCount} 条记录`,
      local_boxes: `${localBoxCount} 条记录`,
      pbi_amzsku_sku: `${mappingCount} 条记录`
    });
    
    console.log('\x1b[33m%s\x1b[0m', '📋 示例发货需求SKU:', sampleNeeds.map(n => n.sku));
    console.log('\x1b[33m%s\x1b[0m', '📋 示例SKU映射:', sampleMappings.map(m => `${m.amz_sku}->${m.local_sku}`));
    
    res.json({
      code: 0,
      message: '发货需求模块运行正常',
      data: {
        tables: {
          pbi_warehouse_products_need: {
            exists: true,
            count: needsCount
          },
          local_boxes: {
            exists: true,
            count: localBoxCount
          },
          pbi_amzsku_sku: {
            exists: true,
            count: mappingCount
          }
        },
        samples: {
          needs: sampleNeeds,
          mappings: sampleMappings
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 发货需求模块健康检查失败:', error);
    
    res.status(500).json({
      code: 1,
      message: '发货需求模块异常',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 获取合并的发货需求和库存数据
router.get('/merged-data', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到合并数据查询请求 - 优化映射流程');
  
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    // 优化的映射流程：
    // 1. 先获取库存统计数据（去重获取唯一的 sku + country 组合）
    // 2. 通过库存 SKU + country 在映射表中查找对应的 Amazon SKU
    // 3. 使用找到的 Amazon SKU 与发货需求进行匹配
    // 4. 保留所有发货需求记录，同时也保留有库存但无需求的记录
    
    console.log('\x1b[33m%s\x1b[0m', '🔄 步骤1: 获取库存统计数据');
    
    // 1. 获取库存统计数据 (按 sku + country 分组)
    const inventoryStats = await LocalBox.findAll({
      attributes: [
        'sku',
        'country',
        [sequelize.fn('SUM', 
          sequelize.literal(`CASE WHEN mix_box_num IS NULL OR mix_box_num = '' THEN total_quantity ELSE 0 END`)
        ), 'whole_box_quantity'],
        [sequelize.fn('SUM', 
          sequelize.literal(`CASE WHEN mix_box_num IS NULL OR mix_box_num = '' THEN total_boxes ELSE 0 END`)
        ), 'whole_box_count'],
        [sequelize.fn('SUM', 
          sequelize.literal(`CASE WHEN mix_box_num IS NOT NULL AND mix_box_num != '' THEN total_quantity ELSE 0 END`)
        ), 'mixed_box_quantity'],
        [sequelize.fn('SUM', sequelize.col('total_quantity')), 'total_quantity']
      ],
      group: ['sku', 'country'],
      having: sequelize.literal('SUM(total_quantity) != 0'), // 过滤掉零库存
      raw: true
    });

    console.log('\x1b[33m%s\x1b[0m', `📦 库存统计数据: ${inventoryStats.length} 条`, 
      inventoryStats.slice(0, 3).map(i => `${i.sku}(${i.country}): ${i.total_quantity}`));

    console.log('\x1b[33m%s\x1b[0m', '🔄 步骤2: 查找库存对应的Amazon SKU映射');
    
    // 2. 对每个库存记录，查找对应的 Amazon SKU（处理多个结果的优先级选择）
    const inventoryWithAmzSku = await Promise.all(
      inventoryStats.map(async (inventory) => {
        try {
          // 查找所有匹配的映射记录
          const skuMappings = await AmzSkuMapping.findAll({
            where: {
              local_sku: inventory.sku,
              country: inventory.country
            },
            raw: true
          });

          console.log('\x1b[36m%s\x1b[0m', `🔍 库存${inventory.sku}(${inventory.country})找到${skuMappings.length}个映射:`, 
            skuMappings.map(m => m.amz_sku));

          let selectedMapping = null;

          if (skuMappings.length > 0) {
            // 优先选择有特定前缀的记录
            const priorityPrefixes = ['SF', 'FBA', 'NA', 'AU', 'UW'];
            
            // 查找有优先前缀的映射
            const priorityMappings = skuMappings.filter(mapping => {
              const amzSku = mapping.amz_sku || '';
              return priorityPrefixes.some(prefix => amzSku.startsWith(prefix));
            });

            if (priorityMappings.length > 0) {
              // 如果有多个优先级映射，选择第一个
              selectedMapping = priorityMappings[0];
              console.log('\x1b[32m%s\x1b[0m', `✅ 选择优先前缀映射: ${selectedMapping.amz_sku}`);
            } else {
              // 如果没有优先前缀，选择第一个可用的
              selectedMapping = skuMappings[0];
              console.log('\x1b[33m%s\x1b[0m', `⚠️ 选择普通映射: ${selectedMapping.amz_sku}`);
            }
          }

          return {
            local_sku: inventory.sku,
            country: inventory.country,
            amz_sku: selectedMapping?.amz_sku || null,
            whole_box_quantity: parseInt(inventory.whole_box_quantity) || 0,
            whole_box_count: parseInt(inventory.whole_box_count) || 0,
            mixed_box_quantity: parseInt(inventory.mixed_box_quantity) || 0,
            total_available: parseInt(inventory.total_quantity) || 0,
            mapping_info: {
              total_mappings: skuMappings.length,
              selected_mapping: selectedMapping,
              all_mappings: skuMappings
            }
          };
        } catch (error) {
          console.error(`处理库存映射失败 ${inventory.sku}:`, error);
          return {
            local_sku: inventory.sku,
            country: inventory.country,
            amz_sku: null,
            whole_box_quantity: parseInt(inventory.whole_box_quantity) || 0,
            whole_box_count: parseInt(inventory.whole_box_count) || 0,
            mixed_box_quantity: parseInt(inventory.mixed_box_quantity) || 0,
            total_available: parseInt(inventory.total_quantity) || 0,
            mapping_info: {
              total_mappings: 0,
              selected_mapping: null,
              all_mappings: []
            }
          };
        }
      })
    );

    // 统计映射情况
    const mappingStats = {
      总库存记录: inventoryWithAmzSku.length,
      有映射记录: inventoryWithAmzSku.filter(i => i.amz_sku).length,
      无映射记录: inventoryWithAmzSku.filter(i => !i.amz_sku).length,
      优先前缀映射: 0,
      普通映射: 0,
      多映射记录: 0
    };

    inventoryWithAmzSku.forEach(inv => {
      if (inv.mapping_info && inv.mapping_info.total_mappings > 0) {
        const amzSku = inv.amz_sku || '';
        const priorityPrefixes = ['SF', 'FBA', 'NA', 'AU'];
        const hasPriorityPrefix = priorityPrefixes.some(prefix => amzSku.startsWith(prefix));
        
        if (hasPriorityPrefix) {
          mappingStats.优先前缀映射++;
        } else {
          mappingStats.普通映射++;
        }
        
        if (inv.mapping_info.total_mappings > 1) {
          mappingStats.多映射记录++;
        }
      }
    });

    console.log('\x1b[33m%s\x1b[0m', '🔗 映射统计完成:', mappingStats);

    console.log('\x1b[33m%s\x1b[0m', '🔄 步骤3: 获取发货需求数据');
    
    // 3. 获取发货需求数据
    const whereCondition = {};
    if (status) {
      whereCondition.status = status;
    }

    const { count, rows: needsData } = await WarehouseProductsNeed.findAndCountAll({
      where: whereCondition,
      order: [['record_num', 'DESC']],
      limit: parseInt(limit) === 1000 ? undefined : parseInt(limit), // 如果是1000，表示要全部数据
      offset: parseInt(limit) === 1000 ? undefined : (parseInt(page) - 1) * parseInt(limit)
    });

    console.log('\x1b[33m%s\x1b[0m', `📋 发货需求数据: ${needsData.length} 条`);

    console.log('\x1b[33m%s\x1b[0m', '🔄 步骤4: 合并发货需求和库存数据');
    
    // 4. 创建一个 Map 来快速查找库存信息
    const inventoryMap = new Map();
    inventoryWithAmzSku.forEach(inv => {
      if (inv.amz_sku) {
        const key = `${inv.amz_sku}_${inv.country}`;
        inventoryMap.set(key, inv);
      }
    });

    // 5. 处理发货需求，与库存信息合并
    const mergedFromNeeds = needsData.map(need => {
      const key = `${need.sku}_${need.country}`;
      const inventoryInfo = inventoryMap.get(key) || {
        local_sku: '',
        whole_box_quantity: 0,
        whole_box_count: 0,
        mixed_box_quantity: 0,
        total_available: 0
      };

      return {
        record_num: need.record_num,
        need_num: need.need_num || '',
        amz_sku: need.sku || '',
        local_sku: inventoryInfo.local_sku,
        quantity: need.ori_quantity || 0,
        shipping_method: need.shipping_method || '',
        marketplace: need.marketplace || '',
        country: need.country || '',
        status: need.status || '待发货',
        created_at: need.create_date || new Date().toISOString(),
        // 库存信息
        whole_box_quantity: inventoryInfo.whole_box_quantity,
        whole_box_count: inventoryInfo.whole_box_count,
        mixed_box_quantity: inventoryInfo.mixed_box_quantity,
        total_available: inventoryInfo.total_available,
        // 计算缺货情况
        shortage: Math.max(0, (need.ori_quantity || 0) - inventoryInfo.total_available),
        data_source: 'need' // 标记数据来源
      };
    });

    // 6. 处理有库存但无需求的记录
    const needsAmzSkuSet = new Set(needsData.map(need => `${need.sku}_${need.country}`));
    const inventoryOnlyRecords = inventoryWithAmzSku
      .filter(inv => inv.amz_sku && !needsAmzSkuSet.has(`${inv.amz_sku}_${inv.country}`))
      .map((inv, index) => ({
        record_num: -1 - index, // 使用负数作为临时ID
        need_num: '',
        amz_sku: inv.amz_sku,
        local_sku: inv.local_sku,
        quantity: 0,
        shipping_method: '',
        marketplace: '',
        country: inv.country,
        status: '有库存无需求',
        created_at: new Date().toISOString(),
        // 库存信息
        whole_box_quantity: inv.whole_box_quantity,
        whole_box_count: inv.whole_box_count,
        mixed_box_quantity: inv.mixed_box_quantity,
        total_available: inv.total_available,
        shortage: 0, // 无需求，所以无缺货
        data_source: 'inventory' // 标记数据来源
      }));

    // 7. 检测库存中没有映射的记录
    const unmappedInventory = inventoryWithAmzSku.filter(inv => !inv.amz_sku && inv.total_available > 0);
    
    console.log('\x1b[31m%s\x1b[0m', '⚠️ 发现未映射的库存记录:', unmappedInventory.length);
    if (unmappedInventory.length > 0) {
      console.log('\x1b[31m%s\x1b[0m', '📋 未映射记录详情:', unmappedInventory.slice(0, 5));
    }

    // 8. 为未映射的库存创建记录显示在表格中
    const unmappedRecords = unmappedInventory.map((inv, index) => ({
      record_num: -1000 - index, // 使用更小的负数作为临时ID
      need_num: '',
      amz_sku: '', // 空的，表示未映射
      local_sku: inv.local_sku,
      quantity: 0,
      shipping_method: '',
      marketplace: '',
      country: inv.country,
      status: '库存未映射',
      created_at: new Date().toISOString(),
      // 库存信息
      whole_box_quantity: inv.whole_box_quantity,
      whole_box_count: inv.whole_box_count,
      mixed_box_quantity: inv.mixed_box_quantity,
      total_available: inv.total_available,
      shortage: 0,
      data_source: 'unmapped_inventory' // 标记为未映射库存
    }));

    // 9. 合并所有数据
    const allMergedData = [...mergedFromNeeds, ...inventoryOnlyRecords, ...unmappedRecords];

    console.log('\x1b[35m%s\x1b[0m', '📊 合并完成统计:', {
      发货需求记录: mergedFromNeeds.length,
      仅库存记录: inventoryOnlyRecords.length,
      未映射库存记录: unmappedRecords.length,
      总计: allMergedData.length,
      有映射需求: mergedFromNeeds.filter(r => r.local_sku).length,
      无映射需求: mergedFromNeeds.filter(r => !r.local_sku).length
    });

    console.log('\x1b[35m%s\x1b[0m', '📊 合并数据示例（前3条）:', allMergedData.slice(0, 3));

    res.json({
      code: 0,
      message: '获取成功',
      data: {
        list: allMergedData,
        total: allMergedData.length, // 注意：这里返回实际合并后的总数
        page: parseInt(page),
        limit: parseInt(limit),
        unmapped_inventory: unmappedInventory, // 返回未映射的库存记录
        summary: {
          需求记录数: mergedFromNeeds.length,
          库存记录数: inventoryOnlyRecords.length,
          未映射库存记录: unmappedRecords.length,
          总记录数: allMergedData.length,
          有映射需求: mergedFromNeeds.filter(r => r.local_sku).length,
          无映射需求: mergedFromNeeds.filter(r => !r.local_sku).length
        }
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取合并数据失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// 调试映射流程端点
router.get('/debug-mapping', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔧 开始调试映射流程');
  
  try {
    // 步骤1: 获取少量库存数据进行调试
    const inventoryData = await LocalBox.findAll({
      limit: 5,
      raw: true
    });
    
    console.log('\x1b[33m%s\x1b[0m', '📦 原始库存数据样例:', inventoryData);

    // 步骤2: 获取映射表数据
    const mappingData = await AmzSkuMapping.findAll({
      limit: 10,
      raw: true
    });
    
    console.log('\x1b[33m%s\x1b[0m', '🔗 映射表数据样例:', mappingData);

    // 步骤3: 获取发货需求数据
    const needsData = await WarehouseProductsNeed.findAll({
      limit: 5,
      raw: true
    });
    
    console.log('\x1b[33m%s\x1b[0m', '📋 发货需求数据样例:', needsData);

    // 步骤4: 测试库存统计查询
    const inventoryStats = await LocalBox.findAll({
      attributes: [
        'sku',
        'country',
        [sequelize.fn('SUM', 
          sequelize.literal(`CASE WHEN mix_box_num IS NULL OR mix_box_num = '' THEN total_quantity ELSE 0 END`)
        ), 'whole_box_quantity'],
        [sequelize.fn('SUM', 
          sequelize.literal(`CASE WHEN mix_box_num IS NULL OR mix_box_num = '' THEN total_boxes ELSE 0 END`)
        ), 'whole_box_count'],
        [sequelize.fn('SUM', 
          sequelize.literal(`CASE WHEN mix_box_num IS NOT NULL AND mix_box_num != '' THEN total_quantity ELSE 0 END`)
        ), 'mixed_box_quantity'],
        [sequelize.fn('SUM', sequelize.col('total_quantity')), 'total_quantity']
      ],
      group: ['sku', 'country'],
      limit: 5,
      raw: true
    });

    console.log('\x1b[33m%s\x1b[0m', '📊 库存统计查询结果:', inventoryStats);

    // 步骤5: 测试映射查询（包含优先级选择逻辑）
    const mappingTests = [];
    for (const inv of inventoryStats.slice(0, 3)) {
      const mappings = await AmzSkuMapping.findAll({
        where: {
          local_sku: inv.sku,
          country: inv.country
        },
        raw: true
      });
      
      let selectedMapping = null;
      let selectionReason = '未找到';

      if (mappings.length > 0) {
        const priorityPrefixes = ['SF', 'FBA', 'NA', 'AU'];
        
        const priorityMappings = mappings.filter(mapping => {
          const amzSku = mapping.amz_sku || '';
          return priorityPrefixes.some(prefix => amzSku.startsWith(prefix));
        });

        if (priorityMappings.length > 0) {
          selectedMapping = priorityMappings[0];
          selectionReason = `优先前缀选择(${priorityMappings.length}个优先/${mappings.length}个总数)`;
        } else {
          selectedMapping = mappings[0];
          selectionReason = `普通选择(${mappings.length}个总数，无优先前缀)`;
        }
      }
      
      mappingTests.push({
        库存SKU: inv.sku,
        国家: inv.country,
        所有映射: mappings,
        选择的映射: selectedMapping,
        选择原因: selectionReason,
        Amazon_SKU: selectedMapping?.amz_sku || '未找到'
      });
    }

    console.log('\x1b[35m%s\x1b[0m', '🔍 映射查询测试结果:', mappingTests);

    // 步骤6: 测试反向映射（从Amazon SKU到本地SKU）
    const reverseMappingTests = [];
    for (const need of needsData.slice(0, 3)) {
      const mapping = await AmzSkuMapping.findOne({
        where: {
          amz_sku: need.sku,
          country: need.country
        },
        raw: true
      });
      
      reverseMappingTests.push({
        需求Amazon_SKU: need.sku,
        国家: need.country,
        查找到的映射: mapping,
        本地SKU: mapping?.local_sku || '未找到'
      });
    }

    console.log('\x1b[35m%s\x1b[0m', '🔄 反向映射测试结果:', reverseMappingTests);

    // 步骤7: 分析问题
    const problemAnalysis = {
      映射表是否为空: mappingData.length === 0,
      库存数据字段检查: inventoryData.length > 0 ? Object.keys(inventoryData[0]) : [],
      映射表字段检查: mappingData.length > 0 ? Object.keys(mappingData[0]) : [],
      需求数据字段检查: needsData.length > 0 ? Object.keys(needsData[0]) : [],
      常见问题分析: []
    };

    // 检查常见问题
    if (mappingData.length === 0) {
      problemAnalysis.常见问题分析.push('❌ 映射表为空，需要先创建SKU映射数据');
    }
    
    if (inventoryStats.length === 0) {
      problemAnalysis.常见问题分析.push('❌ 库存统计结果为空，检查库存表数据');
    }
    
    if (mappingTests.filter(t => t.Amazon_SKU !== '未找到').length === 0) {
      problemAnalysis.常见问题分析.push('❌ 正向映射全部失败，检查映射表local_sku字段是否与库存表sku字段匹配');
    }
    
    if (reverseMappingTests.filter(t => t.本地SKU !== '未找到').length === 0) {
      problemAnalysis.常见问题分析.push('❌ 反向映射全部失败，检查映射表amz_sku字段是否与需求表sku字段匹配');
    }

    // 字段名检查
    if (inventoryData.length > 0 && !inventoryData[0].hasOwnProperty('sku')) {
      problemAnalysis.常见问题分析.push('❌ 库存表缺少sku字段');
    }
    
    if (inventoryData.length > 0 && !inventoryData[0].hasOwnProperty('country')) {
      problemAnalysis.常见问题分析.push('❌ 库存表缺少country字段');
    }

    console.log('\x1b[31m%s\x1b[0m', '🚨 问题分析:', problemAnalysis);

    res.json({
      code: 0,
      message: '映射调试完成',
      data: {
        库存原始数据: inventoryData,
        映射表数据: mappingData,
        发货需求数据: needsData,
        库存统计查询: inventoryStats,
        正向映射测试: mappingTests,
        反向映射测试: reverseMappingTests,
        问题分析: problemAnalysis,
        分析: {
          库存表记录数: inventoryData.length,
          映射表记录数: mappingData.length,
          需求表记录数: needsData.length,
          库存统计结果数: inventoryStats.length,
          映射成功数: mappingTests.filter(t => t.Amazon_SKU !== '未找到').length,
          反向映射成功数: reverseMappingTests.filter(t => t.本地SKU !== '未找到').length
        },
        详细映射步骤说明: {
          步骤1: '从库存表(local_boxes)获取数据，按sku+country分组统计',
          步骤2: '对每个库存记录，在映射表(pbi_amzsku_sku)中查找：local_sku=库存sku AND country=库存country',
          步骤3: '如果找到映射，获取对应的amz_sku',
          步骤4: '从发货需求表获取数据',
          步骤5: '创建映射Map，key为"amz_sku_country"，value为库存信息',
          步骤6: '遍历发货需求，用"需求sku_需求country"作为key在Map中查找对应库存',
          问题可能原因: [
            '映射表数据不存在或不完整',
            'SKU字段名称不匹配（大小写、特殊字符）',
            '国家代码格式不一致（US vs USA, UK vs GB等）',
            '数据类型不匹配（字符串vs数字）',
            '空值或null值处理问题'
          ]
        }
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 映射调试失败:', error);
    res.status(500).json({
      code: 1,
      message: '调试失败',
      error: error.message
    });
  }
});

// 创建测试数据端点（仅用于测试）
router.post('/create-test-data', async (req, res) => {
  console.log('\x1b[33m%s\x1b[0m', '⚠️  创建测试数据请求');
  
  try {
    // 1. 获取现有的发货需求数据，为其创建SKU映射
    const existingNeeds = await WarehouseProductsNeed.findAll({
      attributes: ['sku', 'country'],
      group: ['sku', 'country'],
      raw: true
    });

    console.log('\x1b[33m%s\x1b[0m', '📋 现有发货需求SKU:', existingNeeds);

    // 2. 为现有的Amazon SKU创建映射到本地SKU
    const testMappings = existingNeeds.map((need, index) => ({
      amz_sku: need.sku,
      site: 'Amazon.com',
      country: need.country,
      local_sku: `LOCAL-${need.sku.substr(-4)}-${need.country}`, // 生成对应的本地SKU
      update_time: new Date()
    }));

    // 3. 添加一些额外的测试映射
    testMappings.push(
      {
        amz_sku: 'AMZ-TEST-001',
        site: 'Amazon.com',
        country: 'US',
        local_sku: 'LOCAL-001',
        update_time: new Date()
      },
      {
        amz_sku: 'AMZ-TEST-002',
        site: 'Amazon.co.uk',
        country: 'UK',
        local_sku: 'LOCAL-002',
        update_time: new Date()
      }
    );

    await AmzSkuMapping.bulkCreate(testMappings, {
      ignoreDuplicates: true
    });

    // 2. 创建一些测试发货需求数据（使用映射的Amazon SKU）
    const testNeeds = [
      {
        need_num: `NEED-${Date.now()}`,
        create_date: new Date(),
        sku: 'AMZ-TEST-001',
        ori_quantity: 100,
        shipping_method: '空运',
        marketplace: 'Amazon',
        country: 'US',
        status: '待发货'
      },
      {
        need_num: `NEED-${Date.now() + 1}`,
        create_date: new Date(),
        sku: 'AMZ-TEST-002',
        ori_quantity: 50,
        shipping_method: '海运',
        marketplace: 'Amazon',
        country: 'UK',
        status: '待发货'
      },
      {
        need_num: `NEED-${Date.now() + 2}`,
        create_date: new Date(),
        sku: 'AMZ-TEST-003',
        ori_quantity: 75,
        shipping_method: '快递',
        marketplace: 'Amazon',
        country: 'DE',
        status: '待发货'
      },
      {
        need_num: `NEED-${Date.now() + 3}`,
        create_date: new Date(),
        sku: 'UNMAPPED-SKU',
        ori_quantity: 30,
        shipping_method: '空运',
        marketplace: 'eBay',
        country: 'US',
        status: '待发货'
      }
    ];
    
    const createdNeeds = await WarehouseProductsNeed.bulkCreate(testNeeds);

    // 4. 为映射的本地SKU创建对应的库存数据
    const testInventory = [];
    
    // 为每个映射的本地SKU创建库存数据
    testMappings.forEach((mapping, index) => {
      const baseQuantity = Math.floor(Math.random() * 100) + 50; // 50-150的随机数量
      
      // 添加整箱库存
      testInventory.push({
        sku: mapping.local_sku,
        country: mapping.country,
        total_quantity: baseQuantity,
        total_boxes: Math.floor(baseQuantity / 20), // 假设每箱20个
        mix_box_num: null,
        marketPlace: 'Amazon'
      });
      
      // 随机添加一些混合箱库存
      if (Math.random() > 0.5) {
        testInventory.push({
          sku: mapping.local_sku,
          country: mapping.country,
          total_quantity: Math.floor(Math.random() * 30) + 10,
          total_boxes: 0,
          mix_box_num: `MIX-${index + 1}`,
          marketPlace: 'Amazon'
        });
      }
    });

    await LocalBox.bulkCreate(testInventory, {
      ignoreDuplicates: true
    });
    
    console.log('\x1b[32m%s\x1b[0m', '✅ 测试数据创建成功:', {
      mappings: testMappings.length,
      needs: createdNeeds.length,
      inventory: testInventory.length
    });
    
    res.json({
      code: 0,
      message: '测试数据创建成功',
      data: {
        mappings: testMappings.length,
        needs: createdNeeds.length,
        inventory: testInventory.length
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 创建测试数据失败:', error);
    
    res.status(500).json({
      code: 1,
      message: '创建测试数据失败',
      error: error.message
    });
  }
});

// 记录出库信息（修改为支持新的发货管理模型）
router.post('/outbound-record', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到出库记录请求:', JSON.stringify(req.body, null, 2));
  
  const transaction = await sequelize.transaction();
  
  try {
    const { shipments, operator = '申报出库', shipping_method = '', remark = '' } = req.body;
    
    if (!shipments || !Array.isArray(shipments) || shipments.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '出库记录数据不能为空'
      });
    }

    // 第一步：创建发货记录主表
    const shipmentNumber = `SHIP-${Date.now()}`;
    const totalBoxes = shipments.reduce((sum, item) => sum + (item.total_boxes || 0), 0);
    const totalItems = shipments.reduce((sum, item) => sum + item.total_quantity, 0);

    console.log('\x1b[33m%s\x1b[0m', '📦 创建发货记录:', {
      shipmentNumber,
      totalBoxes: Math.abs(totalBoxes),
      totalItems: Math.abs(totalItems)
    });

    const shipmentRecord = await ShipmentRecord.create({
      shipment_number: shipmentNumber,
      operator: operator,
      total_boxes: Math.abs(totalBoxes),
      total_items: Math.abs(totalItems),
      shipping_method: shipping_method,
      status: '已发货',
      remark: remark
    }, { transaction });

    // 第二步：处理出库记录和发货明细
    const outboundRecords = [];
    const shipmentItems = [];
    const orderSummary = new Map(); // 用于统计每个需求单的发货情况

    for (const shipment of shipments) {
      const {
        sku,
        total_quantity,
        total_boxes = null,
        country,
        marketplace = '亚马逊',
        is_mixed_box = false,
        original_mix_box_num = null,
        order_item_id = null, // 新增：需求记录ID
        need_num = null // 新增：需求单号
      } = shipment;
      
      // 生成唯一的记录号
      const recordId = `OUT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      
      // 统一country字段为中文
      let normalizedCountry = country;
      if (country === 'US') {
        normalizedCountry = '美国';
      } else if (country === 'UK') {
        normalizedCountry = '英国';
      } else if (country === 'AU') {
        normalizedCountry = '澳大利亚';
      } else if (country === 'AE') {
        normalizedCountry = '阿联酋';
      } else if (country === 'CA') {
        normalizedCountry = '加拿大';
      }
      
      // 处理混合箱号
      let mixBoxNum = null;
      if (is_mixed_box) {
        if (original_mix_box_num) {
          mixBoxNum = original_mix_box_num;
        } else {
          try {
            const existingRecord = await LocalBox.findOne({
              where: {
                sku: sku,
                country: normalizedCountry,
                mix_box_num: { [Op.ne]: null }
              },
              attributes: ['mix_box_num'],
              raw: true
            });
            
            if (existingRecord && existingRecord.mix_box_num) {
              mixBoxNum = existingRecord.mix_box_num;
              console.log(`📦 找到原始混合箱号: ${mixBoxNum} for SKU: ${sku}`);
            } else {
              console.warn(`⚠️ 无法找到SKU ${sku} 的原始混合箱号，生成新箱号`);
              mixBoxNum = `OUT-MIX-${Date.now()}`;
            }
          } catch (error) {
            console.error(`❌ 查找原始混合箱号失败: ${error.message}`);
            mixBoxNum = `OUT-MIX-${Date.now()}`;
          }
        }
      }
      
      // 创建出库记录（保持原有的local_boxes表记录）
      const record = {
        记录号: recordId,
        sku: sku,
        total_quantity: -Math.abs(total_quantity),
        total_boxes: total_boxes ? -Math.abs(total_boxes) : null,
        country: normalizedCountry,
        time: new Date(),
        操作员: operator,
        marketPlace: marketplace,
        mix_box_num: mixBoxNum
      };
      
      outboundRecords.push(record);

      // 如果有需求记录信息，创建发货明细
      if (order_item_id && need_num) {
        // 查询需求记录以获取完整信息
        const orderItem = await WarehouseProductsNeed.findByPk(order_item_id);
        if (orderItem) {
          // 查询Amazon SKU映射
          const mapping = await AmzSkuMapping.findOne({
            where: {
              local_sku: sku,
              country: normalizedCountry
            }
          });

          const shipmentItem = {
            shipment_id: shipmentRecord.shipment_id,
            order_item_id: order_item_id,
            need_num: need_num,
            local_sku: sku,
            amz_sku: mapping?.amz_sku || sku,
            country: normalizedCountry,
            marketplace: marketplace,
            requested_quantity: orderItem.ori_quantity,
            shipped_quantity: Math.abs(total_quantity),
            whole_boxes: is_mixed_box ? 0 : Math.abs(total_boxes || 0),
            mixed_box_quantity: is_mixed_box ? Math.abs(total_quantity) : 0,
            box_numbers: JSON.stringify(mixBoxNum ? [mixBoxNum] : [])
          };

          shipmentItems.push(shipmentItem);

          // 统计需求单发货情况
          if (!orderSummary.has(need_num)) {
            orderSummary.set(need_num, {
              total_requested: 0,
              total_shipped: 0,
              items: []
            });
          }
          const summary = orderSummary.get(need_num);
          summary.total_requested += orderItem.ori_quantity;
          summary.total_shipped += Math.abs(total_quantity);
          summary.items.push(order_item_id);
        }
      }
    }

    // 第三步：批量插入出库记录（保持原有逻辑）
    await LocalBox.bulkCreate(outboundRecords, { transaction });

    // 第四步：批量插入发货明细
    if (shipmentItems.length > 0) {
      await ShipmentItem.bulkCreate(shipmentItems, { transaction });
    }

    // 第五步：创建需求单发货关联记录
    const orderRelations = [];
    for (const [needNum, summary] of orderSummary) {
      const completionStatus = summary.total_shipped >= summary.total_requested ? '全部完成' : '部分完成';
      
      orderRelations.push({
        need_num: needNum,
        shipment_id: shipmentRecord.shipment_id,
        total_requested: summary.total_requested,
        total_shipped: summary.total_shipped,
        completion_status: completionStatus
      });

      // 更新需求记录状态
      if (completionStatus === '全部完成') {
        await WarehouseProductsNeed.update(
          { status: '已发货' },
          { 
            where: { record_num: { [Op.in]: summary.items } },
            transaction 
          }
        );
      }
    }

    if (orderRelations.length > 0) {
      await OrderShipmentRelation.bulkCreate(orderRelations, { transaction });
    }

    await transaction.commit();
    
    console.log('\x1b[32m%s\x1b[0m', '✅ 出库记录创建成功:', {
      outboundRecords: outboundRecords.length,
      shipmentItems: shipmentItems.length,
      orderRelations: orderRelations.length,
      shipmentNumber: shipmentNumber
    });
    
    res.json({
      code: 0,
      message: '出库记录创建成功',
      data: {
        shipment_number: shipmentNumber,
        shipment_id: shipmentRecord.shipment_id,
        outbound_records: outboundRecords.length,
        shipment_items: shipmentItems.length,
        order_relations: orderRelations.length,
        details: {
          outbound_records: outboundRecords,
          shipment_items: shipmentItems,
          order_relations: orderRelations
        }
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('\x1b[31m%s\x1b[0m', '❌ 创建出库记录失败:', error);
    res.status(500).json({
      code: 1,
      message: '创建出库记录失败',
      error: error.message
    });
  }
});

// 创建SKU映射记录
router.post('/create-mapping', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到创建SKU映射请求:', JSON.stringify(req.body, null, 2));
  
  try {
    const { mappings } = req.body;
    
    if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
      return res.status(400).json({
        code: 1,
        message: 'SKU映射数据不能为空'
      });
    }

    // 验证必要字段
    for (const mapping of mappings) {
      if (!mapping.local_sku || !mapping.amz_sku || !mapping.country) {
        return res.status(400).json({
          code: 1,
          message: 'local_sku、amz_sku和country字段都是必需的'
        });
      }
    }

    // 检查是否已经存在相同的映射
    const existingMappings = await Promise.all(
      mappings.map(async (mapping) => {
        const existing = await AmzSkuMapping.findOne({
          where: {
            local_sku: mapping.local_sku,
            country: mapping.country,
            amz_sku: mapping.amz_sku
          }
        });
        return { mapping, exists: !!existing };
      })
    );

    const duplicates = existingMappings.filter(item => item.exists);
    if (duplicates.length > 0) {
      console.log('\x1b[33m%s\x1b[0m', '⚠️ 发现重复映射:', duplicates.map(d => d.mapping));
    }

    // 准备插入的数据
    const mappingsToCreate = mappings.map(mapping => ({
      local_sku: mapping.local_sku,
      amz_sku: mapping.amz_sku,
      country: mapping.country,
      site: mapping.site || `Amazon.${mapping.country.toLowerCase()}`,
      update_time: new Date()
    }));

    // 批量创建映射记录
    const createdMappings = await AmzSkuMapping.bulkCreate(mappingsToCreate, {
      ignoreDuplicates: true // 忽略重复记录
    });
    
    console.log('\x1b[32m%s\x1b[0m', '✅ SKU映射创建成功:', createdMappings.length);
    
    res.json({
      code: 0,
      message: 'SKU映射创建成功',
      data: {
        created: createdMappings.length,
        duplicates: duplicates.length,
        details: mappingsToCreate
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 创建SKU映射失败:', error);
    res.status(500).json({
      code: 1,
      message: '创建SKU映射失败',
      error: error.message
    });
  }
});

module.exports = router; 