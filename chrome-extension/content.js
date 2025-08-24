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
      
      // 创建新品审核按钮
      reviewButton = createReviewButton();
      
      // 尝试多种插入方式
      let insertSuccess = false;
      
      // 方式1：直接添加到.ant-space容器末尾
      if (insertLocation.classList.contains('ant-space')) {
        try {
          insertLocation.appendChild(reviewButton);
          console.log('✅ 方式1成功：直接添加到.ant-space容器末尾');
          
          // 验证按钮样式是否正确应用
          if (validateButtonStyles(reviewButton)) {
            insertSuccess = true;
            console.log('✅ 按钮样式验证通过');
          } else {
            console.warn('⚠️ 按钮样式验证失败，尝试修复');
            fixButtonStyles(reviewButton);
            insertSuccess = true;
          }
        } catch (error) {
          console.warn('方式1失败:', error);
        }
      }
      
      // 方式2：如果方式1失败，尝试插入到最后一个按钮之后
      if (!insertSuccess) {
        try {
          const lastButton = insertLocation.querySelector('button:last-child');
          if (lastButton && lastButton.parentNode) {
            lastButton.parentNode.insertBefore(reviewButton, lastButton.nextSibling);
            console.log('✅ 方式2成功：插入到最后一个按钮之后');
            
            if (validateButtonStyles(reviewButton)) {
              insertSuccess = true;
            } else {
              fixButtonStyles(reviewButton);
              insertSuccess = true;
            }
          }
        } catch (error) {
          console.warn('方式2失败:', error);
        }
      }
      
      // 方式3：如果前两种方式都失败，尝试克隆现有按钮并替换
      if (!insertSuccess) {
        try {
          const existingButton = insertLocation.querySelector('button');
          if (existingButton) {
            const buttonWrapper = existingButton.parentNode;
            if (buttonWrapper) {
              buttonWrapper.appendChild(reviewButton);
              console.log('✅ 方式3成功：添加到按钮包装器');
              
              if (validateButtonStyles(reviewButton)) {
                insertSuccess = true;
              } else {
                fixButtonStyles(reviewButton);
                insertSuccess = true;
              }
            }
          }
        } catch (error) {
          console.warn('方式3失败:', error);
        }
      }
      
      if (insertSuccess) {
        console.log('新品审核按钮已成功添加到"数据管理"栏中');
        
        // 最终验证
        setTimeout(() => {
          finalValidation(reviewButton);
        }, 100);
      } else {
        console.error('所有插入方式都失败了，尝试备用方案');
        // 清理创建的按钮
        if (reviewButton && reviewButton.parentNode) {
          reviewButton.parentNode.removeChild(reviewButton);
        }
        // 尝试备用方案
        createFallbackButton();
      }
      
    } catch (error) {
      console.error('添加新品审核按钮失败:', error);
      // 尝试备用方案
      createFallbackButton();
    }
  }

  // 验证按钮样式
  function validateButtonStyles(button) {
    const computedStyle = window.getComputedStyle(button);
    
    // 检查关键样式属性
    const isCorrectWidth = computedStyle.width === 'auto' || parseInt(computedStyle.width) < 200;
    const isCorrectDisplay = computedStyle.display === 'inline-flex' || computedStyle.display === 'inline-block';
    const isCorrectBackground = computedStyle.backgroundColor.includes('rgb(22, 119, 255)');
    
    console.log('按钮样式验证:', {
      width: computedStyle.width,
      display: computedStyle.display,
      backgroundColor: computedStyle.backgroundColor,
      isCorrectWidth,
      isCorrectDisplay,
      isCorrectBackground
    });
    
    return isCorrectWidth && isCorrectDisplay && isCorrectBackground;
  }

  // 修复按钮样式
  function fixButtonStyles(button) {
    console.log('修复按钮样式...');
    
    // 强制应用正确的样式
    button.style.setProperty('width', 'auto', 'important');
    button.style.setProperty('display', 'inline-flex', 'important');
    button.style.setProperty('flex', '0 0 auto', 'important');
    button.style.setProperty('max-width', 'none', 'important');
    
    // 检查父容器是否影响了按钮样式
    const parent = button.parentElement;
    if (parent && parent.classList.contains('ant-space')) {
      // 确保父容器不会强制子元素全宽
      parent.style.setProperty('align-items', 'flex-start', 'important');
      parent.style.setProperty('justify-content', 'flex-start', 'important');
    }
    
    console.log('按钮样式修复完成');
  }

  // 最终验证
  function finalValidation(button) {
    console.log('执行最终验证...');
    
    const computedStyle = window.getComputedStyle(button);
    const buttonRect = button.getBoundingClientRect();
    
    console.log('按钮最终状态:', {
      width: computedStyle.width,
      height: computedStyle.height,
      display: computedStyle.display,
      position: computedStyle.position,
      rect: {
        width: buttonRect.width,
        height: buttonRect.height,
        top: buttonRect.top,
        left: buttonRect.left
      }
    });
    
    // 如果按钮仍然太宽，尝试更激进的修复
    if (buttonRect.width > 200) {
      console.warn('按钮仍然太宽，尝试激进修复');
      aggressiveStyleFix(button);
    }
  }

  // 激进样式修复
  function aggressiveStyleFix(button) {
    console.log('执行激进样式修复...');
    
    // 创建新的按钮元素，完全隔离样式
    const newButton = document.createElement('button');
    newButton.innerHTML = button.innerHTML;
    newButton.setAttribute('data-extension-button', 'true');
    newButton.setAttribute('data-button-type', 'new-product-review');
    
    // 应用完全隔离的样式
    newButton.style.cssText = `
      all: unset !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
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
      width: auto !important;
      max-width: none !important;
      flex: 0 0 auto !important;
      position: relative !important;
      z-index: 1000 !important;
    `;
    
    // 添加事件监听器
    newButton.addEventListener('click', handleReviewClick);
    newButton.addEventListener('mouseenter', () => {
      newButton.style.background = '#4096ff !important';
      newButton.style.borderColor = '#4096ff !important';
    });
    newButton.addEventListener('mouseleave', () => {
      newButton.style.background = '#1677ff !important';
      newButton.style.borderColor = '#1677ff !important';
    });
    
    // 替换原按钮
    if (button.parentNode) {
      button.parentNode.replaceChild(newButton, button);
      reviewButton = newButton;
      console.log('✅ 激进样式修复完成，按钮已替换');
    }
  }
  
  // 创建备用按钮方案
  function createFallbackButton() {
    try {
      console.log('创建备用按钮方案...');
      
      // 查找"数据管理"栏
      const dataManagementDivs = Array.from(document.querySelectorAll('div')).filter(div => {
        return div.textContent && div.textContent.includes('数据管理');
      });
      
      if (dataManagementDivs.length > 0) {
        const dataManagementDiv = dataManagementDivs[0];
        const parentContainer = dataManagementDiv.parentElement;
        
        if (parentContainer) {
          // 在"数据管理"栏后面创建一个新的按钮区域
          const fallbackContainer = document.createElement('div');
          fallbackContainer.style.cssText = `
            padding: 8px;
            background-color: #f8f9fa;
            border-radius: 6px;
            border: 1px solid #e9ecef;
            margin-top: 8px;
            margin-bottom: 16px;
          `;
          
          const titleDiv = document.createElement('div');
          titleDiv.style.cssText = `
            fontWeight: bold;
            marginBottom: 8px;
            color: #495057;
            fontSize: 13px;
          `;
          titleDiv.textContent = '🔍 新品审核';
          
          const buttonDiv = document.createElement('div');
          buttonDiv.style.cssText = `
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          `;
          
          const reviewButton = createReviewButton();
          buttonDiv.appendChild(reviewButton);
          
          fallbackContainer.appendChild(titleDiv);
          fallbackContainer.appendChild(buttonDiv);
          
          // 插入到"数据管理"栏的父容器中
          parentContainer.appendChild(fallbackContainer);
          
          console.log('✅ 备用方案成功：创建了新的按钮区域');
          return true;
        }
      }
      
      console.error('备用方案也失败了');
      return false;
      
    } catch (error) {
      console.error('创建备用方案失败:', error);
      return false;
    }
  }
  
  // 查找按钮插入位置
  function findButtonInsertLocation() {
    // 查找"数据管理"栏
    const dataManagementSection = findDataManagementSection();
    if (dataManagementSection) {
      console.log('找到"数据管理"栏，将在其中插入新品审核按钮');
      return dataManagementSection;
    }
    
    // 如果找不到"数据管理"栏，记录警告但不创建新容器
    console.warn('未找到"数据管理"栏，无法插入新品审核按钮');
    return null;
  }

  // 查找"数据管理"栏
  function findDataManagementSection() {
    // 查找包含"数据管理"文字的div
    const dataManagementDivs = Array.from(document.querySelectorAll('div')).filter(div => {
      return div.textContent && div.textContent.includes('数据管理');
    });
    
    if (dataManagementDivs.length > 0) {
      console.log(`找到 ${dataManagementDivs.length} 个包含"数据管理"的div`);
      
      // 找到包含"数据管理"的div后，查找其父级容器中的按钮区域
      for (const div of dataManagementDivs) {
        console.log('检查包含"数据管理"的div:', div);
        
        // 方法1：直接在同级或子级查找.ant-space容器
        let buttonContainer = div.parentElement.querySelector('.ant-space');
        if (buttonContainer) {
          console.log('在同级找到.ant-space容器:', buttonContainer);
          return buttonContainer;
        }
        
        // 方法2：向上查找包含按钮的容器
        let parent = div.parentElement;
        let level = 0;
        
        while (parent && parent !== document.body && level < 5) {
          console.log(`检查第${level + 1}级父元素:`, parent.tagName, parent.className);
          
          // 优先查找.ant-space容器，这是Ant Design的按钮组容器
          buttonContainer = parent.querySelector('.ant-space');
          if (buttonContainer) {
            console.log('找到.ant-space容器:', buttonContainer);
            return buttonContainer;
          }
          
          // 如果没有找到.ant-space，查找其他包含按钮的容器
          const fallbackContainer = parent.querySelector('[class*="button"], button');
          if (fallbackContainer) {
            console.log('找到备用按钮容器:', fallbackContainer);
            return fallbackContainer;
          }
          
          parent = parent.parentElement;
          level++;
        }
      }
    } else {
      console.warn('页面中未找到包含"数据管理"文字的div');
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