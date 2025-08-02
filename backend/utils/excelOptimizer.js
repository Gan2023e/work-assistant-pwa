const ExcelJS = require('exceljs');

class ExcelOptimizer {
  constructor() {
    this.templateCache = new Map(); // 解析后的模板缓存
  }

  // 优化的Excel解析器（缓存解析结果）
  async parseTemplate(templateData, cacheKey = null) {
    // 如果有缓存键且已缓存，直接返回
    if (cacheKey && this.templateCache.has(cacheKey)) {
      console.log(`⚡ 使用解析缓存: ${cacheKey}`);
      return this.templateCache.get(cacheKey);
    }

    console.log('🔍 解析Excel模板结构...');
    const parseStartTime = Date.now();
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateData.content);
    
    const worksheet = workbook.getWorksheet('Template');
    if (!worksheet) {
      throw new Error('模板文件中未找到Template页面');
    }

    // 预解析列位置（避免重复查找）
    const columnMap = this.parseColumnPositions(worksheet);
    
    // 创建解析结果对象
    const parsedTemplate = {
      workbook,
      worksheet,
      columnMap,
      originalExtension: templateData.originalExtension,
      fileName: templateData.fileName,
      parseTime: Date.now() - parseStartTime
    };

    // 缓存解析结果（如果提供了缓存键）
    if (cacheKey) {
      this.templateCache.set(cacheKey, parsedTemplate);
      console.log(`💾 Excel解析结果已缓存: ${cacheKey} (耗时: ${parsedTemplate.parseTime}ms)`);
    }

    return parsedTemplate;
  }

  // 快速查找列位置
  parseColumnPositions(worksheet) {
    console.log('🔍 快速定位列位置...');
    const columnMap = {};
    
    // 遍历第3行寻找列标题
    const headerRow = worksheet.getRow(3);
    headerRow.eachCell((cell, colNumber) => {
      if (cell.value) {
        const cellValue = cell.value.toString().toLowerCase();
        columnMap[cellValue] = colNumber;
      }
    });

    // 验证必需列
    const requiredColumns = ['item_sku', 'color_name', 'size_name'];
    requiredColumns.forEach(col => {
      if (!columnMap[col]) {
        throw new Error(`在第三行中未找到必需的列：${col}`);
      }
    });

    console.log('✅ 列位置解析完成:', columnMap);
    return columnMap;
  }

  // 高性能数据分组（使用Map提升性能）
  optimizedGrouping(inventorySkus) {
    console.log('🚀 开始高性能数据分组...');
    const groupStartTime = Date.now();
    
    const groupedSkus = new Map();
    
    // 使用Map代替Object，性能更好
    inventorySkus.forEach(sku => {
      if (!groupedSkus.has(sku.parent_sku)) {
        groupedSkus.set(sku.parent_sku, []);
      }
      groupedSkus.get(sku.parent_sku).push(sku);
    });

    const groupTime = Date.now() - groupStartTime;
    console.log(`✅ 数据分组完成，共 ${groupedSkus.size} 个母SKU组 (耗时: ${groupTime}ms)`);
    
    return groupedSkus;
  }

  // 超高性能批量数据准备
  prepareBatchData(groupedSkus) {
    console.log('⚡ 开始超高性能批量数据准备...');
    const prepareStartTime = Date.now();
    
    // 预计算数组大小，避免动态扩容
    let totalRows = 0;
    groupedSkus.forEach(childSkus => {
      totalRows += 1 + childSkus.length; // 1个母SKU + N个子SKU
    });
    
    // 预分配数组空间
    const batchData = new Array(totalRows);
    let index = 0;
    
    // 高效填充数据
    groupedSkus.forEach((childSkus, parentSku) => {
      // 添加母SKU数据
      batchData[index++] = {
        itemSku: `UK${parentSku}`,
        colorName: '',
        sizeName: '',
        type: 'parent'
      };
      
      // 添加子SKU数据
      childSkus.forEach(sku => {
        batchData[index++] = {
          itemSku: `UK${sku.child_sku}`,
          colorName: sku.sellercolorname || '',
          sizeName: sku.sellersizename || '',
          type: 'child'
        };
      });
    });

    const prepareTime = Date.now() - prepareStartTime;
    console.log(`✅ 批量数据准备完成，共 ${batchData.length} 行 (耗时: ${prepareTime}ms)`);
    
    return batchData;
  }

  // 超级优化的Excel批量写入
  async superFastBatchWrite(worksheet, batchData, columnMap) {
    console.log('🚀 开始超级优化的批量写入...');
    const writeStartTime = Date.now();
    
    const templateRowNumber = 4;
    const { item_sku: itemSkuCol, color_name: colorNameCol, size_name: sizeNameCol } = columnMap;
    
    // 清除第4行以后的数据，但保留模板行
    if (worksheet.rowCount > 3) {
      worksheet.spliceRows(templateRowNumber + 1, worksheet.rowCount - templateRowNumber);
    }

    // 🔥 关键优化：减少控制台输出，批量处理
    const batchSize = 50; // 每50行输出一次日志
    
    for (let i = 0; i < batchData.length; i++) {
      const rowData = batchData[i];
      const targetRowNumber = templateRowNumber + 1 + i;
      
      // 复制模板行（包含完整格式）
      worksheet.duplicateRow(templateRowNumber, targetRowNumber, true);
      
      // 填写数据到复制的行
      const targetRow = worksheet.getRow(targetRowNumber);
      targetRow.getCell(itemSkuCol).value = rowData.itemSku;
      targetRow.getCell(colorNameCol).value = rowData.colorName;
      targetRow.getCell(sizeNameCol).value = rowData.sizeName;
      
      // 批量日志输出（大幅减少I/O）
      if ((i + 1) % batchSize === 0 || i === batchData.length - 1) {
        console.log(`📝 批量写入进度: ${i + 1}/${batchData.length} (${((i + 1) / batchData.length * 100).toFixed(1)}%)`);
      }
    }

    // 删除原模板行
    worksheet.spliceRows(templateRowNumber, 1);

    const writeTime = Date.now() - writeStartTime;
    console.log(`✅ 超级批量写入完成！共写入 ${batchData.length} 行，耗时: ${writeTime}ms`);
    
    return {
      rowsWritten: batchData.length,
      writeTime: writeTime,
      avgTimePerRow: (writeTime / batchData.length).toFixed(2)
    };
  }

  // 优化的文件保存
  async optimizedSave(workbook, outputPath) {
    console.log('💾 开始优化文件保存...');
    const saveStartTime = Date.now();
    
    // 使用流式写入，减少内存占用
    await workbook.xlsx.writeFile(outputPath);
    
    const saveTime = Date.now() - saveStartTime;
    console.log(`✅ 文件保存完成，耗时: ${saveTime}ms`);
    
    return { saveTime };
  }

  // 清除解析缓存
  clearParseCache() {
    this.templateCache.clear();
    console.log('🗑️ Excel解析缓存已清除');
  }

  // 获取缓存统计
  getCacheStats() {
    return {
      parseCacheSize: this.templateCache.size,
      parseCacheKeys: Array.from(this.templateCache.keys())
    };
  }
}

// 创建全局实例
const excelOptimizer = new ExcelOptimizer();

module.exports = excelOptimizer; 