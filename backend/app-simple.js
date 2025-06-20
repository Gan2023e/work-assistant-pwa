// 超简化版本 - 不使用任何外部模块
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3001;

console.log('🚀 Starting ultra-simple backend server...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', PORT);

// 简单的CORS处理
function addCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// 创建服务器
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  // 添加CORS头
  addCorsHeaders(res);
  
  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  console.log(`${req.method} ${path}`);
  
  // 健康检查端点
  if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'OK',
      timestamp: new Date().toISOString(),
      message: 'Ultra-simple backend is running'
    }));
    return;
  }
  
  // 根路径
  if (path === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: '工作助手PWA后端服务 (超简化版)',
      version: '1.0.0',
      status: 'running',
      endpoints: ['/health', '/api/test']
    }));
    return;
  }
  
  // 测试API端点
  if (path === '/api/test') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: 'API测试成功',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // 404 处理
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: 'Not Found',
    path: path
  }));
});

// 启动服务器
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 超简化后端服务已启动，端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API测试: http://localhost:${PORT}/api/test`);
});

// 错误处理
server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
}); 