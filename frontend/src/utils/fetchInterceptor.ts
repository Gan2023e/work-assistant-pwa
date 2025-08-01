// Fetch拦截器 - 用于全局处理认证错误
const originalFetch = window.fetch;

// 定义需要拦截的API路径模式
const API_PATTERNS = ['/api/', process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001'];

// 错误处理函数
const handleAuthError = (error: any) => {
  console.error('🚨 API请求错误:', error);
  
  // 检查是否是认证相关错误
  if (error?.message?.includes('user_id') || 
      error?.message?.includes('not valid JSON') ||
      error?.status === 401 ||
      error?.status === 403) {
    
    console.log('🔐 检测到认证错误，清理本地存储...');
    
    // 清理localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // 触发页面刷新以重新加载应用
    if (!window.location.pathname.includes('/login')) {
      console.log('🔄 重定向到登录页面...');
      window.location.href = '/login';
    }
  }
};

// 增强的fetch函数
window.fetch = async function(...args: Parameters<typeof fetch>): Promise<Response> {
  const [input, init] = args;
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
  
  // 检查是否是API请求
  const isApiRequest = API_PATTERNS.some(pattern => url.includes(pattern));
  
  if (isApiRequest) {
    try {
      // 获取token并添加到请求头
      const token = localStorage.getItem('token');
      const headers = new Headers(init?.headers || {});
      
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      
      // 执行原始fetch
      const response = await originalFetch(input, {
        ...init,
        headers
      });
      
      // 检查响应状态
      if (response.status === 401 || response.status === 403) {
        // 尝试读取错误信息
        try {
          const errorData = await response.clone().json();
          if (errorData?.message?.includes('user_id')) {
            handleAuthError({ status: response.status, message: errorData.message });
          }
        } catch (e) {
          // 忽略JSON解析错误
        }
      }
      
      return response;
    } catch (error) {
      // 处理网络错误
      handleAuthError(error);
      throw error;
    }
  }
  
  // 非API请求，直接调用原始fetch
  return originalFetch(...args);
};

// 添加全局错误监听器
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  if (error?.message?.includes('user_id') || 
      error?.message?.includes('not valid JSON')) {
    handleAuthError(error);
  }
});

export { handleAuthError }; 