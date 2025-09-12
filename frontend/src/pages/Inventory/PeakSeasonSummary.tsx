import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Table, 
  Select, 
  Button, 
  Input, 
  message,
  Typography,
  Tabs,
  Space,
  Progress
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { 
  BarChartOutlined, 
  DollarOutlined, 
  ShoppingCartOutlined,
  TruckOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExportOutlined,
  CalendarOutlined,
  TagsOutlined
} from '@ant-design/icons';
import { API_BASE_URL } from '../../config/api';
import * as XLSX from 'xlsx';

const { Option } = Select;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

// 数据类型定义
interface YearlyStats {
  year: number;
  total_skus: number;
  total_prep_quantity: number;
  total_shipments: number;
  total_shipped_quantity: number;
  total_suppliers: number;
  total_payment_amount: number;
}

interface SkuDetail {
  local_sku: string;
  country: string;
  prep_quantity: number;
  upate_date: string;
  shipped_quantity: number;
  year: number;
}

interface SupplierStats {
  supplier: string;
  year: number;
  payment_count: number;
  total_payment_amount: number;
  payment_type: string;
}

const PeakSeasonSummary: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [yearlyStats, setYearlyStats] = useState<YearlyStats[]>([]);
  const [skuDetails, setSkuDetails] = useState<SkuDetail[]>([]);
  const [supplierStats, setSupplierStats] = useState<SupplierStats[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0
  });

  // 筛选条件
  const [filters, setFilters] = useState({
    year: undefined as number | undefined,
    country: undefined as string | undefined,
    local_sku: ''
  });

  const [activeTab, setActiveTab] = useState('overview');

  // 获取年份列表
  const fetchYears = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/peak-season/years`);
      const data = await response.json();
      if (data.code === 0) {
        setAvailableYears(data.data);
        // 默认选择最新年份
        if (data.data.length > 0) {
          setFilters(prev => ({ ...prev, year: data.data[0] }));
        }
      }
    } catch (error) {
      console.error('获取年份列表失败:', error);
    }
  };

  // 获取年度统计
  const fetchYearlyStats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.append('year', filters.year.toString());
      if (filters.country) params.append('country', filters.country);
      if (filters.local_sku) params.append('local_sku', filters.local_sku);

      const response = await fetch(`${API_BASE_URL}/peak-season/summary?${params}`);
      const data = await response.json();
      if (data.code === 0) {
        setYearlyStats(data.data);
      } else {
        message.error(data.message);
      }
    } catch (error) {
      console.error('获取年度统计失败:', error);
      message.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取SKU详细信息
  const fetchSkuDetails = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.append('year', filters.year.toString());
      if (filters.country) params.append('country', filters.country);
      if (filters.local_sku) params.append('local_sku', filters.local_sku);
      params.append('page', page.toString());
      params.append('limit', pagination.pageSize.toString());

      const response = await fetch(`${API_BASE_URL}/peak-season/sku-details?${params}`);
      const data = await response.json();
      if (data.code === 0) {
        setSkuDetails(data.data.records);
        setPagination(prev => ({
          ...prev,
          current: data.data.pagination.current,
          total: data.data.pagination.total
        }));
      } else {
        message.error(data.message);
      }
    } catch (error) {
      console.error('获取SKU详细信息失败:', error);
      message.error('获取SKU详细信息失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取供应商统计
  const fetchSupplierStats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.append('year', filters.year.toString());

      const response = await fetch(`${API_BASE_URL}/peak-season/supplier-stats?${params}`);
      const data = await response.json();
      if (data.code === 0) {
        setSupplierStats(data.data);
      } else {
        message.error(data.message);
      }
    } catch (error) {
      console.error('获取供应商统计失败:', error);
      message.error('获取供应商统计失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始化数据
  useEffect(() => {
    fetchYears();
  }, []);

  useEffect(() => {
    fetchYearlyStats();
    if (activeTab === 'sku-details') {
      fetchSkuDetails(1);
    } else if (activeTab === 'supplier-stats') {
      fetchSupplierStats();
    }
  }, [filters.year, filters.country, filters.local_sku, activeTab]);

  // Tab切换处理
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'sku-details') {
      fetchSkuDetails(1);
    } else if (key === 'supplier-stats') {
      fetchSupplierStats();
    }
  };

  // 搜索处理
  const handleSearch = () => {
    if (activeTab === 'sku-details') {
      fetchSkuDetails(1);
    } else if (activeTab === 'supplier-stats') {
      fetchSupplierStats();
    }
  };

  // 重置筛选条件
  const handleReset = () => {
    setFilters({
      year: availableYears[0] || undefined,
      country: undefined,
      local_sku: ''
    });
  };

  // 导出Excel
  const handleExport = () => {
    let dataToExport: any[] = [];
    let filename = '';

    if (activeTab === 'sku-details') {
      dataToExport = skuDetails.map(item => ({
        本地SKU: item.local_sku,
        国家: item.country,
        年份: item.year,
        备货数量: item.prep_quantity,
        更新日期: item.upate_date,
        已发货数量: item.shipped_quantity
      }));
      filename = `旺季备货SKU详情_${filters.year || '全部'}.xlsx`;
    } else if (activeTab === 'supplier-stats') {
      dataToExport = supplierStats.map(item => ({
        供应商: item.supplier,
        年份: item.year,
        付款类型: item.payment_type,
        付款单数: item.payment_count,
        付款总额: item.total_payment_amount
      }));
      filename = `旺季备货供应商统计_${filters.year || '全部'}.xlsx`;
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, filename);
  };

  // SKU详情表格列
  const skuColumns: ColumnsType<SkuDetail> = [
    {
      title: '本地SKU',
      dataIndex: 'local_sku',
      key: 'local_sku',
      fixed: 'left',
      width: 120,
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 100
    },
    {
      title: '年份',
      dataIndex: 'year',
      key: 'year',
      width: 80
    },
    {
      title: '备货数量',
      dataIndex: 'prep_quantity',
      key: 'prep_quantity',
      width: 100,
      render: (value) => value?.toLocaleString()
    },
    {
      title: '更新日期',
      dataIndex: 'upate_date',
      key: 'upate_date',
      width: 120,
      render: (date) => date ? new Date(date).toLocaleDateString() : '-'
    },
    {
      title: '已发货数量',
      dataIndex: 'shipped_quantity',
      key: 'shipped_quantity',
      width: 120,
      render: (value) => value?.toLocaleString() || 0
    },
    {
      title: '发货完成率',
      key: 'completion_rate',
      width: 120,
      render: (_, record) => {
        const rate = record.prep_quantity > 0 ? 
          (record.shipped_quantity / record.prep_quantity * 100) : 0;
        return (
          <Progress 
            percent={Math.min(rate, 100)} 
            size="small" 
            format={() => `${rate.toFixed(1)}%`}
          />
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 80,
      render: (_, record) => (
        <Button type="link" size="small">
          详情
        </Button>
      )
    }
  ];

  // 供应商统计表格列
  const supplierColumns: ColumnsType<SupplierStats> = [
    {
      title: '供应商',
      dataIndex: 'supplier',
      key: 'supplier',
      fixed: 'left',
      width: 150,
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: '年份',
      dataIndex: 'year',
      key: 'year',
      width: 80
    },
    {
      title: '付款类型',
      dataIndex: 'payment_type',
      key: 'payment_type',
      width: 120
    },
    {
      title: '付款单数',
      dataIndex: 'payment_count',
      key: 'payment_count',
      width: 100,
      render: (value) => value?.toLocaleString()
    },
    {
      title: '付款总额',
      dataIndex: 'total_payment_amount',
      key: 'total_payment_amount',
      width: 140,
      render: (value) => value ? `¥${value.toLocaleString()}` : '-'
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>
          <BarChartOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
          旺季备货汇总
        </Title>
        
        {/* 筛选条件 */}
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Row gutter={16} align="middle">
            <Col>
              <Space>
                <CalendarOutlined />
                <Text>年份:</Text>
                <Select
                  value={filters.year}
                  onChange={(value) => setFilters(prev => ({ ...prev, year: value }))}
                  style={{ width: 120 }}
                  placeholder="选择年份"
                >
                  <Option value={undefined}>全部</Option>
                  {availableYears.map(year => (
                    <Option key={year} value={year}>{year}</Option>
                  ))}
                </Select>
              </Space>
            </Col>
            <Col>
              <Space>
                <TagsOutlined />
                <Text>国家:</Text>
                <Input
                  value={filters.country}
                  onChange={(e) => setFilters(prev => ({ ...prev, country: e.target.value }))}
                  style={{ width: 120 }}
                  placeholder="输入国家"
                />
              </Space>
            </Col>
            {activeTab === 'sku-details' && (
              <Col>
                <Space>
                  <Text>SKU:</Text>
                  <Input
                    value={filters.local_sku}
                    onChange={(e) => setFilters(prev => ({ ...prev, local_sku: e.target.value }))}
                    placeholder="搜索本地SKU"
                    style={{ width: 200 }}
                    prefix={<SearchOutlined />}
                  />
                </Space>
              </Col>
            )}
            <Col>
              <Space>
                <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                  查询
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重置
                </Button>
                <Button icon={<ExportOutlined />} onClick={handleExport}>
                  导出Excel
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 年度统计概览 */}
        {yearlyStats.length > 0 && (
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            {yearlyStats.map((stats) => (
              <Col span={24} key={stats.year}>
                <Card title={`${stats.year}年度统计`} size="small">
                  <Row gutter={16}>
                    <Col span={4}>
                      <Statistic
                        title="备货SKU数"
                        value={stats.total_skus}
                        prefix={<TagsOutlined />}
                        suffix="个"
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic
                        title="备货总数量"
                        value={stats.total_prep_quantity}
                        prefix={<ShoppingCartOutlined />}
                        suffix="件"
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic
                        title="发货记录数"
                        value={stats.total_shipments}
                        prefix={<TruckOutlined />}
                        suffix="个"
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic
                        title="发货总数量"
                        value={stats.total_shipped_quantity}
                        prefix={<ShoppingCartOutlined />}
                        suffix="件"
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic
                        title="供应商数"
                        value={stats.total_suppliers}
                        prefix={<TagsOutlined />}
                        suffix="家"
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic
                        title="付款总额"
                        value={stats.total_payment_amount}
                        prefix={<DollarOutlined />}
                        suffix="元"
                        precision={2}
                      />
                    </Col>
                  </Row>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>

      {/* 详细数据表格 */}
      <Card>
        <Tabs activeKey={activeTab} onChange={handleTabChange}>
          <TabPane tab="概览" key="overview">
            <div>
              <p>请切换到"SKU详情"或"供应商统计"标签页查看详细数据。</p>
            </div>
          </TabPane>
          <TabPane tab="SKU详情" key="sku-details">
            <Table
              columns={skuColumns}
              dataSource={skuDetails}
              rowKey="local_sku"
              loading={loading}
              scroll={{ x: 800 }}
              pagination={{
                ...pagination,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
                onChange: fetchSkuDetails
              }}
              size="small"
            />
          </TabPane>
          <TabPane tab="供应商统计" key="supplier-stats">
            <Table
              columns={supplierColumns}
              dataSource={supplierStats}
              rowKey={(record) => `${record.supplier}-${record.year}-${record.payment_type}`}
              loading={loading}
              scroll={{ x: 600 }}
              pagination={false}
              size="small"
            />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default PeakSeasonSummary; 