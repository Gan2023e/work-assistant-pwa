require('dotenv').config();
const { deleteFromOSS } = require('../utils/oss');

async function testOSSDelete() {
  try {
    console.log('🧪 开始测试OSS删除功能...');
    
    // 测试删除一个不存在的文件
    const testObjectName = 'hscode-images/test-delete-file.jpg';
    console.log('🗑️ 测试删除文件:', testObjectName);
    
    const result = await deleteFromOSS(testObjectName);
    console.log('📊 删除结果:', result);
    
    if (result.success) {
      console.log('✅ OSS删除功能正常');
    } else {
      console.log('⚠️ OSS删除功能异常:', result.error || result.message);
    }
    
  } catch (error) {
    console.error('❌ 测试OSS删除功能失败:', error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testOSSDelete().then(() => {
    console.log('🏁 测试完成');
    process.exit(0);
  }).catch(error => {
    console.error('💥 测试失败:', error);
    process.exit(1);
  });
}

module.exports = { testOSSDelete }; 