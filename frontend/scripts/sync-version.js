const fs = require('fs');
const path = require('path');

// 读取版本配置
const versionPath = path.join(__dirname, '../src/config/version.ts');
const swPath = path.join(__dirname, '../public/sw.js');

try {
  // 读取version.ts文件
  const versionContent = fs.readFileSync(versionPath, 'utf8');
  
  // 提取版本号
  const versionMatch = versionContent.match(/export const APP_VERSION = '([^']+)'/);
  if (!versionMatch) {
    throw new Error('无法从version.ts中提取版本号');
  }
  
  const appVersion = versionMatch[1];
  console.log(`检测到版本号: ${appVersion}`);
  
  // 读取sw.js文件
  const swContent = fs.readFileSync(swPath, 'utf8');
  
  // 替换sw.js中的版本号
  let updatedSwContent = swContent
    .replace(/const CACHE_NAME = '[^']+';/, `const CACHE_NAME = 'work-assistant-pwa-v${appVersion}';`)
    .replace(/const APP_VERSION = '[^']+';/, `const APP_VERSION = '${appVersion}';`);
  
  // 写回sw.js文件
  fs.writeFileSync(swPath, updatedSwContent, 'utf8');
  
  console.log(`✅ Service Worker版本号已同步为: ${appVersion}`);
  console.log(`✅ 缓存名称已更新为: work-assistant-pwa-v${appVersion}`);
  
} catch (error) {
  console.error('❌ 版本同步失败:', error.message);
  process.exit(1);
} 