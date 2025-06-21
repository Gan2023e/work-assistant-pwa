require('dotenv').config();
const { sequelize } = require('../models');
const User = require('../models/User');

async function createAdmin() {
  try {
    // 连接数据库
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');

    // 强制同步用户表（创建表）
    await User.sync({ force: true });
    console.log('✅ 用户表创建完成');

    // 创建默认管理员用户
    const adminUser = await User.create({
      username: 'admin',
      password: 'admin123',
      email: 'admin@example.com',
      role: 'admin'
    });

    console.log('✅ 管理员用户创建成功!');
    console.log('用户名: admin');
    console.log('密码: admin123');
    console.log('角色: admin');
    console.log('');
    console.log('⚠️ 请尽快登录并修改默认密码！');

    // 同时创建一个普通用户用于测试
    const normalUser = await User.create({
      username: 'user1',
      password: 'user123',
      email: 'user1@example.com',
      role: 'user'
    });

    console.log('');
    console.log('✅ 测试用户也已创建:');
    console.log('用户名: user1');
    console.log('密码: user123');
    console.log('角色: user');

  } catch (error) {
    console.error('❌ 创建用户失败:', error.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// 只创建普通用户的函数
async function createUser() {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');

    await User.sync({ force: false });

    // 创建普通用户
    const user = await User.create({
      username: 'user1',
      password: 'user123',
      email: 'user1@example.com',
      role: 'user'
    });

    console.log('✅ 普通用户创建成功!');
    console.log('用户名: user1');
    console.log('密码: user123');
    console.log('角色: user');

  } catch (error) {
    console.error('❌ 创建用户失败:', error.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// 根据命令行参数决定创建哪种用户
const userType = process.argv[2];
if (userType === 'user') {
  createUser();
} else {
  createAdmin();
} 