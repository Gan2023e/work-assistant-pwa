import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Space, Divider, Button, Alert, Tag } from 'antd';
import { 
  ShoppingCartOutlined, 
  TruckOutlined, 
  DollarOutlined, 
  BarChartOutlined,
  InboxOutlined,
  SettingOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import { apiClient, API_ENDPOINTS } from '../../config/api';

const { Title, Paragraph } = Typography;

const HomePage: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [backendInfo, setBackendInfo] = useState<any>(null);

  // 测试API连接
  const testApiConnection = async () => {
    setApiStatus('loading');
    try {
      // 测试健康检查
      const healthResponse = await apiClient.get(API_ENDPOINTS.health);
      console.log('Health check:', healthResponse);
      
      // 测试根路径
      const rootResponse = await apiClient.get('/');
      console.log('Root response:', rootResponse);
      
      setBackendInfo(rootResponse);
      setApiStatus('success');
    } catch (error) {
      console.error('API连接失败:', error);
      setApiStatus('error');
    }
  };

  // 页面加载时自动测试API
  useEffect(() => {
    testApiConnection();
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
      {/* 欢迎区域 */}
      <Card style={{ marginBottom: 24, textAlign: 'center' }}>
        <Title level={1} style={{ color: '#001529', marginBottom: 16 }}>
          🚀 欢迎使用工作助手PWA
        </Title>
        <Paragraph style={{ fontSize: 16, color: '#666' }}>
          集成产品管理、物流、备货、工资结算等功能的一站式业务管理工具
        </Paragraph>
        <Paragraph style={{ color: '#1890ff' }}>
          📱 已安装为PWA应用，支持离线使用，体验更流畅！
        </Paragraph>

        {/* API连接状态 */}
        <div style={{ marginTop: 20, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <ApiOutlined style={{ fontSize: 16 }} />
              <span style={{ fontWeight: 500 }}>后端API连接状态：</span>
              {apiStatus === 'loading' && (
                <Tag icon={<LoadingOutlined />} color="blue">连接中...</Tag>
              )}
              {apiStatus === 'success' && (
                <Tag icon={<CheckCircleOutlined />} color="success">连接成功</Tag>
              )}
              {apiStatus === 'error' && (
                <Tag icon={<CloseCircleOutlined />} color="error">连接失败</Tag>
              )}
            </div>
            
            {backendInfo && (
              <div style={{ textAlign: 'left', background: 'white', padding: 12, borderRadius: 4 }}>
                <strong>后端信息：</strong>
                <pre style={{ margin: '8px 0 0 0', fontSize: '12px' }}>
                  {JSON.stringify(backendInfo, null, 2)}
                </pre>
              </div>
            )}
            
            <Button 
              type="primary" 
              onClick={testApiConnection}
              loading={apiStatus === 'loading'}
              icon={<ApiOutlined />}
            >
              重新测试连接
            </Button>
          </Space>
        </div>
      </Card>

      {/* API连接提示 */}
      {apiStatus === 'error' && (
        <Alert
          message="后端API连接失败"
          description="请检查网络连接或联系管理员。某些功能可能无法使用。"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Divider orientation="left">功能模块</Divider>

      {/* 功能卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card hoverable>
            <div style={{ textAlign: 'center' }}>
              <ShoppingCartOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
              <Title level={4}>产品管理</Title>
              <Paragraph>
                • 采购链接管理<br/>
                • 在线Listings管理<br/>
                • 产品信息维护
              </Paragraph>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card hoverable>
            <div style={{ textAlign: 'center' }}>
              <TruckOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
              <Title level={4}>物流管理</Title>
              <Paragraph>
                • 发货需求管理<br/>
                • 头程物流跟踪<br/>
                • 运输状态监控
              </Paragraph>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card hoverable>
            <div style={{ textAlign: 'center' }}>
              <InboxOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
              <Title level={4}>备货管理</Title>
              <Paragraph>
                • SKU映射管理<br/>
                • 旺季备货汇总<br/>
                • 厂家发货付款
              </Paragraph>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card hoverable>
            <div style={{ textAlign: 'center' }}>
              <DollarOutlined style={{ fontSize: 48, color: '#f5222d', marginBottom: 16 }} />
              <Title level={4}>工资结算</Title>
              <Paragraph>
                • 临工工资计算<br/>
                • 工时统计分析<br/>
                • 薪资发放管理
              </Paragraph>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card hoverable>
            <div style={{ textAlign: 'center' }}>
              <BarChartOutlined style={{ fontSize: 48, color: '#722ed1', marginBottom: 16 }} />
              <Title level={4}>利润分析</Title>
              <Paragraph>
                • 直发小包分析<br/>
                • 成本收益统计<br/>
                • 盈利能力评估
              </Paragraph>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card hoverable>
            <div style={{ textAlign: 'center' }}>
              <SettingOutlined style={{ fontSize: 48, color: '#13c2c2', marginBottom: 16 }} />
              <Title level={4}>系统设置</Title>
              <Paragraph>
                • 用户权限管理<br/>
                • 系统参数配置<br/>
                • 数据备份恢复
              </Paragraph>
            </div>
          </Card>
        </Col>
      </Row>

      <Divider orientation="left">PWA特性</Divider>

      {/* PWA特性介绍 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="💡 PWA优势" size="small">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>✅ 离线访问：网络断开时仍可使用</div>
              <div>✅ 快速启动：缓存技术保证秒级加载</div>
              <div>✅ 原生体验：可安装到桌面或主屏幕</div>
              <div>✅ 自动更新：新版本自动推送</div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="📱 安装指南" size="small">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>🖥️ 桌面：点击地址栏的安装图标</div>
              <div>📱 Android：选择"添加到主屏幕"</div>
              <div>🍎 iOS：点击分享按钮，选择"添加到主屏幕"</div>
              <div>⚡ 更多功能正在开发中...</div>
            </Space>
          </Card>
        </Col>
      </Row>

      <div style={{ textAlign: 'center', marginTop: 40, padding: 20, color: '#999' }}>
        <Paragraph>
          © 2024 工作助手PWA | 让业务管理更简单高效
        </Paragraph>
      </div>
    </div>
  );
};

export default HomePage; 