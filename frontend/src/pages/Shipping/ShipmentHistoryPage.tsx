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
  Tooltip,
  Statistic
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
  normal_orders?: number;
  temp_orders?: number;
  has_temp_shipment?: boolean;
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

  // 发货详情相关状态
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(null);
  const [shipmentDetails, setShipmentDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

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

  // 单个删除发货记录
  const handleSingleDelete = async (shipmentId: number, shipmentNumber: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/shipment-history`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
        body: JSON.stringify({
          shipment_ids: [shipmentId]
        }),
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success(`成功删除发货记录 ${shipmentNumber} 并恢复相应库存`);
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
      render: (count: number, record: ShipmentHistoryRecord) => (
        <div>
          <Tag color="blue">{count}</Tag>
          {record.has_temp_shipment && (
            <div style={{ marginTop: 2 }}>
              <Tag color="orange" style={{ fontSize: '10px' }}>含临时</Tag>
            </div>
          )}
        </div>
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
      width: 120,
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
                setSelectedShipmentId(record.shipment_id);
                setDetailsModalVisible(true);
                fetchShipmentDetails(record.shipment_id);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除发货记录"
            description={
              <div>
                <div>确定要删除发货记录 <Text strong>{record.shipment_number}</Text> 吗？</div>
                <div style={{ color: '#1890ff', marginTop: 4 }}>
                  删除后将自动恢复相应的库存状态
                </div>
              </div>
            }
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
            onConfirm={() => handleSingleDelete(record.shipment_id, record.shipment_number)}
            okText="确认删除"
            cancelText="取消"
            okType="danger"
          >
            <Tooltip title="删除记录并恢复库存">
              <Button 
                type="primary" 
                danger 
                size="small" 
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
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

  // 获取发货详情
  const fetchShipmentDetails = async (shipmentId: number) => {
    setDetailsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/shipment-history/${shipmentId}/details`, {
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
        setShipmentDetails(result.data);
      } else {
        message.error(result.message || '获取发货详情失败');
      }
    } catch (error) {
      console.error('获取发货详情失败:', error);
      message.error('获取发货详情失败，请检查网络连接');
    } finally {
      setDetailsLoading(false);
    }
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
          scroll={{ x: 1440, y: 600 }}
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

             {/* 发货详情模态框 */}
       <Modal
         visible={detailsModalVisible}
         onCancel={() => {
           setDetailsModalVisible(false);
           setShipmentDetails(null);
           setSelectedShipmentId(null);
         }}
         footer={null}
         width={1000}
         title={`发货详情 - ${shipmentDetails?.shipment_record?.shipment_number || '加载中...'}`}
       >
         {detailsLoading ? (
           <div style={{ textAlign: 'center', padding: '50px' }}>
             <Text>正在加载发货详情...</Text>
           </div>
         ) : shipmentDetails ? (
           <div>
             {/* 基本信息 */}
             <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
               <Row gutter={16}>
                 <Col span={8}>
                   <Text strong>发货单号：</Text>
                   <Text copyable>{shipmentDetails.shipment_record.shipment_number}</Text>
                 </Col>
                 <Col span={8}>
                   <Text strong>状态：</Text>
                   <Tag color={getStatusColor(shipmentDetails.shipment_record.status)}>
                     {shipmentDetails.shipment_record.status}
                   </Tag>
                 </Col>
                 <Col span={8}>
                   <Text strong>物流商：</Text>
                   <Text>{shipmentDetails.shipment_record.logistics_provider || '-'}</Text>
                 </Col>
               </Row>
               <Row gutter={16} style={{ marginTop: 8 }}>
                 <Col span={8}>
                   <Text strong>操作员：</Text>
                   <Text>{shipmentDetails.shipment_record.operator}</Text>
                 </Col>
                 <Col span={8}>
                   <Text strong>运输方式：</Text>
                   <Text>{shipmentDetails.shipment_record.shipping_method || '-'}</Text>
                 </Col>
                 <Col span={8}>
                   <Text strong>创建时间：</Text>
                   <Text>{new Date(shipmentDetails.shipment_record.created_at).toLocaleString('zh-CN')}</Text>
                 </Col>
               </Row>
               {shipmentDetails.shipment_record.remark && (
                 <Row style={{ marginTop: 8 }}>
                   <Col span={24}>
                     <Text strong>备注：</Text>
                     <Text>{shipmentDetails.shipment_record.remark}</Text>
                   </Col>
                 </Row>
               )}
             </Card>
             
             {/* 统计汇总 */}
             <Card title="发货汇总" size="small" style={{ marginBottom: 16 }}>
               <Row gutter={16}>
                                 <Col span={6}>
                  <Statistic 
                    title="需求单数" 
                    value={shipmentDetails.summary.total_need_orders}
                    suffix={shipmentDetails.summary.temp_orders > 0 ? "（含临时）" : ""}
                  />
                </Col>
                 <Col span={6}>
                   <Statistic title="SKU数量" value={shipmentDetails.summary.total_sku_count} />
                 </Col>
                 <Col span={6}>
                   <Statistic title="发货数量" value={`${shipmentDetails.summary.total_shipped}/${shipmentDetails.summary.total_requested}`} />
                 </Col>
                 <Col span={6}>
                   <Statistic 
                     title="完成率" 
                     value={shipmentDetails.summary.overall_completion_rate} 
                     suffix="%" 
                     valueStyle={{ color: shipmentDetails.summary.overall_completion_rate === 100 ? '#3f8600' : '#faad14' }}
                   />
                 </Col>
               </Row>
             </Card>
             
             {/* 发货明细 */}
             <Card title="发货明细" size="small">
               <Table
                 dataSource={shipmentDetails.shipment_items}
                 columns={[
                   { 
                    title: '需求单号', 
                    dataIndex: 'need_num', 
                    key: 'need_num', 
                    width: 140,
                    render: (needNum: string) => {
                      const isTemporary = needNum && needNum.startsWith('TEMP-');
                      return (
                        <div>
                          <Text style={{ color: isTemporary ? '#faad14' : undefined }}>
                            {needNum}
                          </Text>
                          {isTemporary && (
                            <div>
                              <Tag color="orange">临时发货</Tag>
                            </div>
                          )}
                        </div>
                      );
                    }
                  },
                   { title: '本地SKU', dataIndex: 'local_sku', key: 'local_sku', width: 120 },
                   { title: 'Amazon SKU', dataIndex: 'amz_sku', key: 'amz_sku', width: 130 },
                   { title: '国家', dataIndex: 'country', key: 'country', width: 80, align: 'center' },
                   { title: '平台', dataIndex: 'marketplace', key: 'marketplace', width: 80 },
                   { 
                     title: '需求数量', 
                     dataIndex: 'requested_quantity', 
                     key: 'requested_quantity', 
                     width: 90, 
                     align: 'center' 
                   },
                   { 
                     title: '发货数量', 
                     dataIndex: 'shipped_quantity', 
                     key: 'shipped_quantity', 
                     width: 90, 
                     align: 'center',
                     render: (value: number, record: any) => (
                       <Text type={value >= record.requested_quantity ? 'success' : 'warning'}>
                         {value}
                       </Text>
                     )
                   },
                   { 
                     title: '整箱数', 
                     dataIndex: 'whole_boxes', 
                     key: 'whole_boxes', 
                     width: 80, 
                     align: 'center',
                     render: (value: number) => value || '-'
                   },
                   { 
                     title: '混合箱数量', 
                     dataIndex: 'mixed_box_quantity', 
                     key: 'mixed_box_quantity', 
                     width: 100, 
                     align: 'center',
                     render: (value: number) => value || '-'
                   }
                 ]}
                 pagination={false}
                 size="small"
                 rowKey="shipment_item_id"
                 scroll={{ y: 300 }}
               />
             </Card>
           </div>
         ) : (
           <div style={{ textAlign: 'center', padding: '50px' }}>
             <Text type="secondary">暂无详情数据</Text>
           </div>
         )}
       </Modal>
    </div>
  );
};

export default ShipmentHistoryPage; 