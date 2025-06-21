import React, { useState } from 'react';
import { Button, Input, Table, message, Alert, Space, Card } from 'antd';
import dayjs from 'dayjs';
import { ColumnsType } from 'antd/es/table';
import { API_BASE_URL } from '../../config/api';

const { TextArea } = Input;

const columns: ColumnsType<any> = [
  { title: '母SKU', dataIndex: 'parent_sku', key: 'parent_sku', align: 'center' },
  { title: '产品链接', dataIndex: 'weblink', key: 'weblink', align: 'center', render: (text: string) => text ? <a href={text} target="_blank" rel="noopener noreferrer">{text}</a> : '' },
  { title: '上传时间', dataIndex: 'update_time', key: 'update_time', render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '', align: 'center' },
  { title: '检查时间', dataIndex: 'check_time', key: 'check_time', render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '', align: 'center' },
  { title: '产品状态', dataIndex: 'status', key: 'status', align: 'center' },
  { title: '备注', dataIndex: 'notice', key: 'notice', align: 'center' },
  { title: 'CPC测试推荐', dataIndex: 'cpc_recommend', key: 'cpc_recommend', align: 'center' },
  { title: 'CPC测试情况', dataIndex: 'cpc_status', key: 'cpc_status', align: 'center' },
  { title: 'CPC提交情况', dataIndex: 'cpc_submit', key: 'cpc_submit', align: 'center' },
  { title: '型号', dataIndex: 'model_number', key: 'model_number', align: 'center' },
  { title: '推荐年龄', dataIndex: 'recommend_age', key: 'recommend_age', align: 'center' },
  { title: '广告是否创建', dataIndex: 'ads_add', key: 'ads_add', align: 'center' },
  { title: '上架母SKU', dataIndex: 'list_parent_sku', key: 'list_parent_sku', align: 'center' },
  { title: '缺货率', dataIndex: 'no_inventory_rate', key: 'no_inventory_rate', align: 'center' },
  { title: '30天销量', dataIndex: 'sales_30days', key: 'sales_30days', align: 'center' },
  { title: '供应商', dataIndex: 'seller_name', key: 'seller_name', align: 'center' },
];

const Purchase: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [healthCheck, setHealthCheck] = useState<any>(null);

  const handleHealthCheck = async () => {
    try {
      console.log('🔍 执行健康检查...');
      const res = await fetch(`${API_BASE_URL}/health`);
      const result = await res.json();
      console.log('🏥 健康检查结果:', result);
      
      setHealthCheck(result);
      
      if (res.ok && result.status === 'OK') {
        message.success('后端服务连接正常！');
      } else {
        message.warning('后端服务可能存在问题');
      }
    } catch (e) {
      console.error('❌ 健康检查失败:', e);
      message.error(`无法连接到后端服务: ${e instanceof Error ? e.message : '未知错误'}`);
      setHealthCheck({ error: e instanceof Error ? e.message : '未知错误' });
    }
  };

  const handleSearch = async () => {
    const keywords = input
      .split('\n')
      .map(i => i.trim())
      .filter(Boolean);
    if (keywords.length === 0) {
      message.warning('请输入parent_sku或weblink');
      return;
    }
    
    setLoading(true);
    setLastError(null);
    setDebugInfo(null);
    
    try {
      console.log('🔍 搜索请求:', { keywords });
      console.log('📡 API URL:', `${API_BASE_URL}/api/product_weblink/search`);
      
      const requestBody = { keywords };
      console.log('📤 请求体:', JSON.stringify(requestBody));
      
      const startTime = Date.now();
      
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const responseTime = Date.now() - startTime;
      console.log(`📡 响应状态: ${res.status}, 耗时: ${responseTime}ms`);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const result = await res.json();
      console.log('📊 搜索结果:', result);
      
      // 设置调试信息
      setDebugInfo({
        requestUrl: `${API_BASE_URL}/api/product_weblink/search`,
        requestBody: requestBody,
        responseStatus: res.status,
        responseTime: responseTime,
        resultCount: result.data?.length || 0,
        timestamp: new Date().toLocaleString()
      });
      
      setData(result.data || []);
      
      if (!result.data || result.data.length === 0) {
        message.info('未找到匹配的产品信息');
      } else {
        message.success(`找到 ${result.data.length} 条产品信息`);
      }
    } catch (e) {
      console.error('❌ 搜索失败:', e);
      const errorMessage = e instanceof Error ? e.message : '未知错误';
      setLastError(errorMessage);
      message.error(`查询失败: ${errorMessage}`);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const testWithSampleData = () => {
    setInput('XBA080');
    setTimeout(() => {
      handleSearch();
    }, 100);
  };

  return (
    <div>
      {/* API 状态信息 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div>
          <strong>API 配置:</strong> <code>{API_BASE_URL}</code>
          <Space style={{ marginLeft: 8 }}>
            <Button 
              size="small" 
              onClick={handleHealthCheck}
            >
              检查后端连接
            </Button>
            <Button 
              size="small" 
              onClick={testWithSampleData}
            >
              使用示例数据测试 (XBA080)
            </Button>
          </Space>
        </div>
      </Card>

      {/* 健康检查结果 */}
      {healthCheck && (
        <Alert
          message="后端连接状态"
          description={
            <div>
              {healthCheck.error ? (
                <p style={{ color: 'red' }}><strong>连接失败:</strong> {healthCheck.error}</p>
              ) : (
                <>
                  <p><strong>状态:</strong> {healthCheck.status}</p>
                  <p><strong>数据库:</strong> {healthCheck.database}</p>
                  <p><strong>环境:</strong> {healthCheck.environment?.NODE_ENV}</p>
                  <p><strong>检查时间:</strong> {healthCheck.timestamp}</p>
                </>
              )}
            </div>
          }
          type={healthCheck.error ? "error" : "success"}
          closable
          onClose={() => setHealthCheck(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 错误信息显示 */}
      {lastError && (
        <Alert
          message="请求失败"
          description={lastError}
          type="error"
          closable
          onClose={() => setLastError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 调试信息显示 */}
      {debugInfo && (
        <Alert
          message="调试信息"
          description={
            <div>
              <p><strong>请求URL:</strong> {debugInfo.requestUrl}</p>
              <p><strong>搜索关键词:</strong> {JSON.stringify(debugInfo.requestBody.keywords)}</p>
              <p><strong>响应状态:</strong> {debugInfo.responseStatus}</p>
              <p><strong>响应时间:</strong> {debugInfo.responseTime}ms</p>
              <p><strong>结果数量:</strong> {debugInfo.resultCount}</p>
              <p><strong>请求时间:</strong> {debugInfo.timestamp}</p>
            </div>
          }
          type="info"
          closable
          onClose={() => setDebugInfo(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Space direction="vertical" style={{ width: '100%' }}>
        <TextArea
          rows={6}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="请输入parent_sku或weblink（每行一个，支持部分内容模糊查询）&#10;例如：XBA080"
          style={{ width: 400 }}
        />
        <Button type="primary" onClick={handleSearch} loading={loading}>
          搜索
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="parent_sku"
        loading={loading}
        style={{ marginTop: 24 }}
        scroll={{ x: 'max-content' }}
        bordered
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
        }}
      />
    </div>
  );
};

export default Purchase; 