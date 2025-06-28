import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  message, 
  Space, 
  Tag,
  Card,
  Row,
  Col,
  Input,
  Select,
  DatePicker,
  Popconfirm,
  Typography,
  Tooltip
} from 'antd';
import type { TableProps } from 'antd';
import { 
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  HistoryOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface ShipmentHistoryRecord {
  shipment_id: number;
  shipment_number: string;
  operator: string;
  total_boxes: number;
  total_items: number;
  shipping_method: string;
  status: '准备中' | '已发货' | '已取消';
  remark: string;
  created_at: string;
  updated_at: string;
  total_requested: number;
  total_shipped: number;
  completion_status: '部分完成' | '全部完成';
  order_count: number;
}

interface Pagination {
  current: number;
  pageSize: number;
  total: number;
}

const ShipmentHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<ShipmentHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<ShipmentHistoryRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    current: 1,
    pageSize: 20,
    total: 0
  });
  
  // 筛选条件
  const [filters, setFilters] = useState<{
    status: string;
    operator: string;
    date_range: [dayjs.Dayjs, dayjs.Dayjs] | null;
  }>({
    status: '',
    operator: '',
    date_range: null
  });

  // 获取发货历史数据
  const fetchShipmentHistory = async (page = 1, pageSize = 20) => {
    setLoading(true);
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString()
      });
      
      // 添加筛选条件
      if (filters.status) {
        params.append('status', filters.status);
      }
      if (filters.operator) {
        params.append('operator', filters.operator);
      }
      if (filters.date_range && filters.date_range[0] && filters.date_range[1]) {
        params.append('date_from', filters.date_range[0].format('YYYY-MM-DD'));
        params.append('date_to', filters.date_range[1].format('YYYY-MM-DD'));
      }
      
      const response = await fetch(`${API_BASE_URL}/api/shipping/shipment-history?${params}`, {
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
        setData(result.data.records || []);
        setPagination({
          current: result.data.pagination.current,
          pageSize: result.data.pagination.pageSize,
          total: result.data.pagination.total
        });
      } else {
        message.error(result.message || '获取发货历史失败');
      }
    } catch (error) {
      console.error('获取发货历史失败:', error);
      message.error('获取发货历史失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  // 批量删除发货记录
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的记录');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/shipment-history`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
        body: JSON.stringify({
          shipment_ids: selectedRowKeys
        }),
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success(`成功删除 ${selectedRowKeys.length} 条发货记录`);
        setSelectedRowKeys([]);
        setSelectedRows([]);
        await fetchShipmentHistory(pagination.current, pagination.pageSize);
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除发货记录失败:', error);
      message.error('删除失败，请检查网络连接');
    }
  };

  // 搜索处理
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchShipmentHistory(1, pagination.pageSize);
  };

  // 重置筛选
  const handleReset = () => {
    setFilters({
      status: '',
      operator: '',
      date_range: null
    });
    setPagination(prev => ({ ...prev, current: 1 }));
    // 重置后立即搜索
    setTimeout(() => {
      fetchShipmentHistory(1, pagination.pageSize);
    }, 100);
  };

  // 状态颜色映射
  const getStatusColor = (status: string) => {
    switch (status) {
      case '准备中': return 'orange';
      case '已发货': return 'green';
      case '已取消': return 'red';
      default: return 'default';
    }
  };

  // 完成状态颜色映射
  const getCompletionColor = (status: string) => {
    switch (status) {
      case '全部完成': return 'green';
      case '部分完成': return 'orange';
      default: return 'default';
    }
  };

  // 表格列定义
  const columns: ColumnsType<ShipmentHistoryRecord> = [
    {
      title: '发货单号',
      dataIndex: 'shipment_number',
      key: 'shipment_number',
      width: 180,
      fixed: 'left',
      render: (text: string) => (
        <Text strong style={{ color: '#1890ff' }}>{text}</Text>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      align: 'center',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      )
    },
    {
      title: '完成状态',
      dataIndex: 'completion_status',
      key: 'completion_status',
      width: 100,
      align: 'center',
      render: (status: string) => (
        <Tag color={getCompletionColor(status)}>{status}</Tag>
      )
    },
    {
      title: '发货数量',
      key: 'shipping_quantity',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Text>
          {record.total_shipped}
          {record.total_requested > 0 && (
            <Text type="secondary">/{record.total_requested}</Text>
          )}
        </Text>
      )
    },
    {
      title: '箱数',
      dataIndex: 'total_boxes',
      key: 'total_boxes',
      width: 80,
      align: 'center',
      render: (value: number) => value || '-'
    },
    {
      title: '件数',
      dataIndex: 'total_items',
      key: 'total_items',
      width: 80,
      align: 'center'
    },
    {
      title: '需求单数',
      dataIndex: 'order_count',
      key: 'order_count',
      width: 90,
      align: 'center',
      render: (count: number) => (
        <Tag color="blue">{count}</Tag>
      )
    },
    {
      title: '运输方式',
      dataIndex: 'shipping_method',
      key: 'shipping_method',
      width: 100,
      render: (value: string) => value || '-'
    },
    {
      title: '操作员',
      dataIndex: 'operator',
      key: 'operator',
      width: 100
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 200,
      ellipsis: {
        showTitle: false
      },
      render: (text: string) => (
        <Tooltip placement="topLeft" title={text}>
          {text || '-'}
        </Tooltip>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button 
              type="primary" 
              size="small" 
              icon={<EyeOutlined />}
              onClick={() => {
                // TODO: 实现查看详情功能
                message.info('查看详情功能待实现');
              }}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  // 行选择配置
  const rowSelection: TableProps<ShipmentHistoryRecord>['rowSelection'] = {
    selectedRowKeys,
    onChange: (selectedRowKeys: React.Key[], selectedRows: ShipmentHistoryRecord[]) => {
      setSelectedRowKeys(selectedRowKeys);
      setSelectedRows(selectedRows);
    },
    getCheckboxProps: (record: ShipmentHistoryRecord) => ({
      disabled: false,
      name: record.shipment_number,
    }),
  };

  useEffect(() => {
    fetchShipmentHistory();
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <HistoryOutlined /> 发货历史
      </Title>
      
      {/* 筛选条件 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Space>
              <Text>状态:</Text>
              <Select
                value={filters.status}
                onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                style={{ width: 120 }}
                allowClear
                placeholder="全部状态"
              >
                <Option value="准备中">准备中</Option>
                <Option value="已发货">已发货</Option>
                <Option value="已取消">已取消</Option>
              </Select>
            </Space>
          </Col>
          <Col>
            <Space>
              <Text>操作员:</Text>
              <Input
                value={filters.operator}
                onChange={(e) => setFilters(prev => ({ ...prev, operator: e.target.value }))}
                placeholder="输入操作员姓名"
                style={{ width: 150 }}
                allowClear
              />
            </Space>
          </Col>
          <Col>
            <Space>
              <Text>日期范围:</Text>
              <RangePicker
                value={filters.date_range}
                onChange={(dates) => {
                  const dateRange = dates && dates[0] && dates[1] ? [dates[0], dates[1]] as [dayjs.Dayjs, dayjs.Dayjs] : null;
                  setFilters(prev => ({ ...prev, date_range: dateRange }));
                }}
                style={{ width: 280 }}
              />
            </Space>
          </Col>
          <Col>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                搜索
              </Button>
              <Button onClick={handleReset}>
                重置
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => fetchShipmentHistory(pagination.current, pagination.pageSize)}>
                刷新
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 操作栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Text>已选择 <Text strong>{selectedRowKeys.length}</Text> 项</Text>
              {selectedRowKeys.length > 0 && (
                <Popconfirm
                  title="确认删除"
                  description={`确定要删除选中的 ${selectedRowKeys.length} 条发货记录吗？此操作不可恢复。`}
                  icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
                  onConfirm={handleBatchDelete}
                  okText="确认删除"
                  cancelText="取消"
                  okType="danger"
                >
                  <Button 
                    type="primary" 
                    danger 
                    icon={<DeleteOutlined />}
                    disabled={selectedRowKeys.length === 0}
                  >
                    批量删除
                  </Button>
                </Popconfirm>
              )}
            </Space>
          </Col>
          <Col>
            <Text type="secondary">
              共 {pagination.total} 条记录
            </Text>
          </Col>
        </Row>
      </Card>

      {/* 数据表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="shipment_id"
          rowSelection={rowSelection}
          loading={loading}
          size="small"
          scroll={{ x: 1400, y: 600 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination(prev => ({ ...prev, current: page, pageSize: pageSize || 20 }));
              fetchShipmentHistory(page, pageSize);
            }
          }}
        />
      </Card>
    </div>
  );
};

export default ShipmentHistoryPage; 