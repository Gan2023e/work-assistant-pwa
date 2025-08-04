/**
 * 本地存储工具函数
 */

// 诊断和修复localStorage问题
export const diagnoseAndFixStorage = () => {
  console.log('🔍 开始诊断localStorage问题...');
  
  try {
    const problems = [];
    const fixes = [];
    
    // 遍历所有localStorage项目
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      const value = localStorage.getItem(key);
      if (!value) continue;
      
      console.log(`检查键: ${key}, 值: ${value}`);
      
      // 检查是否是 "[object Object]" 字符串
      if (value === '[object Object]') {
        problems.push(`发现问题: ${key} = "[object Object]"`);
        localStorage.removeItem(key);
        fixes.push(`已删除损坏的键: ${key}`);
        continue;
      }
      
      // 检查是否是其他对象字符串形式
      if (value.startsWith('[object ') && value.endsWith(']')) {
        problems.push(`发现问题: ${key} = "${value}"`);
        localStorage.removeItem(key);
        fixes.push(`已删除损坏的键: ${key}`);
        continue;
      }
      
      // 对于JSON字符串，尝试解析
      if ((value.startsWith('{') && value.endsWith('}')) || 
          (value.startsWith('[') && value.endsWith(']'))) {
        try {
          JSON.parse(value);
          console.log(`✅ ${key} 格式正确`);
                 } catch (error: any) {
           problems.push(`发现JSON解析错误: ${key}`);
           localStorage.removeItem(key);
           fixes.push(`已删除损坏的JSON键: ${key}`);
         }
      }
    }
    
    console.log('📊 诊断结果:');
    console.log(`发现 ${problems.length} 个问题`);
    console.log(`修复 ${fixes.length} 个问题`);
    
    if (problems.length > 0) {
      console.log('🔧 问题详情:', problems);
      console.log('✅ 修复详情:', fixes);
      return {
        hasProblems: true,
        problems,
        fixes,
        message: `发现并修复了 ${fixes.length} 个localStorage问题`
      };
    } else {
      console.log('✅ localStorage数据正常');
      return {
        hasProblems: false,
        problems: [],
        fixes: [],
        message: 'localStorage数据正常，无需修复'
      };
    }
  } catch (error: any) {
    console.error('❌ 诊断过程中出错:', error);
    return {
      hasProblems: true,
      problems: ['诊断过程出错'],
      fixes: [],
      message: '诊断过程中出现错误: ' + error.message
    };
  }
};

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

// 添加全局storage错误监听
export const setupGlobalStorageErrorHandling = () => {
  // 监听未捕获的Promise拒绝，特别是JSON解析错误
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    
    // 检查是否是localStorage相关的JSON解析错误
    if (error && typeof error === 'object') {
      const errorMessage = error.message || '';
      if (errorMessage.includes('JSON') && 
          (errorMessage.includes('[object Object]') || 
           errorMessage.includes('not valid JSON'))) {
        
        console.warn('🚨 检测到localStorage JSON解析错误，执行修复:', errorMessage);
        
        // 执行诊断和修复
        try {
          const result = diagnoseAndFixStorage();
          if (result.hasProblems) {
            console.log('✅ 已修复localStorage问题:', result.message);
            // 防止错误传播
            event.preventDefault();
          }
        } catch (fixError) {
          console.error('❌ 修复localStorage时出错:', fixError);
        }
      }
    }
  });

  // 监听storage事件
  window.addEventListener('storage', (event) => {
    if (event.newValue && typeof event.newValue === 'string') {
      // 检查是否是损坏的对象字符串
      if (event.newValue === '[object Object]' || 
          event.newValue.startsWith('[object ') && event.newValue.endsWith(']')) {
        console.warn('🚨 检测到损坏的localStorage值，正在清理:', event.key);
        try {
          if (event.key) {
            localStorage.removeItem(event.key);
          }
        } catch (cleanError) {
          console.error('清理损坏的localStorage值时出错:', cleanError);
        }
      }
    }
  });
};

// 强化的清理函数，专门处理模板上传相关的问题
export const cleanStorageForTemplateUpload = () => {
  console.log('🧹 为模板上传清理localStorage...');
  
  try {
    // 先执行常规诊断
    const diagnosisResult = diagnoseAndFixStorage();
    
    // 额外检查可能影响文件上传的存储项
    const suspiciousKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          // 检查是否包含可能干扰上传的数据
          if (key.includes('file') || key.includes('upload') || key.includes('template')) {
            try {
              // 尝试解析JSON，如果失败就标记为可疑
              if ((value.startsWith('{') && value.endsWith('}')) || 
                  (value.startsWith('[') && value.endsWith(']'))) {
                JSON.parse(value);
              }
            } catch (error) {
              suspiciousKeys.push(key);
            }
          }
        }
      }
    }
    
    // 清理可疑的键
    suspiciousKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
        console.log(`🗑️ 已清理可疑的存储键: ${key}`);
      } catch (error) {
        console.warn(`⚠️ 清理键 ${key} 时出错:`, error);
      }
    });
    
    return {
      success: true,
      diagnosisResult,
      cleanedKeys: suspiciousKeys.length,
      message: `完成模板上传前的存储清理，清理了 ${suspiciousKeys.length} 个可疑项目`
    };
    
  } catch (error: any) {
    console.error('❌ 模板上传前清理存储时出错:', error);
    return {
      success: false,
      cleanedKeys: 0,
      error: error.message,
      message: '存储清理失败，但不影响上传功能'
    };
  }
}; 