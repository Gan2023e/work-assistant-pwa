// API配置
const API_CONFIG = {
  // 开发环境
  development: {
    baseURL: 'http://localhost:3001',
  },
  // 生产环境
  production: {
    baseURL: 'https://your-app-name.railway.app', // 替换为您的Railway URL
  }
};

const environment = process.env.NODE_ENV || 'development';
const config = API_CONFIG[environment as keyof typeof API_CONFIG];

export const API_BASE_URL = config.baseURL;

// API端点
export const API_ENDPOINTS = {
  // 产品链接
  productWeblink: {
    list: '/api/product_weblink',
    create: '/api/product_weblink',
    update: (id: number) => `/api/product_weblink/${id}`,
    delete: (id: number) => `/api/product_weblink/${id}`,
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