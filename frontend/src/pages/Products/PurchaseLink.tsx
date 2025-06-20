import React, { useState } from 'react';
import { Button, Input, Table, message, Alert } from 'antd';
import dayjs from 'dayjs';
import { ColumnsType } from 'antd/es/table';
import { apiClient } from '../../config/api';

const { TextArea } = Input;

// 定义产品数据类型
interface ProductData {
  parent_sku: string;
  weblink?: string;
  update_time?: string;
  check_time?: string;
  status?: string;
  notice?: string;
  cpc_recommend?: string;
  cpc_status?: string;
  cpc_submit?: string;
  model_number?: string;
  recommend_age?: string;
  ads_add?: string;
  list_parent_sku?: string;
  no_inventory_rate?: string;
  sales_30days?: number;
  seller_name?: string;
}

const columns: ColumnsType<ProductData> = [
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
  const [data, setData] = useState<ProductData[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    
    try {
      // 目前后端只有测试端点，先调用测试API
      console.log('搜索关键词:', keywords);
      
      // 尝试调用产品API
      const result = await apiClient.post('/api/product_weblink/search', { keywords });
      setData(result.data || []);
      message.success(`找到 ${result.data?.length || 0} 条记录`);
    } catch (e: any) {
      console.error('API调用失败:', e);
      
      // 如果产品API不存在，生成模拟数据用于测试
      if (e.message.includes('404') || e.message.includes('Not Found')) {
        setError('产品API暂未实现，显示模拟数据进行测试');
        
        // 生成模拟数据
        const mockData = keywords.map((keyword, index) => ({
          parent_sku: keyword,
          weblink: `https://example.com/product/${keyword}`,
          update_time: new Date().toISOString(),
          check_time: new Date().toISOString(),
          status: '正常',
          notice: `模拟数据 ${index + 1}`,
          cpc_recommend: '推荐',
          cpc_status: '测试中',
          cpc_submit: '已提交',
          model_number: `MODEL-${keyword}`,
          recommend_age: '3-8岁',
          ads_add: '已创建',
          list_parent_sku: keyword,
          no_inventory_rate: '5%',
          sales_30days: Math.floor(Math.random() * 100),
          seller_name: '示例供应商'
        }));
        
        setData(mockData);
        message.info('显示模拟数据，后端API开发完成后将显示真实数据');
      } else {
        setError(`查询失败: ${e.message}`);
        message.error('查询失败，请检查网络连接');
      }
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 16 }}>
        <h2>采购链接管理</h2>
        <p>输入SKU进行搜索，目前显示模拟数据用于测试前后端连接</p>
      </div>
      
      {error && (
        <Alert
          message="提示"
          description={error}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      
      <div style={{ marginBottom: 16 }}>
        <TextArea
          rows={6}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="请输入parent_sku或weblink（每行一个，支持部分内容模糊查询）"
          style={{ width: 400, marginRight: 8 }}
        />
        <Button type="primary" onClick={handleSearch} loading={loading}>
          搜索
        </Button>
      </div>
      
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
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />
    </div>
  );
};

export default Purchase; 