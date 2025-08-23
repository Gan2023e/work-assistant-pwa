// 弹窗脚本逻辑
document.addEventListener('DOMContentLoaded', function() {
  
  // DOM元素引用
  const elements = {
    loginStatus: document.getElementById('loginStatus'),
    currentPage: document.getElementById('currentPage'),
    pluginStatus: document.getElementById('pluginStatus'),
    refreshButton: document.getElementById('refreshStatus'),
    purchasePageButton: document.getElementById('openPurchasePage'),
    settingsButton: document.getElementById('settings'),
    loading: document.getElementById('loading')
  };
  
  // 初始化
  init();
  
  // 绑定事件
  bindEvents();
  
  // 初始化函数
  async function init() {
    console.log('产品审核助手弹窗已加载');
    await updateStatus();
  }
  
  // 绑定事件监听器
  function bindEvents() {
    elements.refreshButton.addEventListener('click', handleRefreshStatus);
    elements.purchasePageButton.addEventListener('click', handleOpenPurchasePage);
    elements.settingsButton.addEventListener('click', handleOpenSettings);
  }
  
  // 更新状态信息
  async function updateStatus() {
    try {
      showLoading(true);
      
      // 并行获取各种状态信息
      const [currentTab, loginStatus] = await Promise.all([
        getCurrentTab(),
        checkLoginStatus()
      ]);
      
      // 更新当前页面信息
      updateCurrentPageStatus(currentTab);
      
      // 更新登录状态
      updateLoginStatus(loginStatus);
      
      // 更新插件状态
      updatePluginStatus(currentTab);
      
    } catch (error) {
      console.error('更新状态失败:', error);
      updateLoginStatus({ isLoggedIn: false, error: error.message });
    } finally {
      showLoading(false);
    }
  }
  
  // 获取当前标签页信息
  function getCurrentTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0] || null);
      });
    });
  }
  
  // 检查登录状态
  function checkLoginStatus() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CHECK_LOGIN_STATUS' }, (response) => {
        resolve(response || { isLoggedIn: false });
      });
    });
  }
  
  // 更新当前页面状态
  function updateCurrentPageStatus(tab) {
    if (!tab) {
      elements.currentPage.textContent = '未知页面';
      return;
    }
    
    const url = new URL(tab.url);
    const domain = url.hostname;
    const path = url.pathname;
    
    // 判断是否是目标页面
    const isPurchasePage = isPurchaseLinkPage(tab.url, tab.title);
    
    if (isPurchasePage) {
      elements.currentPage.textContent = '采购链接管理 ✓';
      elements.currentPage.style.color = '#2e7d2e';
      elements.currentPage.style.fontWeight = '600';
    } else {
      elements.currentPage.textContent = domain + path;
      elements.currentPage.style.color = '#666';
      elements.currentPage.style.fontWeight = 'normal';
    }
  }
  
  // 判断是否是采购链接页面
  function isPurchaseLinkPage(url, title) {
    const indicators = [
      () => url.includes('purchase'),
      () => url.includes('#/products/purchase'),
      () => title && title.includes('采购链接'),
      () => url.includes('localhost') && url.includes('purchase'),
      () => url.includes('product') && url.includes('link')
    ];
    
    return indicators.some(check => {
      try {
        return check();
      } catch {
        return false;
      }
    });
  }
  
  // 更新登录状态
  function updateLoginStatus(status) {
    const { loginStatus } = elements;
    
    if (status.isLoggedIn) {
      loginStatus.textContent = '已登录';
      loginStatus.className = 'status-badge badge-success';
      
      // 如果有用户信息，显示用户名
      if (status.user && status.user.username) {
        loginStatus.textContent = `已登录 (${status.user.username})`;
      }
    } else {
      loginStatus.textContent = '未登录';
      loginStatus.className = 'status-badge badge-error';
      
      if (status.error) {
        loginStatus.title = `错误: ${status.error}`;
      }
    }
  }
  
  // 更新插件状态
  function updatePluginStatus(tab) {
    const { pluginStatus } = elements;
    
    if (!tab) {
      pluginStatus.textContent = '无法检测';
      pluginStatus.className = 'status-badge badge-error';
      return;
    }
    
    const isPurchasePage = isPurchaseLinkPage(tab.url, tab.title);
    
    if (isPurchasePage) {
      pluginStatus.textContent = '已激活';
      pluginStatus.className = 'status-badge badge-success';
    } else {
      pluginStatus.textContent = '待激活';
      pluginStatus.className = 'status-badge badge-warning';
    }
  }
  
  // 显示/隐藏加载状态
  function showLoading(show) {
    if (show) {
      elements.loading.classList.add('active');
    } else {
      elements.loading.classList.remove('active');
    }
  }
  
  // 处理刷新状态按钮点击
  async function handleRefreshStatus() {
    elements.refreshButton.disabled = true;
    elements.refreshButton.textContent = '刷新中...';
    
    try {
      await updateStatus();
      
      // 显示成功提示
      setTimeout(() => {
        elements.refreshButton.innerHTML = '<span>✅</span> 已刷新';
      }, 100);
      
      // 2秒后恢复按钮状态
      setTimeout(() => {
        elements.refreshButton.innerHTML = '<span>🔄</span> 刷新状态';
        elements.refreshButton.disabled = false;
      }, 2000);
      
    } catch (error) {
      console.error('刷新状态失败:', error);
      
      elements.refreshButton.innerHTML = '<span>❌</span> 刷新失败';
      setTimeout(() => {
        elements.refreshButton.innerHTML = '<span>🔄</span> 刷新状态';
        elements.refreshButton.disabled = false;
      }, 2000);
    }
  }
  
  // 处理打开采购页面按钮点击
  async function handleOpenPurchasePage() {
    try {
      const currentTab = await getCurrentTab();
      
      if (currentTab && isPurchaseLinkPage(currentTab.url, currentTab.title)) {
        // 如果当前就是采购页面，刷新页面
        chrome.tabs.reload(currentTab.id);
        window.close(); // 关闭弹窗
        return;
      }
      
      // 构建采购链接管理页面的URL
      let purchaseUrl = 'http://localhost:3000/#/products/purchase-link';
      
      if (currentTab && currentTab.url) {
        const currentUrl = new URL(currentTab.url);
        // 使用当前页面的协议和域名
        purchaseUrl = `${currentUrl.protocol}//${currentUrl.host}/#/products/purchase-link`;
      }
      
      // 打开或切换到采购页面
      chrome.tabs.create({ url: purchaseUrl }, () => {
        window.close(); // 关闭弹窗
      });
      
    } catch (error) {
      console.error('打开采购页面失败:', error);
      alert('打开页面失败: ' + error.message);
    }
  }
  
  // 处理设置按钮点击
  function handleOpenSettings() {
    // 创建设置界面
    showSettingsModal();
  }
  
  // 显示设置模态框
  function showSettingsModal() {
    // 创建设置模态框
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;
    
    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 12px;
        padding: 24px;
        width: 90%;
        max-width: 400px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      ">
        <h3 style="margin: 0 0 16px 0; color: #333;">插件设置</h3>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; color: #666; font-size: 14px;">
            后端API地址:
          </label>
          <input type="text" id="apiUrlInput" placeholder="http://localhost:3001" 
                 style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; color: #666; font-size: 14px;">
            <input type="checkbox" id="autoCloseTabsInput" style="margin-right: 8px;">
            审核完成后自动关闭标签页
          </label>
        </div>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; color: #666; font-size: 14px;">
            页面加载等待时间 (秒):
          </label>
          <input type="number" id="waitTimeInput" value="3" min="1" max="10"
                 style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button id="cancelSettings" style="
            padding: 8px 16px;
            border: 1px solid #ddd;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          ">取消</button>
          
          <button id="saveSettings" style="
            padding: 8px 16px;
            border: none;
            background: #1677ff;
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          ">保存</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 加载当前设置
    loadCurrentSettings();
    
    // 绑定事件
    document.getElementById('cancelSettings').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    document.getElementById('saveSettings').addEventListener('click', async () => {
      await saveSettings();
      document.body.removeChild(modal);
    });
    
    // 点击外部关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }
  
  // 加载当前设置
  async function loadCurrentSettings() {
    try {
      const settings = await chrome.storage.sync.get(['apiBaseUrl', 'autoCloseTabs', 'waitTime']);
      
      document.getElementById('apiUrlInput').value = settings.apiBaseUrl || 'http://localhost:3001';
      document.getElementById('autoCloseTabsInput').checked = settings.autoCloseTabs !== false;
      document.getElementById('waitTimeInput').value = settings.waitTime || 3;
      
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }
  
  // 保存设置
  async function saveSettings() {
    try {
      const settings = {
        apiBaseUrl: document.getElementById('apiUrlInput').value.trim() || 'http://localhost:3001',
        autoCloseTabs: document.getElementById('autoCloseTabsInput').checked,
        waitTime: parseInt(document.getElementById('waitTimeInput').value) || 3
      };
      
      await chrome.storage.sync.set(settings);
      
      // 显示保存成功提示
      const saveButton = document.getElementById('saveSettings');
      const originalText = saveButton.textContent;
      saveButton.textContent = '已保存 ✓';
      saveButton.style.background = '#52c41a';
      
      setTimeout(() => {
        saveButton.textContent = originalText;
        saveButton.style.background = '#1677ff';
      }, 1500);
      
    } catch (error) {
      console.error('保存设置失败:', error);
      alert('保存失败: ' + error.message);
    }
  }
  
  // 定期更新状态
  setInterval(updateStatus, 30000); // 每30秒更新一次
  
  // 监听来自background的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'STATUS_UPDATE') {
      updateStatus();
    }
  });
  
}); 