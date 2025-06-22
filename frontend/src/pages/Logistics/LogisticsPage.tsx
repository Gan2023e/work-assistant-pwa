import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, 
  Input, 
  Space, 
  Button, 
  message, 
  Card, 
  Row, 
  Col,
  Statistic,
  Tag,
  Select,
  DatePicker,
  Divider,
  Typography,
  Tooltip,
  Modal
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { 
  SearchOutlined, 
  ReloadOutlined, 
  ExportOutlined,
  FilterOutlined,
  TruckOutlined,
  BoxPlotOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  EditOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { API_BASE_URL } from '../../config/api';

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;

// 物流记录接口
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

// 筛选选项接口
interface FilterOptions {
  logisticsProvider?: string[];
  channel?: string[];
  status?: string[];
  destinationCountry?: string[];
  taxPaymentStatus?: string[];
  taxDeclarationStatus?: string[];
  paymentStatus?: string[];
}

// 搜索参数接口
interface SearchParams {
  shippingIds?: string[];
  filters: {
    logisticsProvider?: string;
    channel?: string;
    status?: string;
    destinationCountry?: string;
    taxPaymentStatus?: string;
    taxDeclarationStatus?: string;
    paymentStatus?: string;
  };
}

const LogisticsPage: React.FC = () => {
  // 状态管理
  const [data, setData] = useState<LogisticsRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({});
  const [filters, setFilters] = useState<SearchParams['filters']>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchStatusValue, setBatchStatusValue] = useState<string | undefined>(undefined);

  // API调用函数
  const fetchData = async (params: SearchParams) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/logistics/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const sortedData = (result.data || []).sort((a: LogisticsRecord, b: LogisticsRecord) => {
        const dateA = a.estimatedArrivalDate ? new Date(a.estimatedArrivalDate).getTime() : 0;
        const dateB = b.estimatedArrivalDate ? new Date(b.estimatedArrivalDate).getTime() : 0;
        return dateA - dateB;
      });

      setData(sortedData);
      
      if (params.shippingIds?.length) {
        message.success(`找到 ${sortedData.length} 条匹配记录`);
      } else {
        message.success(`加载了 ${sortedData.length} 条物流记录`);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
      message.error(`获取数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // 获取筛选选项
  const fetchFilterOptions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/logistics/filters`);
      const result = await response.json();
      setFilterOptions(result.data || {});
    } catch (error) {
      console.error('获取筛选选项失败:', error);
    }
  };

  // 批量修改状态
  const handleBatchStatusUpdate = async (newStatus: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要修改的记录');
      return;
    }

    setBatchLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/logistics/batch-update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippingIds: selectedRowKeys,
          status: newStatus
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        message.success(`成功将 ${selectedRowKeys.length} 条记录的状态修改为"${newStatus}"`);
        setSelectedRowKeys([]);
        setBatchStatusValue(undefined);
        // 刷新数据
        fetchData({ filters });
      } else {
        throw new Error(result.message || '批量更新失败');
      }
    } catch (error) {
      console.error('批量更新失败:', error);
      message.error(`批量更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setBatchLoading(false);
    }
  };

  // 处理批量状态选择
  const handleBatchStatusChange = (value: string) => {
    setBatchStatusValue(value);
    handleBatchStatusUpdate(value);
  };

  // 取消选择
  const handleCancelSelection = () => {
    setSelectedRowKeys([]);
    setBatchStatusValue(undefined);
  };

  // 初始化数据
  useEffect(() => {
    fetchFilterOptions();
    // 默认加载未完成的物流记录
    fetchData({ filters: { status: 'not_completed' } });
  }, []);

  // 搜索处理
  const handleSearch = () => {
    const shippingIds = searchInput
      .split('\n')
      .map(id => id.trim())
      .filter(Boolean);

    const params: SearchParams = { filters };
    if (shippingIds.length > 0) {
      params.shippingIds = shippingIds;
    }

    fetchData(params);
  };

  // 重置搜索
  const handleReset = () => {
    setSearchInput('');
    setFilters({});
    setSelectedRowKeys([]);
    setBatchStatusValue(undefined);
    fetchData({ filters: { status: 'not_completed' } });
  };

  // 查询所有数据
  const handleSearchAll = () => {
    setFilters({});
    setSelectedRowKeys([]);
    setBatchStatusValue(undefined);
    fetchData({ filters: {} });
  };

  // 统计数据
  const statistics = useMemo(() => {
    const total = data.length;
    const completed = data.filter(item => item.status === '完成').length;
    const inTransit = data.filter(item => item.status === '在途').length;
    const totalPackages = data.reduce((sum, item) => sum + (item.packageCount || 0), 0);
    const totalValue = data.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

    return { total, completed, inTransit, totalPackages, totalValue };
  }, [data]);

  // 状态标签渲染
  const renderStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
      '在途': { color: 'processing', icon: <TruckOutlined /> },
      '完成': { color: 'success', icon: <BoxPlotOutlined /> },
      '入库中': { color: 'warning', icon: <ClockCircleOutlined /> },
    };

    const config = statusConfig[status] || { color: 'default', icon: null };
    return (
      <Tag color={config.color} icon={config.icon}>
        {status}
      </Tag>
    );
  };

  // 付款状态标签渲染
  const renderPaymentTag = (status: string) => {
    return (
      <Tag color={status === '已付' ? 'success' : 'error'}>
        {status}
      </Tag>
    );
  };

  // 日期格式化
  const formatDate = (dateString: string) => {
    return dateString ? dayjs(dateString).format('MM-DD') : '-';
  };

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record: LogisticsRecord) => ({
      disabled: false,
      name: record.shippingId,
    }),
  };

  // 表格列配置
  const columns: ColumnsType<LogisticsRecord> = [
    {
      title: 'Shipping ID',
      dataIndex: 'shippingId',
      key: 'shippingId',
      fixed: 'left',
      width: 140,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: '物流商',
      dataIndex: 'logisticsProvider',
      key: 'logisticsProvider',
      width: 100,
      filters: filterOptions.logisticsProvider?.map(item => ({ text: item, value: item })),
      filteredValue: filters.logisticsProvider ? [filters.logisticsProvider] : null,
    },
    {
      title: '渠道',
      dataIndex: 'channel',
      key: 'channel',
      width: 120,
      filters: filterOptions.channel?.map(item => ({ text: item, value: item })),
      filteredValue: filters.channel ? [filters.channel] : null,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: renderStatusTag,
      filters: filterOptions.status?.map(item => ({ text: item, value: item })),
      filteredValue: filters.status ? [filters.status] : null,
    },
    {
      title: '包裹数',
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
      title: '起运日期',
      dataIndex: 'departureDate',
      key: 'departureDate',
      width: 80,
      render: formatDate,
      align: 'center',
    },
    {
      title: '开船日期',
      dataIndex: 'sailingDate',
      key: 'sailingDate',
      width: 80,
      render: formatDate,
      align: 'center',
    },
    {
      title: '预计到港',
      dataIndex: 'estimatedArrivalDate',
      key: 'estimatedArrivalDate',
      width: 80,
      render: formatDate,
      align: 'center',
    },
    {
      title: '预计入库',
      dataIndex: 'estimatedWarehouseDate',
      key: 'estimatedWarehouseDate',
      width: 80,
      render: formatDate,
      align: 'center',
    },
    {
      title: '目的国',
      dataIndex: 'destinationCountry',
      key: 'destinationCountry',
      width: 80,
      filters: filterOptions.destinationCountry?.map(item => ({ text: item, value: item })),
      filteredValue: filters.destinationCountry ? [filters.destinationCountry] : null,
    },
    {
      title: '目的仓库',
      dataIndex: 'destinationWarehouse',
      key: 'destinationWarehouse',
      width: 100,
    },
    {
      title: '运费',
      dataIndex: 'price',
      key: 'price',
      width: 80,
      render: (price) => price ? `$${Number(price).toFixed(2)}` : '-',
      align: 'right',
    },
    {
      title: '计费重量',
      dataIndex: 'billingWeight',
      key: 'billingWeight',
      width: 90,
      render: (weight) => weight ? `${Number(weight).toFixed(1)}kg` : '-',
      align: 'right',
    },
    {
      title: '付款状态',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      width: 90,
      render: renderPaymentTag,
      filters: filterOptions.paymentStatus?.map(item => ({ text: item, value: item })),
      filteredValue: filters.paymentStatus ? [filters.paymentStatus] : null,
    },
    {
      title: '税金状态',
      dataIndex: 'taxPaymentStatus',
      key: 'taxPaymentStatus',
      width: 90,
      render: renderPaymentTag,
      filters: filterOptions.taxPaymentStatus?.map(item => ({ text: item, value: item })),
      filteredValue: filters.taxPaymentStatus ? [filters.taxPaymentStatus] : null,
    },
    {
      title: '物流节点',
      dataIndex: 'logisticsNode',
      key: 'logisticsNode',
      width: 200,
      render: (text) => (
        <Tooltip title={text}>
          <Text ellipsis>{text}</Text>
        </Tooltip>
      ),
    },
  ];

  // 表格筛选变化处理
  const handleTableChange = (pagination: any, tableFilters: any) => {
    const newFilters: SearchParams['filters'] = {
      logisticsProvider: tableFilters.logisticsProvider?.[0],
      channel: tableFilters.channel?.[0],
      status: tableFilters.status?.[0],
      destinationCountry: tableFilters.destinationCountry?.[0],
      taxPaymentStatus: tableFilters.taxPaymentStatus?.[0],
      paymentStatus: tableFilters.paymentStatus?.[0],
    };
    
    setFilters(newFilters);
    setSelectedRowKeys([]);
    setBatchStatusValue(undefined);
    fetchData({ filters: newFilters });
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        <TruckOutlined style={{ marginRight: 8 }} />
        头程物流管理
      </Title>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总记录数"
              value={statistics.total}
              prefix={<BoxPlotOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="在途货物"
              value={statistics.inTransit}
              prefix={<TruckOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总包裹数"
              value={statistics.totalPackages}
              prefix={<BoxPlotOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总运费"
              value={statistics.totalValue}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索区域 */}
      <Card title="搜索和筛选" style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col span={12}>
              <TextArea
                rows={4}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="请输入Shipping ID（每行一个）"
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
              />
            </Col>
            <Col span={12}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space wrap>
                  <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    onClick={handleSearch}
                    loading={loading}
                  >
                    搜索
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={handleReset}
                    loading={loading}
                  >
                    重置
                  </Button>
                  <Button
                    icon={<FilterOutlined />}
                    onClick={handleSearchAll}
                    loading={loading}
                  >
                    查询全部
                  </Button>
                </Space>
                <Text type="secondary">
                  当前显示: {data.length} 条记录
                  {selectedRowKeys.length > 0 && ` | 已选择: ${selectedRowKeys.length} 条`}
                </Text>
              </Space>
            </Col>
          </Row>
        </Space>
      </Card>

      {/* 批量操作区域 */}
      {selectedRowKeys.length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <Space>
            <Text strong>批量操作：</Text>
            <Text>修改状态为：</Text>
            <Select
              placeholder="选择状态"
              style={{ width: 120 }}
              value={batchStatusValue}
              onChange={handleBatchStatusChange}
              loading={batchLoading}
            >
              <Option value="在途">在途</Option>
              <Option value="入库中">入库中</Option>
              <Option value="完成">完成</Option>
            </Select>
            <Button 
              size="small" 
              onClick={handleCancelSelection}
              disabled={batchLoading}
            >
              取消选择
            </Button>
            <Text type="secondary">
              已选择 {selectedRowKeys.length} 条记录
            </Text>
          </Space>
        </Card>
      )}

      {/* 数据表格 */}
      <Card>
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={data}
          rowKey="shippingId"
          loading={loading}
          scroll={{ x: 'max-content' }}
          bordered
          size="small"
          onChange={handleTableChange}
          pagination={{
            defaultPageSize: 50,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range?.[0]}-${range?.[1]} 条，共 ${total} 条记录`,
            pageSizeOptions: ['20', '50', '100', '200'],
          }}
          rowClassName={(record) => {
            if (record.status === '完成') return 'logistics-completed';
            if (record.status === '在途') return 'logistics-transit';
            return '';
          }}
        />
      </Card>

      <style>{`
        .logistics-completed {
          background-color: #f6ffed;
        }
        .logistics-transit {
          background-color: #e6f7ff;
        }
      `}</style>
    </div>
  );
};

export default LogisticsPage; 