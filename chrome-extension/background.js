// 后台脚本 - 处理插件核心逻辑
let reviewTasks = new Map(); // 存储审核任务
let isReviewing = false; // 审核状态标识

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 收到消息:', message.type, message.data);
  
  if (message.type === 'START_REVIEW') {
    // 开始审核流程
    startReview(message.data)
      .then(results => {
        console.log('✅ 审核完成:', results);
        sendResponse({ success: true, data: results });
      })
      .catch(error => {
        console.error('❌ 审核失败:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持消息通道开放
  }
  
  if (message.type === 'CONTINUE_REVIEW') {
    // 继续审核下一个产品
    continueReview(message.data)
      .then(results => {
        console.log('✅ 继续审核完成:', results);
        sendResponse({ success: true, data: results });
      })
      .catch(error => {
        console.error('❌ 继续审核失败:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持消息通道开放
  }
  
  if (message.type === 'CHECK_LOGIN_STATUS') {
    // 检查登录状态
    checkLoginStatus()
      .then(status => {
        console.log('✅ 登录状态检查完成:', status);
        sendResponse(status);
      })
      .catch(error => {
        console.error('❌ 登录状态检查失败:', error);
        sendResponse({ isLoggedIn: false, error: error.message });
      });
    return true; // 保持消息通道开放
  }
  
  if (message.type === 'GET_API_BASE_URL') {
    // 获取API基础URL
    getApiBaseUrl()
      .then(url => {
        console.log('✅ API基础URL获取完成:', url);
        sendResponse({ url: url });
      })
      .catch(error => {
        console.error('❌ API基础URL获取失败:', error);
        sendResponse({ error: error.message });
      });
    return true; // 保持消息通道开放
  }
  
  // 其他消息类型
  console.log('❓ 未知消息类型:', message.type);
  sendResponse({ error: '未知消息类型' });
});

// 开始审核流程
async function startReview(reviewData) {
  if (isReviewing) {
    throw new Error('已有审核任务在进行中');
  }
  
  isReviewing = true;
  const { products, authToken } = reviewData;
  
  try {
    // 只处理第一个产品，等待用户点击"下一个"继续
    const product = products[0];
    console.log(`开始审核第一个产品: ${product.parent_sku}`);
    
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
      
      // 显示获取成功的弹窗，包含"下一个"按钮
      await showSourceCodeResult({
        parentSku: product.parent_sku,
        weblink: product.weblink,
        sourceLength: pageSource.length,
        success: true,
        pageSource: pageSource,
        currentIndex: 0,
        totalCount: products.length,
        products: products,
        authToken: authToken
      });
      
      return [{
        ...product,
        success: true,
        sourceLength: pageSource.length,
        saveResult: saveResult
      }];
      
    } catch (error) {
      console.error(`审核产品失败 ${product.parent_sku}:`, error);
      
      // 显示失败弹窗
      await showSourceCodeResult({
        parentSku: product.parent_sku,
        weblink: product.weblink,
        sourceLength: 0,
        success: false,
        pageSource: '',
        currentIndex: 0,
        totalCount: products.length,
        products: products,
        authToken: authToken
      });
      
      return [{
        ...product,
        success: false,
        error: error.message
      }];
    }
    
  } finally {
    isReviewing = false;
  }
}

// 继续审核下一个产品
async function continueReview({ currentIndex, products, authToken }) {
  if (isReviewing) {
    throw new Error('已有审核任务在进行中');
  }

  isReviewing = true;

  try {
    const results = [];
    for (let i = currentIndex; i < products.length; i++) {
      const product = products[i];
      console.log(`继续审核产品 ${i + 1}/${products.length}: ${product.parent_sku}`);

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

        // 显示获取成功的弹窗
        await showSourceCodeResult({
          parentSku: product.parent_sku,
          weblink: product.weblink,
          sourceLength: pageSource.length,
          success: true,
          pageSource: pageSource,
          currentIndex: i,
          totalCount: products.length,
          products: products,
          authToken: authToken
        });

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
        console.error(`继续审核产品失败 ${product.parent_sku}:`, error);
        
        // 显示失败弹窗
        await showSourceCodeResult({
          parentSku: product.parent_sku,
          weblink: product.weblink,
          sourceLength: 0,
          success: false,
          pageSource: '',
          currentIndex: i,
          totalCount: products.length,
          products: products,
          authToken: authToken
        });
        
        results.push({
          ...product,
          success: false,
          error: error.message
        });
      }
    }
    
    // 所有产品审核完成，显示总结
    if (results.length > 0) {
      await showReviewSummary(results);
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
    // 不再更新备注字段，只记录获取时间
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
        sourceLength: pageSource.length,
        updateNotice: false // 不更新备注字段
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

// 显示源代码获取结果弹窗
async function showSourceCodeResult({ parentSku, weblink, sourceLength, success, pageSource, currentIndex, totalCount, products, authToken }) {
  try {
    // 获取当前活动标签页
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return;
    
    const currentTab = tabs[0];
    
    // 在网页中显示弹窗
    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: ({ parentSku, weblink, sourceLength, success, pageSource, currentIndex, totalCount, products, authToken }) => {
        // 创建弹窗元素
        const modal = document.createElement('div');
        modal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow-y: auto;
          padding: 20px;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
          background: white;
          border-radius: 8px;
          padding: 24px;
          max-width: 90%;
          width: 90%;
          max-height: 90vh;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          position: relative;
          overflow-y: auto;
        `;
        
        const icon = success ? '✅' : '❌';
        const title = success ? '源代码获取成功' : '源代码获取失败';
        const bgColor = success ? '#f6ffed' : '#fff2f0';
        const borderColor = success ? '#b7eb8f' : '#ffccc7';
        
        // 进度信息
        const progressInfo = currentIndex !== undefined && totalCount !== undefined ? 
          `<div style="
            background: #e6f7ff;
            border: 1px solid #91d5ff;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 16px;
            text-align: center;
            font-size: 14px;
            color: #1890ff;
          ">
            📊 审核进度: ${currentIndex + 1} / ${totalCount}
          </div>` : '';
        
        content.innerHTML = `
          ${progressInfo}
          <div style="
            background: ${bgColor};
            border: 1px solid ${borderColor};
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 16px;
          ">
            <div style="
              display: flex;
              align-items: center;
              margin-bottom: 12px;
              font-size: 18px;
              font-weight: bold;
              color: ${success ? '#389e0d' : '#cf1322'};
            ">
              ${icon} ${title}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>母SKU:</strong> ${parentSku}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>产品链接:</strong> 
              <a href="${weblink}" target="_blank" style="color: #1890ff; word-break: break-all;">
                ${weblink}
              </a>
            </div>
            ${success ? `
              <div style="margin-bottom: 8px;">
                <strong>源代码长度:</strong> ${sourceLength.toLocaleString()} 字符
              </div>
              <div style="margin-bottom: 8px;">
                <strong>获取时间:</strong> ${new Date().toLocaleString()}
              </div>
            ` : ''}
          </div>
          
          ${success && pageSource ? `
            <div style="margin-bottom: 16px;">
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
              ">
                <strong style="font-size: 14px;">网页源代码：</strong>
                <button id="copySourceCode" style="
                  background: #52c41a;
                  color: white;
                  border: none;
                  padding: 4px 12px;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 12px;
                  margin-left: 8px;
                ">
                  📋 复制源代码
                </button>
              </div>
              <div style="
                background: #f5f5f5;
                border: 1px solid #d9d9d9;
                border-radius: 4px;
                padding: 12px;
                max-height: 400px;
                overflow-y: auto;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                line-height: 1.4;
                white-space: pre-wrap;
                word-break: break-all;
              ">
                ${pageSource}
              </div>
            </div>
          ` : ''}
          
          <div style="text-align: center;">
            ${currentIndex !== undefined && currentIndex < totalCount - 1 ? `
              <button id="nextProduct" style="
                background: #52c41a;
                color: white;
                border: none;
                padding: 8px 24px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                margin-right: 12px;
              ">
                🔄 下一个产品
              </button>
            ` : ''}
            <button id="closeModal" style="
              background: #1890ff;
              color: white;
              border: none;
              padding: 8px 24px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
            ">
              ${currentIndex !== undefined && currentIndex < totalCount - 1 ? '完成审核' : '确定'}
            </button>
          </div>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // 绑定复制源代码事件
        if (success && pageSource) {
          const copyButton = document.getElementById('copySourceCode');
          if (copyButton) {
            copyButton.addEventListener('click', async () => {
              try {
                await navigator.clipboard.writeText(pageSource);
                copyButton.textContent = '✅ 已复制';
                copyButton.style.background = '#52c41a';
                setTimeout(() => {
                  copyButton.textContent = '📋 复制源代码';
                  copyButton.style.background = '#52c41a';
                }, 2000);
              } catch (err) {
                // 降级方案
                const textArea = document.createElement('textarea');
                textArea.value = pageSource;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                copyButton.textContent = '✅ 已复制';
                copyButton.style.background = '#52c41a';
                setTimeout(() => {
                  copyButton.textContent = '📋 复制源代码';
                  copyButton.style.background = '#52c41a';
                }, 2000);
              }
            });
          }
        }
        
        // 绑定下一个产品事件
        if (currentIndex !== undefined && currentIndex < totalCount - 1) {
          const nextButton = document.getElementById('nextProduct');
          if (nextButton) {
            nextButton.addEventListener('click', () => {
              // 关闭当前弹窗
              document.body.removeChild(modal);
              
              // 发送消息给background script继续审核下一个产品
              chrome.runtime.sendMessage({
                type: 'CONTINUE_REVIEW',
                data: {
                  currentIndex: currentIndex + 1,
                  products: products,
                  authToken: authToken
                }
              });
            });
          }
        }
        
        // 绑定关闭事件
        document.getElementById('closeModal').addEventListener('click', () => {
          document.body.removeChild(modal);
        });
        
        // 点击背景关闭
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            document.body.removeChild(modal);
          }
        });
        
        // 按ESC键关闭
        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape' && document.body.contains(modal)) {
            document.body.removeChild(modal);
          }
        });
        
        // 不再自动关闭，让用户手动关闭
      },
      args: [{ parentSku, weblink, sourceLength, success, pageSource, currentIndex, totalCount, products, authToken }]
    });
    
  } catch (error) {
    console.error('显示源代码结果弹窗失败:', error);
  }
}

// 显示审核总结弹窗
async function showReviewSummary(results) {
  try {
    // 获取当前活动标签页
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return;
    
    const currentTab = tabs[0];
    
    // 在网页中显示弹窗
    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: ({ results }) => {
        // 创建弹窗元素
        const modal = document.createElement('div');
        modal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow-y: auto;
          padding: 20px;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
          background: white;
          border-radius: 8px;
          padding: 24px;
          max-width: 90%;
          width: 90%;
          max-height: 90vh;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          position: relative;
          overflow-y: auto;
        `;
        
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;
        const totalSourceLength = results.reduce((sum, r) => sum + (r.sourceLength || 0), 0);
        const avgSourceLength = results.length > 0 ? Math.round(totalSourceLength / results.length) : 0;
        
        content.innerHTML = `
          <div style="
            background: #f6ffed;
            border: 1px solid #b7eb8f;
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 16px;
          ">
            <div style="
              display: flex;
              align-items: center;
              margin-bottom: 12px;
              font-size: 18px;
              font-weight: bold;
              color: #389e0d;
            ">
              🎉 审核总结
            </div>
            <div style="margin-bottom: 8px;">
              <strong>总产品数:</strong> ${results.length}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>成功获取源代码的产品数:</strong> ${successCount}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>失败获取源代码的产品数:</strong> ${failureCount}
            </div>
            <div style="margin-bottom: 8px;">
              <strong>总源代码长度:</strong> ${totalSourceLength.toLocaleString()} 字符
            </div>
            <div style="margin-bottom: 8px;">
              <strong>平均源代码长度:</strong> ${avgSourceLength.toLocaleString()} 字符
            </div>
            <div style="margin-bottom: 8px;">
              <strong>完成时间:</strong> ${new Date().toLocaleString()}
            </div>
          </div>
          
          ${failureCount > 0 ? `
            <div style="
              background: #fff2f0;
              border: 1px solid #ffccc7;
              border-radius: 6px;
              padding: 16px;
              margin-bottom: 16px;
            ">
              <div style="
                display: flex;
                align-items: center;
                margin-bottom: 12px;
                font-size: 16px;
                font-weight: bold;
                color: #cf1322;
              ">
                ❌ 失败详情
              </div>
              ${results.filter(r => !r.success).map(r => `
                <div style="margin-bottom: 4px; color: #cf1322;">
                  • ${r.parent_sku || '未知SKU'}: ${r.error || '未知错误'}
                </div>
              `).join('')}
            </div>
          ` : ''}
          
          <div style="text-align: center;">
            <button id="closeSummaryModal" style="
              background: #1890ff;
              color: white;
              border: none;
              padding: 8px 24px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
            ">
              确定
            </button>
          </div>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // 绑定关闭事件
        document.getElementById('closeSummaryModal').addEventListener('click', () => {
          document.body.removeChild(modal);
        });
        
        // 点击背景关闭
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            document.body.removeChild(modal);
          }
        });
        
        // 按ESC键关闭
        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape' && document.body.contains(modal)) {
            document.body.removeChild(modal);
          }
        });
        
      },
      args: [{ results }]
    });
    
  } catch (error) {
    console.error('显示审核总结弹窗失败:', error);
  }
}

// 工具函数 - 延迟
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 安装时设置默认配置
chrome.runtime.onInstalled.addListener(() => {
  console.log('产品审核助手插件已安装');
}); 