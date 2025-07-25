// 应用版本配置 - 所有版本号的唯一来源
export const APP_VERSION = '2.0.5';
export const BUILD_DATE = new Date().toISOString().split('T')[0]; // 构建日期

// 版本更新日志
export const VERSION_CHANGELOG = {
  '2.0.5': '修复亚马逊发货文件格式问题，完美保持原始模板格式、边框、样式',
  '2.0.4': '修复生产环境批量删除功能，增强调试和错误处理',
  '2.0.3': '演示自动版本同步机制，完善版本管理流程',
  '2.0.2': '优化版本管理机制，统一版本号控制',
  '2.0.1': '添加用户管理和强制更新功能',
  '2.0.0': '重构应用架构，添加PWA功能'
};

// 版本信息
export const VERSION_INFO = {
  version: APP_VERSION,
  buildDate: BUILD_DATE,
  description: VERSION_CHANGELOG[APP_VERSION] || '版本更新',
  cacheVersion: `work-assistant-pwa-v${APP_VERSION}` // 供Service Worker使用
};

// 供Service Worker使用的版本常量
export const SW_VERSION = {
  CACHE_NAME: `work-assistant-pwa-v${APP_VERSION}`,
  APP_VERSION: APP_VERSION
};

export default VERSION_INFO; 