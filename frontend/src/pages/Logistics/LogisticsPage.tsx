import React, { useState, useEffect } from 'react';
import { Table, Input, Space, Button, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined, FilterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { API_BASE_URL } from '../../config/api';

const { TextArea } = Input;

interface LogisticsRecord {
  shippingId: string;
  logisticsProvider: string;
  trackingNumber: string;
  transferNumber: string;
  packageCount: number;
  productCount: number;
  channel: string;
  status: string;
  departureDate: string;
  sailingDate: string;
  estimatedArrivalDate: string;
  estimatedWarehouseDate: string;
  logisticsNode: string;
  destinationCountry: string;
  destinationWarehouse: string;
  price: number;
  billingWeight: number;
  mrn: string;
  customsDuty: number;
  taxPaymentStatus: string;
  taxDeclarationStatus: string;
  dimensions: string;
  paymentStatus: string;
}

const LogisticsPage: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LogisticsRecord[]>([]);
  const [filters, setFilters] = useState({
    logisticsProvider: undefined,
    channel: undefined,
    status: undefined,
    destinationCountry: undefined,
    taxPaymentStatus: undefined,
    taxDeclarationStatus: undefined,
    paymentStatus: undefined,
  });
  const [filterOptions, setFilterOptions] = useState<any>({});

  // 获取所有筛选项
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/logistics/filters`);
        const result = await res.json();
        console.log('filterOptions', result.data); // 调试输出
        setFilterOptions(result.data || {});
      } catch (e) {
        console.error('获取筛选项失败:', e);
        setFilterOptions({});
      }
    };
    fetchFilters();
  }, []);

  // 页面加载时自动请求全部非完成状态数据
  useEffect(() => {
    const fetchDefaultData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/logistics/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filters: { status: 'not_completed' }
          }),
        });
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const result = await res.json();
        const sorted = (result.data || []).sort((a: LogisticsRecord, b: LogisticsRecord) => {
          const t1 = a.estimatedArrivalDate ? new Date(a.estimatedArrivalDate).getTime() : 0;
          const t2 = b.estimatedArrivalDate ? new Date(b.estimatedArrivalDate).getTime() : 0;
          return t1 - t2;
        });
        setData(sorted);
      } catch (e) {
        console.error('默认数据加载失败:', e);
        message.error('加载数据失败，请检查网络连接');
      }
      setLoading(false);
    };
    fetchDefaultData();
  }, []);

  // 判断是否有筛选条件
  const hasFilter = Object.values(filters).some(v => v !== undefined && v !== '');

  // 动态生成列的 filters
  const getColumnFilters = (field: string) => {
    return (filterOptions[field] || []).map((item: string) => ({ text: item, value: item }));
  };

  const columns: ColumnsType<LogisticsRecord> = [
    {
      title: 'Shipping ID',
      dataIndex: 'shippingId',
      key: 'shippingId',
      fixed: 'left',
      width: 120,
      align: 'center',
    },
    {
      title: '物流商',
      dataIndex: 'logisticsProvider',
      key: 'logisticsProvider',
      width: 120,
      filters: getColumnFilters('logisticsProvider'),
      filterIcon: <FilterOutlined />, 
      align: 'center',
    },
    {
      title: '物流商单号',
      dataIndex: 'transferNumber',
      key: 'transferNumber',
      width: 150,
      align: 'center',
    },
    {
      title: '跟踪号',
      dataIndex: 'trackingNumber',
      key: 'trackingNumber',
      width: 150,
      align: 'center',
    },
    {
      title: '件数',
      dataIndex: 'packageCount',
      key: 'packageCount',
      width: 80,
      align: 'center',
    },
    {
      title: '产品数',
      dataIndex: 'productCount',
      key: 'productCount',
      width: 80,
      align: 'center',
    },
    {
      title: '渠道',
      dataIndex: 'channel',
      key: 'channel',
      width: 120,
      filters: getColumnFilters('channel'),
      filterIcon: <FilterOutlined />, 
      align: 'center',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      filters: getColumnFilters('status'),
      filterIcon: <FilterOutlined />, 
      align: 'center',
    },
    {
      title: '发出日期',
      dataIndex: 'departureDate',
      key: 'departureDate',
      width: 120,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '',
      align: 'center',
    },
    {
      title: '开航日',
      dataIndex: 'sailingDate',
      key: 'sailingDate',
      width: 120,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '',
      align: 'center',
    },
    {
      title: '预计到港日',
      dataIndex: 'estimatedArrivalDate',
      key: 'estimatedArrivalDate',
      width: 120,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '',
      align: 'center',
    },
    {
      title: '预计到仓日',
      dataIndex: 'estimatedWarehouseDate',
      key: 'estimatedWarehouseDate',
      width: 120,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '',
      align: 'center',
    },
    {
      title: '物流节点',
      dataIndex: 'logisticsNode',
      key: 'logisticsNode',
      width: 150,
      align: 'center',
    },
    {
      title: '目的国',
      dataIndex: 'destinationCountry',
      key: 'destinationCountry',
      width: 120,
      filters: getColumnFilters('destinationCountry'),
      filterIcon: <FilterOutlined />, 
      align: 'center',
    },
    {
      title: '目的仓',
      dataIndex: 'destinationWarehouse',
      key: 'destinationWarehouse',
      width: 120,
      align: 'center',
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (text: any) => {
        const num = Number(text);
        return isNaN(num) ? '' : `$${num.toFixed(2)}`;
      },
      align: 'center',
    },
    {
      title: '计费重',
      dataIndex: 'billingWeight',
      key: 'billingWeight',
      width: 100,
      render: (text: any) => {
        const num = Number(text);
        return isNaN(num) ? '' : `${num}kg`;
      },
      align: 'center',
    },
    {
      title: 'MRN',
      dataIndex: 'mrn',
      key: 'mrn',
      width: 150,
      align: 'center',
    },
    {
      title: '关税',
      dataIndex: 'customsDuty',
      key: 'customsDuty',
      width: 100,
      render: (text: any) => {
        const num = Number(text);
        return isNaN(num) ? '' : `$${num.toFixed(2)}`;
      },
      align: 'center',
    },
    {
      title: '税金支付状态',
      dataIndex: 'taxPaymentStatus',
      key: 'taxPaymentStatus',
      width: 120,
      filters: getColumnFilters('taxPaymentStatus'),
      filterIcon: <FilterOutlined />, 
      align: 'center',
    },
    {
      title: '报税状态',
      dataIndex: 'taxDeclarationStatus',
      key: 'taxDeclarationStatus',
      width: 120,
      filters: getColumnFilters('taxDeclarationStatus'),
      filterIcon: <FilterOutlined />, 
      align: 'center',
    },
    {
      title: '尺寸',
      dataIndex: 'dimensions',
      key: 'dimensions',
      width: 120,
      align: 'center',
    },
    {
      title: '付款状态',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      width: 120,
      filters: getColumnFilters('paymentStatus'),
      filterIcon: <FilterOutlined />, 
      align: 'center',
    },
  ];

  console.log('columns', columns);
  console.log('filterOptions', filterOptions);

  // 处理列筛选变化（后端过滤）
  const handleTableChange = (pagination: any, tableFilters: any) => {
    const newFilters = {
      logisticsProvider: tableFilters.logisticsProvider ? tableFilters.logisticsProvider[0] : undefined,
      channel: tableFilters.channel ? tableFilters.channel[0] : undefined,
      status: tableFilters.status ? tableFilters.status[0] : undefined,
      destinationCountry: tableFilters.destinationCountry ? tableFilters.destinationCountry[0] : undefined,
      taxPaymentStatus: tableFilters.taxPaymentStatus ? tableFilters.taxPaymentStatus[0] : undefined,
      taxDeclarationStatus: tableFilters.taxDeclarationStatus ? tableFilters.taxDeclarationStatus[0] : undefined,
      paymentStatus: tableFilters.paymentStatus ? tableFilters.paymentStatus[0] : undefined,
    };
    setFilters(newFilters);
    // 重新请求后端
    handleSearch(undefined, newFilters);
  };

  // 搜索
  const handleSearch = async (e?: any, customFilters?: any) => {
    const shippingIds = input
      .split('\n')
      .map(i => i.trim())
      .filter(Boolean);
      
    setLoading(true);
    try {
      const body: any = { filters: customFilters || filters };
      if (shippingIds.length > 0) {
        body.shippingIds = shippingIds;
      }
      
      const res = await fetch(`${API_BASE_URL}/api/logistics/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const result = await res.json();
      const sorted = (result.data || []).sort((a: LogisticsRecord, b: LogisticsRecord) => {
        const t1 = a.estimatedArrivalDate ? new Date(a.estimatedArrivalDate).getTime() : 0;
        const t2 = b.estimatedArrivalDate ? new Date(b.estimatedArrivalDate).getTime() : 0;
        return t1 - t2;
      });
      setData(sorted);
      
      if (shippingIds.length > 0) {
        if (!result.data || result.data.length === 0) {
          message.info('未找到匹配的物流信息');
        } else {
          message.success(`找到 ${result.data.length} 条物流信息`);
        }
      }
    } catch (e) {
      console.error('查询失败:', e);
      message.error(`查询失败: ${e instanceof Error ? e.message : '未知错误'}`);
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
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space>
          <TextArea
            rows={4}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入Shipping ID（每行一个）"
            style={{ width: 400 }}
          />
          <Button 
            type={hasFilter ? 'primary' : 'default'}
            onClick={handleSearch} 
            loading={loading}
            icon={<SearchOutlined />}
          >
            搜索
          </Button>
        </Space>
        
        <Table
          columns={columns}
          dataSource={data}
          rowKey="shippingId"
          loading={loading}
          scroll={{ x: 'max-content' }}
          bordered
          size="middle"
          pagination={{
            defaultPageSize: 100,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          onChange={handleTableChange}
        />
      </Space>
    </div>
  );
};

export default LogisticsPage; 