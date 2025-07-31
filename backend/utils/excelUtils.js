const ExcelJS = require('exceljs');

/**
 * Excel工具类 - 使用ExcelJS库优化Excel处理
 */
class ExcelUtils {
  constructor() {
    this.templateCache = new Map();
    this.CACHE_TIMEOUT = 10 * 60 * 1000; // 10分钟缓存
  }

  /**
   * 从缓冲区加载工作簿
   * @param {Buffer} buffer - Excel文件缓冲区
   * @returns {Promise<ExcelJS.Workbook>} 工作簿对象
   */
  async loadWorkbookFromBuffer(buffer) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      return workbook;
    } catch (error) {
      console.error('❌ 加载Excel工作簿失败:', error);
      throw new Error('Excel文件格式错误或损坏');
    }
  }

  /**
   * 查找工作表中的列索引
   * @param {ExcelJS.Worksheet} worksheet - 工作表对象
   * @param {number} headerRowIndex - 表头行索引（从1开始）
   * @param {string[]} columnNames - 要查找的列名数组
   * @returns {Object} 列名到列索引的映射
   */
  findColumns(worksheet, headerRowIndex, columnNames) {
    const columnMap = {};
    const headerRow = worksheet.getRow(headerRowIndex);
    
    console.log(`🔍 在第${headerRowIndex}行查找列：${columnNames.join(', ')}`);
    
    headerRow.eachCell((cell, colNumber) => {
      const cellValue = cell.value?.toString().toLowerCase().trim();
      if (cellValue && columnNames.includes(cellValue)) {
        columnMap[cellValue] = colNumber;
        console.log(`✅ 找到列 "${cellValue}" 在第${colNumber}列`);
      }
    });

    // 检查是否找到所有必需的列
    const missingColumns = columnNames.filter(name => !columnMap[name]);
    if (missingColumns.length > 0) {
      throw new Error(`在第${headerRowIndex}行中未找到必需的列：${missingColumns.join(', ')}`);
    }

    return columnMap;
  }

  /**
   * 填充子SKU数据到Excel模板
   * @param {ExcelJS.Workbook} workbook - 工作簿对象
   * @param {string} worksheetName - 工作表名称
   * @param {Array} skuData - 子SKU数据数组
   * @param {Array} parentSkus - 母SKU列表
   * @param {number} startRow - 开始填充的行号（从1开始）
   * @returns {Promise<void>}
   */
  async fillSkuData(workbook, worksheetName, skuData, parentSkus = [], startRow = 4) {
    try {
      const worksheet = workbook.getWorksheet(worksheetName);
      if (!worksheet) {
        throw new Error(`未找到工作表: ${worksheetName}`);
      }

      console.log(`📝 开始填充数据到工作表 "${worksheetName}"，从第${startRow}行开始`);

      // 查找列索引
      const columnMap = this.findColumns(worksheet, 3, ['item_sku', 'color_name', 'size_name']);

      let currentRowIndex = startRow;

      // 按母SKU分组数据
      const groupedData = {};
      skuData.forEach(sku => {
        if (!groupedData[sku.parent_sku]) {
          groupedData[sku.parent_sku] = [];
        }
        groupedData[sku.parent_sku].push(sku);
      });

      console.log(`📋 找到 ${Object.keys(groupedData).length} 个母SKU，共 ${skuData.length} 个子SKU`);

      // 按输入的母SKU顺序处理
      parentSkus.forEach(parentSku => {
        if (groupedData[parentSku] && groupedData[parentSku].length > 0) {
          console.log(`📦 处理母SKU: ${parentSku}，包含 ${groupedData[parentSku].length} 个子SKU`);
          
          // 先填写母SKU行
          const parentRow = worksheet.getRow(currentRowIndex);
          
          // 填充母SKU的item_sku列（UK + 母SKU）
          const parentItemSkuCell = parentRow.getCell(columnMap['item_sku']);
          parentItemSkuCell.value = `UK${parentSku}`;
          
          // 母SKU行的color_name和size_name留空
          const parentColorNameCell = parentRow.getCell(columnMap['color_name']);
          parentColorNameCell.value = '';
          
          const parentSizeNameCell = parentRow.getCell(columnMap['size_name']);
          parentSizeNameCell.value = '';

          // 提交母SKU行更改
          parentRow.commit();
          currentRowIndex++;

          // 然后填写子SKU
          groupedData[parentSku].forEach((sku) => {
            const childRow = worksheet.getRow(currentRowIndex);

            // 填充子SKU的item_sku列（UK + 子SKU）
            const itemSkuCell = childRow.getCell(columnMap['item_sku']);
            itemSkuCell.value = `UK${sku.child_sku}`;
            
            // 填充color_name列
            const colorNameCell = childRow.getCell(columnMap['color_name']);
            colorNameCell.value = sku.sellercolorname || '';
            
            // 填充size_name列
            const sizeNameCell = childRow.getCell(columnMap['size_name']);
            sizeNameCell.value = sku.sellersizename || '';

            // 提交子SKU行更改
            childRow.commit();
            currentRowIndex++;
          });
        }
      });

      const totalRows = currentRowIndex - startRow;
      console.log(`✅ 成功填充 ${totalRows} 行数据（包含母SKU和子SKU）`);
    } catch (error) {
      console.error('❌ 填充SKU数据失败:', error);
      throw error;
    }
  }

  /**
   * 生成Excel文件缓冲区
   * @param {ExcelJS.Workbook} workbook - 工作簿对象
   * @param {string} format - 输出格式 ('xlsx', 'xlsm', 'xls')
   * @returns {Promise<Buffer>} Excel文件缓冲区
   */
  async generateBuffer(workbook, format = 'xlsx') {
    try {
      console.log(`📋 生成Excel文件，格式: ${format}`);
      
      let buffer;
      switch (format.toLowerCase()) {
        case 'xlsm':
        case 'xlsx':
        default:
          buffer = await workbook.xlsx.writeBuffer();
          break;
      }

      console.log(`✅ Excel文件生成完成，大小: ${(buffer.length / 1024).toFixed(1)} KB`);
      return buffer;
    } catch (error) {
      console.error('❌ 生成Excel文件失败:', error);
      throw new Error('生成Excel文件时出错');
    }
  }

  /**
   * 获取文件扩展名对应的MIME类型
   * @param {string} extension - 文件扩展名
   * @returns {string} MIME类型
   */
  getMimeType(extension) {
    const mimeTypes = {
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
      'xls': 'application/vnd.ms-excel'
    };
    return mimeTypes[extension.toLowerCase()] || mimeTypes['xlsx'];
  }

  /**
   * 从文件名提取扩展名
   * @param {string} fileName - 文件名
   * @returns {string} 扩展名（不包含点）
   */
  getFileExtension(fileName) {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex > 0) {
      return fileName.substring(lastDotIndex + 1).toLowerCase();
    }
    return 'xlsx'; // 默认扩展名
  }

  /**
   * 生成文件名
   * @param {Array} parentSkus - 母SKU列表
   * @param {string} fileExtension - 文件扩展名
   * @returns {string} 生成的文件名
   */
  generateFileName(parentSkus, fileExtension) {
    // UK + 下划线连接的SKU列表
    const skuPart = parentSkus.join('_');
    const fileName = `UK_${skuPart}.${fileExtension}`;
    console.log(`📝 生成文件名: ${fileName}`);
    return fileName;
  }

  /**
   * 验证Excel模板的基本结构
   * @param {ExcelJS.Workbook} workbook - 工作簿对象
   * @param {string} worksheetName - 工作表名称
   * @param {number} headerRowIndex - 表头行索引
   * @returns {boolean} 验证结果
   */
  validateTemplate(workbook, worksheetName = 'Template', headerRowIndex = 3) {
    try {
      const worksheet = workbook.getWorksheet(worksheetName);
      if (!worksheet) {
        throw new Error(`模板文件中未找到 "${worksheetName}" 工作表`);
      }

      // 检查是否有足够的行数
      if (worksheet.rowCount < headerRowIndex) {
        throw new Error(`"${worksheetName}" 工作表至少需要 ${headerRowIndex} 行数据（包含表头）`);
      }

      // 验证必需的列是否存在
      this.findColumns(worksheet, headerRowIndex, ['item_sku', 'color_name', 'size_name']);

      console.log('✅ 模板验证通过');
      return true;
    } catch (error) {
      console.error('❌ 模板验证失败:', error);
      throw error;
    }
  }

  /**
   * 缓存模板内容
   * @param {string} cacheKey - 缓存键
   * @param {Buffer} content - 模板内容
   * @param {string} fileName - 文件名
   */
  cacheTemplate(cacheKey, content, fileName) {
    this.templateCache.set(cacheKey, {
      content,
      fileName,
      timestamp: Date.now()
    });
    console.log(`💾 模板已缓存: ${fileName}`);
  }

  /**
   * 从缓存获取模板
   * @param {string} cacheKey - 缓存键
   * @returns {Object|null} 缓存的模板对象或null
   */
  getCachedTemplate(cacheKey) {
    const cached = this.templateCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.CACHE_TIMEOUT)) {
      console.log('🎯 使用缓存的模板文件');
      return cached;
    }
    return null;
  }

  /**
   * 清理过期缓存
   */
  cleanExpiredCache() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, value] of this.templateCache) {
      if (now - value.timestamp >= this.CACHE_TIMEOUT) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.templateCache.delete(key);
      console.log(`🗑️ 清理过期缓存: ${key}`);
    });
  }
}

// 创建单例实例
const excelUtils = new ExcelUtils();

// 定期清理过期缓存
setInterval(() => {
  excelUtils.cleanExpiredCache();
}, 5 * 60 * 1000); // 每5分钟清理一次

module.exports = excelUtils; 