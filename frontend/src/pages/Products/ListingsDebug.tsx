import React, { useState, useEffect } from 'react';
import { Card, Button, message } from 'antd';
import { API_BASE_URL } from '../../config/api';

const ListingsDebug: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testAPI = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/listings?page=1&limit=5`);
      const result = await response.json();
      console.log('完整API响应:', result);
      setData(result);
    } catch (error) {
      console.error('API调用失败:', error);
      message.error('API调用失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testAPI();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <Card title="Listings API 调试">
        <Button onClick={testAPI} loading={loading}>
          重新测试API
        </Button>
        
        <div style={{ marginTop: 16 }}>
          <h3>API响应数据:</h3>
          <pre style={{ background: '#f5f5f5', padding: 16, overflow: 'auto' }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
        
        {data?.data?.records && (
          <div style={{ marginTop: 16 }}>
            <h3>记录数量: {data.data.records.length}</h3>
            <h3>国家列表: {JSON.stringify(data.data.countryList)}</h3>
            
            <h4>第一条记录的国家状态:</h4>
            <pre style={{ background: '#f0f9ff', padding: 12 }}>
              {JSON.stringify(data.data.records[0]?.countryStatus, null, 2)}
            </pre>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ListingsDebug; 