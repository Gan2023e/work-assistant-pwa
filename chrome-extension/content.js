// 内容脚本 - 在采购链接管理页面注入新品审核功能
(function() {
  'use strict';
  
  let reviewButton = null;
  let isInitialized = false;
  
  // 初始化插件
  function initPlugin() {
    if (isInitialized) return;
    
    // 检查是否是采购链接管理页面
    if (!isPurchaseLinkPage()) return;
    
    console.log('检测到采购链接管理页面，初始化新品审核功能');
    
    // 等待页面完全加载
    waitForPageReady().then(() => {
      addReviewButton();
      isInitialized = true;
    });
  }
  
  // 检查是否是采购链接管理页面
  function isPurchaseLinkPage() {
    // 检查URL路径
    const path = window.location.pathname;
    const hash = window.location.hash;
    
    // 根据实际的路由判断（可能是SPA应用）
    return path.includes('purchase') || hash.includes('purchase') || 
           document.title.includes('采购链接') ||
           document.querySelector('[data-testid="purchase-link-page"]') ||
           document.querySelector('.ant-table-tbody') !== null; // 有表格的页面
  }
  
  // 等待页面准备就绪
  function waitForPageReady() {
    return new Promise((resolve) => {
      const checkReady = () => {
        // 检查是否有表格和批量操作按钮区域
        const table = document.querySelector('.ant-table-tbody');
        const buttonArea = document.querySelector('.ant-space') || 
                          document.querySelector('[class*="button"]') ||
                          document.querySelector('button');
        
        if (table && buttonArea) {
          resolve();
        } else {
          setTimeout(checkReady, 1000);
        }
      };
      checkReady();
    });
  }
  
  // 添加新品审核按钮
  function addReviewButton() {
    try {
      // 查找合适的位置插入按钮
      const insertLocation = findButtonInsertLocation();
      if (!insertLocation) {
        console.warn('未找到合适的位置插入新品审核按钮');
        return;
      }
      
      // 创建新品审核按钮
      reviewButton = createReviewButton();
      
      // 插入按钮
      insertLocation.appendChild(reviewButton);
      
      console.log('新品审核按钮已添加到页面');
      
    } catch (error) {
      console.error('添加新品审核按钮失败:', error);
    }
  }
  
  // 查找按钮插入位置
  function findButtonInsertLocation() {
    // 查找"数据管理"栏
    const dataManagementSection = findDataManagementSection();
    if (dataManagementSection) {
      return dataManagementSection;
    }
    
    // 如果找不到"数据管理"栏，回退到原来的逻辑
    const selectors = [
      '.ant-space', // Ant Design Space组件
      '[class*="toolbar"]',
      '[class*="action"]',
      '[class*="button-group"]',
      '.batch-operations',
      'div:has(button)' // 包含按钮的div
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.querySelector('button')) {
        return element;
      }
    }
    
    // 如果没有找到理想位置，创建一个新的容器
    const table = document.querySelector('.ant-table');
    if (table) {
      const container = document.createElement('div');
      container.style.cssText = `
        margin: 16px 0;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 6px;
        border: 1px solid #d9d9d9;
      `;
      table.parentNode.insertBefore(container, table);
      return container;
    }
    
    return null;
  }

  // 查找"数据管理"栏
  function findDataManagementSection() {
    // 查找包含"数据管理"文字的div
    const dataManagementDivs = Array.from(document.querySelectorAll('div')).filter(div => {
      return div.textContent && div.textContent.includes('数据管理');
    });
    
    if (dataManagementDivs.length > 0) {
      // 找到包含"数据管理"的div后，查找其父级容器中的按钮区域
      for (const div of dataManagementDivs) {
        // 向上查找包含按钮的容器
        let parent = div.parentElement;
        while (parent && parent !== document.body) {
          const buttonContainer = parent.querySelector('.ant-space, [class*="button"], button');
          if (buttonContainer) {
            return buttonContainer;
          }
          parent = parent.parentElement;
        }
      }
    }
    
    return null;
  }

  // 创建新品审核按钮
  function createReviewButton() {
    const button = document.createElement('button');
    button.innerHTML = `
      <span style="margin-right: 4px;">🔍</span>
      新品审核
    `;
    button.style.cssText = `
      background: #1677ff;
      color: white;
      border: 1px solid #1677ff;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 12px;
      cursor: pointer;
      margin-right: 4px;
      transition: all 0.3s;
      font-weight: 500;
      height: 24px;
      line-height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    `;
    
    // 添加悬停效果
    button.addEventListener('mouseenter', () => {
      button.style.background = '#4096ff';
      button.style.borderColor = '#4096ff';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.background = '#1677ff';
      button.style.borderColor = '#1677ff';
    });
    
    // 添加点击事件
    button.addEventListener('click', handleReviewClick);
    
    return button;
  }
  
  // 处理新品审核按钮点击
  async function handleReviewClick() {
    try {
      // 获取选中的产品记录
      const selectedProducts = getSelectedProducts();
      
      if (selectedProducts.length === 0) {
        showMessage('请先勾选要审核的产品记录', 'warning');
        return;
      }
      
      // 检查登录状态
      const loginStatus = await checkLoginStatus();
      if (!loginStatus.isLoggedIn) {
        showMessage('请先登录网页系统后再使用插件功能', 'error');
        return;
      }
      
      // 确认开始审核
      const confirmed = confirm(`确定要审核 ${selectedProducts.length} 个产品吗？\n\n这将：\n1. 批量打开产品链接\n2. 获取网页源代码\n3. 自动关闭链接\n4. 保存审核数据`);
      
      if (!confirmed) return;
      
      // 显示进度提示
      showProgressMessage(`开始审核 ${selectedProducts.length} 个产品...`);
      
      // 开始审核流程
      const results = await startReviewProcess(selectedProducts, loginStatus.authToken);
      
      // 显示结果
      showReviewResults(results);
      
    } catch (error) {
      console.error('新品审核失败:', error);
      showMessage(`审核失败: ${error.message}`, 'error');
    }
  }
  
  // 获取选中的产品记录
  function getSelectedProducts() {
    const selectedProducts = [];
    
    try {
      // 查找表格中选中的行
      const tableBody = document.querySelector('.ant-table-tbody');
      if (!tableBody) return selectedProducts;
      
      const rows = tableBody.querySelectorAll('tr');
      
      rows.forEach(row => {
        const checkbox = row.querySelector('.ant-checkbox-input:checked');
        if (checkbox) {
          // 提取行数据
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            const productData = extractProductData(row, cells);
            if (productData.weblink) {
              selectedProducts.push(productData);
            }
          }
        }
      });
      
      console.log('获取到选中的产品:', selectedProducts);
      return selectedProducts;
      
    } catch (error) {
      console.error('获取选中产品失败:', error);
      return [];
    }
  }
  
  // 从表格行中提取产品数据
  function extractProductData(row, cells) {
    try {
      // 根据表格结构提取数据
      const data = {
        id: null,
        parent_sku: '',
        weblink: ''
      };
      
      // 尝试从各个单元格提取信息
      cells.forEach((cell, index) => {
        const text = cell.textContent.trim();
        const links = cell.querySelectorAll('a');
        
        // 父SKU通常在第一或第二列
        if (index <= 2 && text && !text.includes('http') && text.length < 20) {
          if (!data.parent_sku && /^[A-Z0-9\-_]+$/.test(text)) {
            data.parent_sku = text;
          }
        }
        
        // 产品链接
        if (links.length > 0) {
          for (const link of links) {
            const href = link.href;
            if (href && (href.includes('amazon') || href.includes('ebay') || 
                        href.includes('aliexpress') || href.includes('1688') ||
                        href.includes('taobao') || href.includes('alibaba'))) {
              data.weblink = href;
              break;
            }
          }
        }
      });
      
      // 尝试从行的data属性获取ID
      if (row.dataset.rowKey) {
        data.id = parseInt(row.dataset.rowKey);
      }
      
      return data;
    } catch (error) {
      console.error('提取产品数据失败:', error);
      return { id: null, parent_sku: '', weblink: '' };
    }
  }
  
  // 检查登录状态
  function checkLoginStatus() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'CHECK_LOGIN_STATUS'
      }, (response) => {
        resolve(response || { isLoggedIn: false });
      });
    });
  }
  
  // 开始审核流程
  function startReviewProcess(products, authToken) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'START_REVIEW',
        data: {
          products: products,
          authToken: authToken
        }
      }, (response) => {
        if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || '审核失败'));
        }
      });
    });
  }
  
  // 显示审核结果
  function showReviewResults(results) {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    let message = `审核完成！\n\n`;
    message += `✅ 成功: ${successCount} 个产品\n`;
    if (failureCount > 0) {
      message += `❌ 失败: ${failureCount} 个产品\n\n`;
      message += `失败详情:\n`;
      results.filter(r => !r.success).forEach(r => {
        message += `• ${r.parent_sku}: ${r.error}\n`;
      });
    }
    
    alert(message);
    
    // 刷新页面数据（如果有刷新按钮）
    const refreshButton = document.querySelector('[title*="刷新"]') || 
                         document.querySelector('[aria-label*="刷新"]') ||
                         document.querySelector('button:has([class*="reload"])');
    if (refreshButton) {
      setTimeout(() => refreshButton.click(), 1000);
    }
  }
  
  // 显示消息提示
  function showMessage(text, type = 'info') {
    // 尝试使用页面的消息系统
    if (window.message && typeof window.message.info === 'function') {
      window.message[type](text);
      return;
    }
    
    // 或者使用Ant Design的message
    if (window.antd && window.antd.message) {
      window.antd.message[type](text);
      return;
    }
    
    // 降级到alert
    alert(text);
  }
  
  // 显示进度消息
  function showProgressMessage(text) {
    // 创建进度提示元素
    const progressDiv = document.createElement('div');
    progressDiv.id = 'review-progress';
    progressDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1677ff;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
      font-size: 14px;
      min-width: 200px;
    `;
    progressDiv.innerHTML = `
      <div style="display: flex; align-items: center;">
        <div style="margin-right: 10px;">
          <div style="
            width: 16px;
            height: 16px;
            border: 2px solid #ffffff40;
            border-top: 2px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          "></div>
        </div>
        <div>${text}</div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    
    document.body.appendChild(progressDiv);
    
    // 10秒后自动移除
    setTimeout(() => {
      const element = document.getElementById('review-progress');
      if (element) element.remove();
    }, 10000);
  }
  
  // 页面变化监听
  function watchPageChanges() {
    // 监听DOM变化
    const observer = new MutationObserver((mutations) => {
      let shouldReinit = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // 检查是否有新的表格或按钮区域
          const hasTable = document.querySelector('.ant-table-tbody');
          const hasButton = document.querySelector('[class*="button"]');
          
          if (hasTable && hasButton && !reviewButton) {
            shouldReinit = true;
          }
        }
      });
      
      if (shouldReinit) {
        setTimeout(initPlugin, 1000);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // 监听页面路由变化（SPA应用）
  function watchRouteChanges() {
    let currentPath = window.location.pathname + window.location.hash;
    
    setInterval(() => {
      const newPath = window.location.pathname + window.location.hash;
      if (newPath !== currentPath) {
        currentPath = newPath;
        isInitialized = false;
        reviewButton = null;
        setTimeout(initPlugin, 1000);
      }
    }, 1000);
  }
  
  // 监听来自页面的消息
  window.addEventListener('message', (event) => {
    // 只处理来自同一个窗口的消息
    if (event.source !== window) return;
    
    const message = event.data;
    
    if (message.type === 'CHECK_EXTENSION_AVAILABLE') {
      // 回复插件可用状态
      if (window.extensionCheckCallback) {
        window.extensionCheckCallback(true);
      }
    }
    
    if (message.type === 'START_PRODUCT_REVIEW') {
      handleProductReviewMessage(message);
    }
  });
  
  // 处理产品审核消息
  async function handleProductReviewMessage(message) {
    try {
      const { products } = message;
      
      if (!products || products.length === 0) {
        showMessage('没有要审核的产品', 'warning');
        return;
      }
      
      // 检查登录状态
      const loginStatus = await checkLoginStatus();
      if (!loginStatus.isLoggedIn) {
        showMessage('请先登录网页系统后再使用插件功能', 'error');
        return;
      }
      
      // 开始审核流程
      showProgressMessage(`开始审核 ${products.length} 个产品...`);
      
      const results = await startReviewProcess(products, loginStatus.authToken);
      
      // 显示结果
      showReviewResults(results);
      
    } catch (error) {
      console.error('处理产品审核消息失败:', error);
      showMessage('审核失败: ' + error.message, 'error');
    }
  }
  
  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlugin);
  } else {
    initPlugin();
  }
  
  // 监听页面变化
  watchPageChanges();
  watchRouteChanges();
  
})(); 