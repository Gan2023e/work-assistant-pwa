import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Card,
  DatePicker,
  Select,
  Button,
  Row,
  Col,
  Statistic,
  Space,
  message,
  Spin,
  Empty,
  Tabs,
  Tag
} from 'antd';
import {
  ReloadOutlined,
  DownloadOutlined,
  CalendarOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { apiClient } from '../../config/api';
import dayjs, { Dayjs } from 'dayjs';
import type { RangePickerProps } from 'antd/es/date-picker';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { TabPane } = Tabs;

interface DailyShipmentRecord {
  shipment_date: string;
  sku: string;
  color: string;
  total_quantity: number;
  record_count: number;
  first_entry_date: string;
  last_entry_date: string;
  record_ids: string;
  supplier_name: string;
  parent_sku: string;
}

interface DailySummaryRecord {
  date: string;
  unique_skus: number;
  total_quantity: number;
  total_records: number;
}

interface SkuSummaryRecord {
  sku: string;
  ship_days: number;
  total_quantity: number;
  total_records: number;
  first_ship_date: string;
  last_ship_date: string;
}

const DailyShipmentsDetail: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [shipmentData, setShipmentData] = useState<DailyShipmentRecord[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummaryRecord[]>([]);
  const [skuSummary, setSkuSummary] = useState<SkuSummaryRecord[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    total: 0,
    pageSize: 50
  });
  
  // 筛选条件
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [years, setYears] = useState<number[]>([]);

  // 获取年份列表
  const fetchYears = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/peak-season/years');
      if (response.data.code === 0) {
        setYears(response.data.data);
      }
    } catch (error) {
      console.error('获取年份列表失败:', error);
    }
  }, []);

  // 获取日发货详情数据
  const fetchShipmentData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit: pagination.pageSize,
        year: selectedYear
      };

      if (dateRange) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }

      // 构建查询参数字符串
      const queryString = new URLSearchParams(params).toString();
      const response = await apiClient.get(`/api/peak-season/daily-shipments?${queryString}`);
      
      if (response.data.code === 0) {
        setShipmentData(response.data.data.records);
        setPagination({
          current: response.data.data.pagination.current,
          total: response.data.data.pagination.total,
          pageSize: response.data.data.pagination.pageSize
        });
      } else {
        message.error(response.data.message || '获取数据失败');
      }
    } catch (error) {
      console.error('获取日发货详情失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, dateRange, pagination.pageSize]);

  // 获取统计汇总数据
  const fetchSummaryData = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const params: any = {
        year: selectedYear
      };

      if (dateRange) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }

      // 构建查询参数字符串
      const queryString = new URLSearchParams(params).toString();
      const response = await apiClient.get(`/api/peak-season/daily-shipments-summary?${queryString}`);
      
      if (response.data.code === 0) {
        setDailySummary(response.data.data.dailySummary);
        setSkuSummary(response.data.data.skuSummary);
      } else {
        message.error(response.data.message || '获取统计数据失败');
      }
    } catch (error) {
      console.error('获取统计汇总失败:', error);
      message.error('获取统计数据失败');
    } finally {
      setSummaryLoading(false);
    }
  }, [selectedYear, dateRange]);

  // 初始化数据
  useEffect(() => {
    fetchYears();
  }, [fetchYears]);

  useEffect(() => {
    fetchShipmentData(1);
    fetchSummaryData();
  }, [selectedYear, dateRange]);

  // 处理页码变化
  const handleTableChange = (page: number) => {
    fetchShipmentData(page);
  };

  // 处理筛选条件变化
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };

  const handleDateRangeChange = (dates: any, dateStrings: [string, string]) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange([dates[0], dates[1]]);
    } else {
      setDateRange(null);
    }
  };

  // 刷新数据
  const handleRefresh = () => {
    fetchShipmentData(pagination.current);
    fetchSummaryData();
  };

  // 表格列定义
  const columns = [
    {
      title: '发货日期',
      dataIndex: 'shipment_date',
      key: 'shipment_date',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
      sorter: (a: DailyShipmentRecord, b: DailyShipmentRecord) => 
        dayjs(a.shipment_date).unix() - dayjs(b.shipment_date).unix(),
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 150,
      render: (sku: string) => (
        <Tag color="blue" style={{ fontSize: '12px' }}>
          {sku}
        </Tag>
      )
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      width: 100,
      render: (color: string) => (
        <Tag color="green" style={{ fontSize: '12px' }}>
          {color}
        </Tag>
      )
    },
    {
      title: '厂家名称',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 120,
      render: (supplierName: string) => (
        supplierName ? (
          <Tag color="purple" style={{ fontSize: '12px' }}>
            {supplierName}
          </Tag>
        ) : (
          <span style={{ color: '#999' }}>未关联</span>
        )
      )
    },
    {
      title: '发货数量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 120,
      align: 'right' as const,
      render: (quantity: number) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
          {quantity.toLocaleString()}
        </span>
      ),
      sorter: (a: DailyShipmentRecord, b: DailyShipmentRecord) => 
        a.total_quantity - b.total_quantity,
    },
    {
      title: '记录数',
      dataIndex: 'record_count',
      key: 'record_count',
      width: 100,
      align: 'right' as const,
    },
    {
      title: '录入时间范围',
      key: 'entry_time_range',
      width: 200,
      render: (record: DailyShipmentRecord) => {
        const firstEntry = dayjs(record.first_entry_date);
        const lastEntry = dayjs(record.last_entry_date);
        
        if (firstEntry.isSame(lastEntry, 'day')) {
          return firstEntry.format('YYYY-MM-DD HH:mm');
        } else {
          return (
            <div>
              <div>首次: {firstEntry.format('MM-DD HH:mm')}</div>
              <div>最后: {lastEntry.format('MM-DD HH:mm')}</div>
            </div>
          );
        }
      }
    }
  ];

  // 日汇总表格列
  const dailySummaryColumns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '不同SKU数',
      dataIndex: 'unique_skus',
      key: 'unique_skus',
      align: 'right' as const,
    },
    {
      title: '总发货量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      align: 'right' as const,
      render: (quantity: number) => quantity.toLocaleString(),
    },
    {
      title: '总记录数',
      dataIndex: 'total_records',
      key: 'total_records',
      align: 'right' as const,
    }
  ];

  // SKU汇总表格列
  const skuSummaryColumns = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      render: (sku: string) => (
        <Tag color="blue">{sku}</Tag>
      )
    },
    {
      title: '发货天数',
      dataIndex: 'ship_days',
      key: 'ship_days',
      align: 'right' as const,
    },
    {
      title: '累计发货量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      align: 'right' as const,
      render: (quantity: number) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
          {quantity.toLocaleString()}
        </span>
      ),
    },
    {
      title: '总记录数',
      dataIndex: 'total_records',
      key: 'total_records',
      align: 'right' as const,
    },
    {
      title: '发货时间范围',
      key: 'date_range',
      render: (record: SkuSummaryRecord) => (
        <div style={{ fontSize: '12px' }}>
          <div>{dayjs(record.first_ship_date).format('YYYY-MM-DD')}</div>
          <div>至</div>
          <div>{dayjs(record.last_ship_date).format('YYYY-MM-DD')}</div>
        </div>
      )
    }
  ];

  return (
    <div style={{ padding: '0 24px' }}>
      <Card>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <label style={{ marginRight: 8 }}>年份:</label>
            <Select
              value={selectedYear}
              onChange={handleYearChange}
              style={{ width: '100%' }}
            >
              {years.map(year => (
                <Option key={year} value={year}>{year}年</Option>
              ))}
            </Select>
          </Col>
          
          <Col span={10}>
            <label style={{ marginRight: 8 }}>日期范围:</label>
            <RangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              placeholder={['开始日期', '结束日期']}
            />
          </Col>
          
          <Col span={8}>
            <Space>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={loading || summaryLoading}
              >
                刷新数据
              </Button>
            </Space>
          </Col>
        </Row>

        <Tabs defaultActiveKey="details">
          <TabPane tab={<span><BarChartOutlined />发货明细</span>} key="details">
            <Table
              columns={columns}
              dataSource={shipmentData}
              loading={loading}
              pagination={{
                current: pagination.current,
                total: pagination.total,
                pageSize: pagination.pageSize,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条记录`,
                onChange: handleTableChange,
                onShowSizeChange: (current, size) => {
                  setPagination(prev => ({ ...prev, pageSize: size }));
                  fetchShipmentData(1);
                }
              }}
              rowKey={(record) => `${record.shipment_date}-${record.sku}-${record.color}`}
              size="small"
              scroll={{ x: 800 }}
            />
          </TabPane>

          <TabPane tab={<span><CalendarOutlined />日汇总</span>} key="daily">
            <Card loading={summaryLoading}>
              <Table
                columns={dailySummaryColumns}
                dataSource={dailySummary}
                pagination={{ pageSize: 10 }}
                rowKey="date"
                size="small"
              />
            </Card>
          </TabPane>

          <TabPane tab={<span><BarChartOutlined />SKU汇总</span>} key="sku">
            <Card loading={summaryLoading}>
              <Table
                columns={skuSummaryColumns}
                dataSource={skuSummary}
                pagination={{ pageSize: 10 }}
                rowKey="sku"
                size="small"
              />
            </Card>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default DailyShipmentsDetail; 