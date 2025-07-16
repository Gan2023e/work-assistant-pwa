const { checkOSSConfig, uploadToOSS } = require('./utils/oss');
const fs = require('fs');
const path = require('path');

async function debugOSS() {
  console.log('🔍 开始OSS调试...');
  
  // 1. 检查OSS配置
  console.log('\n📋 检查OSS环境变量配置:');
  const envVars = ['OSS_REGION', 'OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET', 'OSS_BUCKET'];
  envVars.forEach(envVar => {
    const value = process.env[envVar];
    if (value) {
      const maskedValue = envVar.includes('SECRET') || envVar.includes('KEY') 
        ? value.substring(0, 4) + '***' + value.substring(value.length - 4)
        : value;
      console.log(`  ✅ ${envVar}: ${maskedValue}`);
    } else {
      console.log(`  ❌ ${envVar}: 未设置`);
    }
  });
  
  // 2. 检查配置有效性
  console.log('\n🔧 检查OSS配置有效性:');
  const isConfigValid = checkOSSConfig();
  console.log(`  配置状态: ${isConfigValid ? '✅ 有效' : '❌ 无效'}`);
  
  if (!isConfigValid) {
    console.log('❌ OSS配置无效，无法继续测试上传功能');
    return;
  }
  
  // 3. 测试上传功能
  console.log('\n📤 测试文件上传功能:');
  try {
    // 创建一个测试图片buffer
    const testImageData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    const testFilename = 'test-screenshot.png';
    
    console.log('  📄 测试文件信息:');
    console.log(`    文件名: ${testFilename}`);
    console.log(`    文件大小: ${testImageData.length} bytes`);
    console.log(`    文件类型: PNG (1x1像素测试图片)`);
    
    console.log('  🚀 开始上传...');
    const uploadResult = await uploadToOSS(testImageData, testFilename, 'purchase');
    
    console.log('  ✅ 上传成功！');
    console.log('  📊 上传结果:');
    console.log(`    success: ${uploadResult.success}`);
    console.log(`    url: ${uploadResult.url}`);
    console.log(`    name: ${uploadResult.name}`);
    console.log(`    size: ${uploadResult.size}`);
    console.log(`    originalName: ${uploadResult.originalName}`);
    console.log(`    folder: ${uploadResult.folder}`);
    
    // 4. 模拟前端处理过程
    console.log('\n🎭 模拟前端数据处理:');
    const mockUploadFile = {
      uid: 'test-uid-123',
      name: uploadResult.originalName,
      status: 'done',
      url: uploadResult.url,
      size: uploadResult.size,
      thumbUrl: uploadResult.url,
      response: {
        ...uploadResult
      }
    };
    
    console.log('  📦 模拟前端Upload文件对象:');
    console.log(JSON.stringify(mockUploadFile, null, 2));
    
    const cleanScreenshots = [{
      uid: mockUploadFile.uid,
      name: mockUploadFile.name,
      url: mockUploadFile.url,
      size: mockUploadFile.size,
      status: mockUploadFile.status
    }];
    
    console.log('  🧹 清理后的存储数据:');
    console.log(JSON.stringify(cleanScreenshots, null, 2));
    
    // 5. 验证URL是否可访问
    console.log('\n🌐 验证URL可访问性:');
    try {
      const https = require('https');
      const http = require('http');
      const urlModule = require('url');
      
      const parsedUrl = urlModule.parse(uploadResult.url);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      const headRequest = client.request({
        ...parsedUrl,
        method: 'HEAD'
      }, (res) => {
        console.log(`  📡 HTTP状态码: ${res.statusCode}`);
        console.log(`  📏 Content-Length: ${res.headers['content-length']}`);
        console.log(`  📋 Content-Type: ${res.headers['content-type']}`);
        if (res.statusCode === 200) {
          console.log('  ✅ URL可正常访问');
        } else {
          console.log('  ⚠️ URL访问异常');
        }
      });
      
      headRequest.on('error', (error) => {
        console.log('  ❌ URL访问失败:', error.message);
      });
      
      headRequest.end();
      
    } catch (urlError) {
      console.log('  ❌ URL验证失败:', urlError.message);
    }
    
  } catch (uploadError) {
    console.log('  ❌ 上传失败:');
    console.log(`    错误类型: ${uploadError.name}`);
    console.log(`    错误消息: ${uploadError.message}`);
    if (uploadError.code) {
      console.log(`    错误代码: ${uploadError.code}`);
    }
    console.log(`    完整错误: ${uploadError.stack}`);
  }
  
  console.log('\n🎉 OSS调试完成');
}

// 运行调试
debugOSS().then(() => {
  console.log('\n✅ 调试脚本执行完成');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ 调试脚本执行失败:', error);
  process.exit(1);
}); 