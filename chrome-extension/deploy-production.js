#!/usr/bin/env node

/**
 * Chrome扩展部署脚本
 * 用于将更新后的扩展部署到生产环境
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 开始部署Chrome扩展到生产环境...\n');

// 检查必要文件
const requiredFiles = [
  'manifest.json',
  'content.js',
  'background.js',
  'popup.html',
  'popup.js',
  'icon.svg'
];

console.log('📋 检查必要文件...');
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`❌ 缺少必要文件: ${file}`);
    process.exit(1);
  }
  console.log(`✅ ${file}`);
}

// 读取manifest.json获取版本信息
try {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  console.log(`\n📦 当前版本: ${manifest.version}`);
  console.log(`📝 扩展名称: ${manifest.name}`);
} catch (error) {
  console.error('❌ 无法读取manifest.json:', error.message);
  process.exit(1);
}

// 创建生产环境配置
console.log('\n🔧 创建生产环境配置...');
try {
  const productionConfig = {
    version: new Date().toISOString().slice(0, 19).replace(/:/g, '-'),
    deployTime: new Date().toISOString(),
    changes: [
      '优化新品审核按钮位置，移动到"数据管理"栏中的最后位置',
      '确保按钮在所有其他按钮之后显示',
      '缩小按钮尺寸，提升视觉协调性',
      '改进DOM元素查找算法，提高按钮插入成功率',
      '增强页面变化监听，支持动态内容更新'
    ]
  };
  
  fs.writeFileSync('production-config.json', JSON.stringify(productionConfig, null, 2));
  console.log('✅ 生产环境配置文件已创建');
} catch (error) {
  console.error('❌ 创建生产环境配置失败:', error.message);
}

// 创建部署包
console.log('\n📦 创建部署包...');
const deployDir = `deploy-${Date.now()}`;
try {
  if (!fs.existsSync(deployDir)) {
    fs.mkdirSync(deployDir);
  }
  
  // 复制必要文件
  for (const file of requiredFiles) {
    fs.copyFileSync(file, path.join(deployDir, file));
  }
  
  // 复制其他必要文件
  const additionalFiles = ['README.md', 'production-config.json'];
  for (const file of additionalFiles) {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join(deployDir, file));
    }
  }
  
  console.log(`✅ 部署包已创建: ${deployDir}`);
} catch (error) {
  console.error('❌ 创建部署包失败:', error.message);
  process.exit(1);
}

// 显示部署说明
console.log('\n📋 部署说明:');
console.log('1. 将整个扩展文件夹复制到目标环境');
console.log('2. 在Chrome浏览器中打开 chrome://extensions/');
console.log('3. 开启"开发者模式"');
console.log('4. 点击"加载已解压的扩展程序"');
console.log('5. 选择扩展文件夹');
console.log('6. 如果已安装旧版本，先点击"移除"再重新加载');

console.log('\n🔍 主要更新内容:');
console.log('- 新品审核按钮已移动到"数据管理"栏中的最后位置');
console.log('- 确保按钮在所有其他按钮之后显示');
console.log('- 按钮尺寸已优化，与其他按钮保持一致');
console.log('- 改进了按钮插入逻辑，提高成功率');
console.log('- 增强了页面变化监听能力');

console.log('\n✅ 部署完成！');
console.log(`📁 部署包位置: ${deployDir}`);
console.log('\n💡 提示: 部署后请测试按钮是否能正确显示在"数据管理"栏的最后位置');
console.log('💡 验证顺序: 批量修改状态 → 批量上传新品 → 批量删除 → 新链接（采购用） → 🔍 新品审核'); 