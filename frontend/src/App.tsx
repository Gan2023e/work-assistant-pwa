import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Layout, Menu, ConfigProvider, Button, Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
import { DownOutlined, RightOutlined, UserOutlined, LogoutOutlined, SettingOutlined, TeamOutlined, AppstoreOutlined, FileTextOutlined, HistoryOutlined, FileExcelOutlined, UnorderedListOutlined } from '@ant-design/icons';
import 'antd/dist/reset.css';
import zhCN from 'antd/es/locale/zh_CN';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/Auth/LoginPage';
import HomePage from './pages/Home/HomePage';
import Purchase from './pages/Products/PurchaseLink';
import Listings from './pages/Products/Listings';
import ShippingPage from './pages/Shipping/ShippingPage';
import OrderManagementPage from './pages/Shipping/OrderManagementPage';
import ShipmentHistoryPage from './pages/Shipping/ShipmentHistoryPage';
import LogisticsPage from './pages/Logistics/LogisticsPage';
import SkuMapping from './pages/Season/SkuMapping';
import Summary from './pages/Season/Summary';
import Supplier from './pages/Season/Supplier';
import SalaryPage from './pages/Salary/SalaryPage';
import ProfitPage from './pages/Profit/ProfitPage';
import UserManagePage from './pages/User/UserManagePage';
import ProfilePage from './pages/User/ProfilePage';
import PWAManager from './components/PWAManager';

const { Header, Sider, Content } = Layout;

// 自定义菜单项，带三角形指示符
const getMenuLabel = (label: string, open: boolean) => (
  <span>
    {label}
    {open ? <DownOutlined style={{ marginLeft: 4, fontSize: 10 }} /> : <RightOutlined style={{ marginLeft: 4, fontSize: 10 }} />}
  </span>
);

// 新增：通用左侧功能栏布局组件
const LayoutWithSidebar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  // 侧边栏菜单项（可根据当前路由动态调整）
  const sideMenuItems = [
    { key: '/shipping/management', icon: <AppstoreOutlined />, label: <Link to="/shipping/management">发货操作</Link> },
    { key: '/shipping/orders', icon: <UnorderedListOutlined />, label: <Link to="/shipping/orders">需求单管理</Link> },
    { key: '/shipping/history', icon: <HistoryOutlined />, label: <Link to="/shipping/history">发货历史</Link> },
    { key: '/shipping/template', icon: <SettingOutlined />, label: <span>模板管理</span> },
    { key: '/shipping/packing-list', icon: <FileExcelOutlined />, label: <span>装箱表管理</span> },
  ];
  // 侧边栏高亮
  const selectedKey = sideMenuItems.find(item => location.pathname.startsWith(item.key))?.key || '/shipping/management';
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          style={{ height: '100%', borderRight: 0 }}
          items={sideMenuItems}
        />
      </Sider>
      <Layout>
        <Content style={{ padding: 24, minHeight: 280 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

const AppContent: React.FC = () => {
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  // 添加调试信息
  console.log('Current user:', user);
  console.log('User role:', user?.role);
  console.log('Is admin:', user?.role === 'admin');

  // 如果未登录且不在登录页面，重定向到登录页
  if (!isAuthenticated && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  // 如果已登录且在登录页面，重定向到主页
  if (isAuthenticated && location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  // 登录页面不显示导航
  if (location.pathname === '/login') {
    return <LoginPage />;
  }

  const handleLogout = () => {
    logout();
    message.success('已退出登录');
  };

  // 用户菜单
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: <Link to="/profile">个人资料</Link>,
    },
    {
      type: 'divider',
    },
    {
      key: 'user-info',
      icon: <UserOutlined />,
      label: `${user?.username} (${user?.role === 'admin' ? '管理员' : '普通用户'})`,
      disabled: true,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  // 处理主菜单和子菜单的选中状态
  const getSelectedKeys = () => {
    const path = location.pathname;
    if (["/products/purchase", "/products/listings"].includes(path)) return [path];
    if (["/shipping/orders", "/shipping/management", "/shipping/history"].includes(path)) return [path];
    if (["/season/sku-mapping", "/season/summary", "/season/supplier"].includes(path)) return [path];
    if (["/user-manage", "/profile"].includes(path)) return [path];
    return [path];
  };

  // 菜单项定义，动态渲染三角形
  const menuItems: MenuProps['items'] = [
    { label: <Link to="/">主页</Link>, key: '/' },
    {
      label: getMenuLabel('产品管理', openKeys.includes('products')),
      key: 'products',
      children: [
        { label: <Link to="/products/purchase">采购链接管理</Link>, key: '/products/purchase' },
        { label: <Link to="/products/listings">在线Listings管理</Link>, key: '/products/listings' },
      ],
    },
    {
      label: getMenuLabel('发货管理', openKeys.includes('shipping')),
      key: 'shipping',
      children: [
        { label: <Link to="/shipping/orders">需求单管理</Link>, key: '/shipping/orders' },
        { label: <Link to="/shipping/management">发货操作</Link>, key: '/shipping/management' },
        { label: <Link to="/shipping/history">发货历史</Link>, key: '/shipping/history' },
      ],
    },
    { label: <Link to="/logistics">头程物流管理</Link>, key: '/logistics' },
    {
      label: getMenuLabel('亚马逊旺季备货', openKeys.includes('season')),
      key: 'season',
      children: [
        { label: <Link to="/season/sku-mapping">SKU映射管理</Link>, key: '/season/sku-mapping' },
        { label: <Link to="/season/summary">旺季备货汇总</Link>, key: '/season/summary' },
        { label: <Link to="/season/supplier">厂家发货与付款</Link>, key: '/season/supplier' },
      ],
    },
    { label: <Link to="/salary">临工工资结算</Link>, key: '/salary' },
    { label: <Link to="/profit">直发小包利润分析</Link>, key: '/profit' },
    {
      label: <Link to="/user-manage">用户管理</Link>, 
      key: '/user-manage',
      icon: <TeamOutlined />
    },
  ];

  // 控制下拉菜单展开收起
  const onOpenChange = (keys: string[]) => {
    setOpenKeys(keys);
  };

  return (
    <Layout>
      <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={getSelectedKeys()}
          openKeys={openKeys}
          onOpenChange={onOpenChange}
          items={menuItems}
          style={{ flex: 1, border: 'none' }}
        />
        
        <Dropdown 
          menu={{ items: userMenuItems }} 
          placement="bottomRight"
          trigger={['click']}
        >
          <Button 
            type="text" 
            style={{ color: 'white' }}
            icon={<UserOutlined />}
          >
            {user?.username}
          </Button>
        </Dropdown>
      </Header>
      
      <Content style={{ padding: 24 }}>
        <Routes>
          <Route path="/" element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } />
          <Route path="/products/purchase" element={
            <ProtectedRoute>
              <LayoutWithSidebar>
                <Purchase />
              </LayoutWithSidebar>
            </ProtectedRoute>
          } />
          <Route path="/products/listings" element={
            <ProtectedRoute>
              <LayoutWithSidebar>
                <Listings />
              </LayoutWithSidebar>
            </ProtectedRoute>
          } />
          <Route path="/shipping/orders" element={
            <ProtectedRoute>
              <LayoutWithSidebar>
                <OrderManagementPage />
              </LayoutWithSidebar>
            </ProtectedRoute>
          } />
          <Route path="/shipping/management" element={
            <ProtectedRoute>
              <LayoutWithSidebar>
                <ShippingPage />
              </LayoutWithSidebar>
            </ProtectedRoute>
          } />
          <Route path="/shipping/history" element={
            <ProtectedRoute>
              <LayoutWithSidebar>
                <ShipmentHistoryPage />
              </LayoutWithSidebar>
            </ProtectedRoute>
          } />
          <Route path="/shipping" element={
            <ProtectedRoute>
              <ShippingPage />
            </ProtectedRoute>
          } />
          <Route path="/logistics" element={
            <ProtectedRoute>
              <LogisticsPage />
            </ProtectedRoute>
          } />
          <Route path="/season/sku-mapping" element={
            <ProtectedRoute>
              <SkuMapping />
            </ProtectedRoute>
          } />
          <Route path="/season/summary" element={
            <ProtectedRoute>
              <Summary />
            </ProtectedRoute>
          } />
          <Route path="/season/supplier" element={
            <ProtectedRoute>
              <Supplier />
            </ProtectedRoute>
          } />
          <Route path="/salary" element={
            <ProtectedRoute>
              <SalaryPage />
            </ProtectedRoute>
          } />
          <Route path="/profit" element={
            <ProtectedRoute>
              <ProfitPage />
            </ProtectedRoute>
          } />
          <Route path="/user-manage" element={
            <ProtectedRoute>
              <UserManagePage />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } />
        </Routes>
      </Content>
      
      {/* PWA 管理组件 */}
      <PWAManager />
    </Layout>
  );
};

const App: React.FC = () => (
  <ConfigProvider locale={zhCN}>
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  </ConfigProvider>
);

export default App;
