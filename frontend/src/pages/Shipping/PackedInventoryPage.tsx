import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  message, 
  Space, 
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Select,
  DatePicker,
  Input
} from 'antd';
import { 
  BarChartOutlined,
  ReloadOutlined,
  ExportOutlined,
  SearchOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

// 已封箱库存数据接口
interface PackedInventoryItem {
  local_sku: string;
  amz_sku?: string;
  country: string;
  marketplace: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  total_available: number;
  created_at: string;
  updated_at: string;
}

// 国家库存统计接口
interface CountryInventory {
  country: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  mixed_box_count: number;
  total_quantity: number;
}

const PackedInventoryPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<PackedInventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [countryInventory, setCountryInventory] = useState<CountryInventory[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  
  // 分页状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0
  });

  // 获取已封箱库存数据
  const fetchPackedInventory = async (page = 1, pageSize = 50) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        // 只获取有库存的数据
        has_inventory: 'true'
      });
      
      // 国家筛选
      if (selectedCountry) {
        queryParams.append('country', selectedCountry);
      }
      
      // 搜索筛选
      if (searchText) {
        queryParams.append('search', searchText);
      }

      const response = await fetch(`${API_BASE_URL}/api/shipping/packed-inventory?${queryParams}`, {
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
        setPagination({
          current: result.data.pagination?.current || page,
          pageSize: result.data.pagination?.pageSize || pageSize,
          total: result.data.pagination?.total || 0
        });
        message.success(`加载了 ${result.data.list?.length || 0} 条已封箱库存记录`);
      } else {
        message.error(result.message || '获取已封箱库存数据失败');
      }
    } catch (error) {
      console.error('获取已封箱库存数据失败:', error);
      message.error(`获取已封箱库存数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // 获取国家库存统计数据
  const fetchCountryInventory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/inventory-by-country`, {
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
        setCountryInventory(result.data || []);
      } else {
        console.error('获取国家库存数据失败:', result.message);
      }
    } catch (error) {
      console.error('获取国家库存数据失败:', error);
    }
  };

  useEffect(() => {
    fetchPackedInventory();
    fetchCountryInventory();
  }, []);

  // 刷新数据
  const handleRefresh = () => {
    fetchPackedInventory(pagination.current, pagination.pageSize);
    fetchCountryInventory();
  };

  // 搜索处理
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchPackedInventory(1, pagination.pageSize);
  };

  // 导出Excel
  const exportToExcel = () => {
    const exportData = data.map(item => ({
      '本地SKU': item.local_sku,
      'Amazon SKU': item.amz_sku || '-',
      '国家': item.country,
      '平台': item.marketplace,
      '整箱数量': item.whole_box_quantity,
      '整箱箱数': item.whole_box_count,
      '混合箱数量': item.mixed_box_quantity,
      '总可用库存': item.total_available,
      '创建时间': new Date(item.created_at).toLocaleString('zh-CN'),
      '更新时间': new Date(item.updated_at).toLocaleString('zh-CN')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '已封箱库存');
    XLSX.writeFile(wb, `已封箱库存-${new Date().toLocaleDateString('zh-CN')}.xlsx`);
    message.success('已导出到Excel文件');
  };

  // 表格列定义
  const columns: ColumnsType<PackedInventoryItem> = [
    {
      title: '本地SKU',
      dataIndex: 'local_sku',
      key: 'local_sku',
      width: 150,
      fixed: 'left',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: 'Amazon SKU',
      dataIndex: 'amz_sku',
      key: 'amz_sku',
      width: 150,
      render: (text: string) => text || <Text type="secondary">未映射</Text>
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 80,
      align: 'center',
      sorter: true,
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '平台',
      dataIndex: 'marketplace',
      key: 'marketplace',
      width: 100,
      align: 'center',
      render: (text: string) => <Tag color="green">{text}</Tag>
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
      ),
    },
    {
      title: '整箱箱数',
      dataIndex: 'whole_box_count',
      key: 'whole_box_count',
      width: 100,
      align: 'center',
      sorter: true,
      render: (value: number) => (
        <Text type={value > 0 ? 'success' : 'secondary'}>
          {value || '-'}
        </Text>
      ),
    },
    {
      title: '混合箱数量',
      dataIndex: 'mixed_box_quantity',
      key: 'mixed_box_quantity',
      width: 120,
      align: 'center',
      sorter: true,
      render: (value: number) => (
        <Text type={value > 0 ? 'success' : 'secondary'}>
          {value || '-'}
        </Text>
      ),
    },
    {
      title: '总可用库存',
      dataIndex: 'total_available',
      key: 'total_available',
      width: 120,
      align: 'center',
      sorter: true,
      render: (value: number) => (
        <Text type="success" strong>
          {value}
        </Text>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 150,
      sorter: true,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
  ];

  // 计算总库存统计
  const totalStats = data.reduce((acc, item) => {
    acc.total_quantity += item.total_available;
    acc.whole_box_quantity += item.whole_box_quantity;
    acc.mixed_box_quantity += item.mixed_box_quantity;
    acc.sku_count += 1;
    return acc;
  }, {
    total_quantity: 0,
    whole_box_quantity: 0,
    mixed_box_quantity: 0,
    sku_count: 0
  });

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <BarChartOutlined /> 已封箱待发货库存管理
      </Title>
      
      {/* 国家库存统计卡片 */}
      <Card 
        title="国家库存统计" 
        size="small" 
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          {countryInventory.map(item => (
            <Col key={item.country} span={4}>
              <div 
                style={{ 
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '4px',
                  backgroundColor: selectedCountry === item.country ? '#e6f7ff' : undefined
                }} 
                onClick={() => {
                  const newCountry = selectedCountry === item.country ? '' : item.country;
                  setSelectedCountry(newCountry);
                  setPagination(prev => ({ ...prev, current: 1 }));
                  // 重新获取数据时会使用新的selectedCountry
                }}
              >
                <Statistic
                  title={item.country}
                  value={item.total_quantity}
                  valueStyle={{ 
                    color: selectedCountry === item.country ? '#1677ff' : '#3f8600',
                    fontSize: '16px'
                  }}
                  suffix={
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      整箱: {item.whole_box_quantity} | 混合: {item.mixed_box_quantity}
                    </div>
                  }
                />
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 操作栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Space>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={loading}
              >
                刷新
              </Button>
              <Button
                icon={<ExportOutlined />}
                onClick={exportToExcel}
                disabled={data.length === 0}
              >
                导出Excel
              </Button>
            </Space>
          </Col>
          <Col>
            <Space>
              <Input
                placeholder="搜索本地SKU或Amazon SKU"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onPressEnter={handleSearch}
                style={{ width: 200 }}
                allowClear
              />
              <Button
                icon={<SearchOutlined />}
                onClick={handleSearch}
              >
                搜索
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 库存统计概览 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="SKU总数"
              value={totalStats.sku_count}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总可用库存"
              value={totalStats.total_quantity}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="整箱库存"
              value={totalStats.whole_box_quantity}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="混合箱库存"
              value={totalStats.mixed_box_quantity}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 库存表格 */}
      <Card title="已封箱库存明细" size="small">
        <Table
          columns={columns}
          dataSource={data}
          rowKey={(record) => `${record.local_sku}_${record.country}`}
          loading={loading}
          size="small"
          scroll={{ x: 1200, y: 500 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination(prev => ({ ...prev, current: page, pageSize: pageSize || 50 }));
              fetchPackedInventory(page, pageSize);
            }
          }}
          rowClassName={(record) => {
            if (!record.amz_sku) return 'unmapped-row';
            if (record.total_available > 0) return 'sufficient-row';
            return '';
          }}
        />
      </Card>
    </div>
  );
};

export default PackedInventoryPage; 