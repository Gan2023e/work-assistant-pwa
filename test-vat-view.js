// VAT税单查看功能测试脚本
// 使用方法：在浏览器控制台中运行此脚本

const API_BASE_URL = 'https://work-assistant-pwa-production.up.railway.app';

// 测试OSS连接
async function testOSSConnection() {
  console.log('🔍 测试OSS连接...');
  
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('❌ 未找到认证Token');
      return false;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/logistics/oss-test`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await response.json();
    
    if (result.code === 0) {
      console.log('✅ OSS连接正常:', result.data);
      return true;
    } else {
      console.error('❌ OSS连接失败:', result.message);
      return false;
    }
  } catch (error) {
    console.error('❌ OSS连接测试失败:', error);
    return false;
  }
}

// 测试VAT税单文件获取
async function testVATFileAccess(shippingId) {
  console.log(`🔍 测试VAT税单文件获取: ${shippingId}`);
  
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('❌ 未找到认证Token');
      return false;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/logistics/vat-receipt/${shippingId}/file`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('响应状态:', response.status);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 文件获取失败:', response.status, errorText);
      return false;
    }
    
    const blob = await response.blob();
    console.log('✅ 文件获取成功:', {
      size: blob.size,
      type: blob.type
    });
    
    return true;
  } catch (error) {
    console.error('❌ 文件获取测试失败:', error);
    return false;
  }
}

// 检查当前页面的VAT记录
function checkVATRecords() {
  console.log('🔍 检查当前页面的VAT记录...');
  
  // 假设在物流管理页面
  const tableRows = document.querySelectorAll('.ant-table-tbody tr');
  const vatRecords = [];
  
  tableRows.forEach((row, index) => {
    const cells = row.querySelectorAll('td');
    if (cells.length > 0) {
      // 查找VAT税单列（通常是倒数第几列）
      const vatCell = cells[cells.length - 4]; // 根据实际列位置调整
      if (vatCell) {
        const buttons = vatCell.querySelectorAll('button');
        const hasVATButton = Array.from(buttons).some(btn => 
          btn.textContent.includes('查看') || btn.textContent.includes('上传')
        );
        
        if (hasVATButton) {
          // 尝试获取shippingId（从第一列或其他标识列）
          const idCell = cells[0];
          const shippingId = idCell ? idCell.textContent.trim() : `row-${index}`;
          
          vatRecords.push({
            index,
            shippingId,
            hasViewButton: Array.from(buttons).some(btn => btn.textContent.includes('查看')),
            hasUploadButton: Array.from(buttons).some(btn => btn.textContent.includes('上传'))
          });
        }
      }
    }
  });
  
  console.log('📊 VAT记录统计:', {
    totalRows: tableRows.length,
    vatRecords: vatRecords.length,
    records: vatRecords
  });
  
  return vatRecords;
}

// 运行完整测试
async function runFullTest() {
  console.log('🚀 开始VAT税单查看功能完整测试...');
  
  // 1. 测试OSS连接
  const ossOk = await testOSSConnection();
  
  // 2. 检查VAT记录
  const vatRecords = checkVATRecords();
  
  // 3. 测试第一个有VAT税单的记录
  if (vatRecords.length > 0) {
    const firstVATRecord = vatRecords.find(r => r.hasViewButton);
    if (firstVATRecord) {
      console.log(`🔍 测试第一个VAT记录: ${firstVATRecord.shippingId}`);
      await testVATFileAccess(firstVATRecord.shippingId);
    }
  }
  
  console.log('✅ 测试完成');
}

// 导出测试函数
window.vatTest = {
  testOSSConnection,
  testVATFileAccess,
  checkVATRecords,
  runFullTest
};

console.log('📝 VAT税单查看功能测试脚本已加载');
console.log('使用方法:');
console.log('- vatTest.runFullTest() - 运行完整测试');
console.log('- vatTest.testOSSConnection() - 测试OSS连接');
console.log('- vatTest.checkVATRecords() - 检查VAT记录');
console.log('- vatTest.testVATFileAccess("shippingId") - 测试特定文件访问'); 