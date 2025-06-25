const { Sequelize } = require('sequelize');

// 导入所有模型
const User = require('./User');
const LocalBox = require('./LocalBox');
const WarehouseProductsNeed = require('./WarehouseProductsNeed');
const AmzWarehouse = require('./AmzWarehouse');
const HsCode = require('./HsCode');
const Logistics = require('./Logistics');
const PackagePrice = require('./PackagePrice');
const ProductWeblink = require('./ProductWeblink');
const SellerInventorySku = require('./SellerInventorySku');

// 在Railway中，环境变量是直接注入的，但仍然尝试加载.env文件（如果存在）
try {
  require('dotenv').config();
} catch (e) {
  console.log('📝 No .env file found, using system environment variables');
}

console.log('🔗 Initializing database connection...');

// 详细的环境变量调试输出
console.log('🔍 Environment Variables Debug:');
console.log('- DB_HOST:', process.env.DB_HOST || 'NOT SET');
console.log('- DB_USER:', process.env.DB_USER || 'NOT SET');
console.log('- DB_PASSWORD:', process.env.DB_PASSWORD ? '***HIDDEN***' : 'NOT SET');
console.log('- DB_DATABASE:', process.env.DB_DATABASE || 'NOT SET');
console.log('- DB_PORT:', process.env.DB_PORT || 'NOT SET');
console.log('- MYSQL_URL:', process.env.MYSQL_URL ? '***HIDDEN***' : 'NOT SET');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '***HIDDEN***' : 'NOT SET');

// 优先使用单独的环境变量（Railway配置）
let sequelize;

if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_DATABASE) {
  // 使用单独的环境变量（推荐方式）
  console.log('📊 Using individual database environment variables');
  console.log('- Host:', process.env.DB_HOST);
  console.log('- Database:', process.env.DB_DATABASE);
  console.log('- User:', process.env.DB_USER);
  console.log('- Port:', process.env.DB_PORT || '3306');
  
  sequelize = new Sequelize(
    process.env.DB_DATABASE,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 3306,
      dialect: 'mysql',
      timezone: '+08:00',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      retry: {
        match: [
          /ETIMEDOUT/,
          /EHOSTUNREACH/,
          /ECONNRESET/,
          /ECONNREFUSED/,
          /ETIMEDOUT/,
          /ESOCKETTIMEDOUT/,
          /EHOSTUNREACH/,
          /EPIPE/,
          /EAI_AGAIN/,
          /SequelizeConnectionError/,
          /SequelizeConnectionRefusedError/,
          /SequelizeHostNotFoundError/,
          /SequelizeHostNotReachableError/,
          /SequelizeInvalidConnectionError/,
          /SequelizeConnectionTimedOutError/
        ],
        max: 3
      }
    }
  );
} else if (process.env.MYSQL_URL) {
  // Railway MySQL URL格式（备选）
  console.log('📊 Using MYSQL_URL');
  sequelize = new Sequelize(process.env.MYSQL_URL, {
    dialect: 'mysql',
    timezone: '+08:00',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else if (process.env.DATABASE_URL) {
  // 通用DATABASE_URL格式（备选）
  console.log('📊 Using DATABASE_URL');
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'mysql',
    timezone: '+08:00',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  // 兜底配置
  console.log('⚠️ No database configuration found, using defaults');
  sequelize = new Sequelize(
    'work_assistant',
    'root',
    '',
    {
      host: 'localhost',
      port: 3306,
      dialect: 'mysql',
      timezone: '+08:00',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );
}

module.exports = { 
  sequelize,
  User,
  LocalBox,
  WarehouseProductsNeed,
  AmzWarehouse,
  HsCode,
  Logistics,
  PackagePrice,
  ProductWeblink,
  SellerInventorySku
};
