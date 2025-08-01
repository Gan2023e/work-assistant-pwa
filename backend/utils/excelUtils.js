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
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return workbook;
  } catch (error) {
    console.error('❌ Excel文件加载失败:', error.message);
    throw new Error(`Excel文件格式错误: ${error.message}`);
  }
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
    throw new Error('模板格式错误：未找到必要的列（item_sku、color_name、size_name）');
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
  let totalProcessed = 0;

  console.log(`📝 开始填充数据，母SKU数量: ${skuList.length}`);

  // 按照skuList的顺序处理
  skuList.forEach(parentSku => {
    if (groupedData[parentSku]) {
      // 添加母SKU行
      const parentRow = worksheet.getRow(currentRow);
      parentRow.getCell(columns.item_sku).value = `UK${parentSku}`;
      parentRow.getCell(columns.color_name).value = '';
      parentRow.getCell(columns.size_name).value = '';
      currentRow++;
      totalProcessed++;

      // 添加子SKU行
      groupedData[parentSku].forEach(item => {
        const childRow = worksheet.getRow(currentRow);
        childRow.getCell(columns.item_sku).value = `UK${item.child_sku}`;
        childRow.getCell(columns.color_name).value = item.sellercolorname || '';
        childRow.getCell(columns.size_name).value = item.sellersizename || '';
        currentRow++;
        totalProcessed++;
      });

      console.log(`✅ 已处理母SKU: ${parentSku}, 子SKU数量: ${groupedData[parentSku].length}`);
    } else {
      console.warn(`⚠️ 未找到母SKU的子SKU数据: ${parentSku}`);
    }
  });

  console.log(`✅ 数据填充完成，共填充 ${totalProcessed} 行`);
  return { totalRows: totalProcessed, processedSkus: Object.keys(groupedData).length };
}

/**
 * 生成指定格式的Excel文件缓冲区（修复xlsm格式支持）
 * @param {ExcelJS.Workbook} workbook - 工作簿对象
 * @param {string} fileExtension - 文件扩展名
 * @returns {Promise<Buffer>} - Excel文件缓冲区
 */
async function generateBuffer(workbook, fileExtension) {
  console.log(`📁 生成文件格式: ${fileExtension}`);
  
  try {
    // 根据文件扩展名选择相应的写入方法
    switch (fileExtension.toLowerCase()) {
      case '.xlsm':
        // xlsm格式 - 包含宏的Excel文件
        console.log('📋 生成xlsm格式文件 (包含宏)');
        // 注意：ExcelJS会尽量保持原有格式，包括宏
        const xlsmBuffer = await workbook.xlsx.writeBuffer();
        return xlsmBuffer;
        
      case '.xlsx':
        // xlsx格式 - 标准Excel文件
        console.log('📋 生成xlsx格式文件');
        const xlsxBuffer = await workbook.xlsx.writeBuffer();
        return xlsxBuffer;
        
      case '.xls':
        // xls格式 - 旧版Excel文件
        // 注意：ExcelJS不直接支持写入xls格式，转换为xlsx
        console.log('⚠️ xls格式不支持直接写入，转换为xlsx格式');
        const xlsBuffer = await workbook.xlsx.writeBuffer();
        return xlsBuffer;
        
      default:
        // 默认使用xlsx格式
        console.log(`⚠️ 未知格式 ${fileExtension}，使用默认xlsx格式`);
        const defaultBuffer = await workbook.xlsx.writeBuffer();
        return defaultBuffer;
    }
  } catch (error) {
    console.error('❌ 生成Excel文件失败:', error.message);
    throw new Error(`Excel文件生成失败: ${error.message}`);
  }
}

/**
 * 生成符合要求的文件名（UK_SKU1_SKU2_SKU3格式）
 * @param {Array} skuList - SKU列表
 * @param {string} fileExtension - 文件扩展名
 * @returns {string} - 生成的文件名
 */
function generateFileName(skuList, fileExtension) {
  const prefix = 'UK';
  const maxSkus = 3; // 最多取前3个SKU
  const skuPart = skuList.slice(0, maxSkus).join('_');
  
  // 如果SKU数量超过3个，添加省略号标识
  const suffix = skuList.length > maxSkus ? '_more' : '';
  
  const fileName = `${prefix}_${skuPart}${suffix}${fileExtension}`;
  console.log(`📝 生成文件名: ${fileName} (基于${skuList.length}个SKU)`);
  
  return fileName;
}

/**
 * 验证Excel模板的基本结构
 * @param {ExcelJS.Workbook} workbook - 工作簿对象
 * @param {string} worksheetName - 期望的工作表名称
 * @param {number} headerRow - 表头行号
 * @throws {Error} - 如果验证失败
 */
function validateTemplate(workbook, worksheetName, headerRow) {
  console.log(`🔍 开始验证模板结构...`);
  
  // 检查工作表是否存在
  const worksheet = workbook.getWorksheet(worksheetName);
  if (!worksheet) {
    const availableSheets = workbook.worksheets.map(ws => ws.name).join(', ');
    throw new Error(`模板错误：未找到工作表"${worksheetName}"。可用工作表: ${availableSheets}`);
  }

  // 检查必要的列
  const requiredColumns = ['item_sku', 'color_name', 'size_name'];
  const columns = findColumns(worksheet, headerRow, requiredColumns);
  
  const missingColumns = requiredColumns.filter(col => !columns[col]);
  if (missingColumns.length > 0) {
    throw new Error(`模板错误：第${headerRow}行缺少必要的列: ${missingColumns.join(', ')}`);
  }

  // 检查工作表是否有基本的行数据
  if (worksheet.rowCount < headerRow) {
    throw new Error(`模板错误：工作表行数不足，需要至少${headerRow}行`);
  }

  console.log(`✅ 模板验证通过`);
  return true;
}

/**
 * 获取文件扩展名
 * @param {string} fileName - 文件名
 * @returns {string} - 文件扩展名
 */
function getFileExtension(fileName) {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return '.xlsx'; // 默认扩展名
  }
  return fileName.substring(lastDotIndex).toLowerCase();
}

/**
 * 根据文件扩展名获取MIME类型
 * @param {string} extension - 文件扩展名
 * @returns {string} - MIME类型
 */
function getMimeType(extension) {
  const mimeTypes = {
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
    '.xls': 'application/vnd.ms-excel'
  };
  
  return mimeTypes[extension.toLowerCase()] || mimeTypes['.xlsx'];
}

/**
 * 缓存模板文件
 * @param {string} key - 缓存键
 * @param {Buffer} content - 模板内容
 * @param {string} fileName - 文件名
 */
function cacheTemplate(key, content, fileName) {
  const cacheEntry = {
    content,
    fileName,
    timestamp: Date.now()
  };
  
  templateCache.set(key, cacheEntry);
  console.log(`💾 模板已缓存: ${fileName} (${(content.length / 1024).toFixed(1)} KB)`);
  
  // 定期清理过期缓存
  setTimeout(() => {
    cleanExpiredCache();
  }, CACHE_DURATION);
}

/**
 * 获取缓存的模板
 * @param {string} key - 缓存键
 * @returns {Object|null} - 缓存的模板对象或null
 */
function getCachedTemplate(key) {
  const cacheEntry = templateCache.get(key);
  
  if (!cacheEntry) {
    return null;
  }
  
  // 检查缓存是否过期
  if (Date.now() - cacheEntry.timestamp > CACHE_DURATION) {
    templateCache.delete(key);
    console.log(`🗑️ 缓存已过期并清理: ${key}`);
    return null;
  }
  
  console.log(`📖 使用缓存模板: ${cacheEntry.fileName}`);
  return cacheEntry;
}

/**
 * 清理过期的缓存
 */
function cleanExpiredCache() {
  const now = Date.now();
  const expiredKeys = [];
  
  for (const [key, entry] of templateCache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION) {
      expiredKeys.push(key);
    }
  }
  
  expiredKeys.forEach(key => {
    templateCache.delete(key);
  });
  
  if (expiredKeys.length > 0) {
    console.log(`🗑️ 清理了 ${expiredKeys.length} 个过期缓存`);
  }
}

/**
 * 获取缓存统计信息
 * @returns {Object} - 缓存统计
 */
function getCacheStats() {
  const totalSize = Array.from(templateCache.values())
    .reduce((sum, entry) => sum + entry.content.length, 0);
  
  return {
    count: templateCache.size,
    totalSize: totalSize,
    totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
  };
}

module.exports = {
  loadWorkbookFromBuffer,
  findColumns,
  fillSkuData,
  generateBuffer,
  generateFileName,
  validateTemplate,
  getFileExtension,
  getMimeType,
  cacheTemplate,
  getCachedTemplate,
  cleanExpiredCache,
  getCacheStats
}; 