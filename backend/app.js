require('dotenv').config(); // 读取 .env
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const productWeblinkRouter = require('./routes/productWeblink');
const logisticsRouter = require('./routes/logistics');
const salaryRouter = require('./routes/salary');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/product_weblink', productWeblinkRouter);
app.use('/api/logistics', logisticsRouter);
app.use('/api/salary', salaryRouter);

sequelize.authenticate().then(() => {
  console.log('数据库连接成功');
  app.listen(3001, () => {
    console.log('后端服务已启动，端口3001');
  });
}).catch(err => {
  console.error('数据库连接失败:', err);
}); 