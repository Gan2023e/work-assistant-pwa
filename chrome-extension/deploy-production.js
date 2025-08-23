#!/usr/bin/env node

/**
 * Chrome插件生产环境部署脚本
 * 使用方法: node deploy-production.js your-actual-domain.com
 */

const fs = require('fs');
const path = require('path');

// 获取命令行参数
const args = process.argv.slice(2);
const productionDomain = args[0];

if (!productionDomain) {
  console.error('❌ 错误: 请提供生产环境域名');
  console.log('使用方法: node deploy-production.js your-actual-domain.com');
  process.exit(1);
}

console.log(`🚀 开始配置生产环境部署，目标域名: ${productionDomain}`);

// 文件路径
const manifestPath = path.join(__dirname, 'manifest.json');
const backgroundPath = path.join(__dirname, 'background.js');
const configPath = path.join(__dirname, 'config.js');

try {
  // 1. 更新 manifest.json
  console.log('📝 更新 manifest.json...');
  let manifestContent = fs.readFileSync(manifestPath, 'utf8');
  
  // 替换域名占位符
  manifestContent = manifestContent.replace(/work-assistant-pwa-production\.up\.railway\.app/g, productionDomain);
  
  fs.writeFileSync(manifestPath, manifestContent);
  console.log('✅ manifest.json 更新完成');

  // 2. 更新 background.js
  console.log('📝 更新 background.js...');
  let backgroundContent = fs.readFileSync(backgroundPath, 'utf8');
  
  // 替换域名占位符
  backgroundContent = backgroundContent.replace(/work-assistant-pwa-production\.up\.railway\.app/g, productionDomain);
  
  fs.writeFileSync(backgroundPath, backgroundContent);
  console.log('✅ background.js 更新完成');

  // 3. 更新 config.js
  console.log('📝 更新 config.js...');
  let configContent = fs.readFileSync(configPath, 'utf8');
  
  // 替换域名占位符
  configContent = configContent.replace(/work-assistant-pwd\.up\.railway\.app/g, productionDomain);
  
  fs.writeFileSync(configPath, configContent);
  console.log('✅ config.js 更新完成');

  // 4. 创建部署信息文件
  const deployInfo = {
    deployedAt: new Date().toISOString(),
    domain: productionDomain,
    version: '1.0.0',
    environment: 'production'
  };
  
  fs.writeFileSync(
    path.join(__dirname, 'deploy-info.json'), 
    JSON.stringify(deployInfo, null, 2)
  );

  console.log('🎉 生产环境配置完成！');
  console.log(`📋 部署信息:`);
  console.log(`   - 目标域名: ${productionDomain}`);
  console.log(`   - 部署时间: ${deployInfo.deployedAt}`);
  console.log(`   - 插件版本: ${deployInfo.version}`);
  
  console.log('\n📦 下一步操作:');
  console.log('1. 在Chrome扩展程序页面打包插件');
  console.log('2. 将生成的.crx文件分发给用户');
  console.log('3. 或者将整个文件夹打包为ZIP供用户安装');

} catch (error) {
  console.error('❌ 部署配置失败:', error.message);
  process.exit(1);
} 