require('dotenv').config(); // 读取 .env
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const productWeblinkRouter = require('./routes/productWeblink');
const logisticsRouter = require('./routes/logistics');
const salaryRouter = require('./routes/salary');

const app = express();
const PORT = process.env.PORT || 3001;

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

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API路由
app.use('/api/product_weblink', productWeblinkRouter);
app.use('/api/logistics', logisticsRouter);
app.use('/api/salary', salaryRouter);

// 根路径
app.get('/', (req, res) => {
  res.json({ 
    message: '工作助手PWA后端服务',
    version: '1.0.0',
    status: 'running'
  });
});

// 数据库连接和服务启动
sequelize.authenticate().then(() => {
  console.log('数据库连接成功');
  
  // 同步数据库模型
  return sequelize.sync({ alter: true });
}).then(() => {
  console.log('数据库同步完成');
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`后端服务已启动，端口 ${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/health`);
  });
}).catch(err => {
  console.error('数据库连接失败:', err);
  process.exit(1);
}); 