
// API地址配置 - 优先使用环境变量，开发环境默认使用本地地址
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

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
  // 发货需求管理
  shipping: {
    needs: '/api/shipping/needs',
    inventoryStats: '/api/shipping/inventory-stats',
    mergedData: '/api/shipping/merged-data',
    updateNeed: (id: number) => `/api/shipping/needs/${id}`,
    deleteNeed: (id: number) => `/api/shipping/needs/${id}`,
    batchUpdateStatus: '/api/shipping/needs/batch-status',
    health: '/api/shipping/health'
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