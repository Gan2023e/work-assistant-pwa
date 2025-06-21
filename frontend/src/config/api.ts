// API基础URL配置 - 统一使用生产环境Railway后端
const PRODUCTION_API_URL = 'https://work-assistant-pwa-production.up.railway.app';

// 获取API基础URL
const getApiBaseUrl = () => {
  // 优先使用环境变量（Netlify构建时设置）
  if (process.env.REACT_APP_API_BASE_URL) {
    console.log('🔧 使用环境变量 REACT_APP_API_BASE_URL:', process.env.REACT_APP_API_BASE_URL);
    return process.env.REACT_APP_API_BASE_URL;
  }
  
  // 默认使用生产环境Railway后端
  console.log('🔧 使用默认生产环境API:', PRODUCTION_API_URL);
  console.log('🔧 当前环境信息:', {
    NODE_ENV: process.env.NODE_ENV,
    hostname: window.location.hostname,
    timestamp: new Date().toISOString()
  });
  
  return PRODUCTION_API_URL;
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