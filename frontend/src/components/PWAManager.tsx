import React, { useState, useEffect } from 'react';
import { notification, Button, Card, Space, Modal, Progress } from 'antd';
import { 
  WifiOutlined, 
  DownloadOutlined, 
  SyncOutlined,
  CloudServerOutlined,
  MobileOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAManager: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    // 检查是否已经是独立模式（已安装）
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);

    // 监听网络状态变化
    const handleOnline = () => {
      setIsOnline(true);
      notification.success({
        message: '网络已连接',
        description: '正在检查应用更新...',
        icon: <WifiOutlined style={{ color: '#52c41a' }} />,
        duration: 3,
      });
      // 网络恢复时立即检查更新
      setTimeout(checkForUpdates, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      notification.warning({
        message: '网络已断开',
        description: '应用将在离线模式下继续工作',
        icon: <CloudServerOutlined style={{ color: '#faad14' }} />,
        duration: 5,
      });
    };

    // 监听PWA安装提示事件
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // 延迟显示安装提示，让用户先体验应用
      setTimeout(() => {
        if (!isStandalone) {
          setShowInstallPrompt(true);
        }
      }, 30000); // 30秒后显示
    };

    // 监听应用安装完成
    const handleAppInstalled = () => {
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      notification.success({
        message: '安装成功！',
        description: '工作助手已添加到您的主屏幕',
        icon: <MobileOutlined style={{ color: '#52c41a' }} />,
        duration: 5,
      });
    };

    // 监听Service Worker更新
    const handleSWUpdate = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SW_UPDATE_AVAILABLE') {
        setUpdateAvailable(true);
        setAppVersion(event.data.version || '');
        
        // 显示强制更新模态框
        setShowUpdateModal(true);
        
        // 同时显示通知
        notification.warning({
          message: '发现新版本！',
          description: `应用版本 ${event.data.version} 已发布，包含重要更新`,
          icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
          duration: 0,
          key: 'update-available',
          btn: (
            <Button 
              type="primary" 
              size="small" 
              onClick={() => {
                notification.destroy('update-available');
                setShowUpdateModal(true);
              }}
            >
              立即更新
            </Button>
          ),
        });
      }
    };

    // 定期检查更新
    const checkForUpdates = () => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CHECK_UPDATE'
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // 检查Service Worker更新
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWUpdate);
      
      // 页面加载时检查更新
      setTimeout(checkForUpdates, 2000);
      
      // 定期检查更新（每5分钟）
      const updateCheckInterval = setInterval(checkForUpdates, 5 * 60 * 1000);
      
      return () => {
        clearInterval(updateCheckInterval);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWUpdate);
      }
    };
  }, [isStandalone]);

  const handleForceUpdate = async () => {
    setIsUpdating(true);
    setUpdateProgress(0);
    
    try {
      // 模拟更新进度
      const progressInterval = setInterval(() => {
        setUpdateProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // 清除所有缓存
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }

      // 清除LocalStorage中的缓存数据（保留用户登录信息）
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !key.startsWith('user') && !key.startsWith('token')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // 告诉Service Worker跳过等待
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SKIP_WAITING'
        });
      }

      setUpdateProgress(100);
      
      // 强制刷新页面
      setTimeout(() => {
        window.location.reload();
      }, 500);
      
    } catch (error) {
      console.error('更新失败:', error);
      notification.error({
        message: '更新失败',
        description: '请检查网络连接后重试',
        duration: 5,
      });
      setIsUpdating(false);
      setUpdateProgress(0);
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('用户接受了安装提示');
      } else {
        console.log('用户拒绝了安装提示');
      }
      
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  const handleDismissInstall = () => {
    setShowInstallPrompt(false);
    // 24小时后再次显示
    setTimeout(() => {
      if (deferredPrompt && !isStandalone) {
        setShowInstallPrompt(true);
      }
    }, 24 * 60 * 60 * 1000);
  };

  return (
    <>
      {/* 网络状态指示器 */}
      <div style={{ 
        position: 'fixed', 
        top: 16, 
        right: 16, 
        zIndex: 1000,
        opacity: isOnline ? 0.7 : 1,
        transition: 'opacity 0.3s'
      }}>
        <WifiOutlined 
          style={{ 
            fontSize: 16, 
            color: isOnline ? '#52c41a' : '#ff4d4f',
            background: 'white',
            padding: '4px',
            borderRadius: '50%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }} 
        />
      </div>

      {/* 强制更新模态框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
            应用更新可用
          </div>
        }
        open={showUpdateModal}
        closable={false}
        maskClosable={false}
        footer={null}
        centered
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          {!isUpdating ? (
            <>
              <p style={{ fontSize: 16, marginBottom: 16 }}>
                检测到新版本 <strong>{appVersion}</strong>
              </p>
              <p style={{ color: '#666', marginBottom: 24 }}>
                此更新包含重要的功能改进和安全修复。
                <br />
                为了获得最佳体验，建议立即更新。
              </p>
              <Space>
                <Button 
                  type="primary" 
                  size="large"
                  icon={<ReloadOutlined />}
                  onClick={handleForceUpdate}
                >
                  立即更新
                </Button>
                <Button 
                  size="large"
                  onClick={() => setShowUpdateModal(false)}
                >
                  稍后提醒
                </Button>
              </Space>
            </>
          ) : (
            <>
              <p style={{ fontSize: 16, marginBottom: 16 }}>
                正在更新应用...
              </p>
              <Progress 
                percent={updateProgress} 
                status="active"
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
              <p style={{ color: '#666', marginTop: 16 }}>
                请勿关闭页面，更新完成后将自动刷新
              </p>
            </>
          )}
        </div>
      </Modal>

      {/* 安装提示卡片 */}
      {showInstallPrompt && !isStandalone && (
        <Card
          style={{
            position: 'fixed',
            bottom: 16,
            left: 16,
            right: 16,
            zIndex: 1000,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
          bodyStyle={{ padding: 16 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <MobileOutlined style={{ fontSize: 20, color: '#1890ff', marginRight: 8 }} />
                <strong>安装工作助手PWA</strong>
              </div>
              <p style={{ margin: 0, color: '#666', fontSize: 14 }}>
                添加到主屏幕，获得更快的启动速度和更好的体验
              </p>
            </div>
            <Space>
              <Button size="small" onClick={handleDismissInstall}>
                稍后
              </Button>
              <Button 
                type="primary" 
                size="small" 
                icon={<DownloadOutlined />}
                onClick={handleInstallClick}
              >
                安装
              </Button>
            </Space>
          </div>
        </Card>
      )}
    </>
  );
};

export default PWAManager; 