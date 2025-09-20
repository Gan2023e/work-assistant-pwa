import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, ConfigProvider } from 'antd';
import 'antd/dist/reset.css';
import zhCN from 'antd/es/locale/zh_CN';
import { AuthProvider } from './contexts/AuthContext';
import { TaskProvider, useTaskContext } from './contexts/TaskContext';
import BackgroundTaskManager from './components/BackgroundTaskManager';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/Auth/LoginPage';
import HomePage from './pages/Home/HomePage';
import Purchase from './pages/Products/PurchaseLink';
import ListingsWithTabs from './pages/Products/ListingsWithTabs';
import PurchaseInvoice from './pages/Products/PurchaseInvoice';
import ShippingPage from './pages/Shipping/ShippingPage';
import OrderManagementPage from './pages/Shipping/OrderManagementPage';
import ShipmentHistoryPage from './pages/Shipping/ShipmentHistoryPage';
import LogisticsPage from './pages/Logistics/LogisticsPage';
import Summary from './pages/Inventory/Summary';
import FbaInventory from './pages/Inventory/FbaInventory';
import InventoryManagement from './pages/Inventory/InventoryManagement';
import SalaryPage from './pages/Salary/SalaryPage';
import ProfitPage from './pages/Profit/ProfitPage';
import UserManagePage from './pages/User/UserManagePage';
import ProfilePage from './pages/User/ProfilePage';
import PWAManager from './components/PWAManager';

const { Content } = Layout;

// 全局任务管理器组件
const GlobalTaskManager: React.FC = () => {
  const { tasks, removeTask } = useTaskContext();
  
  return (
    <BackgroundTaskManager
      tasks={tasks}
      onRemoveTask={removeTask}
    />
  );
};

const AppContent: React.FC = () => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content style={{ padding: 0 }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
              <ListingsWithTabs />
            </ProtectedRoute>
          } />
          <Route path="/products/purchase-invoice" element={
            <ProtectedRoute>
              <PurchaseInvoice />
            </ProtectedRoute>
          } />
          <Route path="/shipping/orders" element={
            <ProtectedRoute>
              <OrderManagementPage />
            </ProtectedRoute>
          } />
          <Route path="/shipping/management" element={
            <ProtectedRoute>
              <ShippingPage />
            </ProtectedRoute>
          } />
          <Route path="/shipping/history" element={
            <ProtectedRoute>
              <ShipmentHistoryPage />
            </ProtectedRoute>
          } />
          <Route path="/logistics" element={
            <ProtectedRoute>
              <LogisticsPage />
            </ProtectedRoute>
          } />
          <Route path="/inventory/management" element={
            <ProtectedRoute>
              <InventoryManagement />
            </ProtectedRoute>
          } />
          <Route path="/inventory/summary" element={
            <ProtectedRoute>
              <Summary />
            </ProtectedRoute>
          } />
          <Route path="/inventory/fba-inventory" element={
            <ProtectedRoute>
              <FbaInventory />
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
      
      {/* 全局后台任务管理器 */}
      <GlobalTaskManager />
    </Layout>
  );
};

const App: React.FC = () => (
  <ConfigProvider locale={zhCN}>
    <AuthProvider>
      <TaskProvider>
        <Router>
          <AppContent />
        </Router>
      </TaskProvider>
    </AuthProvider>
  </ConfigProvider>
);

export default App;
