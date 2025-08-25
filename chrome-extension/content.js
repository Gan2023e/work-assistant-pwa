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
  
  // 尝试多种方式插入按钮
  function addReviewButton() {
    try {
      // 查找合适的位置插入按钮
      const insertLocation = findButtonInsertLocation();
      if (!insertLocation) {
        console.warn('未找到合适的位置插入新品审核按钮，尝试创建备用方案');
        // 尝试创建备用方案
        return createFallbackButton();
      }
      
      console.log('插入位置信息:', insertLocation);
      
      // 创建新品审核按钮
      reviewButton = createReviewButton();
      
      // 根据插入位置信息插入按钮
      let insertSuccess = false;
      
      try {
        if (insertLocation.position === 'after') {
          // 在"清空"按钮之后插入
          insertLocation.referenceElement.parentNode.insertBefore(
            reviewButton, 
            insertLocation.referenceElement.nextSibling
          );
          console.log('✅ 成功：在"清空"按钮下方插入"新品审核"按钮');
          insertSuccess = true;
        } else {
          // 备用方案：直接添加到容器末尾
          insertLocation.container.appendChild(reviewButton);
          console.log('✅ 备用方案：添加到容器末尾');
          insertSuccess = true;
        }
        
        if (insertSuccess) {
          console.log('新品审核按钮已成功添加到搜索区域');
          
          // 最终验证
          setTimeout(() => {
            console.log('按钮插入完成，功能就绪');
          }, 100);
        }
        
      } catch (error) {
        console.error('插入按钮失败:', error);
        // 尝试备用方案
        createFallbackButton();
      }
      
    } catch (error) {
      console.error('添加新品审核按钮失败:', error);
      // 尝试备用方案
      createFallbackButton();
    }
  }

  // 修复父容器的宽度问题
  function fixParentContainerWidth(container) {
    if (!container) return;
    
    console.log('修复父容器宽度问题...');
    
    // 检查容器本身的宽度设置
    const containerStyle = window.getComputedStyle(container);
    console.log('容器原始样式:', {
      width: containerStyle.width,
      maxWidth: containerStyle.maxWidth,
      minWidth: containerStyle.minWidth,
      display: containerStyle.display,
      flexDirection: containerStyle.flexDirection
    });
    
    // 如果容器设置了100%宽度，修复它
    if (containerStyle.width === '100%' || containerStyle.width === '100vw') {
      console.log('检测到容器宽度为100%，正在修复...');
      
      // 设置容器为内容自适应宽度
      container.style.setProperty('width', 'auto', 'important');
      container.style.setProperty('max-width', 'fit-content', 'important');
      container.style.setProperty('min-width', 'auto', 'important');
      
      // 确保容器不会影响子元素的宽度
      container.style.setProperty('flex-direction', 'row', 'important');
      container.style.setProperty('flex-wrap', 'wrap', 'important');
      container.style.setProperty('gap', '8px', 'important');
      container.style.setProperty('align-items', 'flex-start', 'important');
      container.style.setProperty('justify-content', 'flex-start', 'important');
      
      console.log('容器宽度修复完成');
    }
    
    // 检查父级容器是否也有宽度问题
    let parent = container.parentElement;
    let level = 0;
    
    while (parent && parent !== document.body && level < 3) {
      const parentStyle = window.getComputedStyle(parent);
      
      if (parentStyle.width === '100%' || parentStyle.width === '100vw') {
        console.log(`第${level + 1}级父容器宽度为100%，正在修复...`);
        
        // 修复父容器的宽度
        parent.style.setProperty('width', 'auto', 'important');
        parent.style.setProperty('max-width', 'fit-content', 'important');
        parent.style.setProperty('min-width', 'auto', 'important');
        
        // 确保父容器不会影响子元素的宽度
        if (parentStyle.display === 'flex' || parentStyle.display === 'inline-flex') {
          parent.style.setProperty('flex-direction', 'row', 'important');
          parent.style.setProperty('flex-wrap', 'wrap', 'important');
          parent.style.setProperty('gap', '8px', 'important');
        }
      }
      
      parent = parent.parentElement;
      level++;
    }
    
    console.log('父容器宽度修复完成');
  }
  
  // 创建备用按钮（如果主要插入方式失败）
  function createFallbackButton() {
    console.log('创建备用按钮...');
    
    try {
      // 查找搜索区域
      const searchArea = document.querySelector('textarea[placeholder*="SKU"], textarea[placeholder*="产品链接"]');
      if (!searchArea) {
        console.warn('未找到搜索区域，无法创建备用按钮');
        return;
      }
      
      // 查找搜索区域的父容器
      let searchContainer = searchArea.closest('div[style*="display: flex"]');
      if (!searchContainer) {
        // 向上查找包含搜索元素的容器
        searchContainer = searchArea.parentElement;
        while (searchContainer && searchContainer !== document.body) {
          const style = window.getComputedStyle(searchContainer);
          if (style.display === 'flex') {
            break;
          }
          searchContainer = searchContainer.parentElement;
        }
      }
      
      if (!searchContainer) {
        console.warn('未找到搜索容器，无法创建备用按钮');
        return;
      }
      
      console.log('找到搜索容器，创建备用按钮区域');
      
      // 创建备用按钮区域
      const fallbackArea = document.createElement('div');
      fallbackArea.style.cssText = `
        margin-top: 8px;
        padding: 8px;
        background-color: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      
      // 添加说明文字
      const label = document.createElement('span');
      label.textContent = '🔍 新品审核:';
      label.style.cssText = `
        font-size: 12px;
        color: #6c757d;
        font-weight: 500;
      `;
      
      // 创建按钮
      const button = createReviewButton();
      
      // 组装备用区域
      fallbackArea.appendChild(label);
      fallbackArea.appendChild(button);
      
      // 插入到搜索容器中
      searchContainer.appendChild(fallbackArea);
      
      console.log('✅ 备用按钮区域创建成功');
      reviewButton = button;
      
    } catch (error) {
      console.error('创建备用按钮失败:', error);
    }
  }
  
  // 查找按钮插入位置
  function findButtonInsertLocation() {
    console.log('查找"清空"按钮位置...');
    
    // 查找"清空"按钮
    const clearButton = Array.from(document.querySelectorAll('button')).find(button => {
      return button.textContent && button.textContent.trim() === '清空';
    });
    
    if (!clearButton) {
      console.warn('未找到"清空"按钮');
      return null;
    }
    
    console.log('找到"清空"按钮:', clearButton);
    
    // 查找包含"清空"按钮的父容器
    // 这个容器应该是一个垂直布局的div，包含搜索相关的按钮
    let parentContainer = clearButton.parentElement;
    
    // 向上查找合适的容器（通常是包含搜索区域的容器）
    while (parentContainer && parentContainer !== document.body) {
      const style = window.getComputedStyle(parentContainer);
      
      // 检查是否是垂直布局的容器
      if (style.display === 'flex' && style.flexDirection === 'column') {
        console.log('找到垂直布局容器:', parentContainer);
        console.log('容器样式:', {
          display: style.display,
          flexDirection: style.flexDirection,
          gap: style.gap,
          alignItems: style.alignItems
        });
        
        // 验证这个容器是否包含搜索相关的元素
        const hasSearchElements = parentContainer.querySelector('textarea, input, select');
        if (hasSearchElements) {
          console.log('✅ 确认找到搜索区域容器，将在"清空"按钮下方插入"新品审核"按钮');
          return {
            container: parentContainer,
            referenceElement: clearButton,
            position: 'after'
          };
        }
      }
      
      parentContainer = parentContainer.parentElement;
    }
    
    console.warn('未找到合适的搜索区域容器');
    return null;
  }

  // 创建新品审核按钮
  function createReviewButton() {
    const button = document.createElement('button');
    button.innerHTML = `
      <span style="margin-right: 4px;">🔍</span>
      新品审核
    `;
    
    // 使用更强的样式隔离，避免与网页CSS冲突
    button.style.cssText = `
      /* 重置所有可能的继承样式 */
      all: unset;
      
      /* 基础样式 */
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      box-sizing: border-box !important;
      
      /* 按钮样式 */
      background: #1677ff !important;
      color: white !important;
      border: 1px solid #1677ff !important;
      border-radius: 4px !important;
      padding: 4px 8px !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      height: 24px !important;
      line-height: 16px !important;
      cursor: pointer !important;
      margin-right: 4px !important;
      transition: all 0.3s !important;
      
      /* 字体样式 */
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      text-decoration: none !important;
      white-space: nowrap !important;
      vertical-align: middle !important;
      
      /* 确保按钮可见且不会变成全宽 */
      opacity: 1 !important;
      visibility: visible !important;
      position: relative !important;
      z-index: 1000 !important;
      
      /* 关键：防止按钮变成全宽 */
      width: auto !important;
      max-width: none !important;
      min-width: auto !important;
      flex: 0 0 auto !important;
      flex-shrink: 0 !important;
      flex-grow: 0 !important;
      
      /* 确保按钮在容器中正确对齐 */
      float: none !important;
      clear: none !important;
      overflow: visible !important;
      
      /* 新增：更强的尺寸约束 */
      max-width: 120px !important;
      min-width: 80px !important;
      width: fit-content !important;
      
      /* 确保按钮不会继承父容器的宽度 */
      box-sizing: content-box !important;
      margin-left: 0 !important;
      margin-right: 4px !important;
      margin-top: 0 !important;
      margin-bottom: 0 !important;
      
      /* 防止被CSS Grid或Flexbox影响 */
      grid-column: unset !important;
      grid-row: unset !important;
      order: unset !important;
    `;
    
    // 添加悬停效果
    button.addEventListener('mouseenter', () => {
      button.style.background = '#4096ff !important';
      button.style.borderColor = '#4096ff !important';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.background = '#1677ff !important';
      button.style.borderColor = '#1677ff !important';
    });
    
    // 添加点击事件
    button.addEventListener('click', handleReviewClick);
    
    // 添加调试标识
    button.setAttribute('data-extension-button', 'true');
    button.setAttribute('data-button-type', 'new-product-review');
    
    // 强制重新计算样式
    button.offsetHeight;
    
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
      const confirmed = confirm(`确定要审核 ${selectedProducts.length} 个产品吗？\n\n新的审核流程：\n1. 先审核第一个产品\n2. 点击"下一个产品"继续审核\n3. 可以随时停止审核\n4. 最后显示审核总结`);
      
      if (!confirmed) return;
      
      // 显示进度提示
      showProgressMessage(`开始审核 ${selectedProducts.length} 个产品...\n将逐个审核，请耐心等待`);
      
      // 开始审核流程（只审核第一个产品）
      const results = await startReviewProcess(selectedProducts, loginStatus.authToken);
      
      // 显示结果
      showReviewResults(results);
      
      // 隐藏进度提示
      hideProgressMessage();
      
    } catch (error) {
      console.error('新品审核失败:', error);
      showMessage(`审核失败: ${error.message}`, 'error');
      hideProgressMessage();
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
    // 新的审核流程是分步进行的，这里只显示第一个产品的结果
    if (results.length === 0) {
      showMessage('审核完成，但没有结果数据', 'warning');
      return;
    }
    
    const result = results[0];
    if (result.success) {
      showMessage(`第一个产品审核完成: ${result.parent_sku}`, 'success');
    } else {
      showMessage(`第一个产品审核失败: ${result.parent_sku} - ${result.error}`, 'error');
    }
    
    // 不再自动刷新页面，让用户通过"下一个"按钮继续
    console.log('第一个产品审核完成，等待用户继续...');
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
      white-space: pre-line;
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
    `;
    
    // 添加CSS动画
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    // 移除已存在的进度提示
    const existingProgress = document.getElementById('review-progress');
    if (existingProgress) {
      existingProgress.remove();
    }
    
    document.body.appendChild(progressDiv);
    
    // 10秒后自动隐藏
    setTimeout(() => {
      if (progressDiv.parentNode) {
        progressDiv.remove();
      }
    }, 10000);
  }
  
  // 隐藏进度消息
  function hideProgressMessage() {
    const progressDiv = document.getElementById('review-progress');
    if (progressDiv) {
      progressDiv.remove();
    }
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