const express = require('express');
const router = express.Router();
const { Op, QueryTypes } = require('sequelize');
const { sequelize } = require('../models');
const ProductInformation = require('../models/ProductInformation');
const multer = require('multer');
const XLSX = require('xlsx');
const ListingsSku = require('../models/ListingsSku');

// 配置multer用于文件上传
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  },
  fileFilter: (req, file, cb) => {
    // 允许Excel文件
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];

    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}，请上传Excel文件(.xlsx或.xls)`));
    }
  }
});

// 获取产品资料列表（带分页和搜索）
router.get('/list', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      site = 'all',
      sort_by = 'item_sku',
      sort_order = 'ASC'
    } = req.query;

    console.log(`🔍 普通列表搜索请求: 搜索词="${search}", 页码=${page}, 每页=${limit}, 站点=${site}, 排序=${sort_by}`);

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
        { item_sku: { [Op.like]: `%${search}%` } },
        { item_name: { [Op.like]: `%${search}%` } },
        { original_parent_sku: { [Op.like]: `%${search}%` } },
        { brand_name: { [Op.like]: `%${search}%` } },
        { parent_sku: { [Op.like]: `%${search}%` } }
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

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`✅ 普通列表搜索完成: 耗时 ${duration}ms, 返回 ${rows.length} 条记录, 总数 ${count} 条`);

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
  const startTime = Date.now();
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      site = 'all'
    } = req.query;

    console.log(`🔍 分组视图搜索请求: 搜索词="${search}", 页码=${page}, 每页=${limit}, 站点=${site}`);
    const queryStartTime = Date.now();
    
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
        { item_sku: { [Op.like]: `%${search}%` } },
        { item_name: { [Op.like]: `%${search}%` } },
        { original_parent_sku: { [Op.like]: `%${search}%` } },
        { brand_name: { [Op.like]: `%${search}%` } },
        { parent_sku: { [Op.like]: `%${search}%` } }
      ];
    }

    // 优化：使用数据库级别的分页，避免将所有数据加载到内存
    const offset = (pageNum - 1) * limitNum;
    console.log(`📊 开始分页查询: 偏移量=${offset}, 限制=${limitNum}`);

    const pagingQueryStart = Date.now();
    // 先获取分页的parent_sku列表和总数
    let currentPageParentSkus, totalCount;
    try {
      [currentPageParentSkus, totalCount] = await Promise.all([
      // 获取当前页的parent_sku
      ProductInformation.findAll({
        attributes: ['parent_sku'],
        where: {
          ...whereConditions,
          parent_sku: { [Op.not]: null },
          parent_sku: { [Op.ne]: '' }
        },
        group: ['parent_sku'],
        order: [['parent_sku', 'ASC']],
        limit: limitNum,
        offset: offset,
        raw: true,
        timeout: 25000 // 25秒超时
      }),
      // 获取总数（用于分页信息）
      sequelize.query(`
        SELECT COUNT(DISTINCT parent_sku) as total
        FROM product_information 
        WHERE parent_sku IS NOT NULL AND parent_sku != ''
        ${whereConditions.site ? 'AND site = :site' : ''}
        ${search ? `AND (
          item_sku LIKE :search OR 
          item_name LIKE :search OR 
          original_parent_sku LIKE :search OR 
          brand_name LIKE :search OR 
          parent_sku LIKE :search
        )` : ''}
      `, {
        replacements: { 
          ...(whereConditions.site && { site: whereConditions.site }),
          ...(search && { search: `%${search}%` })
        },
        type: QueryTypes.SELECT
      })
    ]);
    } catch (queryError) {
      console.error('分页查询失败:', queryError);
      throw new Error(`数据库查询失败: ${queryError.message}`);
    }

        const currentPageParentSkuList = currentPageParentSkus.map(item => item.parent_sku);
    const totalParentSkus = totalCount[0].total;
    
    const pagingQueryEnd = Date.now();
    console.log(`✅ 分页查询完成: 耗时 ${pagingQueryEnd - pagingQueryStart}ms, 获取 ${currentPageParentSkuList.length} 个parent_sku, 总数 ${totalParentSkus}`);

    const detailQueryStart = Date.now();
    // 批量获取所有子记录和父记录（避免N+1查询问题）
    let allChildren, allParentRecords;
    try {
      [allChildren, allParentRecords] = await Promise.all([
        // 批量获取所有子记录
        ProductInformation.findAll({
          where: {
            ...whereConditions,
            parent_sku: { [Op.in]: currentPageParentSkuList }
          },
          order: [['parent_sku', 'ASC'], ['item_sku', 'ASC']],
          timeout: 25000 // 25秒超时
        }),
        // 批量获取所有母SKU记录
        ProductInformation.findAll({
          where: {
            ...whereConditions,
            item_sku: { [Op.in]: currentPageParentSkuList },
            parent_child: 'Parent'
          },
          timeout: 25000 // 25秒超时
        })
      ]);
    } catch (detailQueryError) {
      console.error('批量查询失败:', detailQueryError);
      throw new Error(`批量查询失败: ${detailQueryError.message}`);
    }

          const detailQueryEnd = Date.now();
      console.log(`📦 批量查询完成: 耗时 ${detailQueryEnd - detailQueryStart}ms, 获取 ${allChildren.length} 个子记录, ${allParentRecords.length} 个父记录`);

      // 按parent_sku分组整理数据
      const childrenByParentSku = {};
      const parentRecordsByParentSku = {};

    // 分组子记录
    allChildren.forEach(child => {
      if (!childrenByParentSku[child.parent_sku]) {
        childrenByParentSku[child.parent_sku] = [];
      }
      childrenByParentSku[child.parent_sku].push(child);
    });

    // 分组父记录
    allParentRecords.forEach(parentRecord => {
      parentRecordsByParentSku[parentRecord.item_sku] = parentRecord;
    });

          // 构建最终的分组数据
      const groupedData = currentPageParentSkuList.map(parentSku => {
      const children = childrenByParentSku[parentSku] || [];
      const parentRecord = parentRecordsByParentSku[parentSku] || null;
      
      if (children.length === 0) return null;

      const totalQuantity = children.reduce((sum, child) => sum + (child.quantity || 0), 0);
      const firstChild = children[0];

      return {
        parent_sku: parentSku,
        site: parentRecord ? parentRecord.site : firstChild.site,
        brand_name: parentRecord ? parentRecord.brand_name : firstChild.brand_name,
        manufacturer: parentRecord ? parentRecord.manufacturer : firstChild.manufacturer,
        total_quantity: totalQuantity,
        children_count: children.length,
        children: children,
        parent_record: parentRecord
      };
    }).filter(item => item !== null);

    // 获取站点列表（使用简单缓存）
    let siteList = [];
    const cacheKey = 'productinfo_sites';
    const cached = global.siteListCache;
    
    if (cached && cached.timestamp && (Date.now() - cached.timestamp < 300000)) { // 5分钟缓存
      siteList = cached.data;
    } else {
      const sites = await ProductInformation.findAll({
        attributes: ['site'],
        group: ['site'],
        raw: true
      });
      siteList = sites.map(s => s.site);
      global.siteListCache = { data: siteList, timestamp: Date.now() };
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`✅ 分组视图搜索完成: 耗时 ${duration}ms, 返回 ${groupedData.length} 组数据, 总记录 ${totalParentSkus} 个parent_sku`);

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
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      success: false,
      message: '获取分组数据失败: ' + error.message
    });
  }
});

// 上传资料表文件并导入数据
router.post('/upload-template', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的文件'
      });
    }

    const { country } = req.body;
    if (!country) {
      return res.status(400).json({
        success: false,
        message: '请选择对应的国家'
      });
    }

    console.log(`📤 开始处理${country}资料表上传，文件: ${req.file.originalname}`);

    // 解析Excel文件
    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer);
    } catch (parseError) {
      console.error('❌ 解析Excel文件失败:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Excel文件格式错误，无法解析'
      });
    }

    // 优先选择名为"Template"的工作表，如果没有则使用第一个工作表
    let sheetName;
    let worksheet;
    
    if (workbook.Sheets['Template']) {
      sheetName = 'Template';
      worksheet = workbook.Sheets['Template'];
      console.log('✅ 找到Template工作表，使用Template工作表');
    } else {
      sheetName = workbook.SheetNames[0];
      worksheet = workbook.Sheets[sheetName];
      console.log(`⚠️ 未找到Template工作表，使用第一个工作表: ${sheetName}`);
    }
    
    console.log(`📋 当前使用的工作表: ${sheetName}`);
    
    if (!worksheet) {
      return res.status(400).json({
        success: false,
        message: 'Excel文件中没有找到有效的工作表'
      });
    }

    // 转换为JSON数据（跳过空行）
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: ''
    });

    // 查找表头行（第3行，索引为2）
    let headerRow = null;
    let dataStartIndex = 0;
    
    // 确保至少有3行数据（第3行为标题行）
    if (jsonData.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Excel文件格式错误，至少需要包含前3行（第3行为标题行）'
      });
    }

    // 直接使用第3行作为标题行（索引为2）
    headerRow = jsonData[2];
    dataStartIndex = 3; // 数据从第4行开始（索引为3）

    // 添加调试日志
    console.log(`🔍 调试信息 - 第3行内容:`, JSON.stringify(headerRow));
    console.log(`🔍 调试信息 - 第3行长度:`, headerRow ? headerRow.length : 'null');
    
    // 验证标题行是否包含必要的字段（更灵活的匹配）
    const hasValidHeader = headerRow && headerRow.some(cell => {
      if (typeof cell === 'string') {
        const lowerCell = cell.toLowerCase().trim();
        console.log('🔍 检查字段:', cell, '-> 处理后:', lowerCell);
        return lowerCell.includes('item_sku') || lowerCell === 'sku' || lowerCell.includes('sku');
      }
      return false;
    });

    if (!hasValidHeader) {
      console.log('❌ 表头验证失败 - 第3行内容:', headerRow);
      return res.status(400).json({
        success: false,
        message: '未找到有效的表头行，请确保Excel文件包含item_sku等字段。标题行在文件中的第三行。'
      });
    }

    console.log(`📋 找到表头行，共${headerRow.length}列，数据从第${dataStartIndex + 1}行开始`);

    // 创建字段映射
    const fieldMapping = {};
    const requiredFields = ['item_sku', 'item_name']; // site字段将根据选择的国家自动设置
    
    headerRow.forEach((header, index) => {
      if (header && typeof header === 'string') {
        const cleanHeader = header.trim().toLowerCase();
        // 建立字段映射关系
        if (cleanHeader.includes('item_sku') || cleanHeader === 'sku') {
          fieldMapping.item_sku = index;
        } else if (cleanHeader.includes('item_name') || cleanHeader.includes('商品名称')) {
          fieldMapping.item_name = index;
        } else if (cleanHeader.includes('site') || cleanHeader.includes('站点')) {
          fieldMapping.site = index;
        } else if (cleanHeader.includes('external_product_id')) {
          fieldMapping.external_product_id = index;
        } else if (cleanHeader.includes('brand_name') || cleanHeader.includes('品牌')) {
          fieldMapping.brand_name = index;
        } else if (cleanHeader.includes('manufacturer') || cleanHeader.includes('制造商')) {
          fieldMapping.manufacturer = index;
        } else if (cleanHeader.includes('product_description') || cleanHeader.includes('产品描述')) {
          fieldMapping.product_description = index;
        } else if (cleanHeader.includes('bullet_point1') || cleanHeader.includes('要点1')) {
          fieldMapping.bullet_point1 = index;
        } else if (cleanHeader.includes('bullet_point2') || cleanHeader.includes('要点2')) {
          fieldMapping.bullet_point2 = index;
        } else if (cleanHeader.includes('bullet_point3') || cleanHeader.includes('要点3')) {
          fieldMapping.bullet_point3 = index;
        } else if (cleanHeader.includes('bullet_point4') || cleanHeader.includes('要点4')) {
          fieldMapping.bullet_point4 = index;
        } else if (cleanHeader.includes('bullet_point5') || cleanHeader.includes('要点5')) {
          fieldMapping.bullet_point5 = index;
        } else if (cleanHeader.includes('generic_keywords') || cleanHeader.includes('关键词')) {
          fieldMapping.generic_keywords = index;
        } else if (cleanHeader.includes('color_name') || cleanHeader.includes('颜色')) {
          fieldMapping.color_name = index;
        } else if (cleanHeader.includes('size_name') || cleanHeader.includes('尺寸')) {
          fieldMapping.size_name = index;
        } else if (cleanHeader.includes('standard_price') || cleanHeader.includes('标准价格')) {
          fieldMapping.standard_price = index;
        } else if (cleanHeader.includes('list_price') || cleanHeader.includes('标价')) {
          fieldMapping.list_price = index;
        } else if (cleanHeader.includes('quantity') || cleanHeader.includes('数量')) {
          fieldMapping.quantity = index;
        } else if (cleanHeader.includes('main_image_url') || cleanHeader.includes('主图')) {
          fieldMapping.main_image_url = index;
        } else if (cleanHeader.includes('parent_sku') || cleanHeader.includes('父sku')) {
          fieldMapping.parent_sku = index;
        } else if (cleanHeader.includes('parent_child')) {
          fieldMapping.parent_child = index;
        } else if (cleanHeader.includes('variation_theme') || cleanHeader.includes('变体主题')) {
          fieldMapping.variation_theme = index;
        } else if (cleanHeader.includes('country_of_origin') || cleanHeader.includes('原产国')) {
          fieldMapping.country_of_origin = index;
        }
      }
    });

    // 检查必需字段
    const missingFields = requiredFields.filter(field => fieldMapping[field] === undefined);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Excel文件缺少必需字段: ${missingFields.join(', ')}`
      });
    }

    // 解析数据行
    const records = [];
    const errors = [];
    
    for (let i = dataStartIndex; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.every(cell => !cell || cell === '')) {
        continue; // 跳过空行
      }

      const record = {};
      
      // 基本字段
      record.item_sku = row[fieldMapping.item_sku] || '';
      record.item_name = row[fieldMapping.item_name] || '';
      record.site = country; // 始终使用用户选择的国家作为site值
      
      if (!record.item_sku) {
        errors.push(`第${i + 1}行: item_sku不能为空`);
        continue;
      }

      // 可选字段（排除site字段，因为site由用户选择的国家决定）
      Object.keys(fieldMapping).forEach(field => {
        if (field !== 'item_sku' && field !== 'item_name' && field !== 'site') {
          const value = row[fieldMapping[field]];
          if (value !== undefined && value !== '') {
            if (field === 'standard_price' || field === 'list_price' || field === 'quantity') {
              record[field] = parseFloat(value) || null;
            } else {
              record[field] = String(value).trim();
            }
          }
        }
      });

      records.push(record);
    }

    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有找到有效的数据行'
      });
    }

    console.log(`📊 解析完成，共${records.length}条记录待导入`);

    // 批量插入数据库
    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const record of records) {
      try {
        const [productInfo, created] = await ProductInformation.upsert(record, {
          returning: true
        });
        
        if (created) {
          insertedCount++;
        } else {
          updatedCount++;
        }
      } catch (dbError) {
        errorCount++;
        console.error(`❌ 导入记录失败 (${record.item_sku}):`, dbError.message);
        errors.push(`${record.item_sku}: ${dbError.message}`);
      }
    }

    console.log(`✅ 导入完成: 新增${insertedCount}条，更新${updatedCount}条，失败${errorCount}条`);

    res.json({
      success: true,
      message: `${country}资料表导入完成`,
      data: {
        total: records.length,
        inserted: insertedCount,
        updated: updatedCount,
        errors: errorCount,
        errorDetails: errors.slice(0, 10) // 最多返回10个错误详情
      }
    });

  } catch (error) {
    console.error('❌ 上传资料表失败:', error);
    res.status(500).json({
      success: false,
      message: '上传失败: ' + error.message
    });
  }
});

// 导出选中记录到对应国家的资料表模板
router.post('/export-to-template', async (req, res) => {
  try {
    const { selectedRecords, targetCountry } = req.body;

    if (!selectedRecords || selectedRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请选择要导出的记录'
      });
    }

    if (!targetCountry) {
      return res.status(400).json({
        success: false,
        message: '请指定目标国家'
      });
    }

    console.log(`📊 开始导出 ${selectedRecords.length} 条记录到${targetCountry}模板`);

    const OSS = require('ali-oss');
    const XLSX = require('xlsx');
    const TemplateLink = require('../models/TemplateLink');

    // OSS配置
    const ossConfig = {
      region: process.env.OSS_REGION || process.env.ALICLOUD_OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID || process.env.ALICLOUD_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || process.env.ALICLOUD_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET || process.env.ALICLOUD_OSS_BUCKET,
      endpoint: process.env.OSS_ENDPOINT,
    };

    const client = new OSS(ossConfig);

    // 步骤1: 从数据库获取目标国家的模板文件
    console.log(`🔍 查找${targetCountry}站点的模板文件...`);
    
    // 国家中文名称转换为代码的映射表
    const countryCodeMapping = {
      '美国': 'US',
      '加拿大': 'CA', 
      '英国': 'UK',
      '德国': 'DE',
      '法国': 'FR',
      '意大利': 'IT',
      '西班牙': 'ES',
      '日本': 'JP',
      '澳大利亚': 'AU',
      '印度': 'IN',
      '阿联酋': 'AE',
      '新加坡': 'SG'
    };
    
    // 转换国家名称为国家代码
    const countryCode = countryCodeMapping[targetCountry] || targetCountry;
    console.log(`🔍 转换国家名称: ${targetCountry} -> ${countryCode}`);
    
    const targetTemplate = await TemplateLink.findOne({
      where: {
        country: countryCode,
        file_name: {
          [Op.like]: '%.xlsx'
        }
      },
      order: [['upload_time', 'DESC']]
    });

    if (!targetTemplate) {
      return res.status(400).json({
        success: false,
        message: `未找到${targetCountry}站点的资料模板，请先上传${targetCountry}模板文件`
      });
    }

    console.log(`📄 使用${targetCountry}模板: ${targetTemplate.file_name} (ID: ${targetTemplate.id})`);

    // 步骤2: 下载模板文件
    console.log(`📥 下载${targetCountry}模板文件...`);
    let templateBuffer;
    try {
      const result = await client.get(targetTemplate.oss_object_name);
      templateBuffer = result.content;
      console.log(`✅ ${targetCountry}模板下载成功，大小: ${templateBuffer.length} 字节`);
    } catch (downloadError) {
      console.error(`❌ 下载${targetCountry}模板失败:`, downloadError);
      return res.status(500).json({
        success: false,
        message: `下载${targetCountry}模板失败: ${downloadError.message}`
      });
    }

    // 步骤3: 解析和处理模板文件
    console.log(`📋 开始处理${targetCountry}模板文件...`);

    let workbook;
    try {
      workbook = XLSX.read(templateBuffer);
    } catch (parseError) {
      console.error('❌ 解析模板文件失败:', parseError);
      return res.status(400).json({
        success: false,
        message: '模板文件格式错误，无法解析'
      });
    }

    const templateSheet = workbook.Sheets['Template'] || workbook.Sheets[workbook.SheetNames[0]];
    if (!templateSheet) {
      return res.status(400).json({
        success: false,
        message: '模板文件中未找到Template工作表'
      });
    }

    // 步骤4: 填充数据到模板
    console.log(`📝 开始填充 ${selectedRecords.length} 条记录到模板...`);

    // 转换为数组格式
    const templateData = XLSX.utils.sheet_to_json(templateSheet, { header: 1 });

    // 找到标题行（第3行，索引为2）
    const headerRow = templateData[2];
    if (!headerRow) {
      return res.status(400).json({
        success: false,
        message: '模板文件格式错误，未找到标题行'
      });
    }

    console.log('📊 模板标题行:', headerRow.slice(0, 20));

    // 创建字段名到列索引的映射
    const fieldToColumnMap = {};
    headerRow.forEach((fieldName, index) => {
      if (fieldName) {
        fieldToColumnMap[fieldName] = index;
      }
    });

    console.log('📋 字段映射:', Object.keys(fieldToColumnMap).slice(0, 10));

    // 步骤4.1: 处理母SKU和子SKU关系，重新排序记录
    console.log('🔄 处理母SKU和子SKU关系...');
    
    // 收集所有相关的母SKU和子SKU
    const allRecords = new Map(); // 用于存储所有记录，避免重复
    const parentSkus = new Set(); // 收集所有母SKU
    const childSkus = new Set(); // 收集所有子SKU
    
    // 首先添加选中的记录
    selectedRecords.forEach(record => {
      allRecords.set(record.item_sku, record);
      
      // 如果有parent_sku，收集母SKU
      if (record.parent_sku && record.parent_sku !== record.item_sku) {
        parentSkus.add(record.parent_sku);
      }
      
      // 如果这是子SKU，标记
      if (record.parent_child === 'Child' || (record.parent_sku && record.parent_sku !== record.item_sku)) {
        childSkus.add(record.item_sku);
      }
    });
    
    // 查找并添加缺失的母SKU记录
    if (parentSkus.size > 0) {
      console.log(`🔍 查找 ${parentSkus.size} 个母SKU记录...`);
      
      try {
        const parentRecords = await ProductInformation.findAll({
          where: {
            item_sku: {
              [Op.in]: Array.from(parentSkus)
            },
            site: targetCountry  // 使用中文国家名称而不是国家代码
          }
        });
        
        parentRecords.forEach(record => {
          if (!allRecords.has(record.item_sku)) {
            allRecords.set(record.item_sku, record);
            console.log(`✅ 找到母SKU记录: ${record.item_sku}`);
          }
        });
      } catch (error) {
        console.warn('⚠️ 查找母SKU记录失败:', error.message);
      }
    }
    
    // 重新排序：按母SKU分组，每个母SKU后面紧跟着它的子SKU
    const sortedRecords = [];
    const processedSkus = new Set();
    
    // 按母SKU分组子SKU记录
    const childRecordsByParent = new Map();
    allRecords.forEach(record => {
      if (childSkus.has(record.item_sku) && record.parent_sku) {
        if (!childRecordsByParent.has(record.parent_sku)) {
          childRecordsByParent.set(record.parent_sku, []);
        }
        childRecordsByParent.get(record.parent_sku).push(record);
      }
    });
    
    // 收集所有母SKU记录
    const parentRecords = [];
    allRecords.forEach(record => {
      if (record.parent_child === 'Parent' || (!childSkus.has(record.item_sku) && !record.parent_sku)) {
        parentRecords.push(record);
      }
    });
    
    // 按母SKU分组排序：每个母SKU后面立即跟着它的子SKU
    parentRecords.forEach(parentRecord => {
      // 添加母SKU
      sortedRecords.push(parentRecord);
      processedSkus.add(parentRecord.item_sku);
      
      // 立即添加该母SKU的所有子SKU
      if (childRecordsByParent.has(parentRecord.item_sku)) {
        const children = childRecordsByParent.get(parentRecord.item_sku);
        children.forEach(child => {
          if (!processedSkus.has(child.item_sku)) {
            sortedRecords.push(child);
            processedSkus.add(child.item_sku);
          }
        });
      }
    });
    
    // 添加剩余的记录（没有子SKU的母SKU或独立记录）
    allRecords.forEach(record => {
      if (!processedSkus.has(record.item_sku)) {
        sortedRecords.push(record);
        processedSkus.add(record.item_sku);
      }
    });
    
    console.log(`📊 最终记录顺序: ${sortedRecords.length} 条记录`);
    sortedRecords.forEach((record, index) => {
      const type = record.parent_child === 'Parent' ? '母SKU' : 
                   (childSkus.has(record.item_sku) ? '子SKU' : '普通');
      console.log(`  ${index + 1}. ${record.item_sku} (${type})`);
    });

    // 步骤4.2: 填充数据到模板
    console.log(`📝 开始填充 ${sortedRecords.length} 条记录到模板...`);
    const startRow = 3; // 第4行，索引为3

    sortedRecords.forEach((record, index) => {
      const rowIndex = startRow + index;

      // 确保行存在
      if (!templateData[rowIndex]) {
        templateData[rowIndex] = [];
      }

      // 根据模板列结构填充数据
      const row = templateData[rowIndex];

      // 判断是否为母SKU
      const isParentSku = record.parent_child === 'Parent' || (!childSkus.has(record.item_sku) && !record.parent_sku);
      
      // 根据实际模板字段映射数据
      const fieldMappings = {
        'item_sku': record.item_sku || '',
        'item_name': record.item_name || '',
        'external_product_id': record.external_product_id || '',
        'external_product_id_type': isParentSku ? (record.external_product_id_type || '') : (record.external_product_id_type || 'ASIN'),
        'brand_name': record.brand_name || '',
        'manufacturer': record.manufacturer || '',
        'product_description': record.product_description || '',
        'bullet_point1': record.bullet_point1 || '',
        'bullet_point2': record.bullet_point2 || '',
        'bullet_point3': record.bullet_point3 || '',
        'bullet_point4': record.bullet_point4 || '',
        'bullet_point5': record.bullet_point5 || '',
        'generic_keywords': record.generic_keywords || '',
        'color_name': record.color_name || '',
        'size_name': record.size_name || '',
        'standard_price': record.standard_price || '',
        'list_price': record.list_price || '',
        'quantity': record.quantity || '',
        'main_image_url': record.main_image_url || '',
        'other_image_url1': record.other_image_url1 || '',
        'other_image_url2': record.other_image_url2 || '',
        'other_image_url3': record.other_image_url3 || '',
        'other_image_url4': record.other_image_url4 || '',
        'other_image_url5': record.other_image_url5 || '',
        'other_image_url6': record.other_image_url6 || '',
        'other_image_url7': record.other_image_url7 || '',
        'other_image_url8': record.other_image_url8 || '',
        'parent_sku': record.parent_sku || '',
        'variation_theme': record.variation_theme || '',
        'country_of_origin': record.country_of_origin || '',
        'parent_child': record.parent_child || (childSkus.has(record.item_sku) ? 'Child' : 'Parent'),
        'relationship_type': record.relationship_type || (childSkus.has(record.item_sku) ? 'Variation' : ''),
        'feed_product_type': record.feed_product_type || 'backpack',
        'age_range_description': record.age_range_description || '',
        'target_gender': record.target_gender || '',
        'department_name': record.department_name || '',
        'depth_front_to_back': record.depth_front_to_back || '',
        'depth_width_side_to_side': record.depth_width_side_to_side || '',
        'depth_height_floor_to_top': record.depth_height_floor_to_top || '',
        'recommended_browse_nodes': record.recommended_browse_nodes || ''
      };

      // 根据映射填充数据
      Object.entries(fieldMappings).forEach(([fieldName, value]) => {
        const columnIndex = fieldToColumnMap[fieldName];
        if (columnIndex !== undefined) {
          row[columnIndex] = value;
        }
      });
    });

    // 步骤5: 生成新的Excel文件
    const newWorkbook = XLSX.utils.book_new();
    const newSheet = XLSX.utils.aoa_to_sheet(templateData);
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Template');

    // 生成文件内容
    const outputBuffer = XLSX.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileName = `产品资料_${targetCountry}_${timestamp}.xlsx`;

    console.log(`✅ 导出完成，生成文件: ${fileName}`);

    // 返回文件内容
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(outputBuffer);

  } catch (error) {
    console.error('❌ 导出到模板失败:', error);
    res.status(500).json({
      success: false,
      message: '导出失败: ' + error.message
    });
  }
});

// 根据seller-sku查询ASIN信息
router.get('/asin-info', async (req, res) => {
  try {
    const { sellerSkus, site } = req.query;
    
    if (!sellerSkus) {
      return res.status(400).json({
        success: false,
        message: '缺少seller-sku参数'
      });
    }

    // 解析seller-sku列表（支持单个或多个）
    const skuList = Array.isArray(sellerSkus) ? sellerSkus : sellerSkus.split(',');
    
    // 构建查询条件
    const whereCondition = {
      'seller-sku': { [Op.in]: skuList }
    };
    
    // 如果指定了站点，添加站点条件
    if (site && site !== 'all') {
      whereCondition.site = site;
    }

    // 查询ASIN信息
    const asinData = await ListingsSku.findAll({
      where: whereCondition,
      attributes: ['seller-sku', 'asin1', 'site'],
      raw: true
    });

    // 构建返回结果
    const result = {};
    asinData.forEach(item => {
      const key = `${item['seller-sku']}_${item.site}`;
      result[key] = {
        'seller-sku': item['seller-sku'],
        asin1: item.asin1,
        site: item.site
      };
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ 查询ASIN信息失败:', error);
    res.status(500).json({
      success: false,
      message: '查询ASIN信息失败: ' + error.message
    });
  }
});

module.exports = router; 