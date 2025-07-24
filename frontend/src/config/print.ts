/**
 * 打印服务配置
 * 处理云端部署和本地部署的不同需求
 */

// 检测是否为云端部署
export const isCloudDeployment = (): boolean => {
  return !window.location.hostname.includes('localhost') 
    && !window.location.hostname.includes('127.0.0.1')
    && !window.location.hostname.includes('192.168.');
};

// 获取打印服务URL
export const getPrintServiceUrl = (): string => {
  // 优先使用环境变量
  if (process.env.REACT_APP_PRINT_SERVICE_URL) {
    return process.env.REACT_APP_PRINT_SERVICE_URL;
  }

  // 云端部署时不使用本地地址
  if (isCloudDeployment()) {
    return ''; // 空字符串表示不使用本地打印服务
  }

  // 本地开发默认地址
  return 'http://localhost:3001';
};

// 获取推荐的打印方式
export const getRecommendedPrintMethod = (): 'browser' | 'local' | 'auto' => {
  if (isCloudDeployment()) {
    return 'browser'; // 云端部署推荐浏览器打印
  }
  
  return 'auto'; // 本地部署自动选择
};

// 打印服务配置
export const printConfig = {
  // 服务URL
  serviceUrl: getPrintServiceUrl(),
  
  // 是否为云端部署
  isCloud: isCloudDeployment(),
  
  // 推荐打印方式
  recommendedMethod: getRecommendedPrintMethod(),
  
  // 服务健康检查超时时间
  healthCheckTimeout: isCloudDeployment() ? 3000 : 5000,
  
  // 批量打印间隔时间
  batchPrintDelay: isCloudDeployment() ? 1000 : 500,
  
  // 是否自动关闭打印窗口
  autoClosePrintWindow: true,
  
  // 打印标签尺寸
  labelSize: {
    width: '10cm',
    height: '7cm'
  }
};

// 获取用户友好的部署模式说明
export const getDeploymentModeText = (): {
  mode: string;
  description: string;
  printMethod: string;
} => {
  if (isCloudDeployment()) {
    return {
      mode: '云端模式',
      description: '程序运行在云端服务器，推荐使用浏览器打印',
      printMethod: '浏览器打印（推荐）'
    };
  } else {
    return {
      mode: '本地模式', 
      description: '程序运行在本地环境，支持本地打印服务',
      printMethod: '本地服务 + 浏览器打印'
    };
  }
}; 