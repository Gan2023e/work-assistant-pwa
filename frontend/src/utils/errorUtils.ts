/**
 * TypeScript安全的错误处理工具函数
 */

export interface SafeError {
  name?: string;
  message?: string;
  code?: string;
}

/**
 * 安全地从未知错误对象中提取错误信息
 * @param error 未知类型的错误对象
 * @returns 安全的错误信息对象
 */
export function getSafeErrorInfo(error: unknown): SafeError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: (error as any).code
    };
  }
  
  if (error && typeof error === 'object') {
    const safeError: SafeError = {};
    
    if ('name' in error && typeof (error as any).name === 'string') {
      safeError.name = (error as any).name;
    }
    
    if ('message' in error && typeof (error as any).message === 'string') {
      safeError.message = (error as any).message;
    }
    
    if ('code' in error && typeof (error as any).code === 'string') {
      safeError.code = (error as any).code;
    }
    
    return safeError;
  }
  
  return {
    message: String(error)
  };
}

/**
 * 生成用户友好的错误信息
 * @param error 未知类型的错误对象
 * @param defaultMessage 默认错误信息
 * @returns 用户友好的错误信息
 */
export function getUserFriendlyErrorMessage(error: unknown, defaultMessage: string = '操作失败'): string {
  const safeError = getSafeErrorInfo(error);
  
  // 网络相关错误
  if (safeError.name === 'TypeError' && safeError.message?.includes('fetch')) {
    return '网络连接失败，请检查网络状态后重试';
  }
  
  if (safeError.name === 'AbortError') {
    return '请求超时，请稍后重试';
  }
  
  // JSON解析错误
  if (safeError.name === 'SyntaxError') {
    return '服务器响应格式错误，请稍后重试';
  }
  
  // 其他网络错误
  if (safeError.message?.includes('Failed to fetch')) {
    return '网络连接失败，请检查网络状态后重试';
  }
  
  if (safeError.message?.includes('NetworkError')) {
    return '网络错误，请检查网络连接';
  }
  
  // 返回具体的错误信息或默认信息
  return safeError.message || defaultMessage;
} 