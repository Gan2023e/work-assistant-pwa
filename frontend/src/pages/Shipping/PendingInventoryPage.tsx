import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Input, 
  Select, 
  message, 
  Space, 
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Tooltip,
  DatePicker,
  Empty
} from 'antd';
import { 
  ReloadOutlined,
  ExportOutlined,
  InboxOutlined,
  BoxPlotOutlined,
  SearchOutlined,
  FilterOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';

const { Option } = Select;
const { Title, Text } = Typography;
const { Search } = Input;

// 库存汇总数据接口
interface InventorySummaryItem {
  sku: string;
  country: string;
  marketplace: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  mixed_box_count: number;
  total_quantity: number;
  last_updated: string;
  operators: string;
  packers: string;
  status: string;
}

// 统计数据接口
interface StatsData {
  total_skus: number;
  total_quantity: number;
  total_whole_boxes: number;
  total_mixed_boxes: number;
  countries: string[];
  marketplaces: string[];
}

const PendingInventoryPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<InventorySummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StatsData>({
    total_skus: 0,
    total_quantity: 0,
    total_whole_boxes: 0,
    total_mixed_boxes: 0,
    countries: [],
    marketplaces: []
  });

  // 筛选和排序状态
  const [filters, setFilters] = useState({
    country: '',
    sku_filter: '',
    sort_by: 'total_quantity',
    sort_order: 'desc'
  });

  // 分页状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0
  });

  // 获取库存汇总数据
  const fetchInventorySummary = async (page = 1, pageSize = 50) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        sort_by: filters.sort_by,
        sort_order: filters.sort_order
      });
      
      if (filters.country) {
        queryParams.append('country', filters.country);
      }
      
      if (filters.sku_filter) {
        queryParams.append('sku_filter', filters.sku_filter);
      }

      const response = await fetch(`${API_BASE_URL}/api/shipping/pending-inventory-summary?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.code === 0) {
        setData(result.data.list || []);
        setStats(result.data.stats || {
          total_skus: 0,
          total_quantity: 0,
          total_whole_boxes: 0,
          total_mixed_boxes: 0,
          countries: [],
          marketplaces: []
        });
        setPagination({
          current: page,
          pageSize: pageSize,
          total: result.data.pagination?.total || 0
        });
        
        message.success(`加载了 ${result.data.list?.length || 0} 条库存汇总记录`);
      } else {
        message.error(result.message || '获取数据失败');
      }
    } catch (error) {
      console.error('获取库存汇总失败:', error);
      message.error(`获取数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventorySummary(pagination.current, pagination.pageSize);
  }, [filters]);

  // 处理筛选变化
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPagination(prev => ({ ...prev, current: 1 })); // 重置到第一页
  };

  // 处理表格变化（分页、排序等）
  const handleTableChange = (paginationInfo: any, filtersInfo: any, sorterInfo: any) => {
    // 处理分页
    if (paginationInfo.current !== pagination.current || paginationInfo.pageSize !== pagination.pageSize) {
      setPagination({
        current: paginationInfo.current,
        pageSize: paginationInfo.pageSize,
        total: pagination.total
      });
      fetchInventorySummary(paginationInfo.current, paginationInfo.pageSize);
    }

    // 处理排序
    if (sorterInfo.columnKey && sorterInfo.order) {
      const sortOrder = sorterInfo.order === 'ascend' ? 'asc' : 'desc';
      setFilters(prev => ({
        ...prev,
        sort_by: sorterInfo.columnKey,
        sort_order: sortOrder
      }));
    }
  };

  // 导出数据
  const handleExport = () => {
    if (data.length === 0) {
      message.warning('没有数据可导出');
      return;
    }

    const exportData = data.map(item => ({
      'SKU': item.sku,
      '国家': item.country,
      '平台': item.marketplace,
      '整箱数量': item.whole_box_quantity,
      '整箱数': item.whole_box_count,
      '混合箱数量': item.mixed_box_quantity,
      '混合箱数': item.mixed_box_count,
      '总数量': item.total_quantity,
      '最后更新': new Date(item.last_updated).toLocaleString('zh-CN'),
      '操作员': item.operators,
      '打包员': item.packers,
      '状态': item.status
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '库存汇总');
    XLSX.writeFile(wb, `库存汇总_${new Date().toISOString().split('T')[0]}.xlsx`);
    message.success('导出成功');
  };

  // 获取国家颜色
  const getCountryColor = (country: string) => {
    const colorMap: { [key: string]: string } = {
      '美国': 'blue',
      '英国': 'green',
      '澳大利亚': 'orange',
      '加拿大': 'purple',
      '阿联酋': 'cyan',
      '德国': 'red',
      '法国': 'magenta',
      '意大利': 'gold',
      '西班牙': 'lime',
      '日本': 'volcano'
    };
    return colorMap[country] || 'default';
  };

  // 表格列定义
  const columns: ColumnsType<InventorySummaryItem> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 150,
      fixed: 'left',
      sorter: true,
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 80,
      align: 'center',
      sorter: true,
      render: (text: string) => <Tag color={getCountryColor(text)}>{text}</Tag>
    },
    {
      title: '平台',
      dataIndex: 'marketplace',
      key: 'marketplace',
      width: 100,
      align: 'center',
      render: (text: string) => text ? <Tag color="blue">{text}</Tag> : '-'
    },
    {
      title: '整箱数量',
      dataIndex: 'whole_box_quantity',
      key: 'whole_box_quantity',
      width: 100,
      align: 'center',
      sorter: true,
      render: (value: number) => (
        <Text type={value > 0 ? 'success' : 'secondary'}>
          {value || '-'}
        </Text>
      )
    },
    {
      title: '整箱数',
      dataIndex: 'whole_box_count',
      key: 'whole_box_count',
      width: 80,
      align: 'center',
      sorter: true,
      render: (value: number) => value || '-'
    },
    {
      title: '混合箱数量',
      dataIndex: 'mixed_box_quantity',
      key: 'mixed_box_quantity',
      width: 110,
      align: 'center',
      sorter: true,
      render: (value: number) => (
        <Text type={value > 0 ? 'warning' : 'secondary'}>
          {value || '-'}
        </Text>
      )
    },
    {
      title: '混合箱数',
      dataIndex: 'mixed_box_count',
      key: 'mixed_box_count',
      width: 90,
      align: 'center',
      sorter: true,
      render: (value: number) => value || '-'
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 100,
      align: 'center',
      sorter: true,
      render: (value: number) => (
        <Text strong type={value > 0 ? 'success' : 'danger'}>
          {value}
        </Text>
      )
    },
    {
      title: '最后更新',
      dataIndex: 'last_updated',
      key: 'last_updated',
      width: 150,
      sorter: true,
      render: (date: string) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作员',
      dataIndex: 'operators',
      key: 'operators',
      width: 120,
      render: (text: string) => (
        <Tooltip title={text}>
          <Text ellipsis>{text || '-'}</Text>
        </Tooltip>
      )
    },
    {
      title: '打包员',
      dataIndex: 'packers',
      key: 'packers',
      width: 120,
      render: (text: string) => (
        <Tooltip title={text}>
          <Text ellipsis>{text || '-'}</Text>
        </Tooltip>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      align: 'center',
      render: (status: string) => (
        <Tag color={status === '有库存' ? 'green' : 'red'}>{status}</Tag>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <AppstoreOutlined /> 库存汇总管理
      </Title>
      
      <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
        显示 local_boxes 表中按 SKU 和国家汇总的库存数据
      </Text>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="SKU 种类"
              value={stats.total_skus}
              prefix={<BoxPlotOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="总库存"
              value={stats.total_quantity}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="整箱数"
              value={stats.total_whole_boxes}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="混合箱数"
              value={stats.total_mixed_boxes}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="国家数"
              value={stats.countries.length}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="平台数"
              value={stats.marketplaces.length}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选和操作栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={6}>
            <Space>
              <Text>SKU筛选:</Text>
              <Search
                placeholder="输入SKU关键字"
                allowClear
                value={filters.sku_filter}
                onChange={(e) => handleFilterChange('sku_filter', e.target.value)}
                onSearch={(value) => handleFilterChange('sku_filter', value)}
                style={{ width: 200 }}
              />
            </Space>
          </Col>
          <Col span={4}>
            <Space>
              <Text>国家:</Text>
              <Select
                value={filters.country}
                onChange={(value) => handleFilterChange('country', value)}
                style={{ width: 120 }}
                allowClear
                placeholder="选择国家"
              >
                {stats.countries.map(country => (
                  <Option key={country} value={country}>{country}</Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col span={6}>
            <Space>
              <Text>排序:</Text>
              <Select
                value={filters.sort_by}
                onChange={(value) => handleFilterChange('sort_by', value)}
                style={{ width: 120 }}
              >
                <Option value="total_quantity">总数量</Option>
                <Option value="whole_box_quantity">整箱数量</Option>
                <Option value="mixed_box_quantity">混合箱数量</Option>
                <Option value="last_updated">更新时间</Option>
                <Option value="sku">SKU</Option>
                <Option value="country">国家</Option>
              </Select>
              <Select
                value={filters.sort_order}
                onChange={(value) => handleFilterChange('sort_order', value)}
                style={{ width: 80 }}
              >
                <Option value="desc">降序</Option>
                <Option value="asc">升序</Option>
              </Select>
            </Space>
          </Col>
          <Col span={8}>
            <Space style={{ float: 'right' }}>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => fetchInventorySummary(pagination.current, pagination.pageSize)}
                loading={loading}
              >
                刷新
              </Button>
              <Button
                icon={<ExportOutlined />}
                onClick={handleExport}
                disabled={data.length === 0}
              >
                导出Excel
              </Button>
              <Text type="secondary">
                共 {pagination.total} 条记录
              </Text>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={data}
        rowKey={(record) => `${record.sku}_${record.country}`}
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          pageSizeOptions: ['20', '50', '100', '200']
        }}
        scroll={{ x: 1400, y: 600 }}
        onChange={handleTableChange}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无库存数据"
            />
          )
        }}
      />
    </div>
  );
};

export default PendingInventoryPage; 