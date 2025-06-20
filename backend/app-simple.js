const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

console.log('🚀 Starting simple backend server...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', PORT);

// CORS配置
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://work-assistant-pwa.netlify.app',
    /\.netlify\.app$/,
    /\.railway\.app$/
  ],
  credentials: true
}));

app.use(express.json());

// 健康检查端点
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Simple backend is running'
  });
});

// 根路径
app.get('/', (req, res) => {
  console.log('Root path requested');
  res.json({ 
    message: '工作助手PWA后端服务 (简化版)',
    version: '1.0.0',
    status: 'running',
    endpoints: ['/health', '/api/test']
  });
});

// 测试API端点
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API测试成功',
    timestamp: new Date().toISOString()
  });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 简化后端服务已启动，端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API测试: http://localhost:${PORT}/api/test`);
});

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
}); 