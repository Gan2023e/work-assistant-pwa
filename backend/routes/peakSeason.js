const express = require('express');
const router = express.Router();
const { sequelize } = require('../models/database');
const { Op } = require('sequelize');
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
      SELECT DISTINCT YEAR(日期) as year 
      FROM supplier_shipments_peak_season 
      WHERE 日期 IS NOT NULL 
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

// 获取供应商发货记录筛选选项
router.get('/supplier-shipments-filters', async (req, res) => {
  try {
    const { supplierName, vendorSku } = req.query;
    
    // 获取所有供应商（包括无供应商信息的记录）
    const suppliersQuery = `
      SELECT DISTINCT 
        CASE 
          WHEN pw.seller_name IS NULL OR pw.seller_name = '' THEN '无供应商信息'
          ELSE pw.seller_name 
        END as supplier_name
      FROM \`​supplier_shipments_peak_season\` s
      LEFT JOIN sellerinventory_sku sis ON s.vendor_sku = sis.vendor_sku AND s.sellercolorname = sis.sellercolorname
      LEFT JOIN product_weblink pw ON sis.parent_sku = pw.parent_sku
      WHERE s.date IS NOT NULL
      ORDER BY 
        CASE 
          WHEN pw.seller_name IS NULL OR pw.seller_name = '' THEN 1 
          ELSE 0 
        END,
        pw.seller_name ASC
    `;
    
    // 获取年份
    const yearsQuery = `
      SELECT DISTINCT YEAR(s.date) as year
      FROM \`​supplier_shipments_peak_season\` s
      WHERE s.date IS NOT NULL
      ORDER BY year DESC
    `;
    
    // 获取卖家货号（根据供应商筛选）
    let vendorSkuQuery = `
      SELECT DISTINCT s.vendor_sku
      FROM \`​supplier_shipments_peak_season\` s
      LEFT JOIN sellerinventory_sku sis ON s.vendor_sku = sis.vendor_sku AND s.sellercolorname = sis.sellercolorname
      LEFT JOIN product_weblink pw ON sis.parent_sku = pw.parent_sku
      WHERE s.date IS NOT NULL AND s.vendor_sku IS NOT NULL AND s.vendor_sku != ''
    `;
    const vendorSkuReplacements = {};
    
    if (supplierName) {
      if (supplierName === '无供应商信息') {
        vendorSkuQuery += ' AND (pw.seller_name IS NULL OR pw.seller_name = \'\')';
      } else {
        vendorSkuQuery += ' AND pw.seller_name = :supplierName';
        vendorSkuReplacements.supplierName = supplierName;
      }
    }
    
    vendorSkuQuery += ' ORDER BY s.vendor_sku ASC';
    
    // 获取颜色（根据供应商和卖家货号筛选）
    let colorsQuery = `
      SELECT DISTINCT s.sellercolorname as color
      FROM \`​supplier_shipments_peak_season\` s
      LEFT JOIN sellerinventory_sku sis ON s.vendor_sku = sis.vendor_sku AND s.sellercolorname = sis.sellercolorname
      LEFT JOIN product_weblink pw ON sis.parent_sku = pw.parent_sku
      WHERE s.date IS NOT NULL AND s.sellercolorname IS NOT NULL AND s.sellercolorname != ''
    `;
    const colorsReplacements = {};
    
    if (supplierName) {
      if (supplierName === '无供应商信息') {
        colorsQuery += ' AND (pw.seller_name IS NULL OR pw.seller_name = \'\')';
      } else {
        colorsQuery += ' AND pw.seller_name = :supplierName';
        colorsReplacements.supplierName = supplierName;
      }
    }
    
    if (vendorSku) {
      colorsQuery += ' AND s.vendor_sku IN (:vendorSku)';
      colorsReplacements.vendorSku = Array.isArray(vendorSku) ? vendorSku : vendorSku.split(',');
    }
    
    colorsQuery += ' ORDER BY s.sellercolorname ASC';
    
    // 执行查询
    const [suppliers, years, vendorSkus, colors] = await Promise.all([
      sequelize.query(suppliersQuery, { type: sequelize.QueryTypes.SELECT }),
      sequelize.query(yearsQuery, { type: sequelize.QueryTypes.SELECT }),
      sequelize.query(vendorSkuQuery, { 
        replacements: vendorSkuReplacements, 
        type: sequelize.QueryTypes.SELECT 
      }),
      sequelize.query(colorsQuery, { 
        replacements: colorsReplacements, 
        type: sequelize.QueryTypes.SELECT 
      })
    ]);

    res.json({
      code: 0,
      data: {
        suppliers: suppliers.map(item => item.supplier_name).filter(Boolean),
        years: years.map(item => item.year).filter(Boolean),
        vendorSkus: vendorSkus.map(item => item.vendor_sku).filter(Boolean),
        colors: colors.map(item => item.color).filter(Boolean)
      }
    });

  } catch (error) {
    console.error('获取筛选选项失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取筛选选项失败',
      error: error.message
    });
  }
});

// 获取供应商发货记录详情
router.get('/supplier-shipments', async (req, res) => {
  try {
    const { year, startDate, endDate, vendorSku, color, supplierName } = req.query;
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
    
    // 支持多选卖家货号
    if (vendorSku && vendorSku.trim() !== '') {
      const vendorSkuArray = Array.isArray(vendorSku) ? vendorSku : vendorSku.split(',').map(s => s.trim()).filter(s => s);
      if (vendorSkuArray.length > 0) {
        whereCondition += ' AND s.vendor_sku IN (:vendorSkuArray)';
        replacements.vendorSkuArray = vendorSkuArray;
      }
    }
    
    // 支持多选颜色
    if (color && color.trim() !== '') {
      const colorArray = Array.isArray(color) ? color : color.split(',').map(s => s.trim()).filter(s => s);
      if (colorArray.length > 0) {
        whereCondition += ' AND s.sellercolorname IN (:colorArray)';
        replacements.colorArray = colorArray;
      }
    }
    
    // 支持供应商筛选
    if (supplierName && supplierName.trim() !== '') {
      if (supplierName === '无供应商信息') {
        whereCondition += ' AND (pw.seller_name IS NULL OR pw.seller_name = \'\')';
      } else {
        whereCondition += ' AND pw.seller_name = :supplierName';
        replacements.supplierName = supplierName;
      }
    }

    const shipmentRecords = await sequelize.query(`
      SELECT 
        s.id,
        s.date,
        s.vendor_sku,
        s.sellercolorname as color,
        s.quantity,
        s.create_date,
        sis.parent_sku,
        sis.child_sku,
        CASE 
          WHEN pw.seller_name IS NULL OR pw.seller_name = '' THEN '无供应商信息'
          ELSE pw.seller_name 
        END as supplier_name
      FROM \`​supplier_shipments_peak_season\` s
      LEFT JOIN sellerinventory_sku sis ON s.vendor_sku = sis.vendor_sku AND s.sellercolorname = sis.sellercolorname
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
      FROM \`​supplier_shipments_peak_season\` s
      LEFT JOIN sellerinventory_sku sis ON s.vendor_sku = sis.vendor_sku AND s.sellercolorname = sis.sellercolorname
      LEFT JOIN product_weblink pw ON sis.parent_sku = pw.parent_sku
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

// 获取供应商发货汇总数据
router.get('/supplier-shipments-summary', async (req, res) => {
  try {
    const { year } = req.query;
    
    let whereCondition = '';
    const replacements = {};
    
    if (year) {
      whereCondition += ' AND YEAR(s.date) = :year';
      replacements.year = year;
    }

    // 获取所有发货记录 - 排除数量为0或空的记录
    const shipmentRecords = await sequelize.query(`
      SELECT 
        s.date,
        s.vendor_sku,
        s.sellercolorname,
        sis.child_sku,
        s.quantity
      FROM \`​supplier_shipments_peak_season\` s
      LEFT JOIN sellerinventory_sku sis ON s.vendor_sku = sis.vendor_sku AND s.sellercolorname = sis.sellercolorname
      WHERE s.date IS NOT NULL 
        AND s.quantity IS NOT NULL 
        AND s.quantity > 0 
        ${whereCondition}
      ORDER BY s.date ASC, s.vendor_sku, s.sellercolorname
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    // 处理数据，生成汇总结构
    const summaryMap = new Map();
    const datesSet = new Set();

    console.log('Raw shipment records count:', shipmentRecords.length);
    
    shipmentRecords.forEach((record, index) => {
      const date = record.date.split('T')[0]; // 只取日期部分
      const quantity = Number(record.quantity);
      
      // 调试日志 - 显示前几条记录的详细信息
      if (index < 5) {
        console.log(`Record ${index}:`, {
          vendor_sku: record.vendor_sku,
          sellercolorname: record.sellercolorname,
          child_sku: record.child_sku,
          quantity: quantity,
          date: date
        });
      }
      
      let displaySku;
      if (record.child_sku) {
        // 有真正的子SKU
        displaySku = record.child_sku;
      } else {
        // 构建vendor_sku-颜色组合，处理空值情况
        const vendorSku = record.vendor_sku && record.vendor_sku !== 'None' ? record.vendor_sku : '未知货号';
        const colorName = record.sellercolorname && record.sellercolorname !== 'None' ? record.sellercolorname : '未知颜色';
        
        // 如果两个都是未知，则显示为"数据缺失"
        if (vendorSku === '未知货号' && colorName === '未知颜色') {
          displaySku = '数据缺失';
          console.log(`Data missing record found: quantity=${quantity}, vendor_sku=${record.vendor_sku}, color=${record.sellercolorname}`);
        } else {
          displaySku = `${vendorSku}-${colorName}`;
        }
      }
      
      datesSet.add(date);
      
      if (!summaryMap.has(displaySku)) {
        summaryMap.set(displaySku, {
          child_sku: displaySku,
          is_real_child_sku: !!record.child_sku, // 标记是否为真正的子SKU
          is_data_missing: (!record.vendor_sku || record.vendor_sku === 'None') && 
                          (!record.sellercolorname || record.sellercolorname === 'None') && 
                          !record.child_sku, // 标记是否为数据缺失
          dates: {},
          total: 0
        });
      }
      
      const summary = summaryMap.get(displaySku);
      if (!summary.dates[date]) {
        summary.dates[date] = 0;
      }
      summary.dates[date] += quantity;
      summary.total += quantity;
    });

    // 转换为数组并排序
    const dates = Array.from(datesSet).sort();
    const summary = Array.from(summaryMap.values()).sort((a, b) => 
      a.child_sku.localeCompare(b.child_sku)
    );

    res.json({
      code: 0,
      data: {
        summary,
        dates
      }
    });

  } catch (error) {
    console.error('获取供应商发货汇总失败:', error);
    res.status(500).json({
      code: 1,
      message: '获取供应商发货汇总失败',
      error: error.message
    });
  }
});

// 更新供应商发货记录
router.put('/supplier-shipments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, vendor_sku, color, quantity, supplier_name, parent_sku } = req.body;
    
    // 验证必填字段
    if (!date || !vendor_sku || !color || quantity === undefined || quantity === null) {
      return res.status(400).json({
        code: 1,
        message: '缺少必填字段：日期、卖家货号、颜色、数量'
      });
    }
    
    // 验证数量必须为正数
    if (isNaN(quantity) || quantity < 0) {
      return res.status(400).json({
        code: 1,
        message: '数量必须为非负数字'
      });
    }

    // 开始数据库事务
    const transaction = await sequelize.transaction();
    
    try {
      // 首先检查记录是否存在
      const existingRecord = await sequelize.query(`
        SELECT id FROM \`​supplier_shipments_peak_season\` WHERE id = :id
      `, {
        replacements: { id },
        type: sequelize.QueryTypes.SELECT,
        transaction
      });

      if (existingRecord.length === 0) {
        await transaction.rollback();
        return res.status(404).json({
          code: 1,
          message: '记录未找到'
        });
      }

      // 更新基本发货记录信息
      await sequelize.query(`
        UPDATE \`​supplier_shipments_peak_season\` 
        SET 
          date = :date,
          vendor_sku = :vendor_sku,
          sellercolorname = :color,
          quantity = :quantity
        WHERE id = :id
      `, {
        replacements: { id, date, vendor_sku, color, quantity },
        type: sequelize.QueryTypes.UPDATE,
        transaction
      });

      // 如果提供了supplier_name，需要更新相关的product_weblink表
      if (supplier_name !== undefined) {
        let parentSku = parent_sku;
        
        // 如果前端没有传递parent_sku，则通过查询获取
        if (!parentSku) {
          const currentRecord = await sequelize.query(`
            SELECT sis.parent_sku
            FROM \`​supplier_shipments_peak_season\` s
            LEFT JOIN sellerinventory_sku sis ON s.vendor_sku = sis.vendor_sku AND s.sellercolorname = sis.sellercolorname
            WHERE s.id = :id
          `, {
            replacements: { id },
            type: sequelize.QueryTypes.SELECT,
            transaction
          });
          
          if (currentRecord.length > 0 && currentRecord[0].parent_sku) {
            parentSku = currentRecord[0].parent_sku;
          }
        }

        if (parentSku) {
          // 更新product_weblink表中对应的seller_name
          await sequelize.query(`
            UPDATE product_weblink 
            SET seller_name = :supplier_name 
            WHERE parent_sku = :parent_sku
          `, {
            replacements: { 
              supplier_name: supplier_name || null, 
              parent_sku: parentSku 
            },
            type: sequelize.QueryTypes.UPDATE,
            transaction
          });
          
          console.log(`更新了Parent SKU "${parentSku}" 的供应商信息为 "${supplier_name}"`);
        } else {
          console.log('未找到对应的Parent SKU，跳过供应商信息更新');
        }
      }

      await transaction.commit();
      
      res.json({
        code: 0,
        message: supplier_name !== undefined ? '更新成功，供应商信息已同步更新' : '更新成功'
      });

    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('更新供应商发货记录失败:', error);
    res.status(500).json({
      code: 1,
      message: '更新失败',
      error: error.message
    });
  }
});

// 删除供应商发货记录
router.delete('/supplier-shipments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('删除供应商发货记录，ID:', id);

    const deleteResult = await sequelize.query(`
      DELETE FROM supplier_shipments_peak_season 
      WHERE id = :id
    `, {
      replacements: { id: parseInt(id) },
      type: sequelize.QueryTypes.DELETE
    });

    console.log('删除结果:', deleteResult);

    if (deleteResult[1] === 0) {
      return res.status(404).json({
        code: 1,
        message: '记录未找到'
      });
    }

    res.json({
      code: 0,
      message: '删除成功'
    });

  } catch (error) {
    console.error('删除供应商发货记录失败:', error);
    res.status(500).json({
      code: 1,
      message: '删除失败',
      error: error.message
    });
  }
});

// 批量删除供应商发货记录
router.post('/supplier-shipments/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        code: 1,
        message: '请提供有效的记录ID列表'
      });
    }

    // 验证所有ID都是数字
    const validIds = ids.filter(id => Number.isInteger(id) && id > 0);
    if (validIds.length !== ids.length) {
      return res.status(400).json({
        code: 1,
        message: '提供的ID格式无效'
      });
    }

    console.log('批量删除供应商发货记录，IDs:', validIds);

    const deleteResult = await sequelize.query(`
      DELETE FROM supplier_shipments_peak_season 
      WHERE id IN (:ids)
    `, {
      replacements: { ids: validIds },
      type: sequelize.QueryTypes.DELETE
    });

    console.log('批量删除结果:', deleteResult);

    res.json({
      code: 0,
      message: `成功删除 ${deleteResult[1]} 条记录`,
      data: {
        deletedCount: deleteResult[1]
      }
    });

  } catch (error) {
    console.error('批量删除供应商发货记录失败:', error);
    res.status(500).json({
      code: 1,
      message: '批量删除失败',
      error: error.message
    });
  }
});

module.exports = router; 