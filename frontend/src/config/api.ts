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

// 环境判断和API基础URL配置
const getApiBaseUrl = () => {
  // 优先使用环境变量（Netlify构建时设置）
  if (process.env.REACT_APP_API_BASE_URL) {
    console.log('🔧 使用环境变量 REACT_APP_API_BASE_URL:', process.env.REACT_APP_API_BASE_URL);
    return process.env.REACT_APP_API_BASE_URL;
  }
  
  // 回退到自动检测
  const isProduction = process.env.NODE_ENV === 'production' || 
                      window.location.hostname !== 'localhost';
  
  const environment = isProduction ? 'production' : 'development';
  const config = API_CONFIG[environment];
  
  console.log('🔧 环境检测结果:', {
    NODE_ENV: process.env.NODE_ENV,
    hostname: window.location.hostname,
    isProduction,
    environment,
    baseURL: config.baseURL
  });
  
  return config.baseURL;
};

export const API_BASE_URL = getApiBaseUrl();

// API端点
export const API_ENDPOINTS = {
  // 认证
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    verify: '/api/auth/verify',
    profile: '/api/auth/profile',
    changePassword: '/api/auth/change-password',
    users: '/api/auth/users',
    updateUser: (userId: number) => `/api/auth/users/${userId}`,
    resetPassword: (userId: number) => `/api/auth/reset-password/${userId}`,
    deleteUser: (userId: number) => `/api/auth/users/${userId}`,
  },
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

// HTTP客户端工具 - 添加认证支持
const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const apiClient = {
  get: async (endpoint: string) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        ...getAuthHeaders(),
      },
    });
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
        ...getAuthHeaders(),
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
        ...getAuthHeaders(),
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
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
}; 