const { Sequelize } = require('sequelize');
require('dotenv').config();

// 判断数据库类型
const dbDialect = process.env.DB_DIALECT || 'mysql';
const isDatabaseUrl = process.env.DATABASE_URL;

let sequelize;

if (isDatabaseUrl) {
  // 使用DATABASE_URL（如Supabase、Railway等提供的）
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres', // Supabase使用PostgreSQL
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
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
  // 使用分离的数据库配置（本地开发）
  sequelize = new Sequelize(
    process.env.DB_NAME || 'work_assistant',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || (dbDialect === 'postgres' ? 5432 : 3306),
      dialect: dbDialect,
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
