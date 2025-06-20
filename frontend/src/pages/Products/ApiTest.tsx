import React, { useState } from 'react';
import { Button, Card, Typography, Space, Alert, Divider } from 'antd';
import { ApiOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const ApiTest: React.FC = () => {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    const results: any[] = [];

    // 测试1: 直接访问Railway后端健康检查
    try {
      const healthUrl = 'https://work-assistant-pwa-production.up.railway.app/health';
      const response = await fetch(healthUrl);
      const data = await response.json();
      results.push({
        name: 'Railway健康检查',
        url: healthUrl,
        status: 'success',
        data: data
      });
    } catch (error: any) {
      results.push({
        name: 'Railway健康检查',
        url: 'https://work-assistant-pwa-production.up.railway.app/health',
        status: 'error',
        error: error?.message || String(error)
      });
    }

    // 测试2: 访问Railway根路径
    try {
      const rootUrl = 'https://work-assistant-pwa-production.up.railway.app/';
      const response = await fetch(rootUrl);
      const data = await response.json();
      results.push({
        name: 'Railway根路径',
        url: rootUrl,
        status: 'success',
        data: data
      });
    } catch (error: any) {
      results.push({
        name: 'Railway根路径',
        url: 'https://work-assistant-pwa-production.up.railway.app/',
        status: 'error',
        error: error?.message || String(error)
      });
    }

    // 测试3: 访问Railway测试API
    try {
      const testUrl = 'https://work-assistant-pwa-production.up.railway.app/api/test';
      const response = await fetch(testUrl);
      const data = await response.json();
      results.push({
        name: 'Railway测试API',
        url: testUrl,
        status: 'success',
        data: data
      });
    } catch (error: any) {
      results.push({
        name: 'Railway测试API',
        url: 'https://work-assistant-pwa-production.up.railway.app/api/test',
        status: 'error',
        error: error?.message || String(error)
      });
    }

    // 测试4: 环境变量检查
    results.push({
      name: '环境变量检查',
      status: 'info',
      data: {
        NODE_ENV: process.env.NODE_ENV,
        NODE_ENV_type: typeof process.env.NODE_ENV,
        window_location: window.location.href,
        user_agent: navigator.userAgent
      }
    });

    setTestResults(results);
    setLoading(false);
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1000, margin: '0 auto' }}>
      <Card>
        <Title level={2}>
          <ApiOutlined /> API连接测试
        </Title>
        <Paragraph>
          此页面用于测试前端与Railway后端的连接状态
        </Paragraph>
        
        <Button 
          type="primary" 
          onClick={runTests} 
          loading={loading}
          icon={<ApiOutlined />}
          size="large"
        >
          运行所有测试
        </Button>

        <Divider />

        {testResults.length > 0 && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {testResults.map((result, index) => (
              <Card key={index} size="small">
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  {result.status === 'success' && (
                    <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                  )}
                  {result.status === 'error' && (
                    <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                  )}
                  {result.status === 'info' && (
                    <ApiOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                  )}
                  <Title level={4} style={{ margin: 0 }}>
                    {result.name}
                  </Title>
                </div>
                
                {result.url && (
                  <Paragraph>
                    <Text strong>URL: </Text>
                    <Text code>{result.url}</Text>
                  </Paragraph>
                )}
                
                {result.status === 'success' && result.data && (
                  <Alert
                    message="请求成功"
                    description={
                      <pre style={{ margin: 0, fontSize: 12 }}>
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    }
                    type="success"
                    showIcon
                  />
                )}
                
                {result.status === 'error' && (
                  <Alert
                    message="请求失败"
                    description={result.error}
                    type="error"
                    showIcon
                  />
                )}
                
                {result.status === 'info' && result.data && (
                  <Alert
                    message="系统信息"
                    description={
                      <pre style={{ margin: 0, fontSize: 12 }}>
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    }
                    type="info"
                    showIcon
                  />
                )}
              </Card>
            ))}
          </Space>
        )}
      </Card>
    </div>
  );
};

export default ApiTest; 