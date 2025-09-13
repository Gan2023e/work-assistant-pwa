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
          YEAR(s.日期) as year,
          COUNT(DISTINCT s.卖家货号) as total_shipments,
          SUM(s.数量) as total_shipped_quantity
        FROM supplier_shipments_peak_season s 
        WHERE s.日期 IS NOT NULL
        GROUP BY YEAR(s.日期)
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
          s1.卖家货号, 
          SUM(s1.数量) as shipped_quantity
        FROM supplier_shipments_peak_season s1
        WHERE s1.日期 IS NOT NULL 
          ${year ? 'AND YEAR(s1.日期) = :year' : ''}
        GROUP BY s1.卖家货号
      ) s ON p.local_sku = s.卖家货号
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

    res.json({
      code: 0,
      data: paymentDetails
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

// 获取年份列表
router.get('/years', async (req, res) => {
  try {
    const years = await sequelize.query(`
      SELECT DISTINCT YEAR(upate_date) as year 
      FROM peak_season_inventory_prep 
      WHERE upate_date IS NOT NULL 
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

    // 按日期和SKU汇总的数据透视表视图（含厂家名称三表关联）
    const dailyShipments = await sequelize.query(`
      SELECT 
        s.日期 as shipment_date,
        s.卖家货号 as sku,
        s.卖家颜色 as color,
        SUM(s.数量) as total_quantity,
        COUNT(*) as record_count,
        MIN(s.录入日期) as first_entry_date,
        MAX(s.录入日期) as last_entry_date,
        GROUP_CONCAT(DISTINCT s.序号) as record_ids,
        pw.seller_name as supplier_name,
        sis.parent_sku
      FROM supplier_shipments_peak_season s
      LEFT JOIN sellerinventory_sku sis ON s.卖家货号 = sis.vendor_sku
      LEFT JOIN product_weblink pw ON sis.parent_sku = pw.parent_sku
      WHERE s.日期 IS NOT NULL ${whereCondition}
      GROUP BY s.日期, s.卖家货号, s.卖家颜色, pw.seller_name, sis.parent_sku
      ORDER BY s.日期 DESC, s.卖家货号, s.卖家颜色
      LIMIT :limit OFFSET :offset
    `, {
      replacements: { ...replacements, limit, offset },
      type: sequelize.QueryTypes.SELECT
    });

    // 获取总数
    const totalResult = await sequelize.query(`
      SELECT COUNT(*) as total
      FROM (
        SELECT s.日期, s.卖家货号, s.卖家颜色
        FROM supplier_shipments_peak_season s
        WHERE s.日期 IS NOT NULL ${whereCondition}
        GROUP BY s.日期, s.卖家货号, s.卖家颜色
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
        s.日期 as date,
        COUNT(DISTINCT s.卖家货号) as unique_skus,
        SUM(s.数量) as total_quantity,
        COUNT(*) as total_records
      FROM supplier_shipments_peak_season s
      WHERE s.日期 IS NOT NULL ${whereCondition}
      GROUP BY s.日期
      ORDER BY s.日期 DESC
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    // 按SKU汇总统计（含厂家名称）
    const skuSummary = await sequelize.query(`
      SELECT 
        s.卖家货号 as sku,
        COUNT(DISTINCT s.日期) as ship_days,
        SUM(s.数量) as total_quantity,
        COUNT(*) as total_records,
        MIN(s.日期) as first_ship_date,
        MAX(s.日期) as last_ship_date,
        pw.seller_name as supplier_name,
        sis.parent_sku
      FROM supplier_shipments_peak_season s
      LEFT JOIN sellerinventory_sku sis ON s.卖家货号 = sis.vendor_sku
      LEFT JOIN product_weblink pw ON sis.parent_sku = pw.parent_sku
      WHERE s.日期 IS NOT NULL ${whereCondition}
      GROUP BY s.卖家货号, pw.seller_name, sis.parent_sku
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

module.exports = router; 