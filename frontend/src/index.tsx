import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { cleanCorruptedStorage, getStorageInfo } from './utils/storageUtils';
import './utils/fetchInterceptor'; // 导入fetch拦截器

// 应用启动前检查和清理存储
console.log('🚀 应用启动，检查本地存储状态...');
const storageInfo = getStorageInfo();
console.log('📊 存储状态:', storageInfo);

if (!storageInfo.userValid || !storageInfo.tokenValid) {
  console.log('⚠️ 检测到存储数据异常，开始清理...');
  const cleaned = cleanCorruptedStorage();
  if (cleaned) {
    console.log('✅ 存储清理完成，应用将以全新状态启动');
  }
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <App />
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// PWA Service Worker 注册
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('PWA: Service Worker 注册成功:', registration.scope);
        
        // 检查更新
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // 新的Service Worker已安装，显示更新提示
                if (window.confirm('发现新版本，点击确定刷新页面以获取最新功能。')) {
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('PWA: Service Worker 注册失败:', error);
      });
  });
}
