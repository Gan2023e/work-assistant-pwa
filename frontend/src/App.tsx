import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Layout, Menu, ConfigProvider, Button, Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
import { DownOutlined, RightOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons';
import 'antd/dist/reset.css';
import zhCN from 'antd/es/locale/zh_CN';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/Auth/LoginPage';
import HomePage from './pages/Home/HomePage';
import Purchase from './pages/Products/PurchaseLink';
import Listings from './pages/Products/Listings';
import ShippingPage from './pages/Shipping/ShippingPage';
import LogisticsPage from './pages/Logistics/LogisticsPage';
import SkuMapping from './pages/Season/SkuMapping';
import Summary from './pages/Season/Summary';
import Supplier from './pages/Season/Supplier';
import SalaryPage from './pages/Salary/SalaryPage';
import ProfitPage from './pages/Profit/ProfitPage';
import PWAManager from './components/PWAManager';

const { Header, Content } = Layout;

// 自定义菜单项，带三角形指示符
const getMenuLabel = (label: string, open: boolean) => (
  <span>
    {label}
    {open ? <DownOutlined style={{ marginLeft: 4, fontSize: 10 }} /> : <RightOutlined style={{ marginLeft: 4, fontSize: 10 }} />}
  </span>
);

const AppContent: React.FC = () => {
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  const [openKeys, setOpenKeys] = React.useState<string[]>([]);

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
      label: `${user?.username} (${user?.role})`,
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
    if (["/season/sku-mapping", "/season/summary", "/season/supplier"].includes(path)) return [path];
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
    { label: <Link to="/shipping">发货需求管理</Link>, key: '/shipping' },
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
              <Purchase />
            </ProtectedRoute>
          } />
          <Route path="/products/listings" element={
            <ProtectedRoute>
              <Listings />
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
