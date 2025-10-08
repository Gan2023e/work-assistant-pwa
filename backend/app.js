require('dotenv').config(); // 读取 .env
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./models');
const productWeblinkRouter = require('./routes/productWeblink');
const logisticsRouter = require('./routes/logistics');
const salaryRouter = require('./routes/salary');
const warehouseRouter = require('./routes/warehouse');
const hsCodeRouter = require('./routes/hscode');
const shipmentRouter = require('./routes/shipment');
const shippingRouter = require('./routes/shipping');
const orderManagementRouter = require('./routes/orderManagement');
const fbaInventoryRouter = require('./routes/fbaInventory');
const purchaseInvoiceRouter = require('./routes/purchaseInvoice');
const dingtalkRouter = require('./routes/dingtalk');
const inventoryRouter = require('./routes/inventory');
const listingsRouter = require('./routes/listings');
const peakSeasonRouter = require('./routes/peakSeason');
const productInformationRouter = require('./routes/productInformation');
const { router: authRouter } = require('./routes/auth');

// 强制触发Railway重新部署 - 2025-01-08 - 修复URL配置
const app = express();
const PORT = process.env.PORT || 3001;

console.log('🚀 Starting backend server...');

// CORS配置，允许前端域名访问
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://work-assistant-pwa.netlify.app',
    /\.netlify\.app$/,
    /\.railway\.app$/
  ],
  credentials: true,
  exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type'] // 暴露响应头给前端
}));

// 增加请求体大小限制，支持大文件上传和批量操作
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 健康检查端点 - 增强版本
app.get('/health', async (req, res) => {
  try {
    // 测试数据库连接
    await sequelize.authenticate();
    console.log('✅ Health check: Database connection OK');
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      database: 'connected'
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

// 获取邮件配置端点
app.get('/api/config/email', (req, res) => {
  try {
    res.json({
      receiver: process.env.EMAIL_RECEIVER,
      subject: process.env.EMAIL_SUBJECT
    });
  } catch (error) {
    console.error('获取邮件配置失败:', error);
    res.status(500).json({ message: '获取邮件配置失败' });
  }
});

// API路由
console.log('🔗 Registering API routes...');
app.use('/api/auth', authRouter);
app.use('/api/product_weblink', productWeblinkRouter);
// 添加连字符版本的路由，解决生产环境路径问题
app.use('/api/product-weblink', productWeblinkRouter);
app.use('/api/logistics', logisticsRouter);
app.use('/api/salary', salaryRouter);
app.use('/api/warehouse', warehouseRouter);
app.use('/api/hscode', hsCodeRouter);
app.use('/api/shipments', shipmentRouter);
app.use('/api/shipping', shippingRouter);
app.use('/api/order-management', orderManagementRouter);
app.use('/api/fba-inventory', fbaInventoryRouter);
app.use('/api/purchase-invoice', purchaseInvoiceRouter);
app.use('/api/dingtalk', dingtalkRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/peak-season', peakSeasonRouter);
app.use('/api/product-information', productInformationRouter);
console.log('✅ API routes registered');

// 静态文件服务 - 用于图片访问
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 根路径
app.get('/', (req, res) => {
  res.json({ 
    message: '工作助手PWA后端服务',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      '/health', 
      '/api/auth', 
      '/api/product_weblink',
      '/api/product-weblink', // 连字符版本，兼容生产环境
      '/api/logistics', 
      '/api/salary',
      '/api/warehouse',
      '/api/hscode',
      '/api/shipments',
      '/api/shipping',
      '/api/shipping/health',
      '/api/shipping/needs',
      '/api/shipping/inventory-stats',
      '/api/order-management/orders',
      '/api/order-management/orders/:needNum/details',
      '/api/order-management/check-conflicts',
      '/api/dingtalk/send-message',
      '/api/dingtalk/warehouse-demand',
      '/api/listings',
      '/api/listings/statistics',
      '/api/listings/mappings/batch',
      '/api/product-information/list',
      '/api/product-information/statistics'
    ]
  });
});

// 数据库连接和服务启动
sequelize.authenticate().then(() => {
  console.log('✅ 数据库连接成功');
  
  // 检查生产环境，避免自动同步数据库结构
  if (process.env.NODE_ENV === 'production') {
    console.log('🔒 生产环境：跳过数据库结构同步，使用现有表结构');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ 后端服务已启动，端口 ${PORT}`);
    });
  } else {
    // 开发环境暂时跳过数据库同步
    console.log('⚠️ 开发环境：跳过数据库模型同步...');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ 后端服务已启动，端口 ${PORT}`);
    });
  }
}).catch(err => {
  console.error('❌ 数据库连接失败');
  process.exit(1);
}); 