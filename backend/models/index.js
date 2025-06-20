const { Sequelize } = require('sequelize');
require('dotenv').config();

// 优先使用Railway提供的DATABASE_URL或MYSQL_URL
let sequelize;

if (process.env.MYSQL_URL) {
  // Railway MySQL URL格式
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
  // 通用DATABASE_URL格式
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
  // 传统分别配置方式（本地开发或手动配置）
  sequelize = new Sequelize(
    process.env.MYSQL_DATABASE || process.env.DB_NAME || 'work_assistant',
    process.env.MYSQL_USER || process.env.DB_USER || 'root',
    process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
    {
      host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
      port: process.env.MYSQL_PORT || process.env.DB_PORT || 3306,
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

module.exports = { sequelize };
