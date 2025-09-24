const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const ProductInformation = require('../models/ProductInformation');

// 获取产品资料列表（带分页和搜索）
router.get('/list', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      site = 'all',
      sort_by = 'item_sku',
      sort_order = 'ASC'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // 构建查询条件
    let whereConditions = {};

    // 站点筛选
    if (site !== 'all') {
      whereConditions.site = site;
    }

    // 搜索条件
    if (search) {
      whereConditions[Op.or] = [
        { item_sku: { [Op.iLike]: `%${search}%` } },
        { item_name: { [Op.iLike]: `%${search}%` } },
        { original_parent_sku: { [Op.iLike]: `%${search}%` } },
        { brand_name: { [Op.iLike]: `%${search}%` } },
        { parent_sku: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // 排序字段映射
    const sortFieldMap = {
      'item_sku': 'item_sku',
      'item_name': 'item_name',
      'site': 'site',
      'parent_sku': 'parent_sku',
      'brand_name': 'brand_name'
    };

    const sortField = sortFieldMap[sort_by] || 'item_sku';
    const sortDirection = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // 查询数据
    const { count, rows } = await ProductInformation.findAndCountAll({
      where: whereConditions,
      order: [[sortField, sortDirection]],
      limit: limitNum,
      offset: offset,
      distinct: true
    });

    // 获取站点列表
    const sites = await ProductInformation.findAll({
      attributes: ['site'],
      group: ['site'],
      raw: true
    });

    const siteList = sites.map(s => s.site);

    res.json({
      success: true,
      data: rows,
      pagination: {
        current: pageNum,
        pageSize: limitNum,
        total: count,
        pages: Math.ceil(count / limitNum)
      },
      siteList: siteList
    });

  } catch (error) {
    console.error('获取产品资料列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取产品资料列表失败: ' + error.message
    });
  }
});

// 获取单个产品资料详情
router.get('/:site/:itemSku', async (req, res) => {
  try {
    const { site, itemSku } = req.params;

    const productInfo = await ProductInformation.findOne({
      where: {
        site: site,
        item_sku: itemSku
      }
    });

    if (!productInfo) {
      return res.status(404).json({
        success: false,
        message: '未找到该产品资料'
      });
    }

    res.json({
      success: true,
      data: productInfo
    });

  } catch (error) {
    console.error('获取产品资料详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取产品资料详情失败: ' + error.message
    });
  }
});

// 创建产品资料
router.post('/', async (req, res) => {
  try {
    const productData = req.body;

    // 检查必填字段
    if (!productData.site || !productData.item_sku) {
      return res.status(400).json({
        success: false,
        message: '站点和商品SKU是必填字段'
      });
    }

    // 检查是否已存在
    const existingProduct = await ProductInformation.findOne({
      where: {
        site: productData.site,
        item_sku: productData.item_sku
      }
    });

    if (existingProduct) {
      return res.status(409).json({
        success: false,
        message: '该产品资料已存在'
      });
    }

    const newProduct = await ProductInformation.create(productData);

    res.json({
      success: true,
      message: '产品资料创建成功',
      data: newProduct
    });

  } catch (error) {
    console.error('创建产品资料失败:', error);
    res.status(500).json({
      success: false,
      message: '创建产品资料失败: ' + error.message
    });
  }
});

// 更新产品资料
router.put('/:site/:itemSku', async (req, res) => {
  try {
    const { site, itemSku } = req.params;
    const updateData = req.body;

    const product = await ProductInformation.findOne({
      where: {
        site: site,
        item_sku: itemSku
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: '未找到该产品资料'
      });
    }

    // 更新数据（不允许修改主键）
    delete updateData.site;
    delete updateData.item_sku;

    await product.update(updateData);

    res.json({
      success: true,
      message: '产品资料更新成功',
      data: product
    });

  } catch (error) {
    console.error('更新产品资料失败:', error);
    res.status(500).json({
      success: false,
      message: '更新产品资料失败: ' + error.message
    });
  }
});

// 删除产品资料
router.delete('/:site/:itemSku', async (req, res) => {
  try {
    const { site, itemSku } = req.params;

    const result = await ProductInformation.destroy({
      where: {
        site: site,
        item_sku: itemSku
      }
    });

    if (result === 0) {
      return res.status(404).json({
        success: false,
        message: '未找到该产品资料'
      });
    }

    res.json({
      success: true,
      message: '产品资料删除成功'
    });

  } catch (error) {
    console.error('删除产品资料失败:', error);
    res.status(500).json({
      success: false,
      message: '删除产品资料失败: ' + error.message
    });
  }
});

// 批量删除产品资料
router.post('/batch-delete', async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要删除的产品列表'
      });
    }

    // 构建删除条件
    const deleteConditions = items.map(item => ({
      site: item.site,
      item_sku: item.item_sku
    }));

    const result = await ProductInformation.destroy({
      where: {
        [Op.or]: deleteConditions
      }
    });

    res.json({
      success: true,
      message: `成功删除 ${result} 条产品资料`
    });

  } catch (error) {
    console.error('批量删除产品资料失败:', error);
    res.status(500).json({
      success: false,
      message: '批量删除产品资料失败: ' + error.message
    });
  }
});

// 获取统计信息
router.get('/statistics', async (req, res) => {
  try {
    // 总数统计
    const totalCount = await ProductInformation.count();

    // 母SKU统计（parent_child为'Parent'的记录数）
    const parentSkuCount = await ProductInformation.count({
      where: {
        parent_child: 'Parent'
      }
    });

    // 按站点统计
    const siteStats = await ProductInformation.findAll({
      attributes: ['site', [ProductInformation.sequelize.fn('COUNT', '*'), 'count']],
      group: ['site'],
      raw: true
    });

    // 按品牌统计（前10）
    const brandStats = await ProductInformation.findAll({
      attributes: ['brand_name', [ProductInformation.sequelize.fn('COUNT', '*'), 'count']],
      where: {
        brand_name: { [Op.not]: null }
      },
      group: ['brand_name'],
      order: [[ProductInformation.sequelize.fn('COUNT', '*'), 'DESC']],
      limit: 10,
      raw: true
    });

    res.json({
      success: true,
      data: {
        totalCount,
        parentSkuCount,
        siteStats,
        brandStats
      }
    });

  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计信息失败: ' + error.message
    });
  }
});

// 获取分组视图数据（支持分页）
router.get('/grouped-list', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      site = 'all'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // 构建查询条件
    let whereConditions = {};

    // 站点筛选
    if (site !== 'all') {
      whereConditions.site = site;
    }

    // 搜索条件
    if (search) {
      whereConditions[Op.or] = [
        { item_sku: { [Op.iLike]: `%${search}%` } },
        { item_name: { [Op.iLike]: `%${search}%` } },
        { original_parent_sku: { [Op.iLike]: `%${search}%` } },
        { brand_name: { [Op.iLike]: `%${search}%` } },
        { parent_sku: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // 首先获取所有parent_sku的列表（用于分页）
    const parentSkuQuery = await ProductInformation.findAll({
      attributes: ['parent_sku'],
      where: {
        ...whereConditions,
        parent_sku: { [Op.not]: null },
        parent_sku: { [Op.ne]: '' }
      },
      group: ['parent_sku'],
      order: [['parent_sku', 'ASC']],
      raw: true
    });

    const allParentSkus = parentSkuQuery.map(item => item.parent_sku);
    const totalParentSkus = allParentSkus.length;

    // 计算当前页需要的parent_sku
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const currentPageParentSkus = allParentSkus.slice(startIndex, endIndex);

    // 获取这些parent_sku对应的所有数据
    const groupedData = [];
    
    for (const parentSku of currentPageParentSkus) {
      // 获取母SKU记录（parent_child='Parent'）
      const parentRecord = await ProductInformation.findOne({
        where: {
          ...whereConditions,
          item_sku: parentSku,
          parent_child: 'Parent'
        }
      });

      // 获取子SKU记录
      const children = await ProductInformation.findAll({
        where: {
          ...whereConditions,
          parent_sku: parentSku
        },
        order: [['item_sku', 'ASC']]
      });

      if (children.length > 0) {
        const totalQuantity = children.reduce((sum, child) => sum + (child.quantity || 0), 0);
        
        groupedData.push({
          parent_sku: parentSku,
          site: (parentRecord || children[0]).site,
          brand_name: (parentRecord || children[0]).brand_name,
          manufacturer: (parentRecord || children[0]).manufacturer,
          item_name: parentRecord ? parentRecord.item_name : children[0].item_name,
          main_image_url: parentRecord ? parentRecord.main_image_url : children[0].main_image_url,
          total_quantity: totalQuantity,
          children_count: children.length,
          children: children,
          parent_record: parentRecord // 包含完整的母SKU记录
        });
      }
    }

    // 获取站点列表
    const sites = await ProductInformation.findAll({
      attributes: ['site'],
      group: ['site'],
      raw: true
    });
    const siteList = sites.map(s => s.site);

    res.json({
      success: true,
      data: groupedData,
      pagination: {
        current: pageNum,
        pageSize: limitNum,
        total: totalParentSkus,
        pages: Math.ceil(totalParentSkus / limitNum)
      },
      siteList: siteList
    });

  } catch (error) {
    console.error('获取分组数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分组数据失败: ' + error.message
    });
  }
});

// 导出到亚马逊资料模板
router.post('/export-to-template', async (req, res) => {
  try {
    const { records, country } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要导出的记录'
      });
    }

    if (!country) {
      return res.status(400).json({
        success: false,
        message: '请选择国家站点'
      });
    }

    // 获取OSS工具函数
    const { getTemplateFromOSS } = require('../utils/oss');
    const XLSX = require('xlsx');

    // 从配置中获取模板信息
    const configPath = 'amazon/templates/config.json';
    let templateConfig = {};
    
    try {
      const configData = await getTemplateFromOSS(configPath);
      if (configData) {
        templateConfig = JSON.parse(configData.toString());
      }
    } catch (error) {
      console.log('获取模板配置失败，使用默认配置:', error.message);
    }

    const countryConfig = templateConfig[country];
    if (!countryConfig || !countryConfig.ossPath) {
      return res.status(404).json({
        success: false,
        message: `未找到${country}站点的亚马逊资料模板，请先上传模板文件`
      });
    }

    // 从OSS下载模板文件
    const templateBuffer = await getTemplateFromOSS(countryConfig.ossPath);
    if (!templateBuffer) {
      return res.status(404).json({
        success: false,
        message: `无法获取${country}站点的模板文件`
      });
    }

    // 读取Excel模板
    const workbook = XLSX.read(templateBuffer, { type: 'buffer' });
    const sheetName = countryConfig.sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      return res.status(400).json({
        success: false,
        message: `模板文件中未找到工作表: ${sheetName}`
      });
    }

    // 获取起始行和列配置
    const startRow = countryConfig.startRow || 2;

    // 填充数据到模板
    records.forEach((record, index) => {
      const rowIndex = startRow + index;
      
      // 根据模板结构填充数据 - 这里需要根据实际的亚马逊模板格式调整
      const cellMappings = {
        'A': record.item_sku, // SKU
        'B': record.item_name, // 商品名称
        'C': record.brand_name, // 品牌
        'D': record.product_description, // 产品描述
        'E': record.bullet_point1, // 要点1
        'F': record.bullet_point2, // 要点2
        'G': record.bullet_point3, // 要点3
        'H': record.bullet_point4, // 要点4
        'I': record.bullet_point5, // 要点5
        'J': record.main_image_url, // 主图URL
        'K': record.standard_price, // 价格
        'L': record.quantity, // 数量
        'M': record.color_name, // 颜色
        'N': record.size_name, // 尺寸
        'O': record.parent_sku, // 父SKU
        'P': record.manufacturer, // 制造商
        'Q': record.country_of_origin, // 原产国
      };

      // 填充每个单元格
      Object.entries(cellMappings).forEach(([column, value]) => {
        const cellAddress = `${column}${rowIndex}`;
        if (value !== undefined && value !== null && value !== '') {
          if (!worksheet[cellAddress]) {
            worksheet[cellAddress] = {};
          }
          worksheet[cellAddress].v = value;
          worksheet[cellAddress].t = typeof value === 'number' ? 'n' : 's';
        }
      });
    });

    // 更新工作表范围
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    const lastRow = Math.max(range.e.r, startRow + records.length - 1);
    const lastCol = Math.max(range.e.c, 16); // Q列是第16列
    worksheet['!ref'] = XLSX.utils.encode_range({
      s: { r: range.s.r, c: range.s.c },
      e: { r: lastRow, c: lastCol }
    });

    // 生成新的Excel文件
    const outputBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 设置响应头
    const fileName = `亚马逊资料模板_${country}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    
    // 发送文件
    res.send(outputBuffer);

  } catch (error) {
    console.error('导出到模板失败:', error);
    res.status(500).json({
      success: false,
      message: '导出失败: ' + error.message
    });
  }
});

module.exports = router; 