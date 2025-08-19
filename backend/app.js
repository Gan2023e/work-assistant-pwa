require('dotenv').config(); // 读取 .env
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const { sequelize } = require('./models');
const { ProductWeblink } = require('./models');
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
      '/api/dingtalk/warehouse-demand'
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
      
      // 启动定时任务
      startScheduledTasks();
    });
  } else {
    // 开发环境才进行数据库同步
    console.log('🔄 开发环境：同步数据库模型...');
    return sequelize.sync({ alter: false }).then(() => {
      console.log('✅ 数据库同步完成');
      
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ 后端服务已启动，端口 ${PORT}`);
        
        // 启动定时任务
        startScheduledTasks();
      });
    });
  }
}).catch(err => {
  console.error('❌ 数据库连接失败');
  process.exit(1);
});

// 定时任务函数
function startScheduledTasks() {
  console.log('🕐 启动定时任务...');
  
  // 每天上午10点检查新品一审记录
  cron.schedule('0 10 * * *', async () => {
    try {
      console.log('🔍 执行定时任务：检查新品一审记录数量...');
      
      // 查询新品一审记录数量
      const newProductFirstReviewCount = await ProductWeblink.count({
        where: { status: '新品一审' }
      });
      
      console.log(`📊 新品一审记录数量: ${newProductFirstReviewCount}`);
      
      if (newProductFirstReviewCount > 0) {
        // 发送钉钉通知
        const notificationMessage = `🔔 每日提醒：目前有 ${newProductFirstReviewCount} 个新品一审记录需要处理，请及时处理。`;
        
        try {
          const axios = require('axios');
          const dingtalkWebhook = process.env.DINGTALK_WEBHOOK_URL;
          
          if (!dingtalkWebhook) {
            console.warn('⚠️ 钉钉Webhook URL未配置，跳过通知发送');
            return;
          }
          
          await axios.post(dingtalkWebhook, {
            msgtype: 'text',
            text: {
              content: notificationMessage
            },
            at: {
              atMobiles: [process.env.MOBILE_NUM_SARA || ''],
              isAtAll: false
            }
          });
          
          console.log('✅ 钉钉通知发送成功');
        } catch (notificationError) {
          console.error('❌ 钉钉通知发送失败:', notificationError.message);
        }
      } else {
        console.log('ℹ️ 新品一审记录数量为0，无需发送通知');
      }
    } catch (error) {
      console.error('❌ 定时任务执行失败:', error);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });
  
  console.log('✅ 定时任务启动成功 - 每天上午10点检查新品一审记录');
} 