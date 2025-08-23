// Chrome插件配置文件
const CONFIG = {
  // 生产环境配置
  PRODUCTION: {
    API_BASE_URL: 'https://work-assistant-pwa-production.up.railway.app',
    DOMAIN: 'work-assistant-pwa-production.up.railway.app',
    PROTOCOL: 'https:'
  },
  
  // 开发环境配置
  DEVELOPMENT: {
    API_BASE_URL: 'http://localhost:3001',
    DOMAIN: 'localhost',
    PROTOCOL: 'http:'
  },
  
  // 获取当前环境配置
  getCurrentConfig() {
    // 可以通过多种方式判断环境
    const hostname = window.location?.hostname || 'localhost';
    
    if (hostname === 'work-assistant-pwa-production.up.railway.app') {
      return this.PRODUCTION;
    } else if (hostname === 'localhost') {
      return this.DEVELOPMENT;
    } else {
      // 默认返回生产环境配置
      return this.PRODUCTION;
    }
  },
  
  // 获取API基础URL
  getApiBaseUrl() {
    const config = this.getCurrentConfig();
    return config.API_BASE_URL;
  }
};

// 导出配置（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}

// 全局可用（浏览器环境）
if (typeof window !== 'undefined') {
  window.EXTENSION_CONFIG = CONFIG;
} 