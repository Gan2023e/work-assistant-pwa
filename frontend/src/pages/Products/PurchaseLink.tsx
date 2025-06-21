import React, { useState } from 'react';
import { Button, Input, Table, message } from 'antd';
import dayjs from 'dayjs';
import { ColumnsType } from 'antd/es/table';

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
    try {
      const res = await fetch('/api/product_weblink/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords }),
      });
      const result = await res.json();
      setData(result.data || []);
    } catch (e) {
      message.error('查询失败');
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
    <div>
      <TextArea
        rows={6}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="请输入parent_sku或weblink（每行一个，支持部分内容模糊查询）"
        style={{ width: 400, marginBottom: 16 }}
      />
      <Button type="primary" onClick={handleSearch} loading={loading} style={{ marginLeft: 8 }}>
        搜索
      </Button>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="parent_sku"
        loading={loading}
        style={{ marginTop: 24 }}
        scroll={{ x: 'max-content' }}
        bordered
      />
    </div>
  );
};

export default Purchase; 