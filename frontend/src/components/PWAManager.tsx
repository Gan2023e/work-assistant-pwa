import React, { useState, useEffect } from 'react';
import { notification, Button, Card, Space } from 'antd';
import { 
  WifiOutlined, 
  DownloadOutlined, 
  SyncOutlined,
  CloudServerOutlined,
  MobileOutlined 
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

  useEffect(() => {
    // 检查是否已经是独立模式（已安装）
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);

    // 监听网络状态变化
    const handleOnline = () => {
      setIsOnline(true);
      notification.success({
        message: '网络已连接',
        description: '您现在可以同步最新数据了',
        icon: <WifiOutlined style={{ color: '#52c41a' }} />,
        duration: 3,
      });
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
    const handleSWUpdate = () => {
      notification.info({
        message: '发现新版本',
        description: (
          <div>
            <p>应用有更新可用</p>
            <Button 
              type="primary" 
              size="small" 
              icon={<SyncOutlined />}
              onClick={() => window.location.reload()}
            >
              立即更新
            </Button>
          </div>
        ),
        duration: 0, // 不自动关闭
        key: 'sw-update',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // 检查Service Worker更新
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATE_AVAILABLE') {
          handleSWUpdate();
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isStandalone]);

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