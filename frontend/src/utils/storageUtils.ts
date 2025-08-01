/**
 * 本地存储工具函数
 */

// 清理损坏的 localStorage 数据
export const cleanCorruptedStorage = () => {
  try {
    console.log('🧹 开始清理 localStorage...');
    
    const keysToCheck = ['user', 'token'];
    let cleanedCount = 0;
    
    keysToCheck.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        if (key === 'user') {
          try {
            JSON.parse(value);
            console.log(`✅ ${key} 数据格式正确`);
          } catch (error) {
            console.warn(`⚠️ ${key} 数据损坏，正在清除:`, value);
            localStorage.removeItem(key);
            cleanedCount++;
          }
        } else if (key === 'token') {
          if (typeof value === 'string' && value.length > 0) {
            console.log(`✅ ${key} 数据格式正确`);
          } else {
            console.warn(`⚠️ ${key} 数据损坏，正在清除:`, value);
            localStorage.removeItem(key);
            cleanedCount++;
          }
        }
      }
    });
    
    if (cleanedCount > 0) {
      console.log(`✅ 清理完成，清除了 ${cleanedCount} 个损坏项目`);
      return true;
    } else {
      console.log('✅ localStorage 数据正常，无需清理');
      return false;
    }
  } catch (error) {
    console.error('❌ 清理 localStorage 时出错:', error);
    return false;
  }
};

// 安全获取 JSON 数据
export const safeGetJSON = (key: string, defaultValue: any = null) => {
  try {
    const value = localStorage.getItem(key);
    if (!value) return defaultValue;
    return JSON.parse(value);
  } catch (error) {
    console.error(`解析 ${key} 失败:`, error);
    localStorage.removeItem(key);
    return defaultValue;
  }
};

// 安全设置 JSON 数据
export const safeSetJSON = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`保存 ${key} 失败:`, error);
    return false;
  }
};

// 获取存储状态信息
export const getStorageInfo = () => {
  const info = {
    hasToken: !!localStorage.getItem('token'),
    hasUser: !!localStorage.getItem('user'),
    userValid: false,
    tokenValid: false,
    storageSize: 0
  };
  
  // 检查用户数据有效性
  try {
    const user = localStorage.getItem('user');
    if (user) {
      JSON.parse(user);
      info.userValid = true;
    }
  } catch (error) {
    info.userValid = false;
  }
  
  // 检查 token 有效性
  const token = localStorage.getItem('token');
  info.tokenValid = !!(token && typeof token === 'string' && token.length > 0);
  
  // 计算存储大小
  try {
    let size = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        size += localStorage[key].length;
      }
    }
    info.storageSize = size;
  } catch (error) {
    info.storageSize = -1;
  }
  
  return info;
}; 