const { deleteFromOSS } = require('../utils/oss');

// 测试辅助函数
const extractOSSObjectName = (declaredImage) => {
  if (!declaredImage) return null;
  
  let objectName = null;
  
  // 检查是否为代理URL格式
  if (declaredImage.includes('/api/hscode/image-proxy')) {
    try {
      // 从代理URL中提取objectName
      const urlParams = new URLSearchParams(declaredImage.split('?')[1]);
      objectName = urlParams.get('url');
      if (objectName) {
        objectName = decodeURIComponent(objectName);
      }
    } catch (e) {
      console.warn('解析代理URL失败:', e.message);
    }
  } else if (/aliyuncs\.com[\/:]/.test(declaredImage)) {
    // 直接OSS链接格式
    try {
      const urlObj = new URL(declaredImage);
      objectName = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
    } catch (e) {
      console.warn('解析OSS URL失败:', e.message);
    }
  }
  
  return objectName;
};

// 测试用例
const testCases = [
  {
    name: '代理URL格式',
    input: '/api/hscode/image-proxy?url=hscode-images%2Ftest_sku_123.jpg',
    expected: 'hscode-images/test_sku_123.jpg'
  },
  {
    name: '直接OSS链接格式',
    input: 'https://your-bucket.oss-cn-hangzhou.aliyuncs.com/hscode-images/test_sku_456.jpg',
    expected: 'hscode-images/test_sku_456.jpg'
  },
  {
    name: '空值测试',
    input: null,
    expected: null
  },
  {
    name: '无效URL测试',
    input: 'invalid-url',
    expected: null
  }
];

console.log('🧪 开始测试OSS objectName提取函数...\n');

testCases.forEach((testCase, index) => {
  console.log(`测试 ${index + 1}: ${testCase.name}`);
  console.log(`输入: ${testCase.input}`);
  
  const result = extractOSSObjectName(testCase.input);
  console.log(`输出: ${result}`);
  console.log(`期望: ${testCase.expected}`);
  
  const passed = result === testCase.expected;
  console.log(`结果: ${passed ? '✅ 通过' : '❌ 失败'}\n`);
});

console.log('🎉 测试完成！'); 