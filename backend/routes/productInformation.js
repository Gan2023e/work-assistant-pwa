const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const ProductInformation = require('../models/ProductInformation');
const multer = require('multer');
const XLSX = require('xlsx');

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
        { item_sku: { [Op.like]: `%${search}%` } },
        { item_name: { [Op.like]: `%${search}%` } },
        { original_parent_sku: { [Op.like]: `%${search}%` } },
        { brand_name: { [Op.like]: `%${search}%` } },
        { parent_sku: { [Op.like]: `%${search}%` } }
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
      const children = await ProductInformation.findAll({
        where: {
          ...whereConditions,
          parent_sku: parentSku
        },
        order: [['item_sku', 'ASC']]
      });

      // 尝试获取母SKU记录（parent_child='Parent'且item_sku=parent_sku的记录）
      const parentRecord = await ProductInformation.findOne({
        where: {
          ...whereConditions,
          item_sku: parentSku,
          parent_child: 'Parent'
        }
      });

      if (children.length > 0) {
        const totalQuantity = children.reduce((sum, child) => sum + (child.quantity || 0), 0);
        const firstChild = children[0];

        groupedData.push({
          parent_sku: parentSku,
          site: parentRecord ? parentRecord.site : firstChild.site,
          brand_name: parentRecord ? parentRecord.brand_name : firstChild.brand_name,
          manufacturer: parentRecord ? parentRecord.manufacturer : firstChild.manufacturer,
          total_quantity: totalQuantity,
          children_count: children.length,
          children: children,
          parent_record: parentRecord // 包含母SKU记录信息
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

    // 获取第一个工作表
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
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

    if (jsonData.length < 4) {
      return res.status(400).json({
        success: false,
        message: 'Excel文件数据不足，至少需要包含表头和数据行'
      });
    }

    // 查找表头行（通常在第3行，索引为2）
    let headerRow = null;
    let dataStartIndex = 0;
    
    for (let i = 0; i < Math.min(jsonData.length, 5); i++) {
      const row = jsonData[i];
      if (row && row.some(cell => 
        typeof cell === 'string' && 
        (cell.includes('item_sku') || cell.includes('SKU') || cell.includes('sku'))
      )) {
        headerRow = row;
        dataStartIndex = i + 1;
        break;
      }
    }

    if (!headerRow) {
      return res.status(400).json({
        success: false,
        message: '未找到有效的表头行，请确保Excel文件包含item_sku等字段'
      });
    }

    console.log(`📋 找到表头行，共${headerRow.length}列，数据从第${dataStartIndex + 1}行开始`);

    // 创建字段映射
    const fieldMapping = {};
    const requiredFields = ['item_sku', 'item_name', 'site'];
    
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
      record.site = row[fieldMapping.site] || country; // 默认使用选择的国家
      
      if (!record.item_sku) {
        errors.push(`第${i + 1}行: item_sku不能为空`);
        continue;
      }

      // 可选字段
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
      region: process.env.ALICLOUD_OSS_REGION,
      accessKeyId: process.env.ALICLOUD_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALICLOUD_ACCESS_KEY_SECRET,
      bucket: process.env.ALICLOUD_OSS_BUCKET,
    };

    const client = new OSS(ossConfig);

    // 步骤1: 从数据库获取目标国家的模板文件
    console.log(`🔍 查找${targetCountry}站点的模板文件...`);
    const targetTemplate = await TemplateLink.findOne({
      where: {
        country: targetCountry,
        file_name: {
          [Op.like]: '%.xlsx'
        }
      },
      order: [['created_at', 'DESC']]
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

    // 从第4行开始填写数据（保留模板原有结构）
    const startRow = 3; // 第4行，索引为3

    selectedRecords.forEach((record, index) => {
      const rowIndex = startRow + index;

      // 确保行存在
      if (!templateData[rowIndex]) {
        templateData[rowIndex] = [];
      }

      // 根据模板列结构填充数据（这里需要根据实际模板格式调整）
      const row = templateData[rowIndex];

      // 基本字段映射（根据实际模板调整列索引）
      row[0] = record.item_sku || '';        // SKU
      row[1] = record.item_name || '';       // 商品名称
      row[2] = record.external_product_id || ''; // 外部产品ID
      row[3] = record.brand_name || '';      // 品牌
      row[4] = record.manufacturer || '';    // 制造商
      row[5] = record.product_description || ''; // 产品描述
      row[6] = record.bullet_point1 || '';   // 要点1
      row[7] = record.bullet_point2 || '';   // 要点2
      row[8] = record.bullet_point3 || '';   // 要点3
      row[9] = record.bullet_point4 || '';   // 要点4
      row[10] = record.bullet_point5 || '';  // 要点5
      row[11] = record.generic_keywords || ''; // 关键词
      row[12] = record.color_name || '';     // 颜色
      row[13] = record.size_name || '';      // 尺寸
      row[14] = record.standard_price || '';  // 标准价格
      row[15] = record.list_price || '';     // 标价
      row[16] = record.quantity || '';       // 数量
      row[17] = record.main_image_url || ''; // 主图URL
      row[18] = record.parent_sku || '';     // 父SKU
      row[19] = record.variation_theme || ''; // 变体主题
      row[20] = record.country_of_origin || ''; // 原产国
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

module.exports = router; 