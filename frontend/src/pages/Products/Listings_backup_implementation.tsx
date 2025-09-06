// 备用的xlsx数据填写实现方案
// 如果当前方案还有问题，可以使用这个替代方案

// 替代方案：使用XLSX.utils.aoa_to_sheet重建工作表
const alternativeImplementation = async (worksheet: any, selectedSkuData: any[], countryName: string, XLSX: any) => {
  console.log(`[${countryName}] 使用备用方案重建工作表...`);
  
  // 1. 读取现有数据到数组格式
  const existingData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
  console.log(`[${countryName}] 现有数据行数: ${existingData.length}`);
  
  // 2. 确保至少有3行数据（包含表头）
  while (existingData.length < 3) {
    existingData.push([]);
  }
  
  // 3. 查找列索引
  let itemSkuColIndex = 0; // 默认第0列
  let updateDeleteColIndex = 1; // 默认第1列
  
  // 在前3行中查找表头
  for (let row = 0; row < Math.min(3, existingData.length); row++) {
    const rowData = existingData[row] || [];
    for (let col = 0; col < rowData.length; col++) {
      const cellValue = (rowData[col] || '').toString().toLowerCase();
      if (cellValue.includes('item') && cellValue.includes('sku')) {
        itemSkuColIndex = col;
        console.log(`[${countryName}] 找到item_sku列索引: ${col} (值: ${rowData[col]})`);
      }
      if (cellValue.includes('update') || cellValue.includes('delete') || cellValue.includes('action')) {
        updateDeleteColIndex = col;
        console.log(`[${countryName}] 找到update/delete列索引: ${col} (值: ${rowData[col]})`);
      }
    }
  }
  
  console.log(`[${countryName}] 最终使用列索引: item_sku=${itemSkuColIndex}, update_delete=${updateDeleteColIndex}`);
  
  // 4. 确保数组有足够的列
  const maxColIndex = Math.max(itemSkuColIndex, updateDeleteColIndex, existingData[0]?.length || 0);
  existingData.forEach(row => {
    while (row.length <= maxColIndex) {
      row.push('');
    }
  });
  
  // 5. 从第4行（索引3）开始添加数据
  const startRowIndex = 3;
  selectedSkuData.forEach((data, index) => {
    const rowIndex = startRowIndex + index;
    
    // 确保有足够的行
    while (existingData.length <= rowIndex) {
      const newRow = new Array(maxColIndex + 1).fill('');
      existingData.push(newRow);
    }
    
    // 填入数据
    existingData[rowIndex][itemSkuColIndex] = data.item_sku;
    existingData[rowIndex][updateDeleteColIndex] = data.update_delete;
    
    console.log(`[${countryName}] 第${rowIndex + 1}行: 列${itemSkuColIndex}=${data.item_sku}, 列${updateDeleteColIndex}=${data.update_delete}`);
  });
  
  // 6. 重新生成工作表
  const newWorksheet = XLSX.utils.aoa_to_sheet(existingData);
  
  console.log(`[${countryName}] 备用方案完成，总行数: ${existingData.length}`);
  return newWorksheet;
};

// 如果需要使用备用方案，将当前实现替换为：
// const newWorksheet = await alternativeImplementation(worksheet, selectedSkuData, countryName, XLSX);
// workbook.Sheets[sheetName] = newWorksheet; 