const express = require('express');
const router = express.Router();
const { sequelize } = require('../models/database');
const { 
  PeakSeasonInventoryPrep, 
  SupplierShipmentsPeakSeason, 
  BulkPaymentsPeakSeason,
  SellerInventorySku,
  ProductWeblink
} = require('../models');

// 获取旺季备货汇总统计
router.get('/summary', async (req, res) => {
  try {
    const { year, country, local_sku } = req.query;
    
    let whereCondition = '';
    const replacements = {};
    
    if (year) {
      whereCondition += ' AND YEAR(p.upate_date) = :year';
      replacements.year = year;
    }
    if (country) {
      whereCondition += ' AND p.country = :country';
      replacements.country = country;
    }
    if (local_sku) {
      whereCondition += ' AND p.local_sku LIKE :local_sku';
      replacements.local_sku = `%${local_sku}%`;
    }
    
    // 修复后的按年度统计查询 - 避免笛卡尔积
    const yearlyStats = await sequelize.query(`
      SELECT 
        YEAR(p.upate_date) as year,
        COUNT(DISTINCT p.local_sku) as total_skus,
        SUM(p.qty) as total_prep_quantity,
        COALESCE(shipment_stats.total_shipments, 0) as total_shipments,
        COALESCE(shipment_stats.total_shipped_quantity, 0) as total_shipped_quantity,
        COALESCE(payment_stats.total_suppliers, 0) as total_suppliers,
        COALESCE(payment_stats.total_payment_amount, 0) as total_payment_amount
      FROM peak_season_inventory_prep p
      LEFT JOIN (
        SELECT 
          YEAR(s.date) as year,
          COUNT(DISTINCT s.vendor_sku) as total_shipments,
          SUM(s.quantity) as total_shipped_quantity
        FROM supplier_shipments_peak_season s 
        WHERE s.date IS NOT NULL
        GROUP BY YEAR(s.date)
      ) shipment_stats ON YEAR(p.upate_date) = shipment_stats.year
      LEFT JOIN (
        SELECT 
          YEAR(bp.付款时间) as year,
          COUNT(DISTINCT bp.卖家名称) as total_suppliers,
          CAST(SUM(bp.付款金额) as DECIMAL(16,2)) as total_payment_amount
        FROM bulk_payments_peak_season bp 
        WHERE bp.付款时间 IS NOT NULL
        GROUP BY YEAR(bp.付款时间)
      ) payment_stats ON YEAR(p.upate_date) = payment_stats.year
      WHERE p.upate_date IS NOT NULL ${whereCondition}
      GROUP BY YEAR(p.upate_date)
      ORDER BY YEAR(p.upate_date) DESC
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      code: 0,
      data: yearlyStats
    });
    
  } catch (error) {
    console.error('获取旺季备货汇总统计失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取统计数据失败',
      error: error.message
    });
  }
});

// 获取SKU详细备货信息
router.get('/sku-details', async (req, res) => {
  try {
    const { year, country, local_sku } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    let whereCondition = '';
    const replacements = {};
    
    if (year) {
      whereCondition += ' AND YEAR(p.upate_date) = :year';
      replacements.year = year;
    }
    if (country) {
      whereCondition += ' AND p.country = :country';
      replacements.country = country;
    }
    if (local_sku) {
      whereCondition += ' AND p.local_sku LIKE :local_sku';
      replacements.local_sku = `%${local_sku}%`;
    }

    // 修复SKU详情查询 - 按年份过滤发货数据
    const skuDetails = await sequelize.query(`
      SELECT 
        p.local_sku,
        p.country,
        p.qty as prep_quantity,
        p.upate_date,
        COALESCE(s.shipped_quantity, 0) as shipped_quantity,
        YEAR(p.upate_date) as year
      FROM peak_season_inventory_prep p
      LEFT JOIN (
        SELECT 
          s1.vendor_sku, 
          SUM(s1.quantity) as shipped_quantity
        FROM supplier_shipments_peak_season s1
        WHERE s1.date IS NOT NULL 
          ${year ? 'AND YEAR(s1.date) = :year' : ''}
        GROUP BY s1.vendor_sku
      ) s ON p.local_sku = s.vendor_sku
      WHERE p.upate_date IS NOT NULL ${whereCondition}
      ORDER BY p.upate_date DESC, p.local_sku
      LIMIT :limit OFFSET :offset
    `, {
      replacements: { ...replacements, limit, offset },
      type: sequelize.QueryTypes.SELECT
    });

    // 获取总数
    let countCondition = '';
    const countReplacements = {};
    
    if (year) {
      countCondition += ' AND YEAR(upate_date) = :year';
      countReplacements.year = year;
    }
    if (country) {
      countCondition += ' AND country = :country';
      countReplacements.country = country;
    }
    if (local_sku) {
      countCondition += ' AND local_sku LIKE :local_sku';
      countReplacements.local_sku = `%${local_sku}%`;
    }
    
    const countResult = await sequelize.query(`
      SELECT COUNT(*) as total 
      FROM peak_season_inventory_prep 
      WHERE upate_date IS NOT NULL ${countCondition}
    `, {
      replacements: countReplacements,
      type: sequelize.QueryTypes.SELECT
    });
    
    const totalCount = countResult[0].total;

    res.json({
      code: 0,
      data: {
        records: skuDetails,
        pagination: {
          current: page,
          pageSize: limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      }
    });

  } catch (error) {
    console.error('获取SKU详细信息失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取SKU详细信息失败',
      error: error.message
    });
  }
});

// 获取供应商统计（这个查询是正确的，保持不变）
router.get('/supplier-stats', async (req, res) => {
  try {
    const { year } = req.query;
    
    let whereCondition = '';
    const replacements = {};
    
    if (year) {
      whereCondition += ' AND YEAR(bp.付款时间) = :year';
      replacements.year = year;
    }

    const supplierStats = await sequelize.query(`
      SELECT 
        bp.卖家名称 as supplier,
        YEAR(bp.付款时间) as year,
        COUNT(DISTINCT bp.序列) as payment_count,
        CAST(SUM(bp.付款金额) as DECIMAL(16,2)) as total_payment_amount,
        bp.付款类型 as payment_type
      FROM bulk_payments_peak_season bp
      WHERE bp.付款时间 IS NOT NULL ${whereCondition}
      GROUP BY bp.卖家名称, YEAR(bp.付款时间), bp.付款类型
      ORDER BY YEAR(bp.付款时间) DESC, total_payment_amount DESC
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      code: 0,
      data: supplierStats
    });
    
  } catch (error) {
    console.error('获取供应商统计失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取供应商统计失败',
      error: error.message
    });
  }
});

// 获取付款详细记录
router.get('/payment-details', async (req, res) => {
  try {
    const { year, supplier, payment_type } = req.query;
    
    if (!supplier || !payment_type) {
      return res.status(400).json({
        code: 1,
        message: '供应商和付款类型不能为空'
      });
    }
    
    let whereCondition = ' AND bp.卖家名称 = :supplier AND bp.付款类型 = :payment_type';
    const replacements = { supplier, payment_type };
    
    if (year) {
      whereCondition += ' AND YEAR(bp.付款时间) = :year';
      replacements.year = year;
    }

    const paymentDetails = await sequelize.query(`
      SELECT 
        bp.序列 as id,
        bp.卖家名称 as supplier,
        bp.付款类型 as payment_type,
        CAST(bp.付款金额 as DECIMAL(16,2)) as amount,
        bp.付款时间 as payment_date,
        CONCAT(bp.付款类型, ' - 第', ROW_NUMBER() OVER (PARTITION BY bp.卖家名称, bp.付款类型 ORDER BY bp.付款时间), '笔') as description
      FROM bulk_payments_peak_season bp
      WHERE bp.付款时间 IS NOT NULL ${whereCondition}
      ORDER BY bp.付款时间 DESC
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    // 确保amount字段为数字类型
    const processedData = paymentDetails.map(item => ({
      ...item,
      amount: parseFloat(item.amount) || 0
    }));

    res.json({
      code: 0,
      data: processedData
    });
    
  } catch (error) {
    console.error('获取付款详细记录失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取付款详细记录失败',
      error: error.message
    });
  }
});

// 获取年份列表（基于实际发货数据）
router.get('/years', async (req, res) => {
  try {
    const years = await sequelize.query(`
      SELECT DISTINCT YEAR(date) as year 
      FROM supplier_shipments_peak_season 
      WHERE date IS NOT NULL 
      ORDER BY year DESC
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    res.json({
      code: 0,
      data: years.map(item => item.year).filter(year => year)
    });
    
  } catch (error) {
    console.error('获取年份列表失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取年份列表失败',
      error: error.message
    });
  }
});

// 获取日发货详情 - 数据透视表视图
router.get('/daily-shipments', async (req, res) => {
  try {
    const { year, startDate, endDate, supplierName } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    let whereCondition = '';
    const replacements = {};
    
    // 年份过滤
    if (year) {
      whereCondition += ' AND YEAR(s.日期) = :year';
      replacements.year = year;
    }
    
    // 日期范围过滤
    if (startDate) {
      whereCondition += ' AND s.日期 >= :startDate';
      replacements.startDate = startDate;
    }
    if (endDate) {
      whereCondition += ' AND s.日期 <= :endDate';
      replacements.endDate = endDate;
    }

    // 按日期和SKU汇总的数据透视表视图（以主表为准，关联表信息作为补充）
    const dailyShipments = await sequelize.query(`
      SELECT 
        s.date as shipment_date,
        s.vendor_sku as sku,
        s.sellercolorname as color,
        SUM(s.quantity) as total_quantity,
        COUNT(*) as record_count,
        MIN(s.create_date) as first_entry_date,
        MAX(s.create_date) as last_entry_date,
        GROUP_CONCAT(DISTINCT s.id) as record_ids,
        COALESCE(pw.seller_name, '') as supplier_name,
        COALESCE(sis.parent_sku, '') as parent_sku
      FROM supplier_shipments_peak_season s
      LEFT JOIN sellerinventory_sku sis ON s.vendor_sku = sis.vendor_sku
      LEFT JOIN product_weblink pw ON sis.parent_sku = pw.parent_sku
      WHERE s.date IS NOT NULL ${whereCondition}
      GROUP BY s.date, s.vendor_sku, s.sellercolorname
      ORDER BY s.date DESC, s.vendor_sku, s.sellercolorname
      LIMIT :limit OFFSET :offset
    `, {
      replacements: { ...replacements, limit, offset },
      type: sequelize.QueryTypes.SELECT
    });

    // 获取总数
    const totalResult = await sequelize.query(`
      SELECT COUNT(*) as total
      FROM (
        SELECT s.date, s.vendor_sku, s.sellercolorname
        FROM supplier_shipments_peak_season s
        WHERE s.date IS NOT NULL ${whereCondition}
        GROUP BY s.date, s.vendor_sku, s.sellercolorname
      ) as grouped_data
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    const total = totalResult[0]?.total || 0;

    res.json({
      code: 0,
      data: {
        records: dailyShipments,
        pagination: {
          current: page,
          total: parseInt(total),
          pageSize: limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('获取日发货详情失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取日发货详情失败',
      error: error.message
    });
  }
});

// 获取日发货统计汇总
router.get('/daily-shipments-summary', async (req, res) => {
  try {
    const { year, startDate, endDate } = req.query;
    
    let whereCondition = '';
    const replacements = {};
    
    if (year) {
      whereCondition += ' AND YEAR(s.日期) = :year';
      replacements.year = year;
    }
    
    if (startDate) {
      whereCondition += ' AND s.日期 >= :startDate';
      replacements.startDate = startDate;
    }
    if (endDate) {
      whereCondition += ' AND s.日期 <= :endDate';
      replacements.endDate = endDate;
    }

    // 按日期汇总统计
    const dailySummary = await sequelize.query(`
      SELECT 
        s.date as date,
        COUNT(DISTINCT s.vendor_sku) as unique_skus,
        SUM(s.quantity) as total_quantity,
        COUNT(*) as total_records
      FROM supplier_shipments_peak_season s
      WHERE s.date IS NOT NULL ${whereCondition}
      GROUP BY s.date
      ORDER BY s.date DESC
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    // 按SKU汇总统计（以主表为准，关联表信息作为补充）
    const skuSummary = await sequelize.query(`
      SELECT 
        s.vendor_sku as sku,
        COUNT(DISTINCT s.date) as ship_days,
        SUM(s.quantity) as total_quantity,
        COUNT(*) as total_records,
        MIN(s.date) as first_ship_date,
        MAX(s.date) as last_ship_date,
        COALESCE(pw.seller_name, '') as supplier_name,
        COALESCE(sis.parent_sku, '') as parent_sku
      FROM supplier_shipments_peak_season s
      LEFT JOIN sellerinventory_sku sis ON s.vendor_sku = sis.vendor_sku
      LEFT JOIN product_weblink pw ON sis.parent_sku = pw.parent_sku
      WHERE s.date IS NOT NULL ${whereCondition}
      GROUP BY s.vendor_sku
      ORDER BY total_quantity DESC
      LIMIT 20
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      code: 0,
      data: {
        dailySummary,
        skuSummary
      }
    });
    
  } catch (error) {
    console.error('获取日发货统计汇总失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取日发货统计汇总失败',
      error: error.message
    });
  }
});

// 测试数据接口 - 检查supplier_shipments_peak_season表数据
router.get('/test-data', async (req, res) => {
  try {
    // 检查supplier_shipments_peak_season表数据
    const shipmentCount = await sequelize.query(`
      SELECT COUNT(*) as total 
      FROM supplier_shipments_peak_season
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    // 检查最近10条记录
    const recentRecords = await sequelize.query(`
      SELECT * 
      FROM supplier_shipments_peak_season
      ORDER BY id DESC 
      LIMIT 10
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    // 检查sellerinventory_sku表的vendor_sku字段情况
    const vendorSkuCount = await sequelize.query(`
      SELECT COUNT(*) as total_records,
             COUNT(vendor_sku) as vendor_sku_filled
      FROM sellerinventory_sku
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    // 检查三表关联的结果
    const joinTest = await sequelize.query(`
      SELECT 
        s.vendor_sku,
        sis.vendor_sku,
        sis.parent_sku,
        pw.seller_name
      FROM supplier_shipments_peak_season s
      LEFT JOIN sellerinventory_sku sis ON s.vendor_sku = sis.vendor_sku
      LEFT JOIN product_weblink pw ON sis.parent_sku = pw.parent_sku
      LIMIT 10
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      code: 0,
      data: {
        shipmentCount: shipmentCount[0],
        recentRecords,
        vendorSkuStatus: vendorSkuCount[0],
        joinTestResults: joinTest
      }
    });
  } catch (error) {
    console.error('测试数据查询失败:', error);
    res.status(500).json({
      code: 1,
      message: '测试数据查询失败',
      error: error.message
    });
  }
});

// 获取供应商发货记录详情
router.get('/supplier-shipments', async (req, res) => {
  try {
    const { year, startDate, endDate, vendorSku, color } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    let whereCondition = '';
    const replacements = {};

    if (year) {
      whereCondition += ' AND YEAR(s.date) = :year';
      replacements.year = year;
    }
    if (startDate) {
      whereCondition += ' AND s.date >= :startDate';
      replacements.startDate = startDate;
    }
    if (endDate) {
      whereCondition += ' AND s.date <= :endDate';
      replacements.endDate = endDate;
    }
    if (vendorSku) {
      whereCondition += ' AND s.vendor_sku LIKE :vendorSku';
      replacements.vendorSku = `%${vendorSku}%`;
    }
    if (color) {
      whereCondition += ' AND s.sellercolorname LIKE :color';
      replacements.color = `%${color}%`;
    }

    // 获取供应商发货记录
    const shipmentRecords = await sequelize.query(`
      SELECT 
        s.id,
        s.date,
        s.vendor_sku,
        s.sellercolorname as color,
        s.quantity,
        s.create_date,
        COALESCE(pw.seller_name, '') as supplier_name,
        COALESCE(sis.parent_sku, '') as parent_sku
      FROM supplier_shipments_peak_season s
      LEFT JOIN sellerinventory_sku sis ON s.vendor_sku = sis.vendor_sku
      LEFT JOIN product_weblink pw ON sis.parent_sku = pw.parent_sku
      WHERE s.date IS NOT NULL ${whereCondition}
      ORDER BY s.date DESC, s.vendor_sku, s.sellercolorname
      LIMIT :limit OFFSET :offset
    `, {
      replacements: { ...replacements, limit, offset },
      type: sequelize.QueryTypes.SELECT
    });

    // 获取总数
    const totalResult = await sequelize.query(`
      SELECT COUNT(*) as total
      FROM supplier_shipments_peak_season s
      WHERE s.date IS NOT NULL ${whereCondition}
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    const total = totalResult[0]?.total || 0;

    res.json({
      code: 0,
      data: {
        records: shipmentRecords,
        pagination: {
          current: page,
          pageSize: limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('获取供应商发货记录失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取供应商发货记录失败',
      error: error.message
    });
  }
});

module.exports = router; 