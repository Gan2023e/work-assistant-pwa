// 后台脚本 - 处理插件核心逻辑
let reviewTasks = new Map(); // 存储审核任务
let isReviewing = false; // 审核状态标识

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background收到消息:', message);
  
  if (message.type === 'START_REVIEW') {
    startReview(message.data).then(result => {
      sendResponse({ success: true, data: result });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // 保持消息通道开放
  }
  
  if (message.type === 'GET_PAGE_SOURCE') {
    getPageSource(sender.tab.id).then(source => {
      sendResponse({ success: true, source });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (message.type === 'CHECK_LOGIN_STATUS') {
    checkLoginStatus().then(result => {
      sendResponse(result);
    });
    return true;
  }
});

// 开始审核流程
async function startReview(reviewData) {
  if (isReviewing) {
    throw new Error('已有审核任务在进行中');
  }
  
  isReviewing = true;
  const { products, authToken } = reviewData;
  
  try {
    const results = [];
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`开始审核产品 ${i + 1}/${products.length}: ${product.parent_sku}`);
      
      try {
        // 打开产品链接
        const tab = await chrome.tabs.create({
          url: product.weblink,
          active: false
        });
        
        // 等待页面加载
        await waitForPageLoad(tab.id, 5000);
        
        // 获取页面源代码
        const pageSource = await getPageSource(tab.id);
        
        // 发送源代码到后端
        const saveResult = await saveProductSource({
          productId: product.id,
          parentSku: product.parent_sku,
          weblink: product.weblink,
          pageSource: pageSource,
          authToken: authToken
        });
        
        // 关闭标签页
        await chrome.tabs.remove(tab.id);
        
        results.push({
          ...product,
          success: true,
          sourceLength: pageSource.length,
          saveResult: saveResult
        });
        
        // 延迟一段时间避免请求过频
        if (i < products.length - 1) {
          await sleep(2000);
        }
        
      } catch (error) {
        console.error(`审核产品失败 ${product.parent_sku}:`, error);
        results.push({
          ...product,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
    
  } finally {
    isReviewing = false;
  }
}

// 获取页面源代码
async function getPageSource(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.documentElement.outerHTML
    });
    
    if (results && results[0]) {
      return results[0].result;
    }
    throw new Error('无法获取页面源代码');
  } catch (error) {
    console.error('获取页面源代码失败:', error);
    throw error;
  }
}

// 等待页面加载完成
function waitForPageLoad(tabId, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('页面加载超时'));
    }, timeout);
    
    const checkComplete = () => {
      chrome.scripting.executeScript({
        target: { tabId },
        func: () => document.readyState
      }).then(results => {
        if (results && results[0] && results[0].result === 'complete') {
          clearTimeout(timeoutId);
          // 额外等待1秒确保页面完全加载
          setTimeout(resolve, 1000);
        } else {
          setTimeout(checkComplete, 500);
        }
      }).catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
    };
    
    checkComplete();
  });
}

// 保存产品源代码到后端
async function saveProductSource({ productId, parentSku, weblink, pageSource, authToken }) {
  // 获取后端API地址
  const apiBaseUrl = await getApiBaseUrl();
  
  try {
    const response = await fetch(`${apiBaseUrl}/api/product_weblink/save-page-source`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        productId,
        parentSku,
        weblink,
        pageSource: pageSource.substring(0, 50000), // 限制长度避免过大
        sourceLength: pageSource.length
      })
    });
    
    if (!response.ok) {
      throw new Error(`保存失败: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('保存产品源代码失败:', error);
    throw error;
  }
}

// 检查登录状态
async function checkLoginStatus() {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    
    // 尝试获取当前用户信息
    const response = await fetch(`${apiBaseUrl}/api/auth/current-user`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const userData = await response.json();
      return { 
        isLoggedIn: true, 
        user: userData,
        authToken: userData.token || ''
      };
    } else {
      return { isLoggedIn: false };
    }
  } catch (error) {
    console.error('检查登录状态失败:', error);
    return { isLoggedIn: false, error: error.message };
  }
}

// 获取API基础URL
async function getApiBaseUrl() {
  // 首先尝试从storage中获取
  const result = await chrome.storage.sync.get(['apiBaseUrl']);
  if (result.apiBaseUrl) {
    return result.apiBaseUrl;
  }
  
  // 根据当前页面判断环境
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0) {
    const currentUrl = new URL(tabs[0].url);
    
    // 生产环境判断
    if (currentUrl.hostname === 'work-assistant-pwa-production.up.railway.app') {
      return 'https://work-assistant-pwa-production.up.railway.app'; // 生产环境API地址
    }
    
    // 本地开发环境
    if (currentUrl.hostname === 'localhost') {
      return 'http://localhost:3001';
    }
    
    // 其他情况使用当前域名
    return `${currentUrl.protocol}//${currentUrl.host}`;
  }
  
  // 默认使用生产环境地址
  return 'https://work-assistant-pwa-production.up.railway.app';
}

// 工具函数 - 延迟
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 安装时设置默认配置
chrome.runtime.onInstalled.addListener(() => {
  console.log('产品审核助手插件已安装');
}); 