// 应用版本配置
export const APP_VERSION = '2.0.1';
export const BUILD_DATE = new Date().toISOString().split('T')[0]; // 构建日期

// 版本信息
export const VERSION_INFO = {
  version: APP_VERSION,
  buildDate: BUILD_DATE,
  description: '添加用户管理和强制更新功能'
};

export default VERSION_INFO; 