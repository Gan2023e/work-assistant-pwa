const { Sequelize } = require('sequelize');

// 在Railway中，环境变量是直接注入的，但仍然尝试加载.env文件（如果存在）
try {
  require('dotenv').config();
} catch (e) {
  console.log('📝 No .env file found, using system environment variables');
}

console.log('🔗 Initializing database connection...');

// 优先使用单独的环境变量（Railway配置）
let sequelize;

if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_DATABASE) {
  // 使用单独的环境变量（推荐方式）
  console.log('📊 Using individual database environment variables');
  
  sequelize = new Sequelize(
    process.env.DB_DATABASE,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 3306,
      dialect: 'mysql',
      timezone: '+08:00',
      logging: false,
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
    logging: false,
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
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  // 兜底配置 - 使用SQLite数据库进行本地开发
  console.log('⚠️ No database configuration found, using SQLite for local development');
  const path = require('path');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.db'),
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
}

module.exports = { sequelize }; 