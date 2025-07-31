const ExcelJS = require('exceljs');

// 模板缓存对象
const templateCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10分钟缓存

/**
 * 从缓冲区加载Excel工作簿
 * @param {Buffer} buffer - Excel文件缓冲区
 * @returns {Promise<ExcelJS.Workbook>} - ExcelJS工作簿对象
 */
async function loadWorkbookFromBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

/**
 * 智能查找工作表中的列索引
 * @param {ExcelJS.Worksheet} worksheet - 工作表对象
 * @param {number} headerRow - 表头行号
 * @param {string[]} columnNames - 要查找的列名数组
 * @returns {Object} - 列名到列索引的映射
 */
function findColumns(worksheet, headerRow, columnNames) {
  const columns = {};
  const headerRowData = worksheet.getRow(headerRow);
  
  headerRowData.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const cellValue = cell.value?.toString()?.toLowerCase()?.trim();
    columnNames.forEach(colName => {
      if (cellValue === colName.toLowerCase()) {
        columns[colName] = colNumber;
      }
    });
  });
  
  return columns;
}

/**
 * 高效填充子SKU数据到模板（支持母SKU分组）
 * @param {ExcelJS.Workbook} workbook - 工作簿对象
 * @param {string} worksheetName - 工作表名称
 * @param {Array} skuData - SKU数据数组
 * @param {Array} skuList - 母SKU列表（用于排序）
 * @param {number} startRow - 开始填充的行号
 */
async function fillSkuData(workbook, worksheetName, skuData, skuList, startRow) {
  const worksheet = workbook.getWorksheet(worksheetName);
  if (!worksheet) {
    throw new Error(`工作表 ${worksheetName} 不存在`);
  }

  // 查找列索引
  const columns = findColumns(worksheet, 3, ['item_sku', 'color_name', 'size_name']);
  
  if (!columns.item_sku || !columns.color_name || !columns.size_name) {
    throw new Error('未找到必要的列：item_sku、color_name、size_name');
  }

  // 按母SKU分组
  const groupedData = {};
  skuData.forEach(item => {
    const parentSku = item.parent_sku;
    if (!groupedData[parentSku]) {
      groupedData[parentSku] = [];
    }
    groupedData[parentSku].push(item);
  });

  let currentRow = startRow;

  // 按照skuList的顺序处理
  skuList.forEach(parentSku => {
    if (groupedData[parentSku]) {
      // 添加母SKU行
      const parentRow = worksheet.getRow(currentRow);
      parentRow.getCell(columns.item_sku).value = `UK${parentSku}`;
      parentRow.getCell(columns.color_name).value = '';
      parentRow.getCell(columns.size_name).value = '';
      currentRow++;

      // 添加子SKU行
      groupedData[parentSku].forEach(item => {
        const childRow = worksheet.getRow(currentRow);
        childRow.getCell(columns.item_sku).value = `UK${item.sku}`;
        childRow.getCell(columns.color_name).value = item.color_name || '';
        childRow.getCell(columns.size_name).value = item.size_name || '';
        currentRow++;
      });
    }
  });

  console.log(`✅ 数据填充完成，共填充 ${currentRow - startRow} 行`);
}

/**
 * 生成指定格式的Excel文件缓冲区
 * @param {ExcelJS.Workbook} workbook - 工作簿对象
 * @param {string} fileExtension - 文件扩展名
 * @returns {Promise<Buffer>} - Excel文件缓冲区
 */
async function generateBuffer(workbook, fileExtension) {
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * 生成符合要求的文件名（UK_SKU1_SKU2_SKU3格式）
 * @param {Array} skuList - SKU列表
 * @param {string} fileExtension - 文件扩展名
 * @returns {string} - 生成的文件名
 */
function generateFileName(skuList, fileExtension) {
  const prefix = 'UK';
  const skuPart = skuList.slice(0, 3).join('_'); // 最多取前3个SKU
  return `${prefix}_${skuPart}${fileExtension}`;
}

/**
 * 验证Excel模板的基本结构
 * @param {ExcelJS.Workbook} workbook - 工作簿对象
 * @param {string} worksheetName - 工作表名称
 * @param {number} headerRow - 表头行号
 */
function validateTemplate(workbook, worksheetName, headerRow) {
  const worksheet = workbook.getWorksheet(worksheetName);
  if (!worksheet) {
    throw new Error(`模板验证失败：未找到名为 ${worksheetName} 的工作表`);
  }

  const columns = findColumns(worksheet, headerRow, ['item_sku', 'color_name', 'size_name']);
  
  if (!columns.item_sku || !columns.color_name || !columns.size_name) {
    throw new Error('模板验证失败：第3行必须包含 item_sku、color_name、size_name 列');
  }

  console.log('✅ 模板验证通过');
}

/**
 * 缓存模板文件
 * @param {string} cacheKey - 缓存键
 * @param {Buffer} templateContent - 模板内容
 * @param {string} fileName - 文件名
 */
function cacheTemplate(cacheKey, templateContent, fileName) {
  templateCache.set(cacheKey, {
    content: templateContent,
    fileName: fileName,
    timestamp: Date.now()
  });
  console.log(`📝 模板已缓存: ${cacheKey}`);
}

/**
 * 获取缓存的模板
 * @param {string} cacheKey - 缓存键
 * @returns {Object|null} - 缓存的模板对象或null
 */
function getCachedTemplate(cacheKey) {
  const cached = templateCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`📝 使用缓存模板: ${cacheKey}`);
    return cached;
  }
  
  if (cached) {
    templateCache.delete(cacheKey);
    console.log(`📝 缓存已过期，删除: ${cacheKey}`);
  }
  
  return null;
}

/**
 * 清理过期的缓存
 */
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, value] of templateCache.entries()) {
    if (now - value.timestamp >= CACHE_DURATION) {
      templateCache.delete(key);
      console.log(`🗑️ 清理过期缓存: ${key}`);
    }
  }
}

/**
 * 获取文件扩展名
 * @param {string} fileName - 文件名
 * @returns {string} - 文件扩展名
 */
function getFileExtension(fileName) {
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '.xlsx';
}

/**
 * 获取MIME类型
 * @param {string} fileExtension - 文件扩展名
 * @returns {string} - MIME类型
 */
function getMimeType(fileExtension) {
  const mimeTypes = {
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
    '.xls': 'application/vnd.ms-excel'
  };
  return mimeTypes[fileExtension.toLowerCase()] || mimeTypes['.xlsx'];
}

// 定期清理过期缓存（每5分钟）
setInterval(cleanExpiredCache, 5 * 60 * 1000);

module.exports = {
  loadWorkbookFromBuffer,
  findColumns,
  fillSkuData,
  generateBuffer,
  generateFileName,
  validateTemplate,
  cacheTemplate,
  getCachedTemplate,
  cleanExpiredCache,
  getFileExtension,
  getMimeType
}; 