// 子SKU生成器调试脚本
// 使用方法：在浏览器控制台中运行此脚本

(async function debugSkuGenerator() {
  console.log('🔧 开始调试子SKU生成器...');
  
  // 获取API基础URL
  const API_BASE_URL = window.location.origin;
  const token = localStorage.getItem('token');
  
  if (!token) {
    console.error('❌ 未找到认证token，请先登录');
    return;
  }
  
  try {
    // 1. 测试调试端点
    console.log('📡 测试调试端点...');
    const debugResponse = await fetch(`${API_BASE_URL}/api/product_weblink/debug-child-sku-generator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        testSkus: ['XBC120', 'TEST001'] // 测试用的SKU
      })
    });
    
    const debugResult = await debugResponse.json();
    console.log('🔍 调试结果:', debugResult);
    
    // 2. 测试模板列表
    console.log('📂 测试模板列表...');
    const templateResponse = await fetch(`${API_BASE_URL}/api/product_weblink/uk-templates`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const templateResult = await templateResponse.json();
    console.log('📄 模板列表:', templateResult);
    
    // 3. 测试基本网络连接
    console.log('🌐 测试网络连接...');
    const healthResponse = await fetch(`${API_BASE_URL}/api/product_weblink/uk-templates`, {
      method: 'HEAD',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ 网络状态:', healthResponse.status === 200 ? '正常' : '异常');
    
    // 输出建议
    console.log('\n📋 调试建议:');
    
    if (debugResult.success) {
      console.log('✅ 后端服务正常');
      console.log('💡 如果仍有问题，请检查:');
      console.log('  1. 输入的SKU是否存在于数据库中');
      console.log('  2. 模板文件是否已正确上传');
      console.log('  3. 网络连接是否稳定');
    } else {
      console.log('❌ 后端服务异常:', debugResult.debug);
      console.log('💡 解决建议:');
      console.log('  1. 检查数据库连接');
      console.log('  2. 联系管理员检查服务器状态');
      console.log('  3. 稍后重试');
    }
    
  } catch (error) {
    console.error('❌ 调试过程出错:', error);
    console.log('💡 可能的原因:');
    console.log('  1. 网络连接问题');
    console.log('  2. 服务器停机');
    console.log('  3. 认证token过期');
  }
})();

// 额外的网络诊断函数
window.testSkuGeneratorConnection = async function(testSku = 'XBC120') {
  console.log(`🧪 测试SKU查询: ${testSku}`);
  
  const API_BASE_URL = window.location.origin;
  const token = localStorage.getItem('token');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/product_weblink/debug-child-sku-generator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        testSkus: [testSku]
      })
    });
    
    const result = await response.json();
    console.log('🔍 测试结果:', result);
    
    return result;
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return { success: false, error: error.message };
  }
};

console.log('🎯 调试脚本已加载');
console.log('💡 可以调用 testSkuGeneratorConnection("YOUR_SKU") 来测试特定SKU'); 