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
    console.log('🔍 开始检查登录状态...');
    
    // 获取当前活动标签页
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('📑 当前标签页:', tabs);
    
    if (tabs.length === 0) {
      console.log('❌ 无法获取当前标签页');
      return { isLoggedIn: false, error: '无法获取当前标签页' };
    }
    
    const currentTab = tabs[0];
    console.log('🎯 目标标签页:', currentTab.url, 'ID:', currentTab.id);
    
    // 通过content script获取网页中的认证信息
    console.log('🔧 执行脚本获取认证信息...');
    const authInfo = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: () => {
        try {
          console.log('🔍 Content script: 开始检查localStorage...');
          const token = localStorage.getItem('token');
          const user = localStorage.getItem('user');
          
          console.log('🔑 Token存在:', !!token);
          console.log('👤 User存在:', !!user);
          
          if (token && user) {
            try {
              const userData = JSON.parse(user);
              console.log('✅ 用户信息解析成功:', userData.username);
              return {
                token: token,
                user: userData,
                isLoggedIn: true
              };
            } catch (parseError) {
              console.error('❌ 解析用户信息失败:', parseError);
              return { isLoggedIn: false, error: '用户信息解析失败' };
            }
          } else {
            console.log('❌ 未找到认证信息');
            return { isLoggedIn: false, error: '未找到认证信息' };
          }
        } catch (error) {
          console.error('❌ 获取认证信息失败:', error);
          return { isLoggedIn: false, error: error.message };
        }
      }
    });
    
    console.log('📤 脚本执行结果:', authInfo);
    
    if (authInfo && authInfo[0] && authInfo[0].result) {
      const result = authInfo[0].result;
      console.log('📋 认证结果:', result);
      
      if (result.isLoggedIn && result.token) {
        console.log('🔐 开始验证Token...');
        // 验证token是否有效
        const apiBaseUrl = await getApiBaseUrl();
        console.log('🌐 API地址:', apiBaseUrl);
        
        try {
          const verifyResponse = await fetch(`${apiBaseUrl}/api/auth/verify`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${result.token}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('✅ Token验证响应:', verifyResponse.status, verifyResponse.statusText);
          
          if (verifyResponse.ok) {
            console.log('🎉 登录状态验证成功!');
            return {
              isLoggedIn: true,
              user: result.user,
              authToken: result.token
            };
          } else {
            console.log('❌ Token验证失败:', verifyResponse.status);
            return { isLoggedIn: false, error: 'Token验证失败' };
          }
        } catch (verifyError) {
          console.error('❌ Token验证请求失败:', verifyError);
          return { isLoggedIn: false, error: 'Token验证请求失败' };
        }
      } else {
        console.log('❌ 认证信息不完整:', result);
        return result;
      }
    } else {
      console.log('❌ 无法获取认证信息结果');
      return { isLoggedIn: false, error: '无法获取认证信息' };
    }
  } catch (error) {
    console.error('❌ 检查登录状态失败:', error);
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