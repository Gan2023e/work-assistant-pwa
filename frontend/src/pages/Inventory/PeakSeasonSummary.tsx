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
  Progress,
  Modal
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
  TagsOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { API_BASE_URL } from '../../config/api';
import * as XLSX from 'xlsx';
import DailyShipmentsDetail from '../Products/DailyShipmentsDetail';

const { Option } = Select;
const { Title, Text } = Typography;

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

// 修改供应商统计接口，保持原始数据结构但增加rowSpan和总额字段
interface SupplierStats {
  supplier: string;
  year: number;
  payment_count: number;
  total_payment_amount: number;
  payment_type: string;
  rowSpan?: number; // 用于表格合并行显示
  supplier_total?: number; // 供应商总付款金额
}

// 付款详细记录接口
interface PaymentDetail {
  id: number;
  supplier: string;
  payment_type: string;
  amount: number;
  payment_date: string;
  description?: string;
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

  // 付款详细记录模态框状态
  const [paymentDetailVisible, setPaymentDetailVisible] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>([]);
  const [selectedPaymentInfo, setSelectedPaymentInfo] = useState<{
    supplier: string;
    paymentType: string;
    count: number;
  } | null>(null);

  // 筛选条件
  const [filters, setFilters] = useState({
    year: 2025 as number | undefined, // 默认设置为2025年
    country: undefined as string | undefined,
    local_sku: ''
  });

  const [activeTab, setActiveTab] = useState('overview');

  // 付款类型优先级映射
  const getPaymentTypePriority = (paymentType: string): number => {
    if (paymentType?.includes('预付')) return 1;
    if (paymentType?.includes('阶段')) return 2;
    if (paymentType?.includes('尾款')) return 3;
    return 4; // 其他
  };

  // 获取年份列表
  const fetchYears = async () => {
    try {
      console.log('正在获取年份列表...');
      const response = await fetch(`${API_BASE_URL}/api/peak-season/years`);
      const data = await response.json();
      console.log('年份API响应:', data);
      if (data.code === 0) {
        setAvailableYears(data.data);
        console.log('设置可用年份:', data.data);
        // 如果没有设置年份，设置最新年份
        if (!filters.year && data.data.length > 0) {
          setFilters(prev => ({ ...prev, year: data.data[0] }));
          console.log('设置默认年份:', data.data[0]);
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

      console.log('正在获取年度统计，参数:', params.toString(), '当前筛选条件:', filters);
      const response = await fetch(`${API_BASE_URL}/api/peak-season/summary?${params}`);
      const data = await response.json();
      console.log('年度统计API响应:', data);
      if (data.code === 0) {
        setYearlyStats(data.data);
        console.log('设置年度统计数据:', data.data);
      } else {
        console.error('年度统计API返回错误:', data.message);
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

      console.log('正在获取SKU详情，参数:', params.toString());
      const response = await fetch(`${API_BASE_URL}/api/peak-season/sku-details?${params}`);
      const data = await response.json();
      console.log('SKU详情API响应:', data);
      if (data.code === 0) {
        setSkuDetails(data.data.records);
        setPagination(prev => ({
          ...prev,
          current: data.data.pagination.current,
          total: data.data.pagination.total
        }));
        console.log('设置SKU详情数据:', data.data.records);
      } else {
        console.error('SKU详情API返回错误:', data.message);
        message.error(data.message);
      }
    } catch (error) {
      console.error('获取SKU详细信息失败:', error);
      message.error('获取SKU详细信息失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取供应商统计 - 修改为不合并数据，但计算rowSpan用于表格显示
  const fetchSupplierStats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.append('year', filters.year.toString());

      console.log('正在获取供应商统计，参数:', params.toString());
      const response = await fetch(`${API_BASE_URL}/api/peak-season/supplier-stats?${params}`);
      const data = await response.json();
      console.log('供应商统计API响应:', data);
      if (data.code === 0) {
        console.log('原始供应商数据:', data.data);
        // 处理数据，为表格合并行做准备
        const processedStats = processSupplierStatsForDisplay(data.data);
        setSupplierStats(processedStats);
        console.log('设置处理后的供应商统计数据:', processedStats);
        console.log('总计金额计算结果:', calculateGrandTotal());
      } else {
        console.error('供应商统计API返回错误:', data.message);
        message.error(data.message);
      }
    } catch (error) {
      console.error('获取供应商统计失败:', error);
      message.error('获取供应商统计失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取付款详细记录
  const fetchPaymentDetails = async (supplier: string, paymentType: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.append('year', filters.year.toString());
      params.append('supplier', supplier);
      params.append('payment_type', paymentType);

      console.log('正在获取付款详细记录，参数:', params.toString());
      const response = await fetch(`${API_BASE_URL}/api/peak-season/payment-details?${params}`);
      const data = await response.json();
      
      if (data.code === 0) {
        setPaymentDetails(data.data);
        console.log('设置付款详细记录:', data.data);
      } else {
        console.error('付款详细记录API返回错误:', data.message);
        message.error(data.message);
        setPaymentDetails([]);
      }
    } catch (error) {
      console.error('获取付款详细记录失败:', error);
      message.error('获取付款详细记录失败');
      setPaymentDetails([]);
    } finally {
      setLoading(false);
    }
  };

  // 处理供应商统计数据，计算rowSpan用于表格合并显示，并按付款类型优先级排序
  const processSupplierStatsForDisplay = (rawData: any[]): SupplierStats[] => {
    // 先按供应商和年份分组
    const grouped = new Map<string, any[]>();
    rawData.forEach(item => {
      const key = `${item.supplier}-${item.year}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      // 确保金额是数值类型
      item.total_payment_amount = parseFloat(item.total_payment_amount) || 0;
      item.payment_count = parseInt(item.payment_count) || 0;
      grouped.get(key)!.push(item);
    });

    const result: SupplierStats[] = [];
    
    // 处理每个供应商组
    grouped.forEach((items, groupKey) => {
      // 计算供应商总付款金额 - 确保数值计算
      const supplierTotal = items.reduce((sum, item) => {
        const amount = parseFloat(item.total_payment_amount) || 0;
        return sum + amount;
      }, 0);
      
      // 按付款类型优先级排序：预付款 -> 阶段付款 -> 尾款 -> 其他
      items.sort((a, b) => {
        const priorityA = getPaymentTypePriority(a.payment_type);
        const priorityB = getPaymentTypePriority(b.payment_type);
        if (priorityA !== priorityB) {
          return priorityA - priorityB; // 优先级升序
        }
        // 如果优先级相同，按付款金额降序
        const amountA = parseFloat(a.total_payment_amount) || 0;
        const amountB = parseFloat(b.total_payment_amount) || 0;
        return amountB - amountA;
      });
      
      items.forEach((item, index) => {
        result.push({
          supplier: item.supplier,
          year: item.year,
          payment_count: parseInt(item.payment_count) || 0,
          total_payment_amount: parseFloat(item.total_payment_amount) || 0,
          payment_type: item.payment_type,
          rowSpan: index === 0 ? items.length : 0, // 第一行显示rowSpan，其他行为0
          supplier_total: supplierTotal // 每一行都保存供应商总额，但只在第一行显示
        });
      });
    });

    // 按供应商总付款金额降序排序
    const supplierTotals = new Map<string, number>();
    result.forEach(item => {
      const key = `${item.supplier}-${item.year}`;
      if (!supplierTotals.has(key)) {
        supplierTotals.set(key, item.supplier_total || 0);
      }
    });

    result.sort((a, b) => {
      const keyA = `${a.supplier}-${a.year}`;
      const keyB = `${b.supplier}-${b.year}`;
      const totalA = supplierTotals.get(keyA) || 0;
      const totalB = supplierTotals.get(keyB) || 0;
      if (totalA !== totalB) {
        return totalB - totalA; // 按总金额降序
      }
      // 如果是同一供应商，保持付款类型优先级顺序
      return 0;
    });

    return result;
  };

  // 修正总计计算 - 只计算每个供应商的总额一次
  const calculateGrandTotal = (): number => {
    const supplierTotals = new Map<string, number>();
    
    // 收集每个供应商的总额，避免重复计算
    supplierStats.forEach(item => {
      if (item.rowSpan && item.rowSpan > 0) { // 只计算每个供应商的第一行（有rowSpan的行）
        const key = `${item.supplier}-${item.year}`;
        const total = parseFloat(String(item.supplier_total)) || 0;
        supplierTotals.set(key, total);
      }
    });
    
    // 计算所有供应商的总额 - 确保数值相加
    return Array.from(supplierTotals.values()).reduce((total, amount) => {
      const numAmount = parseFloat(String(amount)) || 0;
      return total + numAmount;
    }, 0);
  };

  // 点击付款单数时显示详细记录
  const handleShowPaymentDetails = (supplier: string, paymentType: string, count: number) => {
    setSelectedPaymentInfo({ supplier, paymentType, count });
    fetchPaymentDetails(supplier, paymentType);
    setPaymentDetailVisible(true);
  };

  // 初始化数据
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    console.log('组件初始化，开始获取数据...');
    fetchYears();
    // 立即尝试获取统计数据
    fetchYearlyStats();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    console.log('筛选条件或标签页变化，重新获取数据...', { filters, activeTab });
    fetchYearlyStats();
    if (activeTab === 'sku-details') {
      fetchSkuDetails(1);
    } else if (activeTab === 'supplier-stats') {
      fetchSupplierStats();
    }
  }, [filters.year, filters.country, filters.local_sku, activeTab]);

  // Tab切换处理
  const handleTabChange = (key: string) => {
    console.log('切换标签页:', key);
    setActiveTab(key);
    if (key === 'sku-details') {
      fetchSkuDetails(1);
    } else if (key === 'supplier-stats') {
      fetchSupplierStats();
    }
  };

  // 搜索处理
  const handleSearch = () => {
    console.log('执行搜索...');
    if (activeTab === 'sku-details') {
      fetchSkuDetails(1);
    } else if (activeTab === 'supplier-stats') {
      fetchSupplierStats();
    }
  };

  // 重置筛选条件
  const handleReset = () => {
    console.log('重置筛选条件...');
    setFilters({
      year: availableYears[0] || 2025,
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
        付款金额: item.total_payment_amount,
        供应商总额: item.supplier_total
      }));
      filename = `旺季备货付款统计_${filters.year || '全部'}.xlsx`;
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

  // 修改后的付款统计表格列 - 支持合并行显示同一供应商，增加总额列，付款单数可点击
  const supplierColumns: ColumnsType<SupplierStats> = [
    {
      title: '供应商',
      dataIndex: 'supplier',
      key: 'supplier',
      fixed: 'left',
      width: 150,
      align: 'center',
      render: (text, record) => {
        const obj = {
          children: <Text strong>{text}</Text>,
          props: {} as any,
        };
        if (record.rowSpan) {
          obj.props.rowSpan = record.rowSpan;
        } else {
          obj.props.rowSpan = 0;
        }
        return obj;
      }
    },
    {
      title: '年份',
      dataIndex: 'year',
      key: 'year',
      width: 80,
      align: 'center',
      render: (text, record) => {
        const obj = {
          children: text,
          props: {} as any,
        };
        if (record.rowSpan) {
          obj.props.rowSpan = record.rowSpan;
        } else {
          obj.props.rowSpan = 0;
        }
        return obj;
      }
    },
    {
      title: '付款类型',
      dataIndex: 'payment_type',
      key: 'payment_type',
      width: 150,
      align: 'center',
      render: (text) => {
        // 给不同付款类型添加颜色标识
        let color = '#108ee9';
        if (text?.includes('预付')) color = '#87d068';
        else if (text?.includes('尾款')) color = '#f50';
        else if (text?.includes('阶段')) color = '#2db7f5';
        
        return <Text style={{ color }}>{text}</Text>;
      }
    },
    {
      title: '付款单数',
      dataIndex: 'payment_count',
      key: 'payment_count',
      width: 100,
      align: 'center',
      render: (value, record) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />}
          onClick={() => handleShowPaymentDetails(record.supplier, record.payment_type, value)}
          style={{ padding: 0, color: '#1890ff' }}
        >
          {value?.toLocaleString()}
        </Button>
      )
    },
    {
      title: '付款金额',
      dataIndex: 'total_payment_amount',
      key: 'total_payment_amount',
      width: 140,
      align: 'right',
      render: (value) => value ? `¥${value.toLocaleString()}` : '-'
    },
    {
      title: '总额',
      dataIndex: 'supplier_total',
      key: 'supplier_total',
      width: 140,
      align: 'right',
      render: (value, record) => {
        const obj = {
          children: record.rowSpan ? (
            <Text strong style={{ color: '#1890ff' }}>
              ¥{value?.toLocaleString() || '-'}
            </Text>
          ) : null,
          props: {} as any,
        };
        if (record.rowSpan) {
          obj.props.rowSpan = record.rowSpan;
        } else {
          obj.props.rowSpan = 0;
        }
        return obj;
      }
    }
  ];

  // 付款详细记录表格列
  const paymentDetailColumns: ColumnsType<PaymentDetail> = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_, record, index) => index + 1
    },
    {
      title: '付款金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right',
      render: (value) => `¥${value.toLocaleString()}`
    },
    {
      title: '付款日期',
      dataIndex: 'payment_date',
      key: 'payment_date',
      width: 120,
      align: 'center',
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: '备注',
      dataIndex: 'description',
      key: 'description',
      align: 'center',
      render: (text) => text || '-'
    }
  ];

  console.log('组件渲染，当前状态:', { yearlyStats, skuDetails, supplierStats, filters, loading });

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>
          <BarChartOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
          旺季备货汇总
        </Title>
        
        {/* 调试信息 */}
        <Card size="small" style={{ marginBottom: '16px', backgroundColor: '#f6f6f6' }}>
          <Text type="secondary">
            调试信息: 年度统计数据数量：{yearlyStats.length}，SKU详情数据数量：{skuDetails.length}，
            付款统计数据数量：{supplierStats.length}，当前年份：{filters.year}，加载状态：{loading ? '加载中' : '已完成'}
          </Text>
        </Card>
        
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
        {yearlyStats.length > 0 ? (
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
                        value={stats.total_shipped_quantity || 0}
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
        ) : (
          <Card style={{ marginBottom: '24px', textAlign: 'center' }}>
            <Text type="secondary">暂无年度统计数据，正在加载中...</Text>
          </Card>
        )}
      </div>

      {/* 详细数据表格 - 调整tab顺序，付款统计放在第二位 */}
      <Card>
        <Tabs activeKey={activeTab} onChange={handleTabChange}>
          <Tabs.TabPane tab="概览" key="overview">
            <div>
              <p>请切换到"付款统计"或"SKU详情"标签页查看详细数据。</p>
              <p>当前数据状态：年度统计 {yearlyStats.length} 条记录</p>
              <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#fafafa', borderRadius: '6px' }}>
                <Title level={4}>付款类型说明</Title>
                <ul>
                  <li><Text style={{ color: '#87d068' }}>预付款</Text> - 订单确认后的初期付款（优先级1）</li>
                  <li><Text style={{ color: '#2db7f5' }}>阶段付款</Text> - 生产过程中的分阶段付款（优先级2）</li>
                  <li><Text style={{ color: '#f50' }}>尾款</Text> - 订单完成前的最终付款（优先级3）</li>
                  <li><Text style={{ color: '#108ee9' }}>其他</Text> - 其他类型的付款（优先级4）</li>
                </ul>
                <p style={{ marginTop: '12px' }}>
                  <Text type="secondary">💡 提示: 点击"付款单数"列的数字可以查看该付款类型的详细记录</Text>
                </p>
              </div>
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane tab="付款统计" key="supplier-stats">
            <div>
              <Table
                columns={supplierColumns}
                dataSource={supplierStats}
                rowKey={(record, index) => `${record.supplier}-${record.year}-${record.payment_type}-${index}`}
                loading={loading}
                scroll={{ x: 700 }}
                pagination={false}
                size="small"
                bordered
                summary={() => (
                  <Table.Summary.Row style={{ backgroundColor: '#fafafa' }}>
                    <Table.Summary.Cell index={0} colSpan={5} align="center">
                      <Text strong style={{ fontSize: '16px' }}>全部供应商总计</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="center">
                      <Text strong style={{ fontSize: '16px', color: '#1890ff' }}>
                        ¥{calculateGrandTotal().toLocaleString()}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane tab="SKU详情" key="sku-details">
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
          </Tabs.TabPane>
          <Tabs.TabPane tab="日发货详情" key="daily-shipments">
            <DailyShipmentsDetail />
          </Tabs.TabPane>
        </Tabs>
      </Card>

      {/* 付款详细记录模态框 */}
      <Modal
        title={
          <div>
            <EyeOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
            付款详细记录
            {selectedPaymentInfo && (
              <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                供应商：{selectedPaymentInfo.supplier} | 
                付款类型：{selectedPaymentInfo.paymentType} | 
                总单数：{selectedPaymentInfo.count}
              </div>
            )}
          </div>
        }
        open={paymentDetailVisible}
        onCancel={() => setPaymentDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPaymentDetailVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <Table
          columns={paymentDetailColumns}
          dataSource={paymentDetails}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          bordered
          summary={() => (
            <Table.Summary.Row style={{ backgroundColor: '#fafafa' }}>
              <Table.Summary.Cell index={0} colSpan={1}>
                <Text strong>合计</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1}>
                <Text strong style={{ color: '#1890ff' }}>
                  ¥{paymentDetails.reduce((total, item) => total + Number(item.amount || 0), 0).toLocaleString()}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} colSpan={2}>
                <Text type="secondary">共 {paymentDetails.length} 条记录</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Modal>
    </div>
  );
};

export default PeakSeasonSummary; 