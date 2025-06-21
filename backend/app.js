require('dotenv').config(); // 读取 .env
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const productWeblinkRouter = require('./routes/productWeblink');
const logisticsRouter = require('./routes/logistics');
const salaryRouter = require('./routes/salary');
const { router: authRouter } = require('./routes/auth');

// 触发Railway重新部署 - 2024-06-21
const app = express();
const PORT = process.env.PORT || 3001;

console.log('🚀 Starting backend server...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', PORT);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);

// 检查数据库环境变量
console.log('📊 Database environment variables:');
console.log('- DB_HOST:', process.env.DB_HOST ? '✓ configured' : '❌ missing');
console.log('- DB_USER:', process.env.DB_USER ? '✓ configured' : '❌ missing');
console.log('- DB_PASSWORD:', process.env.DB_PASSWORD ? '✓ configured' : '❌ missing');
console.log('- DB_DATABASE:', process.env.DB_DATABASE ? '✓ configured' : '❌ missing');
console.log('- DB_PORT:', process.env.DB_PORT || '3306 (default)');

// CORS配置，允许前端域名访问
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

// 健康检查端点 - 增强版本
app.get('/health', async (req, res) => {
  try {
    // 测试数据库连接
    await sequelize.authenticate();
    console.log('✅ Health check: Database connection OK');
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      database: 'connected',
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        DB_HOST: process.env.DB_HOST ? 'configured' : 'missing',
        DB_DATABASE: process.env.DB_DATABASE ? 'configured' : 'missing',
        FRONTEND_URL: process.env.FRONTEND_URL
      }
    });
  } catch (error) {
    console.error('❌ Health check: Database connection failed:', error.message);
    res.status(500).json({ 
      status: 'ERROR', 
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// API路由
app.use('/api/auth', authRouter);
app.use('/api/product_weblink', productWeblinkRouter);
app.use('/api/logistics', logisticsRouter);
app.use('/api/salary', salaryRouter);

// 根路径
app.get('/', (req, res) => {
  res.json({ 
    message: '工作助手PWA后端服务',
    version: '1.0.0',
    status: 'running',
    endpoints: ['/health', '/api/auth', '/api/product_weblink', '/api/logistics', '/api/salary']
  });
});

// 数据库连接和服务启动
console.log('🔗 Attempting to connect to database...');
sequelize.authenticate().then(() => {
  console.log('✅ 数据库连接成功');
  
  // 检查生产环境，避免自动同步数据库结构
  if (process.env.NODE_ENV === 'production') {
    console.log('🔒 生产环境：跳过数据库结构同步，使用现有表结构');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ 后端服务已启动，端口 ${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
      console.log(`API文档: http://localhost:${PORT}/`);
    });
  } else {
    // 开发环境才进行数据库同步
    console.log('🔄 开发环境：同步数据库模型...');
    return sequelize.sync({ alter: false }).then(() => {
      console.log('✅ 数据库同步完成');
      
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ 后端服务已启动，端口 ${PORT}`);
        console.log(`健康检查: http://localhost:${PORT}/health`);
        console.log(`API文档: http://localhost:${PORT}/`);
      });
    });
  }
}).catch(err => {
  console.error('❌ 数据库连接失败:', err.message);
  console.error('Error details:', {
    code: err.original?.code,
    errno: err.original?.errno,
    sqlMessage: err.original?.sqlMessage
  });
  process.exit(1);
}); 