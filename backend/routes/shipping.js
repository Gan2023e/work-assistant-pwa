const express = require('express');
const router = express.Router();
const { WarehouseProductsNeed, LocalBox, AmzSkuMapping, sequelize, ShipmentRecord, ShipmentItem, OrderShipmentRelation } = require('../models/index');
const { Sequelize, Op } = require('sequelize');
const { shipInventoryRecords, cancelShipment } = require('../utils/inventoryUtils');
const { processPartialShipment, processPartialShipmentOptimized, getInventoryStatusSummary, checkPartialShipmentStatus } = require('../utils/partialShipmentUtils');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { uploadTemplateToOSS, listTemplateFiles, downloadTemplateFromOSS, deleteTemplateFromOSS, backupTemplate, checkOSSConfig, createOSSClient } = require('../utils/oss');

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
    // 查询所有库存数据 - 只查询待出库状态的记录
    const allData = await LocalBox.findAll({
      where: {
        status: '待出库',
        total_quantity: { [Op.gt]: 0 } // 只查询数量大于0的记录
      },
      attributes: ['sku', 'country', 'mix_box_num', 'total_quantity', 'total_boxes', 'box_type'],
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

    // 第二步：查询所有库存数据 - 查询待出库和部分出库状态的记录
    const allInventory = await LocalBox.findAll({
      where: {
        status: ['待出库', '部分出库'],
        total_quantity: { [Op.gt]: 0 } // 只查询数量大于0的记录
      },
      attributes: ['sku', 'country', 'mix_box_num', 'total_quantity', 'total_boxes', 'box_type'],
      raw: true
    });

    console.log('\x1b[33m%s\x1b[0m', '🔍 总库存记录数量:', allInventory.length);

    // 第三步：分别处理整箱和混合箱数据
    
    // 步骤3.1：处理整箱数据 - 按SKU+国家分组汇总
    const wholeBoxStats = {};
    
    allInventory.forEach(item => {
      // 只处理整箱数据（根据box_type字段判断）
      if (item.box_type !== '整箱') {
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
      // 只处理混合箱数据（根据box_type字段判断）
      if (item.box_type !== '混合箱') {
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

    // 查询库存数据 - 只查询待出库状态的记录
    const inventoryData = await LocalBox.findAll({
      where: {
        [Op.and]: [
          { [Op.or]: whereConditions },
          { status: '待出库' },
          { total_quantity: { [Op.gt]: 0 } }
        ]
      },
      attributes: ['sku', 'country', 'mix_box_num', 'total_quantity', 'total_boxes', 'box_type'],
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
          },
          status: '待出库',
          total_quantity: { [Op.gt]: 0 }
        },
        attributes: ['sku', 'country', 'mix_box_num', 'total_quantity', 'box_type'],
        raw: true
      });

      console.log('\x1b[33m%s\x1b[0m', '🔍 混合箱内所有SKU数据:', allMixedBoxItems.length);

      // 批量查询所有需要的SKU映射关系（性能优化）
      const skuMappingConditions = allMixedBoxItems.map(item => ({
        local_sku: item.sku,
        country: item.country
      }));
      
      let allMappings = [];
      const mixedBoxListingsMap = new Map(); // 混合箱listings映射表
      
      if (skuMappingConditions.length > 0) {
        try {
          allMappings = await AmzSkuMapping.findAll({
            where: {
              [Op.or]: skuMappingConditions
            },
            attributes: ['local_sku', 'country', 'amz_sku', 'site'],
            raw: true
          });
          
          // 通过amz_sku查询listings_sku表获取seller-sku（混合箱专用）
          if (allMappings.length > 0) {
            const mixedBoxListingsQuery = `
              SELECT 
                asm.local_sku,
                asm.country,
                ls.\`seller-sku\` as amazon_sku,
                asm.amz_sku as mapping_amz_sku,
                ls.site,
                ls.\`fulfillment-channel\` as fulfillment_channel
              FROM pbi_amzsku_sku asm
              INNER JOIN listings_sku ls ON asm.amz_sku = ls.\`seller-sku\` AND asm.site = ls.site
              WHERE (ls.\`fulfillment-channel\` = 'AMAZON_NA' 
                     OR ls.\`fulfillment-channel\` = 'AMAZON_EU' 
                     OR ls.\`fulfillment-channel\` = 'AMAZON_FE'
                     OR ls.\`fulfillment-channel\` LIKE 'AMAZON_%')
                AND ${allMappings.map(mapping => 
                  `(asm.local_sku = '${mapping.local_sku.replace(/'/g, "''")}' AND asm.country = '${mapping.country.replace(/'/g, "''")}')`
                ).join(' OR ')}
            `;
            
            const mixedBoxListingsResults = await sequelize.query(mixedBoxListingsQuery, {
              type: sequelize.QueryTypes.SELECT,
              raw: true
            });
            
                         // 构建混合箱listings映射关系 - 只保留符合Amazon FBA条件的
             mixedBoxListingsResults.forEach(result => {
               // 双重验证：确保fulfillment-channel包含AMAZON
               if (result.fulfillment_channel && 
                   (result.fulfillment_channel === 'AMAZON_NA' || 
                    result.fulfillment_channel === 'AMAZON_EU' || 
                    result.fulfillment_channel === 'AMAZON_FE' || 
                    result.fulfillment_channel.startsWith('AMAZON_'))) {
                 
                 const mappingKey = `${result.local_sku}_${result.country}`;
                 mixedBoxListingsMap.set(mappingKey, result.amazon_sku);
                 console.log('\x1b[32m%s\x1b[0m', `✅ 混合箱listings映射: ${result.local_sku} -> ${result.amazon_sku} (fulfillment: ${result.fulfillment_channel})`);
               } else {
                 console.log('\x1b[31m%s\x1b[0m', `❌ 跳过非Amazon FBA渠道: ${result.local_sku} -> ${result.amazon_sku} (fulfillment: ${result.fulfillment_channel || 'undefined'})`);
               }
             });
             
             console.log('\x1b[36m%s\x1b[0m', `📝 混合箱listings映射表大小: ${mixedBoxListingsMap.size}`);
          }
        } catch (mappingError) {

        }
      }
      


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



      // 只处理汇总后数量大于0的SKU（过滤掉已完全出库的SKU）
      skuSummaryMap.forEach((totalQuantity, summaryKey) => {
        if (totalQuantity > 0) { // 只处理库存为正的SKU
          // 修复箱号分割逻辑 - 正确解析summaryKey
          // summaryKey格式: SKU_国家_混合箱号
          // 例如: MK024A4_美国_MIX1753529314489_1
          const parts = summaryKey.split('_');
          const sku = parts[0];
          const country = parts[1];
          // 混合箱号是从第3部分开始的所有部分重新拼接
          const mixBoxNum = parts.slice(2).join('_');
          
          const mappingKey = `${sku}_${country}`;
          const amazonSku = mixedBoxListingsMap.get(mappingKey) || '';
          console.log('\x1b[36m%s\x1b[0m', `🔍 混合箱SKU映射: ${sku} -> ${amazonSku || '(留空)'} (来源: ${mixedBoxListingsMap.has(mappingKey) ? 'listings_sku' : '无匹配记录'})`);

          allMixedBoxData.push({
            box_num: mixBoxNum,
            sku: sku,
            amz_sku: amazonSku,
            quantity: totalQuantity
          });
        } else {
          // 记录已出库的SKU - 也需要修复分割逻辑
          const parts = summaryKey.split('_');
          const sku = parts[0];
          const country = parts[1];
          const mixBoxNum = parts.slice(2).join('_');

        }
      });
    }

    // 第三步：处理整箱数据（仅选中的记录，并过滤已出库的SKU）
    const wholeBoxData = {};
    
    // 为整箱数据查询listings_sku映射关系（使用与merged-data端点相同的逻辑）
    const wholeBoxListingsMap = new Map();
      
      // 获取所有整箱SKU的映射条件
      const wholeBoxSkus = inventoryData.filter(item => !item.mix_box_num || item.mix_box_num.trim() === '')
        .map(item => ({ local_sku: item.sku, country: item.country }));
      
      if (wholeBoxSkus.length > 0) {
        try {

        
        // 步骤1: 查询SKU映射关系以获取amz_sku
        const amzSkuMappings = await AmzSkuMapping.findAll({
            where: {
              [Op.or]: wholeBoxSkus
            },
          attributes: ['local_sku', 'country', 'amz_sku', 'site'],
            raw: true
          });
          

        
        // 步骤2: 通过amz_sku查询listings_sku表获取seller-sku
        if (amzSkuMappings.length > 0) {
          const listingsQuery = `
            SELECT 
              asm.local_sku,
              asm.country,
              ls.\`seller-sku\` as amazon_sku,
              asm.amz_sku as mapping_amz_sku,
              ls.site,
              ls.\`fulfillment-channel\` as fulfillment_channel
            FROM pbi_amzsku_sku asm
            INNER JOIN listings_sku ls ON asm.amz_sku = ls.\`seller-sku\` AND asm.site = ls.site
            WHERE (ls.\`fulfillment-channel\` = 'AMAZON_NA' 
                   OR ls.\`fulfillment-channel\` = 'AMAZON_EU' 
                   OR ls.\`fulfillment-channel\` = 'AMAZON_FE'
                   OR ls.\`fulfillment-channel\` LIKE 'AMAZON_%')
              AND ${amzSkuMappings.map(mapping => 
                `(asm.local_sku = '${mapping.local_sku.replace(/'/g, "''")}' AND asm.country = '${mapping.country.replace(/'/g, "''")}')`
              ).join(' OR ')}
          `;
          
          const listingsResults = await sequelize.query(listingsQuery, {
            type: sequelize.QueryTypes.SELECT,
            raw: true
          });
          
          // 构建整箱listings映射关系 - 只保留符合Amazon FBA条件的
          listingsResults.forEach(result => {
            // 双重验证：确保fulfillment-channel包含AMAZON
            if (result.fulfillment_channel && 
                (result.fulfillment_channel === 'AMAZON_NA' || 
                 result.fulfillment_channel === 'AMAZON_EU' || 
                 result.fulfillment_channel === 'AMAZON_FE' || 
                 result.fulfillment_channel.startsWith('AMAZON_'))) {
              
              const mappingKey = `${result.local_sku}_${result.country}`;
              wholeBoxListingsMap.set(mappingKey, result.amazon_sku);
            }
          });
        }
        

        
        } catch (error) {

      }
    }
    
    inventoryData.forEach(item => {
      if (!item.mix_box_num || item.mix_box_num.trim() === '') {
        // 整箱数据
        const correspondingRecord = records.find(r => 
          (r.local_sku === item.sku || r.amz_sku === item.sku) && r.country === item.country
        );
        
        if (correspondingRecord) {
          const key = `${item.sku}_${item.country}`;
          if (!wholeBoxData[key]) {
            // 优先使用listings_sku映射，如果没有则回退到原有逻辑
            const mappingKey = `${item.sku}_${item.country}`;
            const amazonSku = wholeBoxListingsMap.get(mappingKey) || '';
            

            
            wholeBoxData[key] = {
              amazon_sku: amazonSku, // 只使用amazon_sku，优先listings映射
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

// 批量删除需求记录
router.post('/needs/batch-delete', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到批量删除需求记录请求:', JSON.stringify(req.body, null, 2));
  
  try {
    const { record_nums } = req.body;
    
    if (!record_nums || !Array.isArray(record_nums) || record_nums.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '记录ID列表不能为空'
      });
    }
    
    console.log('\x1b[33m%s\x1b[0m', '🗑️ 开始删除需求记录:', record_nums);
    
    // 先检查是否有已发货记录，避免删除已发货的需求
    const shippedItems = await ShipmentItem.findAll({
      where: {
        order_item_id: { [Op.in]: record_nums }
      },
      attributes: ['order_item_id', 'shipped_quantity']
    });
    
    if (shippedItems.length > 0) {
      const shippedRecords = shippedItems.filter(item => item.shipped_quantity > 0);
      if (shippedRecords.length > 0) {
        const shippedIds = shippedRecords.map(item => item.order_item_id);
        return res.status(400).json({
          code: 1,
          message: `记录 ${shippedIds.join(', ')} 已有发货记录，无法删除`
        });
      }
    }
    
    // 执行批量删除
    const deletedCount = await WarehouseProductsNeed.destroy({
      where: {
        record_num: { [Op.in]: record_nums }
      }
    });
    
    console.log('\x1b[32m%s\x1b[0m', '✅ 批量删除成功:', {
      deletedCount,
      requestedCount: record_nums.length
    });
    
    res.json({
      code: 0,
      message: '批量删除成功',
      data: {
        deleted_count: deletedCount,
        requested_count: record_nums.length
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 批量删除需求记录失败:', error);
    res.status(500).json({
      code: 1,
      message: '批量删除失败',
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

// 获取Amazon FBA专用发货数据 - 专注FBA渠道的高性能查询
router.get('/merged-data', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到FBA发货数据查询请求');
  
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    console.log('\x1b[33m%s\x1b[0m', '🔄 步骤1: Amazon FBA专用三步映射流程');
    
    // FBA专用映射流程：三步整合成一个SQL语句
    // 步骤1: 从listings_sku获取包含AMAZON的fulfillment-channel数据（只要FBA渠道）
    // 步骤2: 通过seller-sku与amz_sku、site字段关联pbi_amzsku_sku表
    // 步骤3: 通过local_sku与sku、country字段关联local_boxes表，得到Amazon FBA库存
    const inventoryWithMappingQuery = `
      SELECT 
        lb.sku as local_sku,
        lb.country,
        ls.\`seller-sku\` as amazon_sku,
        COALESCE(asm.amz_sku, '') as mapping_amz_sku,
        ls.site,
        ls.\`fulfillment-channel\` as fulfillment_channel,
        SUM(CASE WHEN lb.mix_box_num IS NULL OR lb.mix_box_num = '' THEN lb.total_quantity ELSE 0 END) as whole_box_quantity,
        SUM(CASE WHEN lb.mix_box_num IS NULL OR lb.mix_box_num = '' THEN lb.total_boxes ELSE 0 END) as whole_box_count,
        SUM(CASE WHEN lb.mix_box_num IS NOT NULL AND lb.mix_box_num != '' THEN lb.total_quantity ELSE 0 END) as mixed_box_quantity,
        SUM(lb.total_quantity) as total_available
      FROM local_boxes lb
      INNER JOIN pbi_amzsku_sku asm ON lb.sku = asm.local_sku AND lb.country = asm.country
      INNER JOIN listings_sku ls ON asm.amz_sku = ls.\`seller-sku\` AND asm.site = ls.site
      WHERE lb.total_quantity > 0
        AND lb.status = '待出库'
        AND (ls.\`fulfillment-channel\` = 'AMAZON_NA' 
             OR ls.\`fulfillment-channel\` = 'AMAZON_EU' 
             OR ls.\`fulfillment-channel\` = 'AMAZON_FE'
             OR ls.\`fulfillment-channel\` LIKE 'AMAZON_%')
      GROUP BY lb.sku, lb.country, ls.\`seller-sku\`, asm.amz_sku, ls.site, ls.\`fulfillment-channel\`
      HAVING SUM(lb.total_quantity) != 0
    `;
    
    const inventoryWithMapping = await sequelize.query(inventoryWithMappingQuery, {
      type: sequelize.QueryTypes.SELECT,
      raw: true
    });

        console.log('\x1b[33m%s\x1b[0m', `📦 Amazon FBA库存数据: ${inventoryWithMapping.length} 条`);

    console.log('\x1b[33m%s\x1b[0m', '🔄 步骤2: 查询待发货需求数据并计算剩余需求');
    
    // 2. 查询待发货和部分发货需求数据，并计算每个需求的剩余量
    const needsDataRaw = await WarehouseProductsNeed.findAll({
      where: {
        status: { [Op.in]: ['待发货', '部分发货'] }
      },
      order: [['create_date', 'ASC'], ['record_num', 'ASC']], // 按创建时间升序，确保最早的需求优先
      raw: true
    });

    console.log('\x1b[33m%s\x1b[0m', `📋 原始需求数据(待发货+部分发货): ${needsDataRaw.length} 条`);

    // 2.1 查询每个需求记录的已发货数量，过滤掉已全部发出的记录
    const needsData = [];
    for (const need of needsDataRaw) {
      // 查询该需求记录的已发货数量
      const shippedQuantity = await ShipmentItem.sum('shipped_quantity', {
        where: { order_item_id: need.record_num }
      }) || 0;
      
      // 计算剩余需求量
      const remainingQuantity = need.ori_quantity - shippedQuantity;
      
      console.log(`🔍 需求记录 ${need.record_num}: 原始需求=${need.ori_quantity}, 已发货=${shippedQuantity}, 剩余=${remainingQuantity}, 状态=${need.status}`);
      
      // 只有剩余需求量大于0的记录才参与发货操作
      if (remainingQuantity > 0) {
        needsData.push({
          ...need,
          shipped_quantity: shippedQuantity,
          remaining_quantity: remainingQuantity,
          ori_quantity: remainingQuantity // 用剩余量替换原始需求量进行后续计算
        });
      } else {
        console.log(`⏭️ 跳过已完全发货的记录: ${need.record_num}`);
      }
    }

    console.log('\x1b[33m%s\x1b[0m', `📋 过滤后有效需求数据: ${needsData.length} 条（已排除全部发出的记录）`);

    console.log('\x1b[33m%s\x1b[0m', '🔄 步骤2.5: 查询SKU映射关系（用于获取本地SKU）');
    
    // 2.5 独立查询SKU映射关系，确保即使没有库存也能获取本地SKU
    const skuMappingQuery = `
      SELECT 
        asm.amz_sku,
        asm.local_sku,
        asm.country,
        asm.site
      FROM pbi_amzsku_sku asm
      WHERE asm.amz_sku IN (${needsData.map(need => `'${need.sku.replace(/'/g, "''")}'`).join(',')})
        AND asm.country IN (${needsData.map(need => `'${need.country.replace(/'/g, "''")}'`).join(',')})
    `;
    
    let skuMappingData = [];
    if (needsData.length > 0) {
      skuMappingData = await sequelize.query(skuMappingQuery, {
        type: sequelize.QueryTypes.SELECT,
        raw: true
      });
      console.log('\x1b[33m%s\x1b[0m', `🔗 SKU映射数据: ${skuMappingData.length} 条`);
    }
    
    // 构建SKU映射表（以amz_sku+country为键）
    const skuMappingMap = new Map();
    skuMappingData.forEach(mapping => {
      const key = `${mapping.amz_sku}_${mapping.country}`;
      skuMappingMap.set(key, {
        local_sku: mapping.local_sku,
        site: mapping.site
      });
    });

    console.log('\x1b[33m%s\x1b[0m', '🔄 步骤3: 构建Amazon FBA库存映射表');
    
    // 3. 构建Amazon FBA库存映射表（以sku+country为键）
    const inventoryMap = new Map();
    
    inventoryWithMapping.forEach(inv => {
      const key = `${inv.amazon_sku}_${inv.country}`;
      inventoryMap.set(key, {
        local_sku: inv.local_sku,
        amz_sku: inv.amazon_sku,
        amazon_sku: inv.amazon_sku,
        site: inv.site,
        fulfillment_channel: inv.fulfillment_channel,
        whole_box_quantity: parseInt(inv.whole_box_quantity) || 0,
        whole_box_count: parseInt(inv.whole_box_count) || 0,
        mixed_box_quantity: parseInt(inv.mixed_box_quantity) || 0,
        total_available: parseInt(inv.total_available) || 0,
        country: inv.country,
        data_source: 'amazon_fba'
      });
      console.log(`✅ Amazon FBA库存: ${key} - 可用数量: ${inv.total_available}`);
    });

    console.log('\x1b[33m%s\x1b[0m', '🔄 步骤4: 构建需求映射表');
    
    // 4. 构建需求映射表（以sku+country为键，合并相同SKU的需求）
    const needsMap = new Map();
    
    needsData.forEach(need => {
      const key = `${need.sku}_${need.country}`;
      if (needsMap.has(key)) {
        // 如果已存在，累加数量，保留最早的记录信息
        const existing = needsMap.get(key);
        existing.total_quantity += (need.ori_quantity || 0);
        existing.records.push(need);
            } else {
        needsMap.set(key, {
          sku: need.sku,
          country: need.country,
          total_quantity: need.ori_quantity || 0,
          records: [need],
          earliest_record: need
        });
      }
    });
    
    console.log('\x1b[33m%s\x1b[0m', `📋 合并后需求: ${needsMap.size} 个SKU`);

    console.log('\x1b[33m%s\x1b[0m', '🔄 步骤5: 根据库存和需求关联分析');

        
    // 5. 根据库存和需求关联分析，生成四种状态的记录
    const allRecords = [];
    const processedKeys = new Set();
    
    // 5.1. 处理需求数据，分析库存状态
    needsMap.forEach((needInfo, key) => {
      const inventoryInfo = inventoryMap.get(key);
      const needQuantity = needInfo.total_quantity;
      
      if (inventoryInfo) {
        const availableQuantity = inventoryInfo.total_available;
        let status, shortageQty = 0;
        
        if (availableQuantity >= needQuantity) {
          status = '库存充足';
        } else if (availableQuantity > 0) {
          status = '库存不足';
          shortageQty = needQuantity - availableQuantity;
        } else {
          status = '缺货';
          shortageQty = needQuantity;
        }
        
        // 为每个需求记录创建条目
        needInfo.records.forEach(need => {
          allRecords.push({
        record_num: need.record_num,
        need_num: need.need_num || '',
            amz_sku: need.sku,
            amazon_sku: inventoryInfo.amazon_sku,
        local_sku: inventoryInfo.local_sku,
        site: inventoryInfo.site,
        fulfillment_channel: inventoryInfo.fulfillment_channel,
            quantity: need.ori_quantity || 0,
        shipping_method: need.shipping_method || '',
        marketplace: need.marketplace || '',
            country: need.country,
            status: status,
        created_at: need.create_date || new Date().toISOString(),
        // 库存信息
        whole_box_quantity: inventoryInfo.whole_box_quantity,
        whole_box_count: inventoryInfo.whole_box_count,
        mixed_box_quantity: inventoryInfo.mixed_box_quantity,
        total_available: inventoryInfo.total_available,
            shortage: shortageQty,
            data_source: 'need_with_inventory',
            inventory_source: 'amazon_fba',
            mapping_method: 'fba_focused_mapping'
          });
        });
        
        console.log(`🔍 ${key}: 需求${needQuantity}, 库存${availableQuantity} - ${status}`);
      } else {
        // 有需求但无库存，尝试从SKU映射表获取本地SKU
        const skuMapping = skuMappingMap.get(key);
        
        needInfo.records.forEach(need => {
          allRecords.push({
            record_num: need.record_num,
            need_num: need.need_num || '',
            amz_sku: need.sku,
            amazon_sku: need.sku,
            local_sku: skuMapping ? skuMapping.local_sku : '', // 从映射表获取本地SKU
            site: skuMapping ? skuMapping.site : '',
            fulfillment_channel: '',
            quantity: need.ori_quantity || 0,
            shipping_method: need.shipping_method || '',
            marketplace: need.marketplace || '',
            country: need.country,
            status: skuMapping ? '缺货' : '库存未映射', // 区分缺货和未映射
            created_at: need.create_date || new Date().toISOString(),
            // 库存信息（全为0）
            whole_box_quantity: 0,
            whole_box_count: 0,
            mixed_box_quantity: 0,
            total_available: 0,
            shortage: need.ori_quantity || 0,
            data_source: 'need_no_inventory',
            inventory_source: 'none',
            mapping_method: skuMapping ? 'fba_focused_mapping' : 'no_mapping'
          });
        });
        
        const statusText = skuMapping ? '缺货' : '库存未映射';
        console.log(`❌ ${key}: 需求${needQuantity}, 无库存 - ${statusText}${skuMapping ? `, 本地SKU: ${skuMapping.local_sku}` : ''}`);
      }
      
      processedKeys.add(key);
    });

        
    // 6. 处理有Amazon FBA库存但无需求的记录（第一步有，第二步没有）
    inventoryMap.forEach((inv, key) => {
      if (!processedKeys.has(key) && inv.total_available > 0) {
        allRecords.push({
          record_num: null, // 设置为null表示无需求单的库存
        need_num: '',
          amz_sku: inv.amz_sku,
        amazon_sku: inv.amazon_sku,
        local_sku: inv.local_sku,
        site: inv.site,
        fulfillment_channel: inv.fulfillment_channel,
        quantity: inv.total_available, // 设置为可用库存数量，方便用户调整发货数量
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
        shortage: 0,
          data_source: 'inventory_no_need',
          inventory_source: 'amazon_fba',
          mapping_method: 'fba_focused_mapping'
        });
        
        console.log(`📦 ${key}: 库存${inv.total_available}, 无需求 - 有库存无需求`);
      }
    });

    console.log('\x1b[33m%s\x1b[0m', '🔄 步骤6: 查询无需求未映射的库存');

    // 7. 查询所有没有映射关系的库存（无需求未映射）
    const unmappedInventoryQuery = `
      SELECT 
        lb.sku as local_sku,
        lb.country,
        SUM(CASE WHEN lb.mix_box_num IS NULL OR lb.mix_box_num = '' THEN lb.total_quantity ELSE 0 END) as whole_box_quantity,
        SUM(CASE WHEN lb.mix_box_num IS NULL OR lb.mix_box_num = '' THEN lb.total_boxes ELSE 0 END) as whole_box_count,
        SUM(CASE WHEN lb.mix_box_num IS NOT NULL AND lb.mix_box_num != '' THEN lb.total_quantity ELSE 0 END) as mixed_box_quantity,
        SUM(lb.total_quantity) as total_available
      FROM local_boxes lb
      LEFT JOIN pbi_amzsku_sku asm ON lb.sku = asm.local_sku AND lb.country = asm.country
      WHERE lb.total_quantity > 0
        AND lb.status = '待出库'
        AND asm.local_sku IS NULL
      GROUP BY lb.sku, lb.country
      HAVING SUM(lb.total_quantity) > 0
    `;

    const unmappedInventory = await sequelize.query(unmappedInventoryQuery, {
      type: sequelize.QueryTypes.SELECT,
      raw: true
    });

    console.log('\x1b[33m%s\x1b[0m', `📦 未映射库存数据: ${unmappedInventory.length} 条`);

    // 8. 添加未映射库存记录
    unmappedInventory.forEach(inv => {
      allRecords.push({
        record_num: null, // 设置为null表示无需求单的库存
        need_num: '',
        amz_sku: inv.local_sku, // 使用local_sku作为amz_sku显示
        amazon_sku: '', // 未映射，所以Amazon SKU为空
        local_sku: inv.local_sku,
        site: '',
        fulfillment_channel: '',
        quantity: 0, // 无需求量
        shipping_method: '',
        marketplace: '',
        country: inv.country,
        status: '库存未映射',
        created_at: new Date().toISOString(),
        // 库存信息
        whole_box_quantity: parseInt(inv.whole_box_quantity) || 0,
        whole_box_count: parseInt(inv.whole_box_count) || 0,
        mixed_box_quantity: parseInt(inv.mixed_box_quantity) || 0,
        total_available: parseInt(inv.total_available) || 0,
        shortage: 0,
        data_source: 'unmapped_inventory',
        inventory_source: 'local_only',
        mapping_method: 'no_mapping'
      });
      
      console.log(`🔍 未映射库存: ${inv.local_sku}_${inv.country} - 可用数量: ${inv.total_available}`);
    });

    console.log('\x1b[33m%s\x1b[0m', '🔄 步骤9: 应用分页和排序');
    
    // 9. 应用分页和排序
    const sortedRecords = allRecords.sort((a, b) => {
      // 先按状态排序：库存充足 > 库存不足 > 缺货 > 有库存无需求 > 库存未映射
      const statusOrder = { '库存充足': 1, '库存不足': 2, '缺货': 3, '有库存无需求': 4, '库存未映射': 5 };
      const statusDiff = (statusOrder[a.status] || 6) - (statusOrder[b.status] || 6);
      if (statusDiff !== 0) return statusDiff;
      
      // 相同状态下按创建时间排序
      return new Date(a.created_at) - new Date(b.created_at);
    });
    
    // 分页处理
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = parseInt(limit) === 1000 ? sortedRecords.length : startIndex + parseInt(limit);
    const paginatedRecords = sortedRecords.slice(startIndex, endIndex);
    
    // 10. 统计信息
    const statsMap = {
      库存充足: sortedRecords.filter(r => r.status === '库存充足').length,
      库存不足: sortedRecords.filter(r => r.status === '库存不足').length,
      缺货: sortedRecords.filter(r => r.status === '缺货').length,
      有库存无需求: sortedRecords.filter(r => r.status === '有库存无需求').length,
      库存未映射: sortedRecords.filter(r => r.status === '库存未映射').length,
      总记录数: sortedRecords.length,
      Amazon_FBA库存SKU数: inventoryMap.size,
      待发货需求SKU数: needsMap.size,
      未映射库存SKU数: unmappedInventory.length
    };

    console.log('\x1b[35m%s\x1b[0m', '📊 FBA发货分析完成统计:', statsMap);
    console.log('\x1b[32m%s\x1b[0m', '✅ FBA发货分析成功:', {
      Amazon_FBA库存数据: inventoryWithMapping.length,
      待发货需求数据: needsData.length,
      未映射库存数据: unmappedInventory.length,
      分析结果: `${statsMap.库存充足}充足 + ${statsMap.库存不足}不足 + ${statsMap.缺货}缺货 + ${statsMap.有库存无需求}无需求 + ${statsMap.库存未映射}未映射 = ${statsMap.总记录数}条`
    });

    res.json({
      code: 0,
      message: '获取成功 - FBA库存需求分析',
      data: {
        list: paginatedRecords,
        total: sortedRecords.length,
        page: parseInt(page),
        limit: parseInt(limit),
        stats: statsMap,
        status_breakdown: {
          库存充足: sortedRecords.filter(r => r.status === '库存充足'),
          库存不足: sortedRecords.filter(r => r.status === '库存不足'),
          缺货: sortedRecords.filter(r => r.status === '缺货'),
          有库存无需求: sortedRecords.filter(r => r.status === '有库存无需求'),
          库存未映射: sortedRecords.filter(r => r.status === '库存未映射')
        },
        summary: statsMap,
        mapping_method: 'inventory_need_analysis'
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ FBA库存需求分析失败:', error);
    res.status(500).json({
      code: 1,
      message: '分析失败 - FBA库存需求分析异常',
      error: error.message
    });
  }
});

// 新的映射逻辑调试端点
router.get('/debug-new-mapping', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔧 开始调试新的Amazon SKU映射流程');
  
  try {
    // 步骤1: 检查listings_sku表
    console.log('\x1b[33m%s\x1b[0m', '🔍 步骤1: 检查listings_sku表结构和数据');
    
    let listingsTableExists = false;
    let amazonListings = [];
    
    try {
      const tableCheck = await sequelize.query(`
        SELECT COUNT(*) as count FROM listings_sku LIMIT 1
      `, {
        type: sequelize.QueryTypes.SELECT,
        raw: true
      });
      
      listingsTableExists = true;
      console.log('\x1b[32m%s\x1b[0m', '✅ listings_sku表存在');
      
      // 获取Amazon数据样例
      amazonListings = await sequelize.query(`
        SELECT seller_sku, site, fulfillment_channel
        FROM listings_sku 
        WHERE fulfillment_channel LIKE '%AMAZON%'
        LIMIT 10
      `, {
        type: sequelize.QueryTypes.SELECT,
        raw: true
      });
      
      console.log('\x1b[33m%s\x1b[0m', `📋 Amazon listings数据样例 (${amazonListings.length}条):`, amazonListings);
      
    } catch (error) {
      console.log('\x1b[31m%s\x1b[0m', '❌ listings_sku表不存在或无权限:', error.message);
    }

    // 步骤2: 检查pbi_amzsku_sku表数据
    console.log('\x1b[33m%s\x1b[0m', '🔍 步骤2: 检查pbi_amzsku_sku表数据');
    
    const mappingData = await AmzSkuMapping.findAll({
      limit: 10,
      raw: true
    });
    
    console.log('\x1b[33m%s\x1b[0m', `🔗 映射表数据样例 (${mappingData.length}条):`, mappingData);

    // 步骤3: 测试关联逻辑
    console.log('\x1b[33m%s\x1b[0m', '🔍 步骤3: 测试Amazon listings与映射表的关联');
    
    let associationTests = [];
    if (amazonListings.length > 0) {
      for (const listing of amazonListings.slice(0, 3)) {
        try {
          const matchingMappings = await sequelize.query(`
            SELECT p.amz_sku, p.site, p.country, p.local_sku, p.update_time
            FROM pbi_amzsku_sku p
            WHERE p.amz_sku = :sellerSku 
            AND p.site = :site
          `, {
            replacements: { 
              sellerSku: listing.seller_sku,
              site: listing.site 
            },
            type: sequelize.QueryTypes.SELECT,
            raw: true
          });
          
          associationTests.push({
            listing: listing,
            匹配的映射数量: matchingMappings.length,
            匹配的映射: matchingMappings
          });
        } catch (error) {
          associationTests.push({
            listing: listing,
            错误: error.message
          });
        }
      }
    }
    
    console.log('\x1b[35m%s\x1b[0m', '🔗 关联测试结果:', associationTests);

    // 步骤4: 检查库存数据样例
    console.log('\x1b[33m%s\x1b[0m', '🔍 步骤4: 检查库存数据');
    
    const inventoryStats = await LocalBox.findAll({
      attributes: [
        'sku',
        'country',
        [sequelize.fn('SUM', sequelize.col('total_quantity')), 'total_quantity']
      ],
      group: ['sku', 'country'],
      limit: 5,
      raw: true
    });
    
    console.log('\x1b[33m%s\x1b[0m', `📦 库存数据样例 (${inventoryStats.length}条):`, inventoryStats);

    // 步骤5: 模拟完整的新映射流程
    console.log('\x1b[33m%s\x1b[0m', '🔍 步骤5: 模拟完整的新映射流程');
    
    let simulationResult = {
      listings_sku表存在: listingsTableExists,
      Amazon_listings数量: amazonListings.length,
      映射表记录数量: mappingData.length,
      库存记录数量: inventoryStats.length,
      关联测试结果: associationTests,
      建议操作: []
    };

    if (!listingsTableExists) {
      simulationResult.建议操作.push('需要创建或确认listings_sku表的存在和权限');
    }
    
    if (amazonListings.length === 0) {
      simulationResult.建议操作.push('listings_sku表中没有包含AMAZON的fulfillment_channel数据');
    }
    
    if (mappingData.length === 0) {
      simulationResult.建议操作.push('pbi_amzsku_sku映射表为空，需要先填充映射数据');
    }
    
    if (associationTests.length > 0 && associationTests.every(test => test.匹配的映射数量 === 0)) {
      simulationResult.建议操作.push('listings_sku和pbi_amzsku_sku表之间没有找到匹配的关联数据');
    }

    res.json({
      code: 0,
      message: '新映射逻辑调试完成',
      data: simulationResult
    });

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 新映射逻辑调试失败:', error);
    res.status(500).json({
      code: 1,
      message: '调试失败',
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


// 记录出库信息（修改为支持新的发货管理模型）
router.post('/outbound-record', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到出库记录请求:', JSON.stringify(req.body, null, 2));
  
  const transaction = await sequelize.transaction();
  
  try {
    const { shipments, operator = '申报出库', shipping_method = '', remark = '', logistics_provider = '' } = req.body;
    
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
      remark: remark,
      logistics_provider: logistics_provider // 新增物流商字段
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
      // 新增：写入shipment_id字段，建立主表-明细表关联，并正确设置新字段
      const record = {
        记录号: recordId,
        sku: sku,
        total_quantity: -Math.abs(total_quantity),
        total_boxes: total_boxes ? -Math.abs(total_boxes) : null,
        country: normalizedCountry,
        time: new Date(),
        操作员: operator,
        marketPlace: marketplace,
        mix_box_num: mixBoxNum,
        shipment_id: shipmentRecord.shipment_id, // 关键：写入发货单ID
        // 新增字段
        status: '已出库',
        shipped_at: new Date(),
        box_type: is_mixed_box ? '混合箱' : '整箱',
        last_updated_at: new Date(),
        remark: remark ? `发货备注: ${remark}` : `发货单号: ${shipmentNumber}`
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
      } else {
        // 如果没有需求记录信息，创建临时发货明细
        const shipmentItem = {
          shipment_id: shipmentRecord.shipment_id,
          order_item_id: null,
          need_num: `MANUAL-${Date.now()}-${operator}`,
          local_sku: sku,
          amz_sku: sku,
          country: normalizedCountry,
          marketplace: marketplace,
          requested_quantity: Math.abs(total_quantity),
          shipped_quantity: Math.abs(total_quantity),
          whole_boxes: is_mixed_box ? 0 : Math.abs(total_boxes || 0),
          mixed_box_quantity: is_mixed_box ? Math.abs(total_quantity) : 0,
          box_numbers: JSON.stringify(mixBoxNum ? [mixBoxNum] : [])
        };

        shipmentItems.push(shipmentItem);
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

// 创建uploads目录（如果不存在）
const uploadsDir = path.join(__dirname, '../uploads/amazon-templates');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 配置multer用于文件上传（使用内存存储以便上传到OSS）
const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    // 只允许Excel文件
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('只允许上传Excel文件'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  }
});

// 亚马逊模板配置存储（现在存储在OSS中）
const TEMPLATE_CONFIG_OSS_PATH = 'templates/config/amazon-template-config.json';

// 物流商发票模板配置存储（现在存储在OSS中）
const LOGISTICS_INVOICE_CONFIG_OSS_PATH = 'templates/config/logistics-invoice-config.json';

// OSS配置管理辅助函数
async function getTemplateConfigFromOSS() {
  try {
    if (!checkOSSConfig()) {
      console.warn('OSS配置不完整，使用空配置');
      return {};
    }
    
    const result = await downloadTemplateFromOSS(TEMPLATE_CONFIG_OSS_PATH);
    if (result.success) {
      const configText = result.content.toString('utf8');
      return JSON.parse(configText);
    }
  } catch (error) {
    if (error.message === '模板文件不存在') {
      console.log('配置文件不存在，返回空配置');
      return {};
    }
    console.error('获取模板配置失败:', error);
  }
  return {};
}

async function saveTemplateConfigToOSS(config) {
  try {
    if (!checkOSSConfig()) {
      throw new Error('OSS配置不完整');
    }
    
    const configBuffer = Buffer.from(JSON.stringify(config, null, 2), 'utf8');
    
    // 使用OSS客户端直接上传配置文件
    const client = createOSSClient();
    
    const result = await client.put(TEMPLATE_CONFIG_OSS_PATH, configBuffer, {
      headers: {
        'Content-Type': 'application/json',
        'x-oss-storage-class': 'Standard'
      }
    });
    
    console.log('✅ 模板配置保存成功:', result.name);
    return true;
  } catch (error) {
    console.error('❌ 保存模板配置失败:', error);
    throw error;
  }
}

// 物流商发票模板配置管理函数
async function getLogisticsInvoiceConfigFromOSS() {
  try {
    if (!checkOSSConfig()) {
      console.warn('OSS配置不完整，使用空配置');
      return {};
    }
    
    const result = await downloadTemplateFromOSS(LOGISTICS_INVOICE_CONFIG_OSS_PATH);
    if (result.success) {
      const configText = result.content.toString('utf8');
      return JSON.parse(configText);
    }
  } catch (error) {
    if (error.message === '模板文件不存在') {
      console.log('物流商发票配置文件不存在，返回空配置');
      return {};
    }
    console.error('获取物流商发票配置失败:', error);
  }
  return {};
}

async function saveLogisticsInvoiceConfigToOSS(config) {
  try {
    if (!checkOSSConfig()) {
      throw new Error('OSS配置不完整');
    }
    
    const configBuffer = Buffer.from(JSON.stringify(config, null, 2), 'utf8');
    
    // 使用OSS客户端直接上传配置文件
    const client = createOSSClient();
    
    const result = await client.put(LOGISTICS_INVOICE_CONFIG_OSS_PATH, configBuffer, {
      headers: {
        'Content-Type': 'application/json',
        'x-oss-storage-class': 'Standard'
      }
    });
    
    console.log('✅ 物流商发票配置保存成功:', result.name);
    return true;
  } catch (error) {
    console.error('❌ 保存物流商发票配置失败:', error);
    throw error;
  }
}

// 获取当前模板配置
router.get('/amazon-template/config', async (req, res) => {
  try {
    const { country } = req.query;
    
    // 从OSS获取配置
    const allConfigs = await getTemplateConfigFromOSS();
    
    if (country) {
      // 获取特定国家的模板配置
      const countryConfig = allConfigs[country];
      if (countryConfig) {
        res.json({
          success: true,
          data: {
            hasTemplate: true,
            country: country,
            ...countryConfig
          }
        });
      } else {
        res.json({
          success: true,
          data: {
            hasTemplate: false,
            country: country,
            message: `尚未上传 ${country} 的亚马逊模板`
          }
        });
      }
    } else {
      // 获取所有国家的模板配置
      const hasAnyTemplate = Object.keys(allConfigs).length > 0;
      res.json({
        success: true,
        data: {
          hasTemplate: hasAnyTemplate,
          templates: allConfigs,
          countries: Object.keys(allConfigs),
          message: hasAnyTemplate ? '已配置模板' : '尚未上传任何亚马逊模板'
        }
      });
    }
  } catch (error) {
    console.error('❌ 获取模板配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模板配置失败'
    });
  }
});

// 上传亚马逊模板
router.post('/amazon-template/upload', (req, res, next) => {
  // Multer错误处理
  upload.single('template')(req, res, (err) => {
    if (err) {
      console.error('❌ Multer上传错误:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: '文件大小超过限制(最大10MB)'
        });
      } else if (err.message === '只允许上传Excel文件') {
        return res.status(400).json({
          success: false,
          message: '只支持Excel文件格式(.xlsx, .xls)'
        });
      } else {
        return res.status(500).json({
          success: false,
          message: '文件上传失败: ' + err.message
        });
      }
    }
    next();
  });
}, async (req, res) => {
  console.log('📥 收到亚马逊模板上传请求');
  console.log('📋 请求体参数:', req.body);
  console.log('📁 上传文件信息:', req.file ? {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  } : '无文件');
  
  try {
    if (!req.file) {
      console.error('❌ 未接收到文件');
      return res.status(400).json({
        success: false,
        message: '请选择要上传的Excel文件'
      });
    }

    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.status(500).json({
        success: false,
        message: 'OSS配置不完整，请联系管理员配置OSS服务'
      });
    }

    // 验证文件类型 - 只支持xlsx格式
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!validTypes.includes(req.file.mimetype) && !req.file.originalname.match(/\.(xlsx)$/i)) {
      return res.status(400).json({
        success: false,
        message: '请上传有效的Excel文件（仅支持.xlsx格式）'
      });
    }

    const { sheetName, merchantSkuColumn, quantityColumn, startRow, country, countryName } = req.body;

    if (!sheetName || !merchantSkuColumn || !quantityColumn || !startRow || !country) {
      console.error('❌ 缺少必填参数:', {
        sheetName, merchantSkuColumn, quantityColumn, startRow, country
      });
      return res.status(400).json({
        success: false,
        message: '请提供完整的模板配置信息，包括适用国家'
      });
    }

    // 验证Excel文件并获取sheet信息 - 使用ExcelJS保持完整格式
    let workbook, sheetNames;
    try {
      console.log('📖 正在使用ExcelJS读取Excel文件Buffer...');
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      sheetNames = workbook.worksheets.map(ws => ws.name);
      console.log('📊 ExcelJS文件读取成功，Sheet页:', sheetNames);
    } catch (excelError) {
      console.error('❌ ExcelJS文件读取失败:', excelError);
      return res.status(400).json({
        success: false,
        message: '无法读取Excel文件，请确保文件格式正确且未损坏'
      });
    }
    
    if (!sheetNames.includes(sheetName)) {
      console.error('❌ Sheet页不存在:', { requested: sheetName, available: sheetNames });
      return res.status(400).json({
        success: false,
        message: `模板中不存在sheet页: ${sheetName}。可用的sheet页: ${sheetNames.join(', ')}`,
        data: {
          availableSheets: sheetNames,
          requestedSheet: sheetName
        }
      });
    }

    // 读取现有配置
    let allConfigs = await getTemplateConfigFromOSS();

    // 如果该国家已有模板，先备份旧模板，然后删除
    if (allConfigs[country] && allConfigs[country].ossPath) {
      try {
        console.log(`🔄 ${country} 已有模板，正在备份旧模板...`);
        await backupTemplate(allConfigs[country].ossPath, 'amazon');
        await deleteTemplateFromOSS(allConfigs[country].ossPath);
        console.log(`✅ 已备份并删除 ${country} 的旧模板文件`);
      } catch (err) {
        console.warn(`⚠️ 处理 ${country} 旧模板文件失败:`, err.message);
      }
    }

    // 上传新模板文件到OSS
    console.log('☁️ 正在上传模板文件到OSS...');
    const uploadResult = await uploadTemplateToOSS(
      req.file.buffer,
      req.file.originalname,
      'amazon',
      null,
      country
    );

    if (!uploadResult.success) {
      throw new Error('模板文件上传到OSS失败');
    }

    // 保存该国家的模板配置
    const config = {
      originalName: req.file.originalname,
      ossPath: uploadResult.name,
      ossUrl: uploadResult.url,
      uploadTime: new Date().toISOString(),
      sheetName: sheetName,
      merchantSkuColumn: merchantSkuColumn.toUpperCase(),
      quantityColumn: quantityColumn.toUpperCase(),
      startRow: parseInt(startRow),
      sheetNames: sheetNames, // 保存所有可用的sheet名称
      country: country,
      countryName: countryName || country,
      fileSize: uploadResult.size
    };

    allConfigs[country] = config;
    
    // 保存配置文件到OSS
    try {
      console.log('💾 正在保存配置文件到OSS...');
      await saveTemplateConfigToOSS(allConfigs);
      console.log('✅ 配置文件保存成功');
    } catch (saveError) {
      console.error('❌ 配置文件保存失败:', saveError);
      // 如果配置保存失败，尝试删除已上传的模板文件
      try {
        await deleteTemplateFromOSS(uploadResult.name);
      } catch (deleteError) {
        console.error('❌ 回滚失败，删除已上传文件失败:', deleteError);
      }
      return res.status(500).json({
        success: false,
        message: '模板配置保存失败: ' + saveError.message
      });
    }

    console.log('✅ 模板上传完成:', country);
    res.json({
      success: true,
      message: `${countryName || country} 亚马逊模板上传成功`,
      data: {
        hasTemplate: true,
        country: country,
        ...config
      }
    });

  } catch (error) {
    console.error('❌ 上传亚马逊模板失败:', error);
    res.status(500).json({
      success: false,
      message: '上传模板失败: ' + error.message
    });
  }
});

// 生成亚马逊发货文件
router.post('/amazon-template/generate', async (req, res) => {
  try {
    const { shippingData, country } = req.body;

    if (!shippingData || !Array.isArray(shippingData)) {
      return res.status(400).json({
        success: false,
        message: '请提供发货数据'
      });
    }

    // 获取模板配置
    const allConfigs = await getTemplateConfigFromOSS();
    
    if (!allConfigs || Object.keys(allConfigs).length === 0) {
      return res.status(400).json({
        success: false,
        message: '尚未配置亚马逊模板，请先上传模板'
      });
    }
    
    // 按国家分组发货数据
    const dataByCountry = {};
    shippingData.forEach(item => {
      // 从发货数据中获取国家信息，优先使用传入的country参数
      const itemCountry = country || item.country || '默认';
      if (!dataByCountry[itemCountry]) {
        dataByCountry[itemCountry] = [];
      }
      dataByCountry[itemCountry].push(item);
    });

    const generatedFiles = [];

    // 为每个国家生成对应的文件
    for (const [itemCountry, countryData] of Object.entries(dataByCountry)) {
      const config = allConfigs[itemCountry];
      
      if (!config) {
        console.warn(`⚠️ 未找到 ${itemCountry} 的模板配置，跳过生成`);
        continue;
      }
      
      if (!config.ossPath) {
        console.warn(`⚠️ ${itemCountry} 的模板文件路径不存在`);
        continue;
      }

      // 按Amazon SKU汇总该国家的数量
      const amazonSkuSummary = {};
      countryData.forEach(item => {
        if (amazonSkuSummary[item.amz_sku]) {
          amazonSkuSummary[item.amz_sku] += item.quantity;
        } else {
          amazonSkuSummary[item.amz_sku] = item.quantity;
        }
      });

      // 从OSS下载模板文件 - 使用ExcelJS完美保持格式
      let workbook, worksheet;
      try {
        console.log(`📥 正在从OSS下载 ${itemCountry} 的模板文件...`);
        const downloadResult = await downloadTemplateFromOSS(config.ossPath);
        if (!downloadResult.success) {
          throw new Error('下载失败');
        }
        
        // 使用ExcelJS读取模板文件，完美保持所有格式
        console.log(`🔍 使用ExcelJS读取模板，完美保持所有格式...`);
        workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(downloadResult.content);
        worksheet = workbook.getWorksheet(config.sheetName);
        
        if (!worksheet) {
          throw new Error(`Sheet页 "${config.sheetName}" 不存在`);
        }
        
        console.log(`✅ ${itemCountry} 模板文件下载并读取成功，使用ExcelJS保持完整格式`);
        console.log(`📊 工作表信息: 行数=${worksheet.rowCount}, 列数=${worksheet.columnCount}`);
      } catch (downloadError) {
        console.error(`❌ ${itemCountry} 模板文件处理失败:`, downloadError);
        continue;
      }

      // 使用ExcelJS完美填写数据，保持所有原始格式
      let currentRow = config.startRow;
      
      console.log(`📝 开始使用ExcelJS填写数据，起始行: ${currentRow}`);
      console.log(`📝 目标列: SKU=${config.merchantSkuColumn}, 数量=${config.quantityColumn}`);
      
      Object.entries(amazonSkuSummary).forEach(([amzSku, quantity]) => {
        // 使用ExcelJS的方式填写SKU列，完美保持所有格式
        const skuCell = worksheet.getCell(`${config.merchantSkuColumn}${currentRow}`);
        skuCell.value = amzSku;
        console.log(`📝 ExcelJS填写SKU: ${config.merchantSkuColumn}${currentRow} = ${amzSku}`);

        // 使用ExcelJS的方式填写数量列，完美保持所有格式
        const quantityCell = worksheet.getCell(`${config.quantityColumn}${currentRow}`);
        quantityCell.value = quantity;
        console.log(`📝 ExcelJS填写数量: ${config.quantityColumn}${currentRow} = ${quantity}`);

        currentRow++;
      });
      
      console.log(`✅ ExcelJS完成数据填写，共填写 ${Object.keys(amazonSkuSummary).length} 行数据`);

      // ExcelJS会自动管理工作表范围，无需手动更新
      console.log(`📋 ${itemCountry} ExcelJS自动管理工作表范围，数据已填写到第${currentRow-1}行`);

      // 生成新的文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const countryCode = itemCountry.replace(/[^a-zA-Z0-9]/g, '');
      const outputFilename = `amazon-upload-${countryCode}-${timestamp}.xlsx`;
      const outputPath = path.join(uploadsDir, outputFilename);

      // 使用ExcelJS保存文件，完美保持所有原始格式
      console.log(`💾 使用ExcelJS保存文件到: ${outputPath}`);
      await workbook.xlsx.writeFile(outputPath);
      console.log(`✅ ${itemCountry} 文件保存成功，所有格式完美保持`);

      generatedFiles.push({
        country: itemCountry,
        countryName: config.countryName || itemCountry,
        filename: outputFilename,
        downloadUrl: `/api/shipping/amazon-template/download/${outputFilename}`,
        itemCount: Object.keys(amazonSkuSummary).length,
        totalQuantity: Object.values(amazonSkuSummary).reduce((sum, qty) => sum + qty, 0),
        summary: amazonSkuSummary
      });
    }

    if (generatedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有找到对应国家的模板配置，无法生成文件'
      });
    }

    res.json({
      success: true,
      message: `成功生成 ${generatedFiles.length} 个国家的亚马逊发货文件`,
      data: {
        files: generatedFiles,
        totalCountries: generatedFiles.length,
        totalItems: generatedFiles.reduce((sum, file) => sum + file.itemCount, 0),
        totalQuantity: generatedFiles.reduce((sum, file) => sum + file.totalQuantity, 0)
      }
    });

  } catch (error) {
    console.error('❌ 生成亚马逊发货文件失败:', error);
    res.status(500).json({
      success: false,
      message: '生成发货文件失败: ' + error.message
    });
  }
});

// 下载生成的亚马逊文件
router.get('/amazon-template/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('❌ 文件下载失败:', err);
        res.status(500).json({
          success: false,
          message: '文件下载失败'
        });
      }
    });
  } catch (error) {
    console.error('❌ 下载文件失败:', error);
    res.status(500).json({
      success: false,
      message: '下载失败'
    });
  }
});

// 删除模板配置
router.delete('/amazon-template/config', async (req, res) => {
  try {
    const { country } = req.query;

    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.status(500).json({
        success: false,
        message: 'OSS配置不完整，无法删除模板'
      });
    }

    const allConfigs = await getTemplateConfigFromOSS();

    if (!allConfigs || Object.keys(allConfigs).length === 0) {
      return res.json({
        success: true,
        message: '没有模板配置需要删除'
      });
    }

    if (country) {
      // 删除特定国家的模板配置
      if (allConfigs[country]) {
        const config = allConfigs[country];
        
        // 先备份然后删除OSS中的模板文件
        if (config.ossPath) {
          try {
            console.log(`🔄 正在备份并删除 ${country} 的模板文件...`);
            await backupTemplate(config.ossPath, 'amazon');
            await deleteTemplateFromOSS(config.ossPath);
            console.log(`✅ ${country} 模板文件已备份并删除`);
          } catch (deleteError) {
            console.warn(`⚠️ 删除 ${country} 模板文件失败:`, deleteError.message);
            // 即使文件删除失败，也继续删除配置
          }
        }
        
        // 从配置中删除该国家
        delete allConfigs[country];
        
        // 更新配置文件
        try {
          if (Object.keys(allConfigs).length > 0) {
            await saveTemplateConfigToOSS(allConfigs);
          } else {
            // 如果没有配置了，删除配置文件
            await deleteTemplateFromOSS(TEMPLATE_CONFIG_OSS_PATH);
          }
        } catch (saveError) {
          console.error('❌ 更新配置文件失败:', saveError);
          return res.status(500).json({
            success: false,
            message: '配置文件更新失败: ' + saveError.message
          });
        }

        res.json({
          success: true,
          message: `${config.countryName || country} 模板配置已删除`
        });
      } else {
        res.json({
          success: true,
          message: `${country} 没有模板配置需要删除`
        });
      }
    } else {
      // 删除所有模板配置
      console.log('🗑️ 正在删除所有亚马逊模板配置...');
      
      for (const [countryCode, config] of Object.entries(allConfigs)) {
        if (config.ossPath) {
          try {
            console.log(`🔄 正在备份并删除 ${countryCode} 的模板文件...`);
            await backupTemplate(config.ossPath, 'amazon');
            await deleteTemplateFromOSS(config.ossPath);
            console.log(`✅ ${countryCode} 模板文件已备份并删除`);
          } catch (deleteError) {
            console.warn(`⚠️ 删除 ${countryCode} 模板文件失败:`, deleteError.message);
          }
        }
      }
      
      // 删除配置文件
      try {
        await deleteTemplateFromOSS(TEMPLATE_CONFIG_OSS_PATH);
      } catch (deleteError) {
        console.warn('⚠️ 删除配置文件失败:', deleteError.message);
      }

      res.json({
        success: true,
        message: '所有模板配置已删除'
      });
    }
  } catch (error) {
    console.error('❌ 删除模板配置失败:', error);
    res.status(500).json({
      success: false,
      message: '删除模板配置失败'
    });
  }
});

// 获取发货历史列表
router.get('/shipment-history', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到获取发货历史请求:', JSON.stringify(req.query, null, 2));
  
  try {
    const { page = 1, limit = 10, status, operator, date_from, date_to } = req.query;
    
    const whereCondition = {};
    
    // 添加状态筛选
    if (status) {
      whereCondition.status = status;
    }
    
    // 添加操作员筛选
    if (operator) {
      whereCondition.operator = { [Op.like]: `%${operator}%` };
    }
    
    // 添加日期范围筛选
    if (date_from || date_to) {
      whereCondition.created_at = {};
      if (date_from) {
        whereCondition.created_at[Op.gte] = new Date(date_from);
      }
      if (date_to) {
        whereCondition.created_at[Op.lte] = new Date(date_to + ' 23:59:59');
      }
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    console.log('\x1b[35m%s\x1b[0m', '🔍 查询条件:', JSON.stringify({ whereCondition, offset, limit: parseInt(limit) }, null, 2));
    
    // 查询发货记录
    const { count, rows } = await ShipmentRecord.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: OrderShipmentRelation,
          as: 'orderRelations',
          attributes: ['need_num', 'total_requested', 'total_shipped', 'completion_status'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });
    
    console.log('\x1b[32m%s\x1b[0m', '📊 查询结果:', { count, rowsLength: rows.length });
    
    // 处理数据，添加完成状态统计
    const processedRows = rows.map(row => {
      const orderRelations = row.orderRelations || [];
      const totalRequested = orderRelations.reduce((sum, rel) => sum + rel.total_requested, 0);
      const totalShipped = orderRelations.reduce((sum, rel) => sum + rel.total_shipped, 0);
      
      // 计算整体完成状态
      let overallStatus = '全部完成';
      if (orderRelations.length > 0) {
        const hasPartial = orderRelations.some(rel => rel.completion_status === '部分完成');
        if (hasPartial) {
          overallStatus = '部分完成';
        }
      }
      
      // 统计需求单数量，区分正常需求单和临时发货
          const normalOrders = orderRelations.filter(rel => !rel.need_num.startsWith('TEMP-') && !rel.need_num.startsWith('MANUAL-')).length;
    const tempOrders = orderRelations.filter(rel => rel.need_num.startsWith('TEMP-') || rel.need_num.startsWith('MANUAL-')).length;
      const displayOrderCount = normalOrders + (tempOrders > 0 ? 1 : 0); // 临时发货合并显示为1个
      
      return {
        ...row.toJSON(),
        total_requested: totalRequested,
        total_shipped: totalShipped,
        completion_status: overallStatus,
        order_count: displayOrderCount,
        normal_orders: normalOrders,
        temp_orders: tempOrders,
        has_temp_shipment: tempOrders > 0 // 标记是否包含临时发货
      };
    });
    
    res.json({
      code: 0,
      message: '获取发货历史成功',
      data: {
        records: processedRows,
        pagination: {
          current: parseInt(page),
          pageSize: parseInt(limit),
          total: count
        }
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取发货历史失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取发货历史失败',
      error: error.message
    });
  }
});

// 批量删除发货记录
router.delete('/shipment-history', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到批量删除发货记录请求:', JSON.stringify(req.body, null, 2));
  
  const transaction = await sequelize.transaction();
  
  try {
    const { shipment_ids } = req.body;
    
    if (!shipment_ids || !Array.isArray(shipment_ids) || shipment_ids.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '发货记录ID不能为空'
      });
    }
    
    console.log('\x1b[33m%s\x1b[0m', '🗑️ 开始删除发货记录:', shipment_ids);
    
    // 1. 先查询要删除的发货明细，计算每个SKU的发货数量
    const shipmentItems = await ShipmentItem.findAll({
      where: {
        shipment_id: { [Op.in]: shipment_ids }
      },
      transaction
    });
    
    // 2. 按SKU和国家分组统计发货数量
    const shipmentSummary = new Map();
    shipmentItems.forEach(item => {
      const key = `${item.local_sku}-${item.country}`;
      if (!shipmentSummary.has(key)) {
        shipmentSummary.set(key, 0);
      }
      shipmentSummary.set(key, shipmentSummary.get(key) + item.shipped_quantity);
    });
    
    console.log('\x1b[33m%s\x1b[0m', '📊 待恢复的发货汇总:', Array.from(shipmentSummary.entries()));
    
    // 3. 恢复库存记录的shipped_quantity（按先进先出原则）
    let restoredLocalBoxes = [0];
    
    for (const [skuCountryKey, shippedQty] of shipmentSummary) {
      const [sku, country] = skuCountryKey.split('-');
      
      // 查找参与此次发货的库存记录（按先进先出原则）
      const inventoryRecords = await LocalBox.findAll({
        where: {
          sku: sku,
          country: country,
          total_quantity: { [Op.gt]: 0 },  // 正数库存记录
          shipped_quantity: { [Op.gt]: 0 }  // 有已出库数量的记录
        },
        order: [['time', 'ASC']],  // 按时间排序
        transaction
      });
      
      // 按先进先出原则恢复库存
      let remainingToRestore = shippedQty;
      
      for (const record of inventoryRecords) {
        if (remainingToRestore <= 0) break;
        
        const currentShipped = record.shipped_quantity || 0;
        const toRestoreFromThis = Math.min(remainingToRestore, currentShipped);
        const newShippedQuantity = Math.max(0, currentShipped - toRestoreFromThis);
        
        // 根据新的shipped_quantity确定状态
        let newStatus;
        if (newShippedQuantity === 0) {
          newStatus = '待出库';
        } else if (newShippedQuantity < record.total_quantity) {
          newStatus = '部分出库';
        } else {
          newStatus = '已出库';
        }
        
        await LocalBox.update({
          status: newStatus,
          shipped_quantity: newShippedQuantity,
          shipped_at: newStatus === '待出库' ? null : record.shipped_at,
          last_updated_at: new Date(),
          remark: sequelize.fn('CONCAT', 
            sequelize.fn('IFNULL', sequelize.col('remark'), ''),
            `;\n${new Date().toISOString()} 删除发货记录，恢复库存数量${toRestoreFromThis}`
          )
        }, {
          where: { 记录号: record.记录号 },
          transaction
        });
        
        restoredLocalBoxes[0]++;
        remainingToRestore -= toRestoreFromThis;
        
        console.log(`✅ 恢复库存: ${record.记录号}, SKU: ${sku}, 恢复数量: ${toRestoreFromThis}, 新状态: ${newStatus}`);
      }
      
      if (remainingToRestore > 0) {
        console.warn(`⚠️ SKU ${sku} 在 ${country} 还有 ${remainingToRestore} 数量无法恢复`);
      }
    }
    
    // 4. 恢复需求记录状态
    const needRecordIds = [...new Set(shipmentItems
      .map(item => item.order_item_id)
      .filter(id => id && id > 0)
    )];
    
    if (needRecordIds.length > 0) {
      console.log('\x1b[33m%s\x1b[0m', '📋 检查需求记录状态:', needRecordIds);
      
      // 检查这些需求记录是否还有其他发货记录
      for (const recordId of needRecordIds) {
        const otherShipments = await ShipmentItem.count({
          where: {
            order_item_id: recordId,
            shipment_id: { [Op.notIn]: shipment_ids }
          },
          transaction
        });
        
        // 如果没有其他发货记录，恢复为待发货状态
        if (otherShipments === 0) {
          await WarehouseProductsNeed.update(
            { status: '待发货' },
            { 
              where: { record_num: recordId },
              transaction 
            }
          );
          console.log(`✅ 恢复需求记录状态: ${recordId} -> 待发货`);
        } else {
          console.log(`📋 需求记录 ${recordId} 还有其他发货记录，保持当前状态`);
        }
      }
    }
    
    // 5. 删除发货明细
    const deletedItems = await ShipmentItem.destroy({
      where: {
        shipment_id: { [Op.in]: shipment_ids }
      },
      transaction
    });
    
    // 6. 删除订单发货关联记录
    const deletedRelations = await OrderShipmentRelation.destroy({
      where: {
        shipment_id: { [Op.in]: shipment_ids }
      },
      transaction
    });
    
    // 7. 删除发货记录主表
    const deletedRecords = await ShipmentRecord.destroy({
      where: {
        shipment_id: { [Op.in]: shipment_ids }
      },
      transaction
    });
    
    await transaction.commit();
    
    console.log('\x1b[32m%s\x1b[0m', '✅ 批量删除成功:', {
      deletedRecords,
      deletedItems,
      deletedRelations,
      restoredLocalBoxes: restoredLocalBoxes[0]
    });
    
    res.json({
      code: 0,
      message: '批量删除成功',
      data: {
        deleted_records: deletedRecords,
        deleted_items: deletedItems,
        deleted_relations: deletedRelations,
        restored_local_boxes: restoredLocalBoxes[0]
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('\x1b[31m%s\x1b[0m', '❌ 批量删除失败:', error);
    res.status(500).json({
      code: 1,
      message: '批量删除失败',
      error: error.message
    });
  }
});

// 撤销发货记录（单个）
router.post('/shipment-cancel/:shipment_id', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到撤销发货记录请求:', req.params.shipment_id);
  
  const transaction = await sequelize.transaction();
  
  try {
    const { shipment_id } = req.params;
    const { reason = '用户撤销' } = req.body;
    
    // 验证发货记录是否存在
    const shipmentRecord = await ShipmentRecord.findByPk(shipment_id);
    if (!shipmentRecord) {
      await transaction.rollback();
      return res.status(404).json({
        code: 1,
        message: '发货记录不存在'
      });
    }
    
    // 验证发货记录状态
    if (shipmentRecord.status === '已取消') {
      await transaction.rollback();
      return res.status(400).json({
        code: 1,
        message: '该发货记录已经被取消'
      });
    }
    
    console.log('\x1b[33m%s\x1b[0m', '🔄 开始撤销发货记录:', shipment_id);
    
    // 1. 先查询要撤销的发货明细，计算每个SKU的发货数量
    const shipmentItems = await ShipmentItem.findAll({
      where: { shipment_id: shipment_id },
      transaction
    });
    
    // 2. 按SKU和国家分组统计发货数量
    const shipmentSummary = new Map();
    shipmentItems.forEach(item => {
      const key = `${item.local_sku}-${item.country}`;
      if (!shipmentSummary.has(key)) {
        shipmentSummary.set(key, 0);
      }
      shipmentSummary.set(key, shipmentSummary.get(key) + item.shipped_quantity);
    });
    
    console.log('\x1b[33m%s\x1b[0m', '📊 待恢复的发货汇总:', Array.from(shipmentSummary.entries()));
    
    // 3. 恢复库存记录的shipped_quantity（按先进先出原则）
    let restoredLocalBoxes = [0];
    
    for (const [skuCountryKey, shippedQty] of shipmentSummary) {
      const [sku, country] = skuCountryKey.split('-');
      
      // 查找参与此次发货的原有库存记录（按先进先出原则）
      const inventoryRecords = await LocalBox.findAll({
        where: {
          sku: sku,
          country: country,
          total_quantity: { [Op.gt]: 0 },  // 正数库存记录
          shipped_quantity: { [Op.gt]: 0 }  // 有已出库数量的记录
        },
        order: [['time', 'ASC']],  // 按时间排序
        transaction
      });
      
      // 按先进先出原则恢复库存
      let remainingToRestore = shippedQty;
      
      for (const record of inventoryRecords) {
        if (remainingToRestore <= 0) break;
        
        const currentShipped = record.shipped_quantity || 0;
        const toRestoreFromThis = Math.min(remainingToRestore, currentShipped);
        const newShippedQuantity = Math.max(0, currentShipped - toRestoreFromThis);
        
        // 根据新的shipped_quantity确定状态
        let newStatus;
        if (newShippedQuantity === 0) {
          newStatus = '待出库';
        } else if (newShippedQuantity < record.total_quantity) {
          newStatus = '部分出库';
        } else {
          newStatus = '已出库';
        }
        
        await LocalBox.update({
          status: newStatus,
          shipped_quantity: newShippedQuantity,
          shipped_at: newStatus === '待出库' ? null : record.shipped_at,
          last_updated_at: new Date(),
          remark: sequelize.fn('CONCAT', 
            sequelize.fn('IFNULL', sequelize.col('remark'), ''),
            `;\n${new Date().toISOString()} 撤销发货: ${reason}，恢复库存数量${toRestoreFromThis}`
          )
        }, {
          where: { 记录号: record.记录号 },
          transaction
        });
        
        restoredLocalBoxes[0]++;
        remainingToRestore -= toRestoreFromThis;
        
        console.log(`✅ 恢复库存: ${record.记录号}, SKU: ${sku}, 恢复数量: ${toRestoreFromThis}, 新状态: ${newStatus}`);
      }
      
      if (remainingToRestore > 0) {
        console.warn(`⚠️ SKU ${sku} 在 ${country} 还有 ${remainingToRestore} 数量无法恢复`);
      }
    }
    
    // 恢复需求记录状态（如果完全撤销）
    const needRecordIds = [...new Set(shipmentItems.map(item => item.order_item_id))];
    if (needRecordIds.length > 0) {
      // 检查这些需求记录是否还有其他发货记录
      for (const recordId of needRecordIds) {
        const otherShipments = await ShipmentItem.count({
          where: {
            order_item_id: recordId,
            shipment_id: { [Op.ne]: shipment_id }
          }
        });
        
        // 如果没有其他发货记录，恢复为待发货状态
        if (otherShipments === 0) {
          await WarehouseProductsNeed.update(
            { status: '待发货' },
            { 
              where: { record_num: recordId },
              transaction 
            }
          );
        }
      }
    }
    
    // 3. 删除发货明细
    const deletedItems = await ShipmentItem.destroy({
      where: { shipment_id: shipment_id },
      transaction
    });
    
    // 4. 删除订单发货关联记录
    const deletedRelations = await OrderShipmentRelation.destroy({
      where: { shipment_id: shipment_id },
      transaction
    });
    
    // 5. 更新发货记录状态为已取消（而非删除）
    await ShipmentRecord.update({
      status: '已取消',
      remark: sequelize.fn('CONCAT', 
        sequelize.fn('IFNULL', sequelize.col('remark'), ''),
        `;\n${new Date().toISOString()} 撤销原因: ${reason}`
      ),
      updated_at: new Date()
    }, {
      where: { shipment_id: shipment_id },
      transaction
    });
    
    await transaction.commit();
    
    console.log('\x1b[32m%s\x1b[0m', '✅ 发货撤销成功:', {
      shipment_id,
      restoredLocalBoxes: restoredLocalBoxes[0],
      deletedItems,
      deletedRelations,
      restoredNeedRecords: needRecordIds.length
    });
    
    res.json({
      code: 0,
      message: '发货撤销成功',
      data: {
        shipment_id: parseInt(shipment_id),
        restored_local_boxes: restoredLocalBoxes[0],
        deleted_items: deletedItems,
        deleted_relations: deletedRelations,
        restored_need_records: needRecordIds.length
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('\x1b[31m%s\x1b[0m', '❌ 撤销发货失败:', error);
    res.status(500).json({
      code: 1,
      message: '撤销发货失败',
      error: error.message
    });
  }
});

// 获取发货记录详细信息（包含发货明细）
router.get('/shipment-history/:shipment_id', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到获取发货详情请求:', req.params.shipment_id);
  
  try {
    const { shipment_id } = req.params;
    
    // 查询发货记录基本信息
    const shipmentRecord = await ShipmentRecord.findByPk(shipment_id, {
      include: [
        {
          model: OrderShipmentRelation,
          as: 'orderRelations',
          attributes: ['need_num', 'total_requested', 'total_shipped', 'completion_status']
        }
      ]
    });
    
    if (!shipmentRecord) {
      return res.status(404).json({
        code: 1,
        message: '发货记录不存在'
      });
    }
    
    // 查询发货明细
    const shipmentItems = await ShipmentItem.findAll({
      where: { shipment_id: shipment_id },
      order: [['created_at', 'ASC']]
    });
    
    // 查询相关的出库记录
    const outboundRecords = await LocalBox.findAll({
      where: { 
        shipment_id: shipment_id,
        status: '已出库'
      },
      attributes: ['记录号', 'sku', 'total_quantity', 'total_boxes', 'country', 'time', 'mix_box_num', 'box_type', 'shipped_at', 'remark'],
      order: [['time', 'ASC']]
    });
    
    // 统计信息
    const statistics = {
      total_items: shipmentItems.length,
      total_quantity: shipmentItems.reduce((sum, item) => sum + item.shipped_quantity, 0),
      total_boxes: shipmentRecord.total_boxes,
      whole_boxes: shipmentItems.reduce((sum, item) => sum + item.whole_boxes, 0),
      mixed_box_quantity: shipmentItems.reduce((sum, item) => sum + item.mixed_box_quantity, 0),
      countries: [...new Set(shipmentItems.map(item => item.country))],
      need_nums: [...new Set(shipmentItems.map(item => item.need_num))]
    };

    // 生成汇总信息，兼容前端显示需求
    const orderRelations = shipmentRecord.orderRelations || [];
    const totalRequested = shipmentItems.reduce((sum, item) => sum + item.requested_quantity, 0);
    const totalShipped = shipmentItems.reduce((sum, item) => sum + item.shipped_quantity, 0);
    const completionRate = totalRequested > 0 ? Math.round((totalShipped / totalRequested) * 100) : 100;
    
    // 统计需求单数量（排除临时发货的重复统计）
    const uniqueNeedNums = [...new Set(shipmentItems.map(item => item.need_num))];
    const normalNeedNums = uniqueNeedNums.filter(needNum => !needNum.startsWith('TEMP-') && !needNum.startsWith('MANUAL-'));
    const tempNeedNums = uniqueNeedNums.filter(needNum => needNum.startsWith('TEMP-') || needNum.startsWith('MANUAL-'));
    
    const summary = {
      total_need_orders: normalNeedNums.length + (tempNeedNums.length > 0 ? 1 : 0), // 临时发货算作1个需求单
      total_sku_count: [...new Set(shipmentItems.map(item => item.local_sku))].length,
      total_requested: totalRequested,
      total_shipped: totalShipped,
      overall_completion_rate: completionRate,
      normal_orders: normalNeedNums.length,
      temp_orders: tempNeedNums.length
    };
    
    res.json({
      code: 0,
      message: '获取发货详情成功',
      data: {
        shipment_record: shipmentRecord,
        shipment_items: shipmentItems,
        outbound_records: outboundRecords,
        statistics: statistics,
        summary: summary // 新增汇总信息，支持临时发货显示
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取发货详情失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取发货详情失败',
      error: error.message
    });
  }
});

// 装箱表相关API

// 配置装箱表上传的multer
const packingListStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, '../uploads/packing-lists');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // 保持原始文件名，只在前面加时间戳避免冲突
    const timestamp = Date.now();
    const originalName = file.originalname;
    cb(null, `${timestamp}_${originalName}`);
  }
});

const uploadPackingList = multer({
  storage: packingListStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('只允许上传Excel文件'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB限制
  }
});

// 自动分析装箱表Excel文件
router.post('/packing-list/analyze', uploadPackingList.single('packingList'), async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到装箱表自动分析请求');
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要分析的文件'
      });
    }

    console.log('\x1b[33m%s\x1b[0m', '📁 文件信息:', {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size
    });

    // 使用ExcelJS读取Excel文件，完美保持格式
    console.log('🔍 使用ExcelJS读取装箱表分析文件...');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const sheetNames = workbook.worksheets.map(sheet => sheet.name);
    
    // 自动分析配置
    const autoConfig = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      sheetNames: sheetNames,
      sheetName: sheetNames[0], // 默认使用第一个Sheet
      headerRow: 5,  // 默认第5行
      skuStartRow: 6, // 默认第6行
      boxStartColumn: 'L', // 默认L列
      boxCount: 5 // 默认5个箱子
    };

    // 尝试自动检测配置
    for (const sheetName of sheetNames) {
      const worksheet = workbook.getWorksheet(sheetName);
      
      // 将ExcelJS工作表数据转换为数组格式，便于分析
      const data = [];
      for (let rowNum = 1; rowNum <= worksheet.rowCount; rowNum++) {
        const row = worksheet.getRow(rowNum);
        const rowData = [];
        for (let colNum = 1; colNum <= worksheet.columnCount; colNum++) {
          const cell = row.getCell(colNum);
          rowData.push(cell.value || '');
        }
        data.push(rowData);
      }
      
      // 查找包含"Box 1 quantity"等关键字的行作为标题行
      for (let rowIndex = 0; rowIndex < Math.min(10, data.length); rowIndex++) {
        const row = data[rowIndex];
        if (!row || !Array.isArray(row)) continue;
        
                   for (let colIndex = 0; colIndex < row.length; colIndex++) {
             const cellValue = String(row[colIndex] || '').toLowerCase().trim();
             // 更精确的匹配模式：Box [数字] quantity 或 Box[数字] quantity
             if ((cellValue.includes('box') && cellValue.includes('quantity')) || 
                 cellValue.match(/box\s*\d+\s*quantity/i) ||
                 cellValue.match(/box\s*\d+/i)) {
               autoConfig.sheetName = sheetName;
               autoConfig.headerRow = rowIndex + 1; // 转换为1基索引
               
               // 智能寻找SKU开始行
               let skuRow = rowIndex + 2; // 默认下一行
               for (let searchRow = rowIndex + 1; searchRow < Math.min(rowIndex + 5, data.length); searchRow++) {
                 const searchRowData = data[searchRow];
                 if (searchRowData && searchRowData[0] && 
                     String(searchRowData[0]).trim() !== '' && 
                     !String(searchRowData[0]).toLowerCase().includes('box') &&
                     !String(searchRowData[0]).toLowerCase().includes('weight') &&
                     !String(searchRowData[0]).toLowerCase().includes('dimension')) {
                   skuRow = searchRow + 1;
                   break;
                 }
               }
               autoConfig.skuStartRow = skuRow;
               
               // 找到第一个Box列
               const getColumnLetter = (index) => {
                 let letter = '';
                 let temp = index;
                 while (temp >= 0) {
                   letter = String.fromCharCode(65 + (temp % 26)) + letter;
                   temp = Math.floor(temp / 26) - 1;
                 }
                 return letter;
               };
               
               autoConfig.boxStartColumn = getColumnLetter(colIndex);
               
               // 更准确地计算箱子总数
               let boxCount = 0;
               let firstBoxIndex = colIndex;
               for (let i = colIndex; i < row.length; i++) {
                 const cellVal = String(row[i] || '').toLowerCase().trim();
                 if ((cellVal.includes('box') && cellVal.includes('quantity')) || 
                     cellVal.match(/box\s*\d+\s*quantity/i) ||
                     cellVal.match(/box\s*\d+/i)) {
                   boxCount++;
                   if (boxCount === 1) {
                     firstBoxIndex = i;
                     autoConfig.boxStartColumn = getColumnLetter(i);
                   }
                 } else if (boxCount > 0 && cellVal !== '') {
                   // 如果已经开始计数并且遇到了非空的非Box列，可能要停止
                   // 但如果是空列，可能只是格式问题，继续检查
                   let isEndOfBoxes = true;
                   // 检查接下来的几列，如果有Box列就继续
                   for (let j = i + 1; j < Math.min(i + 3, row.length); j++) {
                     const nextCellVal = String(row[j] || '').toLowerCase().trim();
                     if ((nextCellVal.includes('box') && nextCellVal.includes('quantity')) || 
                         nextCellVal.match(/box\s*\d+\s*quantity/i) ||
                         nextCellVal.match(/box\s*\d+/i)) {
                       isEndOfBoxes = false;
                       break;
                     }
                   }
                   if (isEndOfBoxes) break;
                 }
               }
               autoConfig.boxCount = boxCount || 5;
               
               console.log('\x1b[32m%s\x1b[0m', '✅ 自动检测到配置:', autoConfig);
               break;
             }
           }
        
        // 如果已找到配置就跳出
        if (autoConfig.headerRow !== 5) break;
      }
      
      // 如果已找到配置就跳出
      if (autoConfig.headerRow !== 5) break;
    }

    // 删除临时文件
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({
      success: true,
      message: '装箱表分析完成',
      data: autoConfig
    });

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 装箱表分析失败:', error);
    
    // 清理已上传的文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: '装箱表分析失败: ' + error.message
    });
  }
});

// 上传装箱表（支持自动分析和填写Box packing information格式）
router.post('/packing-list/upload', uploadPackingList.single('packingList'), async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到装箱表上传请求:', JSON.stringify(req.body, null, 2));
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的文件'
      });
    }

    console.log('\x1b[33m%s\x1b[0m', '📁 文件信息:', {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size
    });

    // 使用ExcelJS读取Excel文件，完美保持格式
    console.log('🔍 使用ExcelJS读取装箱表上传文件...');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const sheetNames = workbook.worksheets.map(sheet => sheet.name);
    




    
    // 查找目标Sheet页
    
    let targetSheetName = null;
    
    if (sheetNames.includes('Box packing information')) {
      targetSheetName = 'Box packing information';
    } else {
      // 尝试模糊匹配
      const possibleMatches = sheetNames.filter(name => {
        const lowerName = name.toLowerCase();
        return lowerName.includes('box') && lowerName.includes('packing') && lowerName.includes('information');
      });
      
      if (possibleMatches.length > 0) {
        targetSheetName = possibleMatches[0];
      } else {
        
        // 删除临时文件
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        
        return res.status(400).json({
          success: false,
          message: `Excel文件中必须包含名为"Box packing information"的sheet页。\n\n当前文件包含的sheet页：\n${sheetNames.map((name, index) => `${index + 1}. "${name}" (长度: ${name.length}字符)`).join('\n')}\n\n请确保：\n1. Excel文件中有名为"Box packing information"的工作表\n2. 该工作表包含正确的装箱信息格式\n3. 工作表名称完全匹配（区分大小写）\n4. 注意可能的隐藏字符或空格`
        });
      }
    }
    
    const worksheet = workbook.getWorksheet(targetSheetName);
    
    if (!worksheet) {
      return res.status(400).json({
        success: false,
        message: `无法读取指定的Sheet页: "${targetSheetName}"`
      });
    }
    
    // 将ExcelJS工作表数据转换为数组格式，便于处理
    const data = [];
    for (let rowNum = 1; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const rowData = [];
      for (let colNum = 1; colNum <= worksheet.columnCount; colNum++) {
        const cell = row.getCell(colNum);
        rowData.push(cell.value || '');
      }
      data.push(rowData);
    }
    
    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Sheet页 "${targetSheetName}" 中没有数据`
      });
    }

    // 检查是否使用新的简化流程
    const { boxCount, startColumn, dataStartRow } = req.body;
    const useNewFlow = boxCount && startColumn && dataStartRow;

    // 解析列索引（A=0, B=1, C=2...）
    const getColumnIndex = (columnLetter) => {
      let result = 0;
      for (let i = 0; i < columnLetter.length; i++) {
        result = result * 26 + (columnLetter.toUpperCase().charCodeAt(i) - 65 + 1);
      }
      return result - 1;
    };

    // 获取列字母（0->A, 1->B, 25->Z, 26->AA...）
    const getColumnLetter = (index) => {
      let letter = '';
      while (index >= 0) {
        letter = String.fromCharCode(65 + (index % 26)) + letter;
        index = Math.floor(index / 26) - 1;
      }
      return letter;
    };

    let autoConfig;
    let headerRowIndex = -1;
    let headerRowData = [];
    
    // 定义所有流程共用的变量
    let skuStartRowIndex = -1;
    let skuEndRowIndex = -1;
    let boxColumns = [];
    let boxNumbers = [];

    if (useNewFlow) {
      // 新的简化流程：直接根据参数配置
      const numBoxes = parseInt(boxCount);
      const startColIndex = getColumnIndex(startColumn);
      const startRow = parseInt(dataStartRow);
      
      // 直接生成箱子配置
      const boxColumns = [];
      const boxNumbers = [];
      
      for (let i = 0; i < numBoxes; i++) {
        const colIndex = startColIndex + i;
        const colLetter = getColumnLetter(colIndex);
        const boxNumber = String(i + 1);
        
        boxColumns.push(colLetter);
        boxNumbers.push(boxNumber);
      }
      
      autoConfig = {
        sheetName: targetSheetName,
        headerRow: null, // 新流程不需要标题行
        skuStartRow: startRow, // 从指定行开始
        boxStartColumn: startColumn,
        boxCount: numBoxes,
        boxColumns: boxColumns,
        boxNumbers: boxNumbers,
        foundBoxWeightRow: null,
        foundBoxWidthRow: null,
        foundBoxLengthRow: null,
        foundBoxHeightRow: null
      };
      
      headerRowIndex = startRow - 2; // 设置一个虚拟的标题行索引，实际不使用
      
    } else {
      // 传统的自动分析流程
      autoConfig = {
        sheetName: targetSheetName,
        headerRow: 5,  // 第5行是箱号标题行
        skuStartRow: 6, // 第6行开始是SKU
        boxStartColumn: 'L', // 默认L列开始
        boxCount: 5, // 默认5个箱子
        boxColumns: [],
        boxNumbers: [],
        foundBoxWeightRow: null,
        foundBoxWidthRow: null,
        foundBoxLengthRow: null,
        foundBoxHeightRow: null
      };
      
      // 自动查找箱号标题行（在前10行中搜索）
    
    for (let rowIndex = 0; rowIndex < Math.min(10, data.length); rowIndex++) {
      const rowData = data[rowIndex] || [];
      
      // 检查这一行是否包含箱号标题
      let foundBoxHeaders = 0;
      
      for (let colIndex = 0; colIndex < rowData.length; colIndex++) {
        const cellValue = String(rowData[colIndex] || '').trim();
        const patterns = [
          /Box\s*(\d+)\s*quantity/i,
          /Box(\d+)\s*quantity/i,
          /Box\s*(\d+)/i,
          /(\d+).*box.*quantity/i,
          /quantity.*box\s*(\d+)/i,
          /箱子?\s*(\d+)/i,
          /第\s*(\d+)\s*箱/i
        ];
        
        for (const pattern of patterns) {
          if (cellValue.match(pattern)) {
            foundBoxHeaders++;
            break;
          }
        }
      }
      
      // 如果找到至少1个箱号标题，就认为这是标题行
      if (foundBoxHeaders > 0) {
        headerRowIndex = rowIndex;
        headerRowData = rowData;
        break;
      }
    }
    


    if (headerRowIndex === -1) {
      return res.status(400).json({
        success: false,
        message: '未能在前10行中找到箱号标题行。请确保Excel文件包含"Box X quantity"格式的标题。\n\n支持的格式示例：\n- "Box 1 quantity"\n- "Box 2 quantity"\n- "Box1 quantity"\n- "箱子1"\n- "第1箱"'
      });
    }
    
    // 查找所有包含"Box"和"quantity"的列
    boxColumns = [];
    boxNumbers = [];
    
    for (let colIndex = 0; colIndex < headerRowData.length; colIndex++) {
      const cellValue = String(headerRowData[colIndex] || '').trim();
      
      // 更灵活的匹配模式：支持多种格式
      let boxMatch = null;
      
      // 尝试多种匹配模式
      const patterns = [
        /Box\s*(\d+)\s*quantity/i,           // "Box 1 quantity"
        /Box(\d+)\s*quantity/i,              // "Box1 quantity"  
        /Box\s*(\d+)/i,                      // "Box 1"
        /(\d+).*box.*quantity/i,             // "1 box quantity"
        /quantity.*box\s*(\d+)/i,            // "quantity box 1"
        /箱子?\s*(\d+)/i,                    // "箱子1" 或 "箱1"
        /第\s*(\d+)\s*箱/i                   // "第1箱"
      ];
      
      for (const pattern of patterns) {
        const testMatch = cellValue.match(pattern);
        if (testMatch) {
          boxMatch = testMatch;
          break;
        }
      }
      
      if (boxMatch) {
        const boxNumber = boxMatch[1];
        const colLetter = getColumnLetter(colIndex);
        
        boxColumns.push(colLetter);
        boxNumbers.push(boxNumber);
        
        // 记录第一个箱子的列作为起始列
        if (boxColumns.length === 1) {
          autoConfig.boxStartColumn = colLetter;
        }
      }
    }

    autoConfig.boxColumns = boxColumns;
    autoConfig.boxNumbers = boxNumbers;
    autoConfig.boxCount = boxNumbers.length;

    if (boxColumns.length === 0) {
      // 提供更详细的错误信息
      const availableHeaders = headerRowData
        .map((header, index) => `列${getColumnLetter(index)}: "${String(header || '').trim()}"`)
        .filter(h => h.includes('"') && !h.includes('""'))
        .slice(0, 10); // 只显示前10个非空列
        
      return res.status(400).json({
        success: false,
        message: `未能在前10行中找到"Box X quantity"格式的标题，请确认文件格式正确。\n\n搜索的标题行范围：第1行到第${Math.min(10, data.length)}行\n\n最终确定的标题行（第${headerRowIndex + 1}行）内容：\n${availableHeaders.join('\n')}\n\n期望格式示例：\n- "Box 1 quantity"\n- "Box 2 quantity"\n- "Box1 quantity"\n- "箱子1"\n- "第1箱"`
      });
    }

    // 查找SKU开始行（从标题行的下一行开始）
    skuStartRowIndex = headerRowIndex + 1; // 从标题行的下一行开始
    skuEndRowIndex = skuStartRowIndex;

    // 向下查找，直到遇到空的SKU单元格或包含"Box"关键字的行
    for (let rowIndex = skuStartRowIndex; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex] || [];
      const skuCell = String(row[0] || '').trim();
      
      if (!skuCell || skuCell === '' || 
          skuCell.toLowerCase().includes('box') || 
          skuCell.toLowerCase().includes('weight') ||
          skuCell.toLowerCase().includes('width') ||
          skuCell.toLowerCase().includes('length') ||
          skuCell.toLowerCase().includes('height')) {
        break;
      }
      skuEndRowIndex = rowIndex;
    }

    // 查找箱子信息行（Box weight, Box width, Box length, Box height）
    for (let rowIndex = skuEndRowIndex + 1; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex] || [];
      const firstCell = String(row[0] || '').toLowerCase().trim();
      
      if (firstCell.includes('box') && firstCell.includes('weight')) {
        autoConfig.foundBoxWeightRow = rowIndex;
      } else if (firstCell.includes('box') && firstCell.includes('width')) {
        autoConfig.foundBoxWidthRow = rowIndex;
      } else if (firstCell.includes('box') && firstCell.includes('length')) {
        autoConfig.foundBoxLengthRow = rowIndex;
      } else if (firstCell.includes('box') && firstCell.includes('height')) {
        autoConfig.foundBoxHeightRow = rowIndex;
      }
    }

    // 解析装箱数据
    // 创建箱子信息
    for (let i = 0; i < boxNumbers.length; i++) {
      const boxNumber = boxNumbers[i];
      const colIndex = getColumnIndex(boxColumns[i]);
      
      const boxInfo = {
        box_num: boxNumber,
        weight: null,
        width: null,
        length: null,
        height: null
      };

      // 解析箱子尺寸信息
      if (autoConfig.foundBoxWeightRow !== null) {
        const weightValue = parseFloat(data[autoConfig.foundBoxWeightRow][colIndex]);
        if (!isNaN(weightValue) && weightValue > 0) {
          boxInfo.weight = weightValue;
        }
      }
      
      if (autoConfig.foundBoxWidthRow !== null) {
        const widthValue = parseFloat(data[autoConfig.foundBoxWidthRow][colIndex]);
        if (!isNaN(widthValue) && widthValue > 0) {
          boxInfo.width = widthValue;
        }
      }
      
      if (autoConfig.foundBoxLengthRow !== null) {
        const lengthValue = parseFloat(data[autoConfig.foundBoxLengthRow][colIndex]);
        if (!isNaN(lengthValue) && lengthValue > 0) {
          boxInfo.length = lengthValue;
        }
      }
      
      if (autoConfig.foundBoxHeightRow !== null) {
        const heightValue = parseFloat(data[autoConfig.foundBoxHeightRow][colIndex]);
        if (!isNaN(heightValue) && heightValue > 0) {
          boxInfo.height = heightValue;
        }
      }

      boxes.push(boxInfo);
    }

    // 解析SKU装箱数据
    for (let rowIndex = skuStartRowIndex; rowIndex <= skuEndRowIndex; rowIndex++) {
      const row = data[rowIndex] || [];
      const sku = String(row[0] || '').trim();
      
      if (!sku || sku === '') continue;

      // 解析每个箱子中的数量
      for (let i = 0; i < boxColumns.length; i++) {
        const colIndex = getColumnIndex(boxColumns[i]);
        const quantity = parseInt(row[colIndex]);
        
        if (!isNaN(quantity) && quantity > 0) {
          packingItems.push({
            box_num: boxNumbers[i],
            sku: sku,
            quantity: quantity
          });
        }
      }
    }



    } // 结束传统流程的else块

    // 通用的数据解析部分（对两种流程都适用）
    const packingItems = [];
    const boxes = [];

    if (useNewFlow) {
      // 新流程：直接从指定位置解析数据
      const startRowIndex = parseInt(dataStartRow) - 1; // 转换为0基索引
      
      // 查找SKU数据范围（从指定行开始，直到遇到空行）
      let skuEndRowIndex = startRowIndex;
      for (let rowIndex = startRowIndex; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex] || [];
        const skuCell = String(row[0] || '').trim();
        
        if (!skuCell || skuCell === '') {
          break;
        }
        skuEndRowIndex = rowIndex;
      }
      
      // 新流程中也查找箱子信息行（Box weight, Box width, Box length, Box height）
      for (let rowIndex = skuEndRowIndex + 1; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex] || [];
        const firstCell = String(row[0] || '').toLowerCase().trim();
        
        if (firstCell.includes('box') && firstCell.includes('weight')) {
          autoConfig.foundBoxWeightRow = rowIndex;
        } else if (firstCell.includes('box') && firstCell.includes('width')) {
          autoConfig.foundBoxWidthRow = rowIndex;
        } else if (firstCell.includes('box') && firstCell.includes('length')) {
          autoConfig.foundBoxLengthRow = rowIndex;
        } else if (firstCell.includes('box') && firstCell.includes('height')) {
          autoConfig.foundBoxHeightRow = rowIndex;
        }
      }
      
      // 创建箱子信息
      for (let i = 0; i < autoConfig.boxNumbers.length; i++) {
        const boxNumber = autoConfig.boxNumbers[i];
        const colIndex = getColumnIndex(autoConfig.boxColumns[i]);
        
        const boxInfo = {
          box_num: boxNumber,
          weight: null,
          width: null,
          length: null,
          height: null
        };

        // 解析箱子尺寸信息
        if (autoConfig.foundBoxWeightRow !== null) {
          const weightValue = parseFloat(data[autoConfig.foundBoxWeightRow][colIndex]);
          if (!isNaN(weightValue) && weightValue > 0) {
            boxInfo.weight = weightValue;
          }
        }
        
        if (autoConfig.foundBoxWidthRow !== null) {
          const widthValue = parseFloat(data[autoConfig.foundBoxWidthRow][colIndex]);
          if (!isNaN(widthValue) && widthValue > 0) {
            boxInfo.width = widthValue;
          }
        }
        
        if (autoConfig.foundBoxLengthRow !== null) {
          const lengthValue = parseFloat(data[autoConfig.foundBoxLengthRow][colIndex]);
          if (!isNaN(lengthValue) && lengthValue > 0) {
            boxInfo.length = lengthValue;
          }
        }
        
        if (autoConfig.foundBoxHeightRow !== null) {
          const heightValue = parseFloat(data[autoConfig.foundBoxHeightRow][colIndex]);
          if (!isNaN(heightValue) && heightValue > 0) {
            boxInfo.height = heightValue;
          }
        }

        boxes.push(boxInfo);
      }
      
      // 解析SKU装箱数据
      for (let rowIndex = startRowIndex; rowIndex <= skuEndRowIndex; rowIndex++) {
        const row = data[rowIndex] || [];
        const sku = String(row[0] || '').trim();
        
        if (!sku || sku === '') continue;
        
        // 解析每个箱子中的数量
        for (let i = 0; i < autoConfig.boxColumns.length; i++) {
          const colIndex = getColumnIndex(autoConfig.boxColumns[i]);
          const quantity = parseInt(row[colIndex]);
          
          if (!isNaN(quantity) && quantity > 0) {
            packingItems.push({
              box_num: autoConfig.boxNumbers[i],
              sku: sku,
              quantity: quantity
            });
          }
        }
      }
      

    }

    // 保存配置到文件
    const configData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      uploadTime: new Date().toISOString(),
      filePath: req.file.path, // 保存文件路径用于后续填写
      sheetName: targetSheetName,
      headerRow: useNewFlow ? null : (headerRowIndex + 1), // 新流程不需要标题行
      skuStartRow: useNewFlow ? parseInt(dataStartRow) : (skuStartRowIndex + 1),
      skuEndRow: useNewFlow ? null : (skuEndRowIndex + 1), // 新流程动态确定结束行
      boxColumns: autoConfig.boxColumns,
      boxNumbers: autoConfig.boxNumbers,
      boxWeightRow: autoConfig.foundBoxWeightRow !== null ? autoConfig.foundBoxWeightRow + 1 : null,
      boxWidthRow: autoConfig.foundBoxWidthRow !== null ? autoConfig.foundBoxWidthRow + 1 : null,
      boxLengthRow: autoConfig.foundBoxLengthRow !== null ? autoConfig.foundBoxLengthRow + 1 : null,
      boxHeightRow: autoConfig.foundBoxHeightRow !== null ? autoConfig.foundBoxHeightRow + 1 : null,
      sheetNames: workbook.SheetNames,
      items: packingItems,
      boxes: boxes,
      // 新增：标记是否使用新流程
      useNewFlow: useNewFlow,
      newFlowParams: useNewFlow ? {
        boxCount: parseInt(boxCount),
        startColumn: startColumn,
        dataStartRow: parseInt(dataStartRow)
      } : null
    };

    const configPath = path.join(__dirname, '../uploads/packing-lists/config.json');
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));



    res.json({
      success: true,
      message: '装箱表上传成功，已自动识别Box packing information格式',
      data: configData
    });

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 装箱表上传失败:', error);
    
    // 清理已上传的文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: '装箱表上传失败: ' + error.message
    });
  }
});

// 填写装箱表数据（根据发货清单数据）
router.post('/packing-list/fill', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到装箱表填写请求');
  console.log('\x1b[33m%s\x1b[0m', '📋 请求体:', JSON.stringify(req.body, null, 2));
  
  try {
    const { shippingData } = req.body;
    
    if (!shippingData || !Array.isArray(shippingData) || shippingData.length === 0) {
      console.log('\x1b[31m%s\x1b[0m', '❌ 无效的发货清单数据:', shippingData);
      return res.status(400).json({
        success: false,
        message: '请提供发货清单数据'
      });
    }

    console.log('\x1b[33m%s\x1b[0m', '📦 发货清单数据:', shippingData.length, '条');
    console.log('\x1b[33m%s\x1b[0m', '📦 发货清单详情:', JSON.stringify(shippingData.slice(0, 3), null, 2));

    // 获取装箱表配置
    const configPath = path.join(__dirname, '../uploads/packing-lists/config.json');
    
    if (!fs.existsSync(configPath)) {
      return res.status(400).json({
        success: false,
        message: '请先上传装箱表模板'
      });
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (!config.filePath || !fs.existsSync(config.filePath)) {
      return res.status(400).json({
        success: false,
        message: '装箱表模板文件不存在，请重新上传'
      });
    }

    console.log('\x1b[33m%s\x1b[0m', '📋 装箱表配置:', {
      sheetName: config.sheetName,
      boxColumns: config.boxColumns,
      boxNumbers: config.boxNumbers
    });

    // 使用ExcelJS读取原始Excel文件，完美保持格式
    console.log('🔍 使用ExcelJS读取装箱表模板文件...');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(config.filePath);
    
    const worksheet = workbook.getWorksheet(config.sheetName);
    
    if (!worksheet) {
      return res.status(400).json({
        success: false,
        message: `配置的Sheet页 "${config.sheetName}" 不存在于Excel文件中`
      });
    }
    
    // 列字母转换函数
    const getColumnLetter = (index) => {
      let letter = '';
      while (index >= 0) {
        letter = String.fromCharCode(65 + (index % 26)) + letter;
        index = Math.floor(index / 26) - 1;
      }
      return letter;
    };

    // 解析列索引函数
    const getColumnIndex = (columnLetter) => {
      let result = 0;
      for (let i = 0; i < columnLetter.length; i++) {
        result = result * 26 + (columnLetter.toUpperCase().charCodeAt(i) - 65 + 1);
      }
      return result - 1;
    };

    // 获取单元格引用 (如: A1, B2)
    const getCellRef = (row, col) => {
      return getColumnLetter(col) + (row + 1);
    };

    // 将ExcelJS工作表数据转换为数组格式，用于读取SKU列表
    const data = [];
    for (let rowNum = 1; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const rowData = [];
      for (let colNum = 1; colNum <= worksheet.columnCount; colNum++) {
        const cell = row.getCell(colNum);
        rowData.push(cell.value || '');
      }
      data.push(rowData);
    }
    
    // 按箱号和SKU组织发货数据
    const shippingByBoxAndSku = {};
    shippingData.forEach(item => {
      const key = `${item.box_num}_${item.amz_sku}`;
      if (shippingByBoxAndSku[key]) {
        shippingByBoxAndSku[key].quantity += item.quantity;
      } else {
        shippingByBoxAndSku[key] = {
          box_num: item.box_num,
          amz_sku: item.amz_sku,
          quantity: item.quantity
        };
      }
    });

    // 获取所有SKU列表（从A6开始直到空单元格）
    const skuStartRowIndex = config.skuStartRow - 1; // 转换为0基索引
    const availableSkus = [];
    
    for (let rowIndex = skuStartRowIndex; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex] || [];
      const skuCell = String(row[0] || '').trim();
      
      if (!skuCell || skuCell === '' || 
          skuCell.toLowerCase().includes('box') || 
          skuCell.toLowerCase().includes('weight') ||
          skuCell.toLowerCase().includes('width') ||
          skuCell.toLowerCase().includes('length') ||
          skuCell.toLowerCase().includes('height')) {
        break;
      }
      
      availableSkus.push({
        sku: skuCell,
        rowIndex: rowIndex
      });
    }

    // 填写发货数据 - 直接修改原始工作表
    let filledCount = 0;
    let unmatchedSkus = [];
    
    Object.values(shippingByBoxAndSku).forEach(shippingItem => {
      // 找到对应的箱号列
      const boxIndex = config.boxNumbers.indexOf(shippingItem.box_num);
      if (boxIndex === -1) {
        return;
      }
      
      const colIndex = getColumnIndex(config.boxColumns[boxIndex]);
      
      // 找到对应的SKU行
      const skuInfo = availableSkus.find(s => s.sku === shippingItem.amz_sku);
      if (!skuInfo) {
        unmatchedSkus.push(shippingItem.amz_sku);
        return;
      }
      
      // 使用ExcelJS直接修改工作表单元格，完美保持原始格式
      const rowNum = skuInfo.rowIndex + 1; // 转换为1基索引
      const colNum = colIndex + 1; // 转换为1基索引
      const cell = worksheet.getCell(rowNum, colNum);
      cell.value = shippingItem.quantity;
      console.log(`📝 ExcelJS填写装箱表: 行${rowNum} 列${colNum} = ${shippingItem.quantity}`);
      
      filledCount++;
    });

    // 填写默认的箱子信息（如果没有的话）- 直接修改原始工作表
    
    // 根据发货数据中的国家信息确定默认箱子参数
    const countriesInShipment = [...new Set(shippingData.map(item => item.country || '默认'))];
    
    // 判断是否包含美国
    const isUSShipment = countriesInShipment.some(country => 
      country === 'US' || country === '美国' || country.toLowerCase().includes('us')
    );
    
    // 根据国家设置默认参数
    let defaultBoxWeight, defaultBoxDimensions;
    if (isUSShipment) {
      // 美国：箱重45kg，长宽高23、17、13cm
      defaultBoxWeight = 45;
      defaultBoxDimensions = { width: 17, length: 23, height: 13 };
    } else {
      // 其他国家：箱重18kg，长宽高60、45、35cm
      defaultBoxWeight = 18;
      defaultBoxDimensions = { width: 45, length: 60, height: 35 };
    }

    for (let i = 0; i < config.boxColumns.length; i++) {
      const colIndex = getColumnIndex(config.boxColumns[i]);
      
      // 检查该箱子是否有装货
      const hasItems = Object.values(shippingByBoxAndSku).some(item => 
        config.boxNumbers.indexOf(item.box_num) === i
      );
      
      if (hasItems) {
        // 只为有装货的箱子使用ExcelJS填写默认信息，完美保持格式
        const colNum = colIndex + 1; // 转换为1基索引
        
        if (config.boxWeightRow) {
          const weightCell = worksheet.getCell(config.boxWeightRow, colNum);
          weightCell.value = defaultBoxWeight;
          console.log(`📝 ExcelJS填写箱重: 行${config.boxWeightRow} 列${colNum} = ${defaultBoxWeight}`);
        }
        if (config.boxWidthRow) {
          const widthCell = worksheet.getCell(config.boxWidthRow, colNum);
          widthCell.value = defaultBoxDimensions.width;
          console.log(`📝 ExcelJS填写箱宽: 行${config.boxWidthRow} 列${colNum} = ${defaultBoxDimensions.width}`);
        }
        if (config.boxLengthRow) {
          const lengthCell = worksheet.getCell(config.boxLengthRow, colNum);
          lengthCell.value = defaultBoxDimensions.length;
          console.log(`📝 ExcelJS填写箱长: 行${config.boxLengthRow} 列${colNum} = ${defaultBoxDimensions.length}`);
        }
        if (config.boxHeightRow) {
          const heightCell = worksheet.getCell(config.boxHeightRow, colNum);
          heightCell.value = defaultBoxDimensions.height;
          console.log(`📝 ExcelJS填写箱高: 行${config.boxHeightRow} 列${colNum} = ${defaultBoxDimensions.height}`);
        }
      }
    }
    
    // ExcelJS会自动管理工作表范围，无需手动更新
    console.log('📋 ExcelJS自动管理装箱表工作表范围，数据填写完成');

    // 使用ExcelJS保存到新文件，完美保持原始格式
    const timestamp = Date.now();
    const originalNameWithoutExt = path.basename(config.originalName, path.extname(config.originalName));
    const outputFileName = `${timestamp}_${originalNameWithoutExt}_已填写.xlsx`;
    const outputPath = path.join(__dirname, '../uploads/packing-lists', outputFileName);
    
    console.log(`💾 使用ExcelJS保存装箱表到: ${outputPath}`);
    await workbook.xlsx.writeFile(outputPath);
    console.log(`✅ 装箱表保存成功，所有格式完美保持`);

    // 更新配置文件，记录填写结果
    const updatedConfig = {
      ...config,
      lastFillTime: new Date().toISOString(),
      lastFillData: {
        filledCount,
        totalItems: Object.keys(shippingByBoxAndSku).length,
        unmatchedSkus,
        outputFileName,
        outputPath
      }
    };
    
    fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));

    res.json({
      success: true,
      message: `装箱表填写完成！保持原始格式，成功填写 ${filledCount} 条数据${unmatchedSkus.length > 0 ? `，${unmatchedSkus.length} 个SKU未匹配` : ''}`,
      data: {
        filledCount,
        totalItems: Object.keys(shippingByBoxAndSku).length,
        unmatchedSkus,
        outputFileName,
        downloadUrl: `/api/shipping/packing-list/download-filled?file=${encodeURIComponent(outputFileName)}`
      }
    });

  } catch (error) {
    console.error('装箱表填写失败:', error);
    res.status(500).json({
      success: false,
      message: '装箱表填写失败: ' + error.message
    });
  }
});

// 下载填写好的装箱表文件
router.get('/packing-list/download-filled', async (req, res) => {
  try {
    const { file } = req.query;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        message: '请指定要下载的文件'
      });
    }

    const filePath = path.join(__dirname, '../uploads/packing-lists', file);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file)}`);
    
    // 发送文件
    res.sendFile(filePath);
    
  } catch (error) {
    console.error('下载填写好的装箱表失败:', error);
    res.status(500).json({
      success: false,
      message: '下载失败',
      error: error.message
    });
  }
});

// 获取装箱表配置
router.get('/packing-list/config', async (req, res) => {
  try {
    const configPath = path.join(__dirname, '../uploads/packing-lists/config.json');
    
    if (!fs.existsSync(configPath)) {
      return res.json({
        success: true,
        data: null,
        message: '尚未配置装箱表'
      });
    }

    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    res.json({
      success: true,
      data: configData
    });

  } catch (error) {
    console.error('获取装箱表配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取装箱表配置失败'
    });
  }
});

// 下载填写好的装箱表
router.get('/packing-list/download', async (req, res) => {
  
  try {
    const configPath = path.join(__dirname, '../uploads/packing-lists/config.json');
    
    if (!fs.existsSync(configPath)) {
      return res.status(404).json({
        success: false,
        message: '没有找到装箱表配置，请先上传装箱表'
      });
    }

    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (!configData.items || configData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: '装箱表数据为空'
      });
    }

    // 使用ExcelJS创建新的工作簿，确保完全兼容Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(configData.sheetName || 'Sheet1');
    
    // 准备数据：按照原始格式重建装箱表
    // 先创建标题行
    const headerRow = ['SKU'];
    configData.boxNumbers.forEach(boxNum => {
      headerRow.push(`Box ${boxNum} quantity`);
    });
    
    // 按SKU汇总数据
    const skuData = {};
    configData.items.forEach(item => {
      if (!skuData[item.sku]) {
        skuData[item.sku] = {};
        configData.boxNumbers.forEach(boxNum => {
          skuData[item.sku][boxNum] = 0;
        });
      }
      skuData[item.sku][item.box_num] = item.quantity;
    });
    
    // 使用ExcelJS逐行填写数据
    let currentRow = 1;
    
    // 添加几行空行（模拟亚马逊表格格式）
    for (let i = 0; i < configData.headerRow - 1; i++) {
      if (i === 0) {
        worksheet.getCell(currentRow, 1).value = '装箱表 - ' + new Date().toLocaleDateString('zh-CN');
        // 设置标题样式
        worksheet.getCell(currentRow, 1).font = { bold: true, size: 14 };
      }
      currentRow++;
    }
    
    // 添加标题行
    headerRow.forEach((header, index) => {
      const cell = worksheet.getCell(currentRow, index + 1);
      cell.value = header;
      // 设置表头样式
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    currentRow++;
    
    // 添加SKU数据行
    Object.keys(skuData).forEach(sku => {
      worksheet.getCell(currentRow, 1).value = sku;
      configData.boxNumbers.forEach((boxNum, index) => {
        const cell = worksheet.getCell(currentRow, index + 2);
        cell.value = skuData[sku][boxNum] || 0;
        // 设置数据单元格边框
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      // 设置SKU列边框
      worksheet.getCell(currentRow, 1).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      currentRow++;
    });
    
    // 添加统计行（可选）
    currentRow++; // 空行
    
    // 总计行
    worksheet.getCell(currentRow, 1).value = '总计';
    worksheet.getCell(currentRow, 1).font = { bold: true };
    configData.boxNumbers.forEach((boxNum, index) => {
      const total = configData.items
        .filter(item => item.box_num === boxNum)
        .reduce((sum, item) => sum + item.quantity, 0);
      const cell = worksheet.getCell(currentRow, index + 2);
      cell.value = total;
      cell.font = { bold: true };
    });
    currentRow++;
    
    // 如果有箱子信息，添加重量等信息
    if (configData.boxes && configData.boxes.length > 0) {
      currentRow++; // 空行
      worksheet.getCell(currentRow, 1).value = '箱子重量(kg)';
      worksheet.getCell(currentRow, 1).font = { bold: true };
      configData.boxNumbers.forEach((boxNum, index) => {
        const box = configData.boxes.find(b => b.box_num === boxNum);
        worksheet.getCell(currentRow, index + 2).value = box?.weight || '';
      });
    }
    
    // 设置列宽
    worksheet.getColumn(1).width = 20; // SKU列宽度
    for (let i = 2; i <= configData.boxNumbers.length + 1; i++) {
      worksheet.getColumn(i).width = 15; // 箱子列宽度
    }
    
    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `装箱表_已填写_${timestamp}.xlsx`;
    
    // 使用ExcelJS生成Excel文件buffer
    const excelBuffer = await workbook.xlsx.writeBuffer();
    
    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Content-Length', excelBuffer.length);
    
    console.log('\x1b[32m%s\x1b[0m', '✅ 装箱表下载文件已生成:', filename);
    
    // 发送文件
    res.send(excelBuffer);

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 下载装箱表失败:', error);
    res.status(500).json({
      success: false,
      message: '下载装箱表失败: ' + error.message
    });
  }
});

// 获取发货历史详情
router.get('/shipment-history/:shipmentId/details', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到获取发货历史详情请求:', req.params.shipmentId);
  
  try {
    const { shipmentId } = req.params;
    
    // 查询发货记录主表
    const shipmentRecord = await ShipmentRecord.findByPk(shipmentId, {
      include: [
        {
          model: OrderShipmentRelation,
          as: 'orderRelations',
          attributes: ['need_num', 'total_requested', 'total_shipped', 'completion_status']
        }
      ]
    });
    
    if (!shipmentRecord) {
      return res.status(404).json({
        code: 1,
        message: '发货记录不存在'
      });
    }
    
    // 查询发货明细
    const rawShipmentItems = await ShipmentItem.findAll({
      where: { shipment_id: shipmentId },
      order: [['need_num', 'ASC'], ['local_sku', 'ASC']]
    });
    
    // 合并同一个需求单号的同一个SKU的整箱和混合箱数量
    const mergedItemsMap = new Map();
    
    rawShipmentItems.forEach(item => {
      const key = `${item.need_num}_${item.local_sku}`;
      
      if (mergedItemsMap.has(key)) {
        // 合并现有记录
        const existingItem = mergedItemsMap.get(key);
        existingItem.shipped_quantity += item.shipped_quantity;
        existingItem.whole_boxes += item.whole_boxes || 0;
        existingItem.mixed_box_quantity += item.mixed_box_quantity || 0;
        
        // 合并箱号列表
        if (item.box_numbers) {
          try {
            const boxNumbers = JSON.parse(item.box_numbers);
            if (Array.isArray(boxNumbers) && boxNumbers.length > 0) {
              const existingBoxNumbers = JSON.parse(existingItem.box_numbers || '[]');
              const mergedBoxNumbers = [...new Set([...existingBoxNumbers, ...boxNumbers])];
              existingItem.box_numbers = JSON.stringify(mergedBoxNumbers);
            }
          } catch (e) {
            console.warn('解析箱号JSON失败:', e);
          }
        }
      } else {
        // 创建新记录
        mergedItemsMap.set(key, {
          shipment_item_id: item.shipment_item_id,
          shipment_id: item.shipment_id,
          order_item_id: item.order_item_id,
          need_num: item.need_num,
          local_sku: item.local_sku,
          amz_sku: item.amz_sku,
          country: item.country,
          marketplace: item.marketplace,
          requested_quantity: item.requested_quantity,
          shipped_quantity: item.shipped_quantity,
          whole_boxes: item.whole_boxes || 0,
          mixed_box_quantity: item.mixed_box_quantity || 0,
          box_numbers: item.box_numbers,
          created_at: item.created_at
        });
      }
    });
    
    // 转换为数组
    const shipmentItems = Array.from(mergedItemsMap.values());
    
    // 计算统计汇总
    const summary = {
      total_need_orders: new Set(shipmentItems.map(item => item.need_num)).size,
      total_sku_count: shipmentItems.length,
      total_requested: shipmentItems.reduce((sum, item) => sum + (item.requested_quantity || 0), 0),
      total_shipped: shipmentItems.reduce((sum, item) => sum + (item.shipped_quantity || 0), 0),
      overall_completion_rate: 0
    };
    
    if (summary.total_requested > 0) {
      summary.overall_completion_rate = Math.round((summary.total_shipped / summary.total_requested) * 100);
    }
    
    console.log('\x1b[32m%s\x1b[0m', '✅ 发货历史详情查询成功:', {
      shipmentId,
      itemsCount: shipmentItems.length,
      summary
    });
    
    res.json({
      code: 0,
      message: '获取成功',
      data: {
        shipment_record: shipmentRecord,
        shipment_items: shipmentItems,
        summary: summary
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取发货历史详情失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取失败',
      error: error.message
    });
  }
});

// ======================= 物流商发票模板管理 API =======================

// 获取物流商发票模板配置
router.get('/logistics-invoice/config', async (req, res) => {
  try {
    const { logisticsProvider, country } = req.query;
    
    // 从OSS获取配置
    const allConfigs = await getLogisticsInvoiceConfigFromOSS();
    
    if (logisticsProvider && country) {
      // 获取特定物流商和国家的配置
      const providerConfig = allConfigs[logisticsProvider];
      if (providerConfig && providerConfig[country]) {
        res.json({
          success: true,
          data: {
            hasTemplate: true,
            logisticsProvider: logisticsProvider,
            country: country,
            ...providerConfig[country]
          }
        });
      } else {
        res.json({
          success: true,
          data: {
            hasTemplate: false,
            logisticsProvider: logisticsProvider,
            country: country,
            message: `尚未上传 ${logisticsProvider} - ${country} 的发票模板`
          }
        });
      }
    } else {
      // 获取所有配置
      const hasAnyTemplate = Object.keys(allConfigs).length > 0;
      const logisticsProviders = Object.keys(allConfigs);
      
      res.json({
        success: true,
        data: {
          hasTemplate: hasAnyTemplate,
          templates: allConfigs,
          logisticsProviders: logisticsProviders,
          message: hasAnyTemplate ? '已配置发票模板' : '尚未上传任何物流商发票模板'
        }
      });
    }
  } catch (error) {
    console.error('❌ 获取物流商发票模板配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取配置失败'
    });
  }
});

// 上传物流商发票模板
router.post('/logistics-invoice/upload', (req, res, next) => {
  // Multer错误处理
  upload.single('template')(req, res, (err) => {
    if (err) {
      console.error('❌ Multer上传错误:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: '文件大小超过限制(最大10MB)'
        });
      } else if (err.message === '只允许上传Excel文件') {
        return res.status(400).json({
          success: false,
          message: '只支持Excel文件格式(.xlsx, .xls)'
        });
      } else {
        return res.status(500).json({
          success: false,
          message: '文件上传失败: ' + err.message
        });
      }
    }
    next();
  });
}, async (req, res) => {
  console.log('📥 收到物流商发票模板上传请求');
  console.log('📋 请求体参数:', req.body);
  console.log('📁 上传文件信息:', req.file ? {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  } : '无文件');
  
  try {
    if (!req.file) {
      console.error('❌ 未接收到文件');
      return res.status(400).json({
        success: false,
        message: '请选择要上传的Excel文件'
      });
    }

    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.status(500).json({
        success: false,
        message: 'OSS配置不完整，请联系管理员配置OSS服务'
      });
    }

    const { sheetName, logisticsProvider, country, countryName } = req.body;

    if (!sheetName || !logisticsProvider || !country) {
      console.error('❌ 缺少必填参数:', {
        sheetName, logisticsProvider, country
      });
      return res.status(400).json({
        success: false,
        message: '请提供完整的配置信息，包括物流商、适用国家和Sheet页名称'
      });
    }

    // 验证Excel文件并获取sheet信息 - 使用ExcelJS保持完整格式
    let workbook, sheetNames;
    try {
      console.log('📖 正在使用ExcelJS读取Excel文件Buffer...');
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      sheetNames = workbook.worksheets.map(ws => ws.name);
      console.log('📊 ExcelJS文件读取成功，Sheet页:', sheetNames);
    } catch (excelError) {
      console.error('❌ ExcelJS文件读取失败:', excelError);
      return res.status(400).json({
        success: false,
        message: '无法读取Excel文件，请确保文件格式正确且未损坏'
      });
    }
    
    if (!sheetNames.includes(sheetName)) {
      console.error('❌ Sheet页不存在:', { requested: sheetName, available: sheetNames });
      return res.status(400).json({
        success: false,
        message: `模板中不存在sheet页: ${sheetName}。可用的sheet页: ${sheetNames.join(', ')}`,
        data: {
          availableSheets: sheetNames,
          requestedSheet: sheetName
        }
      });
    }

    // 读取现有配置
    let allConfigs = await getLogisticsInvoiceConfigFromOSS();

    // 初始化物流商配置
    if (!allConfigs[logisticsProvider]) {
      allConfigs[logisticsProvider] = {};
    }

    // 如果该物流商和国家已有模板，先备份旧模板，然后删除
    if (allConfigs[logisticsProvider][country] && allConfigs[logisticsProvider][country].ossPath) {
      try {
        console.log(`🔄 ${logisticsProvider}-${country} 已有模板，正在备份旧模板...`);
        await backupTemplate(allConfigs[logisticsProvider][country].ossPath, 'logistics');
        await deleteTemplateFromOSS(allConfigs[logisticsProvider][country].ossPath);
        console.log(`✅ 已备份并删除 ${logisticsProvider}-${country} 的旧模板文件`);
      } catch (err) {
        console.warn(`⚠️ 处理 ${logisticsProvider}-${country} 旧模板文件失败:`, err.message);
      }
    }

    // 上传新模板文件到OSS
    console.log('☁️ 正在上传发票模板文件到OSS...');
    const uploadResult = await uploadTemplateToOSS(
      req.file.buffer,
      req.file.originalname,
      'logistics',
      logisticsProvider,
      country
    );

    if (!uploadResult.success) {
      throw new Error('模板文件上传到OSS失败');
    }

    // 保存该物流商和国家的模板配置
    const config = {
      originalName: req.file.originalname,
      ossPath: uploadResult.name,
      ossUrl: uploadResult.url,
      uploadTime: new Date().toISOString(),
      sheetName: sheetName,
      sheetNames: sheetNames, // 保存所有可用的sheet名称
      logisticsProvider: logisticsProvider,
      country: country,
      countryName: countryName || country,
      fileSize: uploadResult.size
    };

    allConfigs[logisticsProvider][country] = config;
    
    // 保存配置文件到OSS
    try {
      console.log('💾 正在保存发票模板配置文件到OSS...');
      await saveLogisticsInvoiceConfigToOSS(allConfigs);
      console.log('✅ 发票模板配置文件保存成功');
    } catch (saveError) {
      console.error('❌ 配置文件保存失败:', saveError);
      // 如果配置保存失败，尝试删除已上传的模板文件
      try {
        await deleteTemplateFromOSS(uploadResult.name);
      } catch (deleteError) {
        console.error('❌ 回滚失败，删除已上传文件失败:', deleteError);
      }
      return res.status(500).json({
        success: false,
        message: '模板配置保存失败: ' + saveError.message
      });
    }

    console.log('✅ 物流商发票模板上传完成:', `${logisticsProvider}-${country}`);
    res.json({
      success: true,
      message: `${logisticsProvider} - ${countryName || country} 发票模板上传成功`,
      data: {
        hasTemplate: true,
        logisticsProvider: logisticsProvider,
        country: country,
        ...config
      }
    });

  } catch (error) {
    console.error('❌ 上传物流商发票模板失败:', error);
    res.status(500).json({
      success: false,
      message: '上传模板失败: ' + error.message
    });
  }
});

// 生成物流商发票
router.post('/logistics-invoice/generate', async (req, res) => {
  try {
    const { shippingData } = req.body;

    if (!shippingData || !Array.isArray(shippingData)) {
      return res.status(400).json({
        success: false,
        message: '请提供发货数据'
      });
    }

    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.status(500).json({
        success: false,
        message: 'OSS配置不完整，无法生成发票'
      });
    }

    // 获取物流商发票模板配置
    const allConfigs = await getLogisticsInvoiceConfigFromOSS();
    
    if (!allConfigs || Object.keys(allConfigs).length === 0) {
      return res.status(400).json({
        success: false,
        message: '尚未配置物流商发票模板，请先上传模板'
      });
    }

    // 按物流商和国家分组发货数据
    const dataByProviderAndCountry = {};
    shippingData.forEach(item => {
      const provider = item.logisticsProvider || '默认';
      const country = item.country || '默认';
      const key = `${provider}-${country}`;
      
      if (!dataByProviderAndCountry[key]) {
        dataByProviderAndCountry[key] = {
          provider: provider,
          country: country,
          data: []
        };
      }
      dataByProviderAndCountry[key].data.push(item);
    });

    const generatedFiles = [];
    const outputDir = path.join(__dirname, '../uploads/generated-invoices');
    
    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 为每个物流商和国家生成对应的发票
    for (const [key, groupData] of Object.entries(dataByProviderAndCountry)) {
      const { provider, country, data } = groupData;
      
      const providerConfig = allConfigs[provider];
      if (!providerConfig || !providerConfig[country]) {
        console.warn(`⚠️ 未找到 ${provider}-${country} 的发票模板配置，跳过生成`);
        continue;
      }
      
      const config = providerConfig[country];
      
      if (!config.ossPath) {
        console.warn(`⚠️ ${provider}-${country} 的模板文件路径不存在`);
        continue;
      }

      // 从OSS下载发票模板文件
      let workbook, worksheet;
      try {
        console.log(`📥 正在从OSS下载 ${provider}-${country} 的发票模板文件...`);
        const downloadResult = await downloadTemplateFromOSS(config.ossPath);
        if (!downloadResult.success) {
          throw new Error('下载失败');
        }
        
        // 使用ExcelJS读取发票模板文件，完美保持所有格式信息
        workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(downloadResult.content);
        worksheet = workbook.getWorksheet(config.sheetName);
        
        if (!worksheet) {
          throw new Error(`Sheet页 "${config.sheetName}" 不存在`);
        }
        
        console.log(`✅ ${provider}-${country} 发票模板文件下载并读取成功，原始范围: ${worksheet['!ref']}`);
      } catch (downloadError) {
        console.error(`❌ ${provider}-${country} 发票模板文件处理失败:`, downloadError);
        continue;
      }

      // 简单直接的方案：直接修改发票模板副本的指定单元格
      // 目前先简单地在第一列填写商品信息，第二列填写数量
      let currentRow = 2; // 假设第一行是表头
      
      console.log(`📝 开始填写发票数据到模板副本，起始行: ${currentRow}`);
      
      data.forEach(item => {
        // 使用ExcelJS设置商品SKU列的值，完美保持原有格式
        const skuCell = worksheet.getCell(`A${currentRow}`);
        skuCell.value = item.amz_sku || item.sku;
        console.log(`📝 ExcelJS填写发票SKU: A${currentRow} = ${item.amz_sku || item.sku}`);

        // 使用ExcelJS设置数量列的值，完美保持原有格式
        const quantityCell = worksheet.getCell(`B${currentRow}`);
        quantityCell.value = item.quantity;
        console.log(`📝 ExcelJS填写发票数量: B${currentRow} = ${item.quantity}`);

        // 使用ExcelJS设置箱号列的值（如果有），完美保持原有格式
        if (item.box_num) {
          const boxCell = worksheet.getCell(`C${currentRow}`);
          boxCell.value = item.box_num;
          console.log(`📝 ExcelJS填写发票箱号: C${currentRow} = ${item.box_num}`);
        }
        
        currentRow++;
      });
      
      console.log(`✅ ExcelJS完成发票数据填写，共填写 ${data.length} 行数据`);

      // ExcelJS会自动管理工作表范围，无需手动更新
      console.log(`📋 ${provider}-${country} ExcelJS自动管理工作表范围，数据已填写到第${currentRow-1}行`);

      // 生成新的文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const providerCode = provider.replace(/[^a-zA-Z0-9]/g, '');
      const countryCode = country.replace(/[^a-zA-Z0-9]/g, '');
      const outputFilename = `invoice-${providerCode}-${countryCode}-${timestamp}.xlsx`;
      const outputPath = path.join(outputDir, outputFilename);

      // 使用ExcelJS保存文件，完美保持所有原始格式
      console.log(`💾 使用ExcelJS保存发票文件到: ${outputPath}`);
      await workbook.xlsx.writeFile(outputPath);
      console.log(`✅ ${provider}-${country} 发票文件保存成功，所有格式完美保持`);

      generatedFiles.push({
        logisticsProvider: provider,
        country: country,
        countryName: config.countryName || country,
        filename: outputFilename,
        downloadUrl: `/api/shipping/logistics-invoice/download/${outputFilename}`,
        itemCount: data.length,
        totalQuantity: data.reduce((sum, item) => sum + (item.quantity || 0), 0)
      });
    }

    if (generatedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有找到对应的发票模板配置，无法生成发票'
      });
    }

    res.json({
      success: true,
      message: `成功生成 ${generatedFiles.length} 个发票文件`,
      data: {
        files: generatedFiles,
        totalFiles: generatedFiles.length,
        totalItems: generatedFiles.reduce((sum, file) => sum + file.itemCount, 0),
        totalQuantity: generatedFiles.reduce((sum, file) => sum + file.totalQuantity, 0)
      }
    });

  } catch (error) {
    console.error('❌ 生成物流商发票失败:', error);
    res.status(500).json({
      success: false,
      message: '生成发票失败: ' + error.message
    });
  }
});

// 下载生成的发票文件
router.get('/logistics-invoice/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads/generated-invoices', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('❌ 发票文件下载失败:', err);
        res.status(500).json({
          success: false,
          message: '文件下载失败'
        });
      }
    });
  } catch (error) {
    console.error('❌ 下载发票文件失败:', error);
    res.status(500).json({
      success: false,
      message: '下载失败'
    });
  }
});

// 下载原始模板文件（亚马逊模板）
router.get('/amazon-template/download-original/:country', async (req, res) => {
  try {
    const { country } = req.params;
    
    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.status(500).json({
        success: false,
        message: 'OSS配置不完整，无法下载模板'
      });
    }

    // 获取模板配置
    const allConfigs = await getTemplateConfigFromOSS();
    
    if (!allConfigs[country]) {
      return res.status(404).json({
        success: false,
        message: `未找到 ${country} 的模板配置`
      });
    }

    const config = allConfigs[country];
    
    if (!config.ossPath) {
      return res.status(404).json({
        success: false,
        message: `${country} 模板文件路径不存在`
      });
    }

    // 从OSS下载模板文件
    try {
      console.log(`📥 正在从OSS下载 ${country} 的亚马逊模板文件...`);
      const downloadResult = await downloadTemplateFromOSS(config.ossPath);
      
      if (!downloadResult.success) {
        throw new Error('下载失败');
      }

      // 设置响应头
      res.set({
        'Content-Type': downloadResult.contentType,
        'Content-Disposition': `attachment; filename="${config.originalName}"`,
        'Content-Length': downloadResult.size
      });

      // 返回文件内容
      res.send(downloadResult.content);
      
    } catch (downloadError) {
      console.error(`❌ 下载 ${country} 亚马逊模板失败:`, downloadError);
      res.status(500).json({
        success: false,
        message: '模板文件下载失败: ' + downloadError.message
      });
    }

  } catch (error) {
    console.error('❌ 下载亚马逊模板失败:', error);
    res.status(500).json({
      success: false,
      message: '下载失败: ' + error.message
    });
  }
});

// 下载原始模板文件（物流商发票模板）
router.get('/logistics-invoice/download-original/:logisticsProvider/:country', async (req, res) => {
  try {
    const { logisticsProvider, country } = req.params;
    
    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.status(500).json({
        success: false,
        message: 'OSS配置不完整，无法下载模板'
      });
    }

    // 获取配置
    const allConfigs = await getLogisticsInvoiceConfigFromOSS();
    
    if (!allConfigs[logisticsProvider] || !allConfigs[logisticsProvider][country]) {
      return res.status(404).json({
        success: false,
        message: `未找到 ${logisticsProvider} - ${country} 的发票模板配置`
      });
    }

    const config = allConfigs[logisticsProvider][country];
    
    if (!config.ossPath) {
      return res.status(404).json({
        success: false,
        message: `${logisticsProvider} - ${country} 模板文件路径不存在`
      });
    }

    // 从OSS下载模板文件
    try {
      console.log(`📥 正在从OSS下载 ${logisticsProvider}-${country} 的发票模板文件...`);
      const downloadResult = await downloadTemplateFromOSS(config.ossPath);
      
      if (!downloadResult.success) {
        throw new Error('下载失败');
      }

      // 设置响应头
      res.set({
        'Content-Type': downloadResult.contentType,
        'Content-Disposition': `attachment; filename="${config.originalName}"`,
        'Content-Length': downloadResult.size
      });

      // 返回文件内容
      res.send(downloadResult.content);
      
    } catch (downloadError) {
      console.error(`❌ 下载 ${logisticsProvider}-${country} 发票模板失败:`, downloadError);
      res.status(500).json({
        success: false,
        message: '模板文件下载失败: ' + downloadError.message
      });
    }

  } catch (error) {
    console.error('❌ 下载发票模板失败:', error);
    res.status(500).json({
      success: false,
      message: '下载失败: ' + error.message
    });
  }
});

// 删除物流商发票模板配置
router.delete('/logistics-invoice/config', async (req, res) => {
  try {
    const { logisticsProvider, country } = req.query;

    // 检查OSS配置
    if (!checkOSSConfig()) {
      return res.status(500).json({
        success: false,
        message: 'OSS配置不完整，无法删除模板'
      });
    }

    const allConfigs = await getLogisticsInvoiceConfigFromOSS();

    if (!allConfigs || Object.keys(allConfigs).length === 0) {
      return res.json({
        success: true,
        message: '没有发票模板配置需要删除'
      });
    }

    if (logisticsProvider && country) {
      // 删除特定物流商和国家的模板配置
      if (allConfigs[logisticsProvider] && allConfigs[logisticsProvider][country]) {
        const config = allConfigs[logisticsProvider][country];
        
        // 先备份然后删除OSS中的模板文件
        if (config.ossPath) {
          try {
            console.log(`🔄 正在备份并删除 ${logisticsProvider}-${country} 的发票模板文件...`);
            await backupTemplate(config.ossPath, 'logistics');
            await deleteTemplateFromOSS(config.ossPath);
            console.log(`✅ ${logisticsProvider}-${country} 发票模板文件已备份并删除`);
          } catch (deleteError) {
            console.warn(`⚠️ 删除 ${logisticsProvider}-${country} 发票模板文件失败:`, deleteError.message);
          }
        }
        
        // 从配置中删除该国家
        delete allConfigs[logisticsProvider][country];
        
        // 如果该物流商没有其他国家的配置了，删除整个物流商配置
        if (Object.keys(allConfigs[logisticsProvider]).length === 0) {
          delete allConfigs[logisticsProvider];
        }
        
        // 更新配置文件
        try {
          if (Object.keys(allConfigs).length > 0) {
            await saveLogisticsInvoiceConfigToOSS(allConfigs);
          } else {
            // 如果没有配置了，删除配置文件
            await deleteTemplateFromOSS(LOGISTICS_INVOICE_CONFIG_OSS_PATH);
          }
        } catch (saveError) {
          console.error('❌ 更新发票配置文件失败:', saveError);
          return res.status(500).json({
            success: false,
            message: '配置文件更新失败: ' + saveError.message
          });
        }

        res.json({
          success: true,
          message: `${logisticsProvider} - ${config.countryName || country} 发票模板配置已删除`
        });
      } else {
        res.json({
          success: true,
          message: `${logisticsProvider} - ${country} 没有发票模板配置需要删除`
        });
      }
    } else if (logisticsProvider) {
      // 删除特定物流商的所有模板配置
      if (allConfigs[logisticsProvider]) {
        console.log(`🗑️ 正在删除物流商 ${logisticsProvider} 的所有发票模板配置...`);
        
        for (const [countryCode, config] of Object.entries(allConfigs[logisticsProvider])) {
          if (config.ossPath) {
            try {
              console.log(`🔄 正在备份并删除 ${logisticsProvider}-${countryCode} 的发票模板文件...`);
              await backupTemplate(config.ossPath, 'logistics');
              await deleteTemplateFromOSS(config.ossPath);
              console.log(`✅ ${logisticsProvider}-${countryCode} 发票模板文件已备份并删除`);
            } catch (deleteError) {
              console.warn(`⚠️ 删除 ${logisticsProvider}-${countryCode} 发票模板文件失败:`, deleteError.message);
            }
          }
        }
        
        // 删除整个物流商配置
        delete allConfigs[logisticsProvider];
        
        // 更新配置文件
        try {
          if (Object.keys(allConfigs).length > 0) {
            await saveLogisticsInvoiceConfigToOSS(allConfigs);
          } else {
            await deleteTemplateFromOSS(LOGISTICS_INVOICE_CONFIG_OSS_PATH);
          }
        } catch (saveError) {
          console.error('❌ 更新发票配置文件失败:', saveError);
          return res.status(500).json({
            success: false,
            message: '配置文件更新失败: ' + saveError.message
          });
        }

        res.json({
          success: true,
          message: `物流商 ${logisticsProvider} 的所有发票模板配置已删除`
        });
      } else {
        res.json({
          success: true,
          message: `物流商 ${logisticsProvider} 没有发票模板配置需要删除`
        });
      }
    } else {
      // 删除所有物流商发票模板配置
      console.log('🗑️ 正在删除所有物流商发票模板配置...');
      
      for (const [providerName, providerConfigs] of Object.entries(allConfigs)) {
        for (const [countryCode, config] of Object.entries(providerConfigs)) {
          if (config.ossPath) {
            try {
              console.log(`🔄 正在备份并删除 ${providerName}-${countryCode} 的发票模板文件...`);
              await backupTemplate(config.ossPath, 'logistics');
              await deleteTemplateFromOSS(config.ossPath);
              console.log(`✅ ${providerName}-${countryCode} 发票模板文件已备份并删除`);
            } catch (deleteError) {
              console.warn(`⚠️ 删除 ${providerName}-${countryCode} 发票模板文件失败:`, deleteError.message);
            }
          }
        }
      }
      
      // 删除配置文件
      try {
        await deleteTemplateFromOSS(LOGISTICS_INVOICE_CONFIG_OSS_PATH);
      } catch (deleteError) {
        console.warn('⚠️ 删除发票配置文件失败:', deleteError.message);
      }

      res.json({
        success: true,
        message: '所有物流商发票模板配置已删除'
      });
    }
  } catch (error) {
    console.error('❌ 删除物流商发票模板配置失败:', error);
    res.status(500).json({
      success: false,
      message: '删除失败: ' + error.message
    });
  }
});

// 获取混合箱详细信息和列表（用于待发货库存管理）
router.get('/mixed-box-inventory', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到混合箱库存查询请求:', JSON.stringify(req.query, null, 2));
  
  try {
    const { country, mix_box_num, page = 1, limit = 50 } = req.query;
    
    // 第一步：查询所有已发货的需求记录（与国家库存汇总保持一致）
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
    
    let whereCondition = {
      total_quantity: { [Op.gt]: 0 } // 只显示库存大于0的记录
    };
    
    // 添加国家筛选
    if (country) {
      whereCondition.country = country;
    }
    
    // 添加混合箱号筛选
    if (mix_box_num) {
      whereCondition.mix_box_num = mix_box_num;
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // 查询本地箱子数据
    const { count, rows } = await LocalBox.findAll({
      where: whereCondition,
      order: [['time', 'DESC'], ['记录号', 'DESC']],
      raw: true
    });
    
    // 分别统计混合箱和整箱数据，并排除已发货的SKU（与国家库存汇总保持一致）
    const mixedBoxes = rows.filter(item => {
      if (!item.mix_box_num || item.mix_box_num.trim() === '') return false;
      
      // 排除已发货的SKU
      const skuKey = `${item.sku}_${item.country}`;
      if (shippedSkuSet.has(skuKey)) {
        console.log('\x1b[31m%s\x1b[0m', `🚫 跳过已发货混合箱SKU: ${item.sku} (${item.country}) 混合箱:${item.mix_box_num}`);
        return false;
      }
      
      return true;
    });
    
    const wholeBoxes = rows.filter(item => {
      if (item.mix_box_num && item.mix_box_num.trim() !== '') return false;
      
      // 排除已发货的SKU
      const skuKey = `${item.sku}_${item.country}`;
      if (shippedSkuSet.has(skuKey)) {
        console.log('\x1b[31m%s\x1b[0m', `🚫 跳过已发货整箱SKU: ${item.sku} (${item.country})`);
        return false;
      }
      
      return true;
    });
    
    console.log('\x1b[33m%s\x1b[0m', '🔍 过滤后混合箱记录数:', mixedBoxes.length);
    console.log('\x1b[33m%s\x1b[0m', '🔍 过滤后整箱记录数:', wholeBoxes.length);
    
    // 按混合箱号分组统计
    const mixedBoxSummary = {};
    mixedBoxes.forEach(item => {
      const key = `${item.mix_box_num}_${item.country}`;
      if (!mixedBoxSummary[key]) {
        mixedBoxSummary[key] = {
          mix_box_num: item.mix_box_num,
          country: item.country,
          total_quantity: 0,
          sku_count: 0,
          skus: [],
          created_at: item.time,
          operator: item.操作员,
          marketplace: item.marketPlace
        };
      }
      mixedBoxSummary[key].total_quantity += parseInt(item.total_quantity) || 0;
      mixedBoxSummary[key].sku_count += 1;
      mixedBoxSummary[key].skus.push({
        sku: item.sku,
        quantity: item.total_quantity,
        record_num: item.记录号
      });
      
      // 保留最早的创建时间
      if (item.time && new Date(item.time) < new Date(mixedBoxSummary[key].created_at)) {
        mixedBoxSummary[key].created_at = item.time;
      }
    });
    
    // 按SKU+国家分组统计整箱数据
    const wholeBoxSummary = {};
    wholeBoxes.forEach(item => {
      const key = `${item.sku}_${item.country}`;
      if (!wholeBoxSummary[key]) {
        wholeBoxSummary[key] = {
          sku: item.sku,
          country: item.country,
          total_quantity: 0,
          total_boxes: 0,
          created_at: item.time,
          operator: item.操作员,
          marketplace: item.marketPlace,
          records: []
        };
      }
      wholeBoxSummary[key].total_quantity += parseInt(item.total_quantity) || 0;
      wholeBoxSummary[key].total_boxes += parseInt(item.total_boxes) || 0;
      wholeBoxSummary[key].records.push({
        record_num: item.记录号,
        quantity: item.total_quantity,
        boxes: item.total_boxes
      });
      
      // 保留最早的创建时间
      if (item.time && new Date(item.time) < new Date(wholeBoxSummary[key].created_at)) {
        wholeBoxSummary[key].created_at = item.time;
      }
    });
    
    // 筛选有效的混合箱（总数量大于0）和整箱
    const validMixedBoxes = Object.values(mixedBoxSummary).filter(box => box.total_quantity > 0);
    const validWholeBoxes = Object.values(wholeBoxSummary).filter(box => box.total_quantity > 0);
    
    // 实现分页逻辑
    const allValidBoxes = [...validMixedBoxes, ...validWholeBoxes];
    const totalCount = allValidBoxes.length;
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    
    // 分页后的混合箱和整箱数据
    const paginatedMixedBoxes = validMixedBoxes.slice(Math.max(0, startIndex), Math.min(validMixedBoxes.length, endIndex));
    const remainingSlots = parseInt(limit) - paginatedMixedBoxes.length;
    const mixedBoxEndIndex = Math.min(validMixedBoxes.length, endIndex);
    const wholeBoxStartIndex = Math.max(0, startIndex - validMixedBoxes.length);
    const paginatedWholeBoxes = remainingSlots > 0 ? validWholeBoxes.slice(wholeBoxStartIndex, wholeBoxStartIndex + remainingSlots) : [];
    
    console.log('\x1b[32m%s\x1b[0m', '📊 混合箱库存统计:', {
      originalTotalRecords: rows.length,
      validMixedBoxes: validMixedBoxes.length,
      validWholeBoxes: validWholeBoxes.length,
      totalValidBoxes: totalCount,
      currentPage: parseInt(page),
      pageSize: parseInt(limit)
    });
    
    res.json({
      code: 0,
      message: '获取混合箱库存成功',
      data: {
        mixed_boxes: paginatedMixedBoxes,
        whole_boxes: paginatedWholeBoxes,
        pagination: {
          current: parseInt(page),
          pageSize: parseInt(limit),
          total: totalCount
        },
        stats: {
          total_records: totalCount,
          mixed_box_count: validMixedBoxes.length,
          whole_box_count: validWholeBoxes.length,
          filtered_out_shipped: rows.length - (mixedBoxes.length + wholeBoxes.length)
        }
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取混合箱库存失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取混合箱库存失败',
      error: error.message
    });
  }
});

// 获取指定混合箱的详细SKU列表
router.get('/mixed-box-details/:mix_box_num', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到混合箱详情查询请求:', req.params);
  
  try {
    const { mix_box_num } = req.params;
    const { country } = req.query;
    
    // 查询所有已发货的需求记录（与国家库存汇总保持一致）
    const shippedNeeds = await WarehouseProductsNeed.findAll({
      where: {
        status: '已发货'
      },
      attributes: ['sku', 'country'],
      raw: true
    });

    // 创建已发货SKU的查找集合
    const shippedSkuSet = new Set();
    shippedNeeds.forEach(need => {
      const key = `${need.sku}_${need.country}`;
      shippedSkuSet.add(key);
    });
    
    let whereCondition = {
      mix_box_num: mix_box_num,
      total_quantity: { [Op.gt]: 0 }
    };
    
    if (country) {
      whereCondition.country = country;
    }
    
    const allItems = await LocalBox.findAll({
      where: whereCondition,
      order: [['time', 'DESC']],
      raw: true
    });
    
    // 排除已发货的SKU
    const items = allItems.filter(item => {
      const skuKey = `${item.sku}_${item.country}`;
      if (shippedSkuSet.has(skuKey)) {
        console.log('\x1b[31m%s\x1b[0m', `🚫 跳过已发货的混合箱SKU: ${item.sku} (${item.country})`);
        return false;
      }
      return true;
    });
    
    // 查询对应的Amazon SKU映射
    const itemsWithMapping = await Promise.all(
      items.map(async (item) => {
        try {
          const mapping = await AmzSkuMapping.findOne({
            where: {
              local_sku: item.sku,
              country: item.country
            },
            raw: true
          });
          
          return {
            ...item,
            amz_sku: mapping?.amz_sku || item.sku,
            site: mapping?.site || ''
          };
        } catch (error) {
          console.warn('查询SKU映射失败:', error);
          return {
            ...item,
            amz_sku: item.sku,
            site: ''
          };
        }
      })
    );
    
    console.log('\x1b[32m%s\x1b[0m', '📊 混合箱详情:', {
      mix_box_num,
      originalItemCount: allItems.length,
      filteredItemCount: itemsWithMapping.length,
      filteredOutCount: allItems.length - items.length
    });
    
    res.json({
      code: 0,
      message: '获取混合箱详情成功',
      data: {
        mix_box_num,
        country: items[0]?.country || '',
        items: itemsWithMapping,
        summary: {
          total_quantity: items.reduce((sum, item) => sum + (parseInt(item.total_quantity) || 0), 0),
          sku_count: items.length,
          created_at: items.length > 0 ? Math.min(...items.map(item => new Date(item.time).getTime())) : null
        }
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取混合箱详情失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取混合箱详情失败',
      error: error.message
    });
  }
});

// 修改混合箱中的SKU数量
router.put('/mixed-box-item/:record_num', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到混合箱SKU修改请求:', req.params, req.body);
  
  try {
    const { record_num } = req.params;
    const { total_quantity, operator } = req.body;
    
    if (!total_quantity || total_quantity < 0) {
      return res.status(400).json({
        code: 1,
        message: '数量必须大于0'
      });
    }
    
    // 查找原记录
    const originalRecord = await LocalBox.findOne({
      where: { 记录号: record_num }
    });
    
    if (!originalRecord) {
      return res.status(404).json({
        code: 1,
        message: '记录不存在'
      });
    }
    
    // 更新记录
    const [updatedCount] = await LocalBox.update({
      total_quantity: parseInt(total_quantity),
      操作员: operator || '系统修改',
      time: new Date()
    }, {
      where: { 记录号: record_num }
    });
    
    if (updatedCount > 0) {
      console.log('\x1b[32m%s\x1b[0m', '✅ 混合箱SKU修改成功:', {
        record_num,
        old_quantity: originalRecord.total_quantity,
        new_quantity: total_quantity
      });
      
      res.json({
        code: 0,
        message: '修改成功',
        data: {
          record_num,
          old_quantity: originalRecord.total_quantity,
          new_quantity: parseInt(total_quantity)
        }
      });
    } else {
      res.status(404).json({
        code: 1,
        message: '记录不存在或修改失败'
      });
    }
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 修改混合箱SKU失败:', error);
    res.status(500).json({
      code: 1,
      message: '修改失败',
      error: error.message
    });
  }
});

// 删除混合箱中的SKU记录
router.delete('/mixed-box-item/:record_num', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到混合箱SKU删除请求:', req.params);
  
  try {
    const { record_num } = req.params;
    
    // 查找原记录
    const originalRecord = await LocalBox.findOne({
      where: { 记录号: record_num }
    });
    
    if (!originalRecord) {
      return res.status(404).json({
        code: 1,
        message: '记录不存在'
      });
    }
    
    // 标记记录为已取消状态（软删除）
    const [updatedCount] = await LocalBox.update({
      status: '已取消',
      last_updated_at: new Date(),
      remark: sequelize.fn('CONCAT', 
        sequelize.fn('IFNULL', sequelize.col('remark'), ''),
        `;\n${new Date().toISOString()} 手动删除记录`
      )
    }, {
      where: { 记录号: record_num, status: '待出库' }
    });
    
    if (updatedCount > 0) {
      console.log('\x1b[32m%s\x1b[0m', '✅ 混合箱SKU删除成功:', {
        record_num,
        sku: originalRecord.sku,
        quantity: originalRecord.total_quantity
      });
      
      res.json({
        code: 0,
        message: '删除成功',
        data: {
          record_num,
          deleted_sku: originalRecord.sku,
          deleted_quantity: originalRecord.total_quantity
        }
      });
    } else {
      res.status(404).json({
        code: 1,
        message: '记录不存在或删除失败'
      });
    }
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 删除混合箱SKU失败:', error);
    res.status(500).json({
      code: 1,
      message: '删除失败',
      error: error.message
    });
  }
});

// 批量删除混合箱记录
router.delete('/mixed-box-items/batch', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到批量删除混合箱SKU请求:', req.body);
  
  try {
    const { record_nums } = req.body;
    
    if (!record_nums || !Array.isArray(record_nums) || record_nums.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '记录号列表不能为空'
      });
    }
    
    // 查找所有要删除的记录
    const recordsToDelete = await LocalBox.findAll({
      where: { 记录号: { [Op.in]: record_nums } },
      raw: true
    });
    
    if (recordsToDelete.length === 0) {
      return res.status(404).json({
        code: 1,
        message: '没有找到要删除的记录'
      });
    }
    
    // 批量标记为已取消状态（软删除）
    const [updatedCount] = await LocalBox.update({
      status: '已取消',
      last_updated_at: new Date(),
      remark: sequelize.fn('CONCAT', 
        sequelize.fn('IFNULL', sequelize.col('remark'), ''),
        `;\n${new Date().toISOString()} 批量删除记录`
      )
    }, {
      where: { 记录号: { [Op.in]: record_nums }, status: '待出库' }
    });
    
    console.log('\x1b[32m%s\x1b[0m', '✅ 批量删除混合箱SKU成功:', {
      requested: record_nums.length,
      updated: updatedCount
    });
    
    res.json({
      code: 0,
      message: `批量删除成功，标记了 ${updatedCount} 条记录为已取消`,
      data: {
        requested_count: record_nums.length,
        updated_count: updatedCount,
        updated_records: recordsToDelete
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 批量删除混合箱SKU失败:', error);
    res.status(500).json({
      code: 1,
      message: '批量删除失败',
      error: error.message
    });
  }
});

// 更新发货状态（批量发货完成）
router.post('/update-shipped-status', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到批量发货完成请求:', JSON.stringify(req.body, null, 2));
  
  const transaction = await sequelize.transaction();
  
  try {
    const { updateItems, shipping_method = '', logistics_provider = '', remark = '' } = req.body;
    
    if (!updateItems || !Array.isArray(updateItems) || updateItems.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        code: 1,
        message: '发货数据不能为空'
      });
    }

    console.log('\x1b[33m%s\x1b[0m', '📦 开始处理发货完成，总计:', updateItems.length);

    // 第一步：创建发货记录主表
    const shipmentNumber = `SHIP-${Date.now()}`;
    const totalBoxes = updateItems.reduce((sum, item) => sum + (item.total_boxes || 0), 0);
    const totalItems = updateItems.reduce((sum, item) => sum + item.quantity, 0);

    console.log('\x1b[33m%s\x1b[0m', '📦 创建发货记录:', {
      shipmentNumber,
      totalBoxes: Math.abs(totalBoxes),
      totalItems: Math.abs(totalItems)
    });

    const shipmentRecord = await ShipmentRecord.create({
      shipment_number: shipmentNumber,
      operator: '批量发货',
      total_boxes: Math.abs(totalBoxes),
      total_items: Math.abs(totalItems),
      shipping_method: shipping_method,
      status: '已发货',
      remark: remark,
      logistics_provider: logistics_provider
    }, { transaction });

    // 第二步：创建发货明细记录（优化：批量查询）
    const shipmentItems = [];
    const orderSummary = new Map(); // 用于统计每个需求单的发货情况
    
    console.log('\x1b[33m%s\x1b[0m', '📦 开始批量查询SKU映射和需求记录，总计:', updateItems.length, '个SKU');

    // 预处理：统一country字段并收集所有需要查询的SKU
    const normalizedItems = updateItems.map(item => {
      let normalizedCountry = item.country;
      if (item.country === 'US') {
        normalizedCountry = '美国';
      } else if (item.country === 'UK') {
        normalizedCountry = '英国';
      } else if (item.country === 'AU') {
        normalizedCountry = '澳大利亚';
      } else if (item.country === 'AE') {
        normalizedCountry = '阿联酋';
      } else if (item.country === 'CA') {
        normalizedCountry = '加拿大';
      }
      return { ...item, normalizedCountry };
    });

    // 批量查询Amazon SKU映射
    const mappingConditions = normalizedItems.map(item => ({
      [Op.and]: [
        { local_sku: item.sku },
        { country: item.normalizedCountry }
      ]
    }));
    
    const allMappings = await AmzSkuMapping.findAll({
      where: { [Op.or]: mappingConditions }
    });
    
    // 创建映射的快速查找表
    const mappingMap = new Map();
    allMappings.forEach(mapping => {
      const key = `${mapping.local_sku}-${mapping.country}`;
      mappingMap.set(key, mapping);
    });

    // 批量查询需求记录
    const orderConditions = [];
    
    // 优先使用record_num进行精确查询
    const recordNums = normalizedItems
      .filter(item => item.record_num && item.record_num > 0)
      .map(item => item.record_num);
    
    if (recordNums.length > 0) {
      orderConditions.push({ record_num: { [Op.in]: recordNums } });
    }
    
    // 对于没有record_num的记录，使用sku和country查询
    const skuCountryItems = normalizedItems.filter(item => !item.record_num || item.record_num <= 0);
    if (skuCountryItems.length > 0) {
      const skuCountryConditions = skuCountryItems.map(item => ({
        [Op.and]: [
          { sku: item.sku },
          { country: item.normalizedCountry },
          { status: { [Op.in]: ['待发货', '备货中', '部分发货'] } } // 添加"待发货"状态
        ]
      }));
      orderConditions.push(...skuCountryConditions);
    }
    
    const allOrderItems = orderConditions.length > 0 ? await WarehouseProductsNeed.findAll({
      where: { [Op.or]: orderConditions },
      order: [['record_num', 'DESC']]
    }) : [];
    
    // 创建需求记录的快速查找表（支持record_num和sku-country两种查找方式）
    const orderItemMap = new Map();
    const orderItemByRecordNum = new Map();
    allOrderItems.forEach(orderItem => {
      // 按record_num索引
      orderItemByRecordNum.set(orderItem.record_num, orderItem);
      // 按sku-country索引（用于备用查找）
      const key = `${orderItem.sku}-${orderItem.country}`;
      if (!orderItemMap.has(key)) {
        orderItemMap.set(key, orderItem);
      }
    });

    console.log('\x1b[32m%s\x1b[0m', '✅ 批量查询完成:', {
      映射记录: allMappings.length,
      需求记录: allOrderItems.length,
      处理时间: Date.now()
    });

    // 现在快速处理每个SKU（无需数据库查询）
    for (const item of normalizedItems) {
      const {
        sku,
        quantity,
        normalizedCountry,
        is_mixed_box = false,
        total_boxes = 0,
        original_mix_box_num = null,
        record_num = null,
        need_num = null,
        amz_sku = null,
        marketplace = '亚马逊'
      } = item;

      const mappingKey = `${sku}-${normalizedCountry}`;
      
      const mapping = mappingMap.get(mappingKey);
      
      // 优先使用前端传来的record_num查找需求记录
      let orderItem = null;
      if (record_num && record_num > 0) {
        orderItem = orderItemByRecordNum.get(record_num);
        console.log(`🔍 通过record_num ${record_num} 查找需求记录:`, orderItem ? '找到' : '未找到');
      }
      
      // 如果没有找到，尝试通过sku和country查找
      if (!orderItem) {
        const orderKey = `${sku}-${normalizedCountry}`;
        orderItem = orderItemMap.get(orderKey);
        console.log(`🔍 通过sku-country ${orderKey} 查找需求记录:`, orderItem ? '找到' : '未找到');
      }

      // 创建发货明细记录
      const shipmentItem = {
        shipment_id: shipmentRecord.shipment_id,
        order_item_id: orderItem?.record_num || record_num || null,
        need_num: orderItem?.need_num || need_num || `MANUAL-${Date.now()}-${shipmentRecord.operator}`,
        local_sku: sku,
        amz_sku: mapping?.amz_sku || amz_sku || sku,
        country: normalizedCountry,
        marketplace: marketplace,
        requested_quantity: orderItem?.ori_quantity || Math.abs(quantity),
        shipped_quantity: Math.abs(quantity),
        whole_boxes: is_mixed_box ? 0 : Math.abs(total_boxes || 0),
        mixed_box_quantity: is_mixed_box ? Math.abs(quantity) : 0,
        box_numbers: JSON.stringify(original_mix_box_num ? [original_mix_box_num] : [])
      };

      shipmentItems.push(shipmentItem);

      // 统计需求单发货情况（优先使用前端传来的need_num）
      let effectiveNeedNum = null;
      if (orderItem) {
        effectiveNeedNum = orderItem.need_num;
      } else if (need_num) {
        effectiveNeedNum = need_num;
      } else {
        // 生成手动发货需求单号
        effectiveNeedNum = `MANUAL-${Date.now()}-${shipmentRecord.operator}`;
      }
      
      if (effectiveNeedNum) {
        if (!orderSummary.has(effectiveNeedNum)) {
          orderSummary.set(effectiveNeedNum, {
            total_requested: 0,
            total_shipped: 0,
            items: []
          });
        }
        const summary = orderSummary.get(effectiveNeedNum);
        summary.total_requested += orderItem?.ori_quantity || Math.abs(quantity);
        summary.total_shipped += Math.abs(quantity);
        summary.items.push(orderItem?.record_num || record_num || null);
        
        console.log(`📊 需求单 ${effectiveNeedNum} 发货统计:`, {
          total_requested: summary.total_requested,
          total_shipped: summary.total_shipped,
          items_count: summary.items.filter(id => id !== null).length
        });
      } else {
        console.log(`⚠️ 无法确定需求单号，SKU: ${sku}, Country: ${normalizedCountry}`);
      }
    }

    // 第三步：批量插入发货明细
    if (shipmentItems.length > 0) {
      await ShipmentItem.bulkCreate(shipmentItems, { transaction });
      console.log('\x1b[33m%s\x1b[0m', '📦 创建发货明细记录:', shipmentItems.length, '条');
    }

    // 第四步：创建需求单发货关联记录
    const orderRelations = [];
    for (const [needNum, summary] of orderSummary) {
      // 过滤掉null值的items
      const validItems = summary.items.filter(id => id !== null && id > 0);
      
      const completionStatus = summary.total_shipped >= summary.total_requested ? '全部完成' : '部分完成';
      
      orderRelations.push({
        need_num: needNum,
        shipment_id: shipmentRecord.shipment_id,
        total_requested: summary.total_requested,
        total_shipped: summary.total_shipped,
        completion_status: completionStatus
      });

      console.log(`📦 创建需求单关联记录: ${needNum}, 请求: ${summary.total_requested}, 发货: ${summary.total_shipped}, 状态: ${completionStatus}`);

      // 更新需求记录状态（仅对有效的record_num进行更新）
      if (validItems.length > 0) {
        if (completionStatus === '全部完成') {
          await WarehouseProductsNeed.update(
            { status: '已发货' },
            { 
              where: { record_num: { [Op.in]: validItems } },
              transaction 
            }
          );
        } else {
          await WarehouseProductsNeed.update(
            { status: '部分发货' },
            { 
              where: { record_num: { [Op.in]: validItems } },
              transaction 
            }
          );
        }
        console.log(`📊 更新了 ${validItems.length} 个需求记录的状态为: ${completionStatus === '全部完成' ? '已发货' : '部分发货'}`);
      } else {
        console.log(`⚠️ 需求单 ${needNum} 没有有效的record_num，跳过状态更新`);
      }
    }

    if (orderRelations.length > 0) {
      await OrderShipmentRelation.bulkCreate(orderRelations, { transaction });
      console.log('\x1b[33m%s\x1b[0m', '📦 成功创建需求单关联记录:', orderRelations.length, '条');
      console.log('\x1b[33m%s\x1b[0m', '📦 关联记录详情:', orderRelations.map(rel => `${rel.need_num}: ${rel.total_shipped}/${rel.total_requested}`));
    } else {
      console.log('\x1b[31m%s\x1b[0m', '⚠️ 没有创建任何需求单关联记录，orderSummary内容:', Array.from(orderSummary.keys()));
    }

    // 第五步：处理部分出库逻辑（支持混合箱号匹配和整箱确认）
    const shipmentForProcessing = updateItems.map(item => ({
      sku: item.sku,
      quantity: item.quantity,
      country: item.country,
      is_mixed_box: item.is_mixed_box || false,
      original_mix_box_num: item.original_mix_box_num || null,
      is_whole_box_confirmed: item.is_whole_box_confirmed || false
    }));

    console.log('\x1b[33m%s\x1b[0m', '🔄 第六步：开始更新库存状态（local_boxes表）');
    console.log('\x1b[33m%s\x1b[0m', '📦 待处理的发货数据:', shipmentForProcessing.map(item => 
      `SKU:${item.sku}, 数量:${item.quantity}, 国家:${item.country}, 混合箱:${item.is_mixed_box}, 箱号:${item.original_mix_box_num}, 整箱确认:${item.is_whole_box_confirmed}`
    ));
    
    const partialShipmentResult = await processPartialShipmentOptimized(shipmentForProcessing, transaction);

    console.log('\x1b[32m%s\x1b[0m', '📊 库存状态更新结果:', {
      updated: partialShipmentResult.updated,
      partialShipped: partialShipmentResult.partialShipped,
      fullyShipped: partialShipmentResult.fullyShipped,
      errors: partialShipmentResult.errors
    });

    if (partialShipmentResult.errors.length > 0) {
      console.log('\x1b[31m%s\x1b[0m', '⚠️ 库存更新过程中的错误:', partialShipmentResult.errors);
    }

    await transaction.commit();
    
    console.log('\x1b[32m%s\x1b[0m', '✅ 批量发货完成记录创建成功:', {
      shipmentNumber: shipmentNumber,
      shipmentItems: shipmentItems.length,
      orderRelations: orderRelations.length,
      updatedRecords: partialShipmentResult.updated
    });
    
    res.json({
      code: 0,
      message: '发货完成记录创建成功',
      data: {
        shipment_number: shipmentNumber,
        shipment_id: shipmentRecord.shipment_id,
        updated_count: partialShipmentResult.updated,
        shipment_items_count: shipmentItems.length,
        order_relations_count: orderRelations.length,
        partial_shipment_summary: {
          updated: partialShipmentResult.updated,
          partialShipped: partialShipmentResult.partialShipped,
          fullyShipped: partialShipmentResult.fullyShipped,
          errors: partialShipmentResult.errors
        }
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('\x1b[31m%s\x1b[0m', '❌ 批量发货完成失败:', error);
    res.status(500).json({
      code: 1,
      message: '批量发货完成失败',
      error: error.message
    });
  }
});

// 获取库存状态汇总（包括部分出库）
router.get('/inventory-status-summary', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到库存状态汇总查询请求:', JSON.stringify(req.query, null, 2));
  
  try {
    const { country, sku, status } = req.query;
    
    // 构建筛选条件
    const filters = {};
    if (country) filters.country = country;
    if (sku) filters.sku = { [Op.like]: `%${sku}%` };
    if (status) filters.status = status;
    
    // 获取库存状态汇总
    const summary = await getInventoryStatusSummary(filters);
    
    // 按状态分组统计
    const statusCounts = {
      '待出库': 0,
      '部分出库': 0,
      '已出库': 0,
      '已取消': 0
    };
    
    let totalQuantity = 0;
    let totalShipped = 0;
    let totalRemaining = 0;
    
    summary.forEach(item => {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
      totalQuantity += parseInt(item.total_quantity) || 0;
      totalShipped += parseInt(item.shipped_quantity) || 0;
      totalRemaining += parseInt(item.remaining_quantity) || 0;
    });
    
    console.log('\x1b[32m%s\x1b[0m', '📊 库存状态汇总查询成功:', {
      总记录数: summary.length,
      状态统计: statusCounts
    });
    
    res.json({
      code: 0,
      message: '获取库存状态汇总成功',
      data: {
        summary: summary,
        statistics: {
          total_records: summary.length,
          status_counts: statusCounts,
          total_quantity: totalQuantity,
          total_shipped: totalShipped,
          total_remaining: totalRemaining
        }
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 获取库存状态汇总失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取库存状态汇总失败',
      error: error.message
    });
  }
});

// 检查SKU的部分出库状态
router.get('/check-partial-shipment/:sku/:country', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '🔍 收到SKU部分出库状态检查请求:', req.params);
  
  try {
    const { sku, country } = req.params;
    
    const status = await checkPartialShipmentStatus(sku, country);
    
    console.log('\x1b[32m%s\x1b[0m', '✅ SKU部分出库状态检查完成:', {
      sku,
      country,
      hasPartialShipment: status.hasPartialShipment
    });
    
    res.json({
      code: 0,
      message: 'SKU部分出库状态检查完成',
      data: status
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ SKU部分出库状态检查失败:', error);
    res.status(500).json({
      code: 1,
      message: 'SKU部分出库状态检查失败',
      error: error.message
    });
  }
});

// 更新库存状态为已发货（批量发货确认第三步使用）
router.post('/update-shipped-status', async (req, res) => {
  const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  console.log('\x1b[32m%s\x1b[0m', `🔍 [${requestId}] 收到更新库存状态为已发货请求`);
  console.log('\x1b[35m%s\x1b[0m', `📋 [${requestId}] 请求详情:`, JSON.stringify(req.body, null, 2));
  
  const transaction = await sequelize.transaction();
  
  try {
    const { updateItems, shipping_method = '', logistics_provider = '', remark = '' } = req.body;
    
    if (!updateItems || !Array.isArray(updateItems) || updateItems.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '更新数据不能为空'
      });
    }

    // 第一步：创建发货记录主表
    const shipmentNumber = `SHIP-${Date.now()}`;
    const totalBoxes = updateItems.reduce((sum, item) => sum + (item.total_boxes || 0), 0);
    const totalItems = updateItems.reduce((sum, item) => sum + item.quantity, 0);

    console.log('\x1b[33m%s\x1b[0m', '📦 创建发货记录:', {
      shipmentNumber,
      totalBoxes: Math.abs(totalBoxes),
      totalItems: Math.abs(totalItems)
    });

    const shipmentRecord = await ShipmentRecord.create({
      shipment_number: shipmentNumber,
      operator: '批量发货确认',
      total_boxes: Math.abs(totalBoxes),
      total_items: Math.abs(totalItems),
      shipping_method: shipping_method,
      status: '已发货',
      remark: remark,
      logistics_provider: logistics_provider
    }, { transaction });

    // 第二步：处理每个发货项目
    const outboundRecords = [];
    const shipmentItems = [];
    const orderSummary = new Map(); // 用于统计每个需求单的发货情况

         for (const updateItem of updateItems) {
       const {
         sku,
         quantity,
         total_boxes = null,
         country,
         is_mixed_box = false,
         original_mix_box_num = null,
         is_whole_box_confirmed = false,
         // 新增：前端传递的需求记录信息
         record_num = null,
         need_num = null,
         amz_sku = null,
         marketplace = '亚马逊'
       } = updateItem;
      
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
      
             // 优先使用前端传递的需求记录信息
       let needRecords = [];
       let isTemporaryShipment = false;
       
       // 检查是否为临时发货（record_num为负数或undefined都表示临时发货）
       console.log(`🔍 检查发货类型: record_num=${record_num}, need_num=${need_num}, sku=${sku}`);
       
       if ((record_num && record_num < 0) || record_num === undefined || record_num === null) {
         console.log(`📦 检测到临时发货: record_num=${record_num} (负数/undefined/null表示临时发货)`);
         isTemporaryShipment = true;
         needRecords = [];
       } else if (record_num && need_num && need_num.trim() !== '' && record_num > 0) {
         // 前端传递了具体的需求记录信息，直接使用
         console.log(`📋 使用前端传递的需求记录: record_num=${record_num}, need_num=${need_num}`);
         
         const specificNeedRecord = await WarehouseProductsNeed.findByPk(record_num, { transaction });
         console.log(`🔍 查询需求记录结果: record_num=${record_num}, 找到记录=${!!specificNeedRecord}, 状态=${specificNeedRecord?.status}`);
         
         if (specificNeedRecord && specificNeedRecord.status === '待发货') {
           needRecords = [specificNeedRecord];
           console.log(`✅ 找到指定的需求记录: ${record_num}`);
         } else {
           console.warn(`⚠️ 需求记录 ${record_num} 不存在或状态不是待发货，将作为临时发货处理`);
           isTemporaryShipment = true;
         }
       } else {
         // 没有具体的需求记录信息，通过SKU和国家查找
         console.log(`🔍 通过SKU和国家查找需求记录: ${sku} (${normalizedCountry})`);
         needRecords = await WarehouseProductsNeed.findAll({
           where: {
             sku: sku,
             country: normalizedCountry,
             status: '待发货'
           },
           order: [['create_date', 'ASC']], // 按创建时间升序，优先处理最早的需求
           transaction
         });
         
         isTemporaryShipment = needRecords.length === 0;
       }

       console.log(`🔍 最终找到的需求记录数量: ${needRecords.length} 条, 是否临时发货: ${isTemporaryShipment}`);
       console.log(`📊 进入发货处理分支: ${isTemporaryShipment ? '临时发货分支' : '正常发货分支'}`);

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
              raw: true,
              transaction
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
      
      // 生成唯一的记录号
      const recordId = `OUT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      
      // 创建出库记录
      const record = {
        记录号: recordId,
        sku: sku,
        total_quantity: -Math.abs(quantity),
        total_boxes: total_boxes ? -Math.abs(total_boxes) : null,
        country: normalizedCountry,
        time: new Date(),
        操作员: '批量发货确认',
        marketPlace: '亚马逊',
        mix_box_num: mixBoxNum,
        shipment_id: shipmentRecord.shipment_id,
        status: '已出库',
        shipped_at: new Date(),
        box_type: is_mixed_box ? '混合箱' : '整箱',
        last_updated_at: new Date(),
        remark: remark ? `发货备注: ${remark}` : `发货单号: ${shipmentNumber}`
      };
      
      outboundRecords.push(record);

             // 查询Amazon SKU映射（无论是否有需求记录都需要）
       const mapping = await AmzSkuMapping.findOne({
         where: {
           local_sku: sku,
           country: normalizedCountry
         },
         transaction
       });

       if (isTemporaryShipment) {
         // 临时发货：没有对应的需求记录，创建临时发货明细
         console.log(`📦 创建临时发货记录: SKU ${sku} (${normalizedCountry}), 数量: ${quantity}`);
         
         // 使用系统生成的MANUAL开头的need_num，如果没有则生成一个
         let effectiveNeedNum;
         if (need_num && need_num.trim() !== '') {
           // 优先使用前端传递的need_num（应该是MANUAL开头）
           effectiveNeedNum = need_num;
         } else {
           // 如果没有或为undefined/null，生成MANUAL格式的need_num
           effectiveNeedNum = `MANUAL-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
         }
         
         const effectiveAmzSku = amz_sku || mapping?.amz_sku || sku;
         
         console.log(`🔍 临时发货need_num处理: 原值='${need_num}', 有效值='${effectiveNeedNum}' (MANUAL格式)`);
         
         // 处理order_item_id：负数record_num直接使用，undefined则设为null
         const effectiveOrderItemId = (record_num !== undefined && record_num !== null) ? record_num : null;
         
         const shipmentItem = {
           shipment_id: shipmentRecord.shipment_id,
           order_item_id: effectiveOrderItemId, // 使用有效的record_num或null
           need_num: effectiveNeedNum, // 使用MANUAL开头的need_num
           local_sku: sku,
           amz_sku: effectiveAmzSku,
           country: normalizedCountry,
           marketplace: marketplace, // 使用前端传递的marketplace
           requested_quantity: Math.abs(quantity), // 临时发货的请求量等于发货量
           shipped_quantity: Math.abs(quantity),
           whole_boxes: is_mixed_box ? 0 : Math.abs(total_boxes || 0),
           mixed_box_quantity: is_mixed_box ? Math.abs(quantity) : 0,
           box_numbers: JSON.stringify(mixBoxNum ? [mixBoxNum] : [])
         };
         
         console.log(`📦 创建临时发货明细: record_num=${record_num}, need_num=${effectiveNeedNum}`);

         shipmentItems.push(shipmentItem);

         // 为临时发货创建需求单发货关联记录
         const orderSummaryData = {
           total_requested: Math.abs(quantity),
           total_shipped: Math.abs(quantity),
           items: [], // 临时发货没有对应的需求记录，items为空
           is_temporary: true, // 临时发货标记
           manual_need_num: effectiveNeedNum, // MANUAL开头的需求单号
           negative_record_num: effectiveOrderItemId // 有效的record_num（可能是负数或null）
         };
         
         console.log(`📋 临时发货关联记录: MANUAL需求单='${effectiveNeedNum}', 记录号=${effectiveOrderItemId}, 数量=${Math.abs(quantity)}`);
         orderSummary.set(effectiveNeedNum, orderSummaryData);
         console.log(`✅ 已添加临时发货到orderSummary, 当前大小: ${orderSummary.size}`);
         
         console.log(`📦 创建临时发货明细: ${effectiveNeedNum}, 数量: ${quantity}, 记录ID: ${record_num || 'null'}`);
         console.log(`📋 当前orderSummary大小: ${orderSummary.size}, 新增临时需求单: ${effectiveNeedNum}`);
       } else {
         // 正常发货：有对应的需求记录
         let remainingQuantity = Math.abs(quantity);
         
         for (const needRecord of needRecords) {
           if (remainingQuantity <= 0) break;
           
           // 查询该需求记录的已发货数量
           const shippedQuantity = await ShipmentItem.sum('shipped_quantity', {
             where: { order_item_id: needRecord.record_num },
             transaction
           }) || 0;
           
           // 计算剩余需求量
           const remainingNeed = needRecord.ori_quantity - shippedQuantity;
           
           if (remainingNeed <= 0) continue; // 跳过已完全发货的需求

           // 计算本次发货数量（不超过剩余需求量）
           const shipQuantity = Math.min(remainingQuantity, remainingNeed);
           
           const shipmentItem = {
             shipment_id: shipmentRecord.shipment_id,
             order_item_id: needRecord.record_num,
             need_num: needRecord.need_num,
             local_sku: sku,
             amz_sku: amz_sku || mapping?.amz_sku || sku, // 优先使用前端传递的amz_sku
             country: normalizedCountry,
             marketplace: marketplace || needRecord.marketplace || '亚马逊', // 优先使用前端传递的marketplace
             requested_quantity: needRecord.ori_quantity,
             shipped_quantity: shipQuantity,
             whole_boxes: is_mixed_box ? 0 : Math.abs(total_boxes || 0),
             mixed_box_quantity: is_mixed_box ? shipQuantity : 0,
             box_numbers: JSON.stringify(mixBoxNum ? [mixBoxNum] : [])
           };

           shipmentItems.push(shipmentItem);

           // 统计需求单发货情况
           const needNum = needRecord.need_num;
           if (!orderSummary.has(needNum)) {
             orderSummary.set(needNum, {
               total_requested: 0,
               total_shipped: 0,
               items: []
             });
           }
           const summary = orderSummary.get(needNum);
           summary.total_requested += needRecord.ori_quantity;
           summary.total_shipped += shipQuantity;
           summary.items.push(needRecord.record_num);
           
           remainingQuantity -= shipQuantity;
           
           console.log(`📦 为需求单 ${needNum} 记录 ${needRecord.record_num} 创建发货明细: ${shipQuantity}/${needRecord.ori_quantity}`);
         }
         
         if (remainingQuantity > 0) {
           console.warn(`⚠️ SKU ${sku} 仍有 ${remainingQuantity} 数量未分配到具体需求记录，将作为临时发货处理`);
           
           // 为未分配的数量创建MANUAL格式的临时发货记录
           const manualNeedNum = `MANUAL-OVERFLOW-${Date.now()}`;
           
           const tempShipmentItem = {
             shipment_id: shipmentRecord.shipment_id,
             order_item_id: null, // 溢出发货没有具体的record_num
             need_num: manualNeedNum,
             local_sku: sku,
             amz_sku: amz_sku || mapping?.amz_sku || sku, // 优先使用前端传递的amz_sku
             country: normalizedCountry,
             marketplace: marketplace || '亚马逊', // 优先使用前端传递的marketplace
             requested_quantity: remainingQuantity,
             shipped_quantity: remainingQuantity,
             whole_boxes: is_mixed_box ? 0 : Math.abs(total_boxes || 0),
             mixed_box_quantity: is_mixed_box ? remainingQuantity : 0,
             box_numbers: JSON.stringify(mixBoxNum ? [mixBoxNum] : [])
           };

           shipmentItems.push(tempShipmentItem);

           // 为溢出临时发货创建需求单发货关联记录
           orderSummary.set(manualNeedNum, {
             total_requested: remainingQuantity,
             total_shipped: remainingQuantity,
             items: [],
             is_temporary: true,
             manual_need_num: manualNeedNum,
             is_overflow: true // 标记这是溢出发货
           });
           
           console.log(`📦 创建溢出MANUAL发货明细: ${manualNeedNum}, 数量: ${remainingQuantity}`);
         }
       }
    }

    // 第三步：批量插入出库记录
    if (outboundRecords.length > 0) {
      await LocalBox.bulkCreate(outboundRecords, { transaction });
      console.log(`✅ 创建了 ${outboundRecords.length} 条出库记录`);
    }

    // 第四步：批量插入发货明细
    if (shipmentItems.length > 0) {
      await ShipmentItem.bulkCreate(shipmentItems, { transaction });
      console.log(`✅ 创建了 ${shipmentItems.length} 条发货明细记录`);
    }

         // 第五步：创建需求单发货关联记录（这是之前缺失的关键部分）
     console.log(`🔍 准备创建order_shipment_relations记录，orderSummary大小: ${orderSummary.size}`);
     console.log(`🔍 shipmentItems数量: ${shipmentItems.length}`);
     
     // 保底机制：如果orderSummary为空但有shipmentItems，说明都是临时发货
     if (orderSummary.size === 0 && shipmentItems.length > 0) {
       console.log(`⚠️ 检测到orderSummary为空但有shipmentItems，启用保底机制为临时发货创建关联记录`);
       
                         // 为每个shipmentItem创建MANUAL格式的orderSummary记录
         for (const shipmentItem of shipmentItems) {
           const manualNeedNum = (shipmentItem.need_num && shipmentItem.need_num.trim() !== '') 
             ? shipmentItem.need_num 
             : `MANUAL-FALLBACK-${Date.now()}`;
           orderSummary.set(manualNeedNum, {
             total_requested: shipmentItem.shipped_quantity,
             total_shipped: shipmentItem.shipped_quantity,
             items: [],
             is_temporary: true,
             manual_need_num: manualNeedNum,
             fallback_created: true, // 标记这是保底机制创建的
             negative_record_num: shipmentItem.order_item_id // 保存负数record_num
           });
           console.log(`🔄 保底机制创建MANUAL关联: ${manualNeedNum}, 数量: ${shipmentItem.shipped_quantity}, 负数记录: ${shipmentItem.order_item_id}`);
         }
     }
     
     // 打印orderSummary的详细内容用于调试
     for (const [needNum, summary] of orderSummary) {
       console.log(`📋 orderSummary项目: ${needNum} => `, JSON.stringify(summary, null, 2));
     }
     
     const orderRelations = [];
     for (const [needNum, summary] of orderSummary) {
       const completionStatus = summary.total_shipped >= summary.total_requested ? '全部完成' : '部分完成';
       
       const relationRecord = {
         need_num: needNum,
         shipment_id: shipmentRecord.shipment_id,
         total_requested: summary.total_requested,
         total_shipped: summary.total_shipped,
         completion_status: completionStatus
       };
       
       orderRelations.push(relationRecord);
       
       // 根据发货类型输出不同的日志
       if (summary.is_temporary) {
         console.log(`📦 添加临时发货关联记录: MANUAL需求单='${needNum}', 负数记录=${summary.negative_record_num || 'N/A'}, 数量=${summary.total_shipped}`);
       } else {
         console.log(`📦 添加正常发货关联记录: 需求单='${needNum}', 数量=${summary.total_shipped}`);
       }

       // 为正常需求和有record_num的情况更新需求记录状态
       if (completionStatus === '全部完成' && summary.items.length > 0) {
         await WarehouseProductsNeed.update(
           { status: '已发货' },
           { 
             where: { record_num: { [Op.in]: summary.items } },
             transaction 
           }
         );
         console.log(`✅ 更新需求记录状态为已发货: ${summary.items.join(', ')}`);
       } else if (summary.is_temporary) {
         console.log(`📦 临时发货记录: ${needNum} (不更新需求记录状态)`);
       } else if (summary.items.length === 0) {
         console.log(`⚠️ 需求单 ${needNum} 没有关联的需求记录ID，跳过状态更新`);
       }
     }

    // 插入需求单发货关联记录
    console.log(`🔍 最终orderRelations数组长度: ${orderRelations.length}`);
    if (orderRelations.length > 0) {
      console.log(`📋 准备插入的orderRelations:`, JSON.stringify(orderRelations, null, 2));
      
      try {
        console.log('📤 开始执行 OrderShipmentRelation.bulkCreate...');
        const createdRelations = await OrderShipmentRelation.bulkCreate(orderRelations, { 
          transaction,
          returning: true,
          validate: true
        });
        console.log(`✅ 成功创建了 ${createdRelations.length} 条需求单发货关联记录`);
        console.log('📋 创建的记录详情:', JSON.stringify(createdRelations, null, 2));
      } catch (bulkCreateError) {
        console.error('❌ OrderShipmentRelation.bulkCreate 执行失败:', bulkCreateError);
        console.error('❌ 错误详情:', {
          message: bulkCreateError.message,
          sql: bulkCreateError.sql,
          parameters: bulkCreateError.parameters,
          stack: bulkCreateError.stack
        });
        throw bulkCreateError; // 重新抛出错误以触发事务回滚
      }
    } else {
      console.warn(`⚠️ orderRelations数组为空，没有创建任何order_shipment_relations记录！`);
      console.warn(`⚠️ orderSummary 最终状态:`, Array.from(orderSummary.entries()));
    }

    await transaction.commit();
    
    console.log('\x1b[32m%s\x1b[0m', `✅ [${requestId}] 库存状态更新成功 (优化临时发货流程):`, {
      shipmentNumber: shipmentNumber,
      outboundRecords: outboundRecords.length,
      shipmentItems: shipmentItems.length,
      orderRelations: orderRelations.length,
      updated_count: updateItems.length,
      临时发货_使用MANUAL格式: true
    });
    
    res.json({
      code: 0,
      message: '库存状态更新成功',
      data: {
        shipment_number: shipmentNumber,
        shipment_id: shipmentRecord.shipment_id,
        updated_count: updateItems.length,
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
    console.error('\x1b[31m%s\x1b[0m', '❌ 更新库存状态过程中发生错误，执行事务回滚');
    console.error('❌ 错误类型:', error.constructor.name);
    console.error('❌ 错误消息:', error.message);
    console.error('❌ 错误堆栈:', error.stack);
    
    try {
      await transaction.rollback();
      console.log('✅ 事务回滚成功');
    } catch (rollbackError) {
      console.error('❌ 事务回滚失败:', rollbackError);
    }
    
    res.status(500).json({
      code: 1,
      message: '更新库存状态失败',
      error: error.message,
      errorType: error.constructor.name
    });
  }
});

module.exports = router; 