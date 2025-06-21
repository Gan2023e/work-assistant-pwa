import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, ConfigProvider } from 'antd';
import type { MenuProps } from 'antd';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import 'antd/dist/reset.css';
import zhCN from 'antd/es/locale/zh_CN';
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

const App: React.FC = () => {
  const location = useLocation();
  const [openKeys, setOpenKeys] = React.useState<string[]>([]);

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
    <ConfigProvider locale={zhCN}>
      <Layout>
        <Header>
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={getSelectedKeys()}
            openKeys={openKeys}
            onOpenChange={onOpenChange}
            items={menuItems}
          />
        </Header>
        <Content style={{ padding: 24 }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/products/purchase" element={<Purchase />} />
            <Route path="/products/listings" element={<Listings />} />
            <Route path="/shipping" element={<ShippingPage />} />
            <Route path="/logistics" element={<LogisticsPage />} />
            <Route path="/season/sku-mapping" element={<SkuMapping />} />
            <Route path="/season/summary" element={<Summary />} />
            <Route path="/season/supplier" element={<Supplier />} />
            <Route path="/salary" element={<SalaryPage />} />
            <Route path="/profit" element={<ProfitPage />} />
          </Routes>
        </Content>
        
        {/* PWA 管理组件 */}
        <PWAManager />
      </Layout>
    </ConfigProvider>
  );
};

const AppWrapper: React.FC = () => (
  <Router>
    <App />
  </Router>
);

export default AppWrapper;
