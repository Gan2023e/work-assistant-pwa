#!/usr/bin/env node

/**
 * CPC文件上传性能测试脚本
 * 用于验证异步优化后的上传性能
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// 配置
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const TEST_RECORD_ID = 1; // 测试用的记录ID
const TEST_PDF_PATH = path.join(__dirname, 'test-files', 'test-cpc.pdf');

// 创建测试PDF文件（如果不存在）
function createTestPdf() {
  const testDir = path.join(__dirname, 'test-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, true);
  }

  const testPdfPath = path.join(testDir, 'test-cpc.pdf');
  if (!fs.existsSync(testPdfPath)) {
    // 创建一个简单的PDF文件用于测试
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(CHILDREN'S PRODUCT CERTIFICATE) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000204 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
297
%%EOF`;

    fs.writeFileSync(testPdfPath, pdfContent);
    console.log('✅ 创建测试PDF文件:', testPdfPath);
  }

  return testPdfPath;
}

// 测试单个文件上传
async function testSingleUpload() {
  console.log('\n🧪 测试单个文件上传...');
  
  const testPdfPath = createTestPdf();
  const formData = new FormData();
  formData.append('cpcFile', fs.createReadStream(testPdfPath));

  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/product_weblink/upload-cpc-file/${TEST_RECORD_ID}`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`📊 上传响应时间: ${duration}ms`);
    console.log(`📋 响应状态: ${response.status}`);
    console.log(`📝 响应内容:`, JSON.stringify(result, null, 2));

    if (result.code === 0) {
      console.log('✅ 单文件上传测试通过');
      return { success: true, duration, result };
    } else {
      console.log('❌ 单文件上传测试失败:', result.message);
      return { success: false, duration, error: result.message };
    }
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log('❌ 单文件上传测试异常:', error.message);
    return { success: false, duration, error: error.message };
  }
}

// 测试多文件并行上传
async function testMultipleUpload() {
  console.log('\n🧪 测试多文件并行上传...');
  
  const testPdfPath = createTestPdf();
  const fileCount = 3; // 测试3个文件并行上传
  
  const uploadPromises = [];
  for (let i = 0; i < fileCount; i++) {
    const formData = new FormData();
    formData.append('cpcFile', fs.createReadStream(testPdfPath));
    
    uploadPromises.push(
      fetch(`${API_BASE_URL}/api/product_weblink/upload-cpc-file/${TEST_RECORD_ID}`, {
        method: 'POST',
        body: formData,
      }).then(async response => {
        const result = await response.json();
        return { response, result };
      })
    );
  }

  const startTime = Date.now();
  
  try {
    const results = await Promise.allSettled(uploadPromises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`📊 并行上传响应时间: ${duration}ms`);
    
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.result.code === 0).length;
    const failureCount = results.length - successCount;

    console.log(`📋 成功: ${successCount}, 失败: ${failureCount}`);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`📝 文件${index + 1}响应:`, result.value.result.message);
      } else {
        console.log(`❌ 文件${index + 1}异常:`, result.reason.message);
      }
    });

    if (successCount > 0) {
      console.log('✅ 多文件并行上传测试通过');
      return { success: true, duration, successCount, failureCount };
    } else {
      console.log('❌ 多文件并行上传测试失败');
      return { success: false, duration, successCount, failureCount };
    }
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log('❌ 多文件并行上传测试异常:', error.message);
    return { success: false, duration, error: error.message };
  }
}

// 测试WebSocket连接
async function testWebSocketConnection() {
  console.log('\n🧪 测试WebSocket连接...');
  
  try {
    const WebSocket = require('ws');
    const wsUrl = API_BASE_URL.replace('http', 'ws') + '/ws?userId=test';
    
    return new Promise((resolve) => {
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        console.log('✅ WebSocket连接成功');
        ws.close();
        resolve({ success: true });
      });
      
      ws.on('error', (error) => {
        console.log('❌ WebSocket连接失败:', error.message);
        resolve({ success: false, error: error.message });
      });
      
      ws.on('message', (data) => {
        console.log('📨 收到WebSocket消息:', data.toString());
      });
    });
  } catch (error) {
    console.log('❌ WebSocket测试异常:', error.message);
    return { success: false, error: error.message };
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始CPC文件上传性能测试...');
  console.log(`🔗 API地址: ${API_BASE_URL}`);
  console.log(`📁 测试记录ID: ${TEST_RECORD_ID}`);

  const results = {
    singleUpload: null,
    multipleUpload: null,
    webSocket: null
  };

  // 测试单文件上传
  results.singleUpload = await testSingleUpload();

  // 等待2秒
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 测试多文件并行上传
  results.multipleUpload = await testMultipleUpload();

  // 等待2秒
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 测试WebSocket连接
  results.webSocket = await testWebSocketConnection();

  // 输出测试总结
  console.log('\n📊 测试总结:');
  console.log('='.repeat(50));
  
  if (results.singleUpload?.success) {
    console.log(`✅ 单文件上传: 通过 (${results.singleUpload.duration}ms)`);
  } else {
    console.log(`❌ 单文件上传: 失败 (${results.singleUpload?.duration || 0}ms)`);
  }
  
  if (results.multipleUpload?.success) {
    console.log(`✅ 多文件并行上传: 通过 (${results.multipleUpload.duration}ms, 成功${results.multipleUpload.successCount}个)`);
  } else {
    console.log(`❌ 多文件并行上传: 失败 (${results.multipleUpload?.duration || 0}ms)`);
  }
  
  if (results.webSocket?.success) {
    console.log(`✅ WebSocket连接: 通过`);
  } else {
    console.log(`❌ WebSocket连接: 失败`);
  }

  // 性能评估
  console.log('\n🎯 性能评估:');
  if (results.singleUpload?.duration < 2000) {
    console.log('✅ 单文件上传响应时间优秀 (< 2秒)');
  } else if (results.singleUpload?.duration < 5000) {
    console.log('⚠️ 单文件上传响应时间一般 (2-5秒)');
  } else {
    console.log('❌ 单文件上传响应时间较慢 (> 5秒)');
  }

  if (results.multipleUpload?.duration < 5000) {
    console.log('✅ 多文件并行上传响应时间优秀 (< 5秒)');
  } else if (results.multipleUpload?.duration < 10000) {
    console.log('⚠️ 多文件并行上传响应时间一般 (5-10秒)');
  } else {
    console.log('❌ 多文件并行上传响应时间较慢 (> 10秒)');
  }

  console.log('\n🏁 测试完成!');
}

// 运行测试
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testSingleUpload, testMultipleUpload, testWebSocketConnection };
