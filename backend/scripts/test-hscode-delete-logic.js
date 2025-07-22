require('dotenv').config();

// 模拟测试HSCODE图片删除逻辑
function testDeleteLogic() {
  console.log('🧪 测试HSCODE图片删除逻辑...');
  
  // 测试用例1: 代理URL格式
  const proxyUrl = '/api/hscode/image-proxy?url=hscode-images%2F2025%2F07%2Ftest-image.jpg';
  console.log('\n📋 测试用例1: 代理URL格式');
  console.log('输入URL:', proxyUrl);
  
  let objectName = null;
  if (proxyUrl && proxyUrl.includes('/api/hscode/image-proxy')) {
    try {
      const urlParams = new URLSearchParams(proxyUrl.split('?')[1]);
      objectName = urlParams.get('url');
      if (objectName) {
        objectName = decodeURIComponent(objectName);
      }
      console.log('✅ 从代理URL提取objectName:', objectName);
    } catch (e) {
      console.warn('❌ 解析代理URL失败:', e.message);
    }
  }
  
  // 测试用例2: 直接OSS链接格式
  const ossUrl = 'https://your-bucket.oss-cn-hangzhou.aliyuncs.com/hscode-images/2025/07/test-image.jpg';
  console.log('\n📋 测试用例2: 直接OSS链接格式');
  console.log('输入URL:', ossUrl);
  
  let objectName2 = null;
  if (/aliyuncs\.com[\/:]/.test(ossUrl)) {
    try {
      const urlObj = new URL(ossUrl);
      objectName2 = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
      console.log('✅ 从OSS URL提取objectName:', objectName2);
    } catch (e) {
      console.warn('❌ 解析OSS URL失败:', e.message);
    }
  }
  
  // 测试用例3: 无效URL格式
  const invalidUrl = 'invalid-url-format';
  console.log('\n📋 测试用例3: 无效URL格式');
  console.log('输入URL:', invalidUrl);
  
  let objectName3 = null;
  if (invalidUrl && invalidUrl.includes('/api/hscode/image-proxy')) {
    try {
      const urlParams = new URLSearchParams(invalidUrl.split('?')[1]);
      objectName3 = urlParams.get('url');
      if (objectName3) {
        objectName3 = decodeURIComponent(objectName3);
      }
      console.log('✅ 从代理URL提取objectName:', objectName3);
    } catch (e) {
      console.warn('❌ 解析代理URL失败:', e.message);
    }
  } else if (/aliyuncs\.com[\/:]/.test(invalidUrl)) {
    try {
      const urlObj = new URL(invalidUrl);
      objectName3 = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
      console.log('✅ 从OSS URL提取objectName:', objectName3);
    } catch (e) {
      console.warn('❌ 解析OSS URL失败:', e.message);
    }
  } else {
    console.log('⚠️ 未知的图片URL格式');
  }
  
  console.log('\n📊 测试结果总结:');
  console.log('✅ 代理URL解析:', objectName ? '成功' : '失败');
  console.log('✅ OSS URL解析:', objectName2 ? '成功' : '失败');
  console.log('✅ 无效URL处理:', objectName3 ? '意外成功' : '正确失败');
  
  console.log('\n🏁 逻辑测试完成');
}

// 如果直接运行此脚本
if (require.main === module) {
  testDeleteLogic();
  process.exit(0);
}

module.exports = { testDeleteLogic }; 