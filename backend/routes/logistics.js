const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const Logistics = require('../models/Logistics');

// 搜索物流信息
router.post('/search', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到搜索请求:', JSON.stringify(req.body, null, 2));
  
  try {
    const { shippingIds, filters } = req.body;
    
    // 构建查询条件
    const where = {};
    if (Array.isArray(shippingIds) && shippingIds.length > 0) {
      where.shippingId = {
        [Op.in]: shippingIds
      };
    }

    // 添加筛选条件
    if (filters) {
      // 处理特殊查询
      if (filters.specialQuery === 'pendingWarehouse') {
        // 查询10天内即将到仓的记录，只统计状态为"在途"的记录
        const tenDaysFromNow = new Date();
        tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
        
        where[Op.and] = [
          {
            estimatedWarehouseDate: {
              [Op.and]: [
                { [Op.ne]: null },
                { [Op.lte]: tenDaysFromNow.toISOString().split('T')[0] },
                { [Op.gte]: new Date().toISOString().split('T')[0] }
              ]
            }
          },
          {
            status: '在途'
          }
        ];
      } else if (filters.specialQuery === 'yearlyShipments') {
        // 查询今年发货的记录（发出日期为今年）
        const currentYear = new Date().getFullYear();
        where.departureDate = {
          [Op.and]: [
            { [Op.ne]: null },
            { [Op.gte]: `${currentYear}-01-01` },
            { [Op.lte]: `${currentYear}-12-31` }
          ]
        };
      } else {
        // 处理状态筛选
        if (filters.status) {
          if (Array.isArray(filters.status)) {
            if (filters.status.includes('not_completed')) {
              // 如果包含 not_completed，则查询非完成状态
              const otherStatuses = filters.status.filter(s => s !== 'not_completed');
              if (otherStatuses.length > 0) {
                where[Op.or] = [
                  { status: { [Op.ne]: '完成' } },
                  { status: { [Op.in]: otherStatuses } }
                ];
              } else {
                where.status = { [Op.ne]: '完成' };
              }
            } else {
              where.status = { [Op.in]: filters.status };
            }
          } else if (filters.status === 'not_completed') {
        where.status = { [Op.ne]: '完成' };
          } else {
        where.status = filters.status;
      }
        }

        // 处理其他筛选条件（支持数组和单值）
        const filterFields = [
          'logisticsProvider',
          'channel', 
          'destinationCountry',
          'taxPaymentStatus',
          'taxDeclarationStatus',
          'paymentStatus'
        ];

        filterFields.forEach(field => {
          if (filters[field]) {
            if (Array.isArray(filters[field]) && filters[field].length > 0) {
              where[field] = { [Op.in]: filters[field] };
            } else if (!Array.isArray(filters[field])) {
              where[field] = filters[field];
            }
          }
        });
      }
    }

    console.log('\x1b[35m%s\x1b[0m', '查询条件:', JSON.stringify(where, null, 2));

    const logistics = await Logistics.findAll({
      where,
      order: [['shippingId', 'DESC']]
    });

    console.log('\x1b[32m%s\x1b[0m', '查询结果数量:', logistics.length);

    res.json({
      code: 0,
      message: 'success',
      data: logistics
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '搜索物流信息失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: error.message
    });
  }
});

// 更新单个记录
router.post('/update', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到单个记录更新请求:', JSON.stringify(req.body, null, 2));
  
  try {
    const { shippingId, ...updateData } = req.body;
    
    // 验证参数
    if (!shippingId) {
      return res.status(400).json({
        code: 400,
        message: 'shippingId 是必需的'
      });
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        code: 400,
        message: '至少需要提供一个要更新的字段'
      });
    }

    console.log('\x1b[35m%s\x1b[0m', `更新记录 ${shippingId}:`, updateData);

    // 查找记录是否存在
    const existingRecord = await Logistics.findOne({
      where: { shippingId }
    });

    if (!existingRecord) {
      return res.status(404).json({
        code: 404,
        message: '记录不存在'
      });
    }

    // 执行更新
    const [affectedCount] = await Logistics.update(updateData, {
      where: { shippingId }
    });

    console.log('\x1b[32m%s\x1b[0m', '成功更新记录数:', affectedCount);

    // 返回更新后的记录
    const updatedRecord = await Logistics.findOne({
      where: { shippingId }
    });

    res.json({
      code: 0,
      message: 'success',
      data: updatedRecord
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '更新记录失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: error.message
    });
  }
});

// 批量更新多字段
router.post('/batch-update', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到批量更新多字段请求:', JSON.stringify(req.body, null, 2));
  
  try {
    const { updates } = req.body;
    
    // 验证参数
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        code: 400,
        message: 'updates 必须是非空数组'
      });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // 逐个处理更新
    for (const updateItem of updates) {
      const { shippingId, updates: updateData } = updateItem;
      
      if (!shippingId || !updateData || Object.keys(updateData).length === 0) {
        console.log('\x1b[33m%s\x1b[0m', `跳过无效的更新项:`, updateItem);
        errorCount++;
        results.push({
          shippingId,
          success: false,
          error: 'shippingId 和 updates 是必需的'
        });
        continue;
      }

      try {
        // 检查记录是否存在
        const existingRecord = await Logistics.findOne({
          where: { shippingId }
        });

        if (!existingRecord) {
          console.log('\x1b[33m%s\x1b[0m', `记录不存在: ${shippingId}`);
          errorCount++;
          results.push({
            shippingId,
            success: false,
            error: '记录不存在'
          });
          continue;
        }

        // 执行更新
        const [affectedCount] = await Logistics.update(updateData, {
          where: { shippingId }
        });

        if (affectedCount > 0) {
          successCount++;
          results.push({
            shippingId,
            success: true,
            updatedFields: Object.keys(updateData)
          });
          console.log('\x1b[32m%s\x1b[0m', `成功更新记录: ${shippingId}`);
        } else {
          errorCount++;
          results.push({
            shippingId,
            success: false,
            error: '更新失败'
          });
        }
      } catch (itemError) {
        console.error('\x1b[31m%s\x1b[0m', `更新记录 ${shippingId} 失败:`, itemError);
        errorCount++;
        results.push({
          shippingId,
          success: false,
          error: itemError.message
        });
      }
    }

    console.log('\x1b[32m%s\x1b[0m', `批量更新完成: 成功 ${successCount} 条，失败 ${errorCount} 条`);

    res.json({
      code: 0,
      message: 'success',
      data: {
        totalCount: updates.length,
        successCount,
        errorCount,
        results
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '批量更新多字段失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: error.message
    });
  }
});

// 批量更新状态
router.post('/batch-update-status', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到批量更新状态请求:', JSON.stringify(req.body, null, 2));
  
  try {
    const { shippingIds, status } = req.body;
    
    // 验证参数
    if (!Array.isArray(shippingIds) || shippingIds.length === 0) {
      return res.status(400).json({
        code: 400,
        message: 'shippingIds 必须是非空数组'
      });
    }
    
    if (!status || !['在途', '入库中', '完成'].includes(status)) {
      return res.status(400).json({
        code: 400,
        message: '状态必须是：在途、入库中、完成 中的一种'
      });
    }

    console.log('\x1b[35m%s\x1b[0m', `批量更新 ${shippingIds.length} 条记录状态为: ${status}`);

    // 执行批量更新
    const [affectedCount] = await Logistics.update(
      { status: status },
      {
        where: {
          shippingId: {
            [Op.in]: shippingIds
          }
        }
      }
    );

    console.log('\x1b[32m%s\x1b[0m', '成功更新记录数:', affectedCount);

    res.json({
      code: 0,
      message: 'success',
      data: {
        affectedCount,
        updatedStatus: status,
        shippingIds
      }
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '批量更新状态失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: error.message
    });
  }
});

// 获取所有可筛选字段的唯一值
router.get('/filters', async (req, res) => {
  try {
    const fieldMap = {
      logisticsProvider: 'logistics_provider',
      channel: 'channel',
      status: 'status',
      destinationCountry: 'destination_country',
      taxPaymentStatus: 'tax_payment_status',
      taxDeclarationStatus: 'tax_declaration_status',
      paymentStatus: 'payment_status'
    };
    const fields = Object.keys(fieldMap);
    const result = {};
    for (const key of fields) {
      const dbField = fieldMap[key];
      try {
        const rows = await Logistics.findAll({
          attributes: [[dbField, 'value']],
          group: [dbField],
          raw: true
        });
        result[key] = rows.map(r => r.value).filter(v => v !== null && v !== '');
      } catch (e) {
        console.error('字段出错:', key, e.message);
        result[key] = [];
      }
    }
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: 500, message: '获取筛选项失败', error: e.message });
  }
});

// 获取统计数据
router.get('/statistics', async (req, res) => {
  console.log('\x1b[32m%s\x1b[0m', '收到统计数据请求');
  
  try {
    const currentYear = new Date().getFullYear();
    
    // 1. 今年发货票数（只统计发出日期为今年的记录）
    const yearlyCount = await Logistics.count({
      where: {
        departureDate: {
          [Op.and]: [
            { [Op.ne]: null },
            { [Op.gte]: `${currentYear}-01-01` },
            { [Op.lte]: `${currentYear}-12-31` }
          ]
        }
      }
    });

    // 2. 在途产品数
    const transitRecords = await Logistics.findAll({
      where: { status: '在途' },
      attributes: ['productCount'],
      raw: true
    });
    const transitProductCount = transitRecords.reduce((sum, record) => sum + (Number(record.productCount) || 0), 0);

    // 3. 在途箱数
    const transitPackageRecords = await Logistics.findAll({
      where: { status: '在途' },
      attributes: ['packageCount'],
      raw: true
    });
    const transitPackageCount = transitPackageRecords.reduce((sum, record) => sum + (Number(record.packageCount) || 0), 0);

    // 4. 未付总运费
    const unpaidRecords = await Logistics.findAll({
      where: { paymentStatus: '未付' },
      attributes: ['price', 'billingWeight'],
      raw: true
    });
    const unpaidTotalFee = unpaidRecords.reduce((sum, record) => {
      const price = Number(record.price) || 0;
      const weight = Number(record.billingWeight) || 0;
      return sum + (price * weight);
    }, 0);

    // 5. 待调整到仓日货件数（10天内，只统计状态为"在途"的记录）
    const tenDaysFromNow = new Date();
    tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
    
    const pendingWarehouseCount = await Logistics.count({
      where: {
        [Op.and]: [
          {
            estimatedWarehouseDate: {
              [Op.and]: [
                { [Op.ne]: null },
                { [Op.lte]: tenDaysFromNow.toISOString().split('T')[0] },
                { [Op.gte]: new Date().toISOString().split('T')[0] }
              ]
            }
          },
          {
            status: '在途'
          }
        ]
      }
    });

    const result = {
      yearlyCount,
      transitProductCount,
      transitPackageCount,
      unpaidTotalFee: Math.round(unpaidTotalFee * 100) / 100, // 保留两位小数
      pendingWarehouseCount
    };

    console.log('\x1b[32m%s\x1b[0m', '统计数据:', result);

    res.json({
      code: 0,
      message: 'success',
      data: result
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '获取统计数据失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: error.message
    });
  }
});

module.exports = router; 