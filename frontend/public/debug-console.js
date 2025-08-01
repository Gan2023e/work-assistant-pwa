// 子SKU生成器详细调试脚本
// 请在浏览器控制台中复制并运行此脚本

console.clear();
console.log('🔧 开始详细调试子SKU生成器...');

// 1. 检查基本环境
console.group('📋 环境检查');
console.log('当前URL:', window.location.href);
console.log('用户代理:', navigator.userAgent);
console.log('localStorage可用:', typeof Storage !== "undefined");
console.log('fetch可用:', typeof fetch !== "undefined");
console.groupEnd();

// 2. 检查认证状态
console.group('🔐 认证检查');
const token = localStorage.getItem('token');
console.log('Token存在:', !!token);
if (token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('Token过期时间:', new Date(payload.exp * 1000));
    console.log('Token是否过期:', Date.now() > payload.exp * 1000);
  } catch (e) {
    console.error('Token解析失败:', e);
  }
}
console.groupEnd();

// 3. 检查网络连接
console.group('🌐 网络检查');
async function checkNetwork() {
  const API_BASE_URL = window.location.origin;
  
  try {
    // 测试基本连接
    console.log('测试基本连接...');
    const response = await fetch(API_BASE_URL + '/api/product_weblink/uk-templates', {
      method: 'HEAD',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('基本连接状态:', response.status);
    
    // 测试模板列表
    console.log('测试模板列表API...');
    const templateResponse = await fetch(API_BASE_URL + '/api/product_weblink/uk-templates', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const templateResult = await templateResponse.json();
    console.log('模板列表结果:', templateResult);
    
    // 测试调试端点
    console.log('测试调试端点...');
    const debugResponse = await fetch(API_BASE_URL + '/api/product_weblink/debug-child-sku-generator', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ testSkus: ['TEST001'] })
    });
    const debugResult = await debugResponse.json();
    console.log('调试端点结果:', debugResult);
    
  } catch (error) {
    console.error('网络检查失败:', error);
  }
}

checkNetwork().then(() => {
  console.groupEnd();
  
  // 4. 检查React组件错误
  console.group('⚛️ React组件检查');
  
  // 检查是否有React错误边界捕获的错误
  const reactErrors = window.__REACT_ERROR_OVERLAY_GLOBAL_HOOK__;
  if (reactErrors) {
    console.log('React错误覆盖层存在');
  }
  
  // 检查控制台错误
  const originalError = console.error;
  const errors = [];
  console.error = function(...args) {
    errors.push(args);
    originalError.apply(console, args);
  };
  
  setTimeout(() => {
    console.log('捕获的错误数量:', errors.length);
    if (errors.length > 0) {
      console.log('错误详情:', errors);
    }
    console.error = originalError;
  }, 2000);
  
  console.groupEnd();
  
  // 5. 检查特定功能
  console.group('🎯 功能检查');
  
  // 检查子SKU生成器相关的DOM元素
  const skuButton = document.querySelector('button[type="button"]:contains("子SKU生成器")') || 
                    Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.includes('子SKU生成器'));
  console.log('子SKU生成器按钮存在:', !!skuButton);
  
  // 检查模态框
  const modal = document.querySelector('.ant-modal');
  console.log('模态框已打开:', !!modal);
  
  console.groupEnd();
  
  // 6. 提供快速测试函数
  console.group('🧪 快速测试函数');
  
  window.testSkuGenerator = async function() {
    console.log('🧪 测试子SKU生成器...');
    
    try {
      // 点击子SKU生成器按钮
      if (skuButton) {
        skuButton.click();
        console.log('✅ 成功点击子SKU生成器按钮');
        
        setTimeout(() => {
          // 检查模态框是否打开
          const openModal = document.querySelector('.ant-modal');
          console.log('模态框打开状态:', !!openModal);
          
          if (openModal) {
            console.log('✅ 子SKU生成器界面正常打开');
          } else {
            console.error('❌ 子SKU生成器界面未打开');
          }
        }, 500);
        
      } else {
        console.error('❌ 未找到子SKU生成器按钮');
      }
    } catch (error) {
      console.error('❌ 测试过程出错:', error);
    }
  };
  
  window.testUpload = function() {
    console.log('🧪 测试文件上传功能...');
    const uploadButton = document.querySelector('input[type="file"][accept*=".xlsx"]');
    console.log('上传按钮存在:', !!uploadButton);
  };
  
  console.log('可用测试函数:');
  console.log('- testSkuGenerator() - 测试子SKU生成器打开');
  console.log('- testUpload() - 测试文件上传功能');
  
  console.groupEnd();
  
  console.log('🎯 调试完成！如有问题，请查看上述各组的检查结果。');
});

// 7. 错误监听器
window.addEventListener('error', function(e) {
  console.error('🚨 全局JavaScript错误:', {
    message: e.message,
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno,
    error: e.error
  });
});

window.addEventListener('unhandledrejection', function(e) {
  console.error('🚨 未处理的Promise拒绝:', e.reason);
});

console.log('📋 错误监听器已设置，将捕获后续的错误。'); 