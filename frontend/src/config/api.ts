// API配置
const API_CONFIG = {
  // 开发环境
  development: {
    baseURL: 'http://localhost:3001',
  },
  // 生产环境 - Railway后端URL
  production: {
    baseURL: 'https://work-assistant-pwa-production.up.railway.app',
  }
};

// 更明确的环境判断
const isProduction = process.env.NODE_ENV === 'production' || 
                    window.location.hostname !== 'localhost';

const environment = isProduction ? 'production' : 'development';
const config = API_CONFIG[environment];

// 调试输出
console.log('🌍 Environment Detection:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- hostname:', window.location.hostname);
console.log('- isProduction:', isProduction);
console.log('- selected environment:', environment);
console.log('- API_BASE_URL:', config.baseURL);

export const API_BASE_URL = config.baseURL;

// API端点
export const API_ENDPOINTS = {
  // 产品链接
  productWeblink: {
    list: '/api/product_weblink',
    create: '/api/product_weblink',
    update: (id: number) => `/api/product_weblink/${id}`,
    delete: (id: number) => `/api/product_weblink/${id}`,
    search: '/api/product_weblink/search',
  },
  // 物流
  logistics: {
    list: '/api/logistics',
    create: '/api/logistics',
    update: (id: number) => `/api/logistics/${id}`,
    delete: (id: number) => `/api/logistics/${id}`,
  },
  // 工资
  salary: {
    list: '/api/salary',
    create: '/api/salary',
    update: (id: number) => `/api/salary/${id}`,
    delete: (id: number) => `/api/salary/${id}`,
  },
  // 健康检查
  health: '/health',
};

// HTTP客户端工具
export const apiClient = {
  get: async (endpoint: string) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  
  post: async (endpoint: string, data: any) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  
  put: async (endpoint: string, data: any) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  
  delete: async (endpoint: string) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
}; 