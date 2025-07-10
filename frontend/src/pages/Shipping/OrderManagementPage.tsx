import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  InputNumber, 
  message, 
  Space, 
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Divider,
  Progress,
  Descriptions,
  Alert,
  Tooltip
} from 'antd';
import { 
  EyeOutlined,
  EditOutlined,
  ShopOutlined,
  HistoryOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';

const { Title, Text } = Typography;

interface OrderSummary {
  need_num: string;
  total_items: number;
  total_quantity: number;
  total_shipped: number;
  remaining_quantity: number;
  created_at: string;
  updated_at: string;
  country: string;
  marketplace: string;
  shipping_method: string;
  order_status: string;
  completion_rate: number;
  shipment_count: number;
  latest_shipment: {
    shipment_number: string;
    created_at: string;
    operator: string;
  } | null;
}

interface OrderItem {
  record_num: number;
  need_num: string;
  sku: string;
  amz_sku: string;
  ori_quantity: number;
  country: string;
  marketplace: string;
  shipping_method: string;
  status: string;
  create_date: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  total_available: number;
  shipped_quantity: number;
  remaining_quantity: number;
  shortage: number;
}

interface ShipmentHistory {
  relation_id: number;
  need_num: string;
  shipment_id: number;
  total_requested: number;
  total_shipped: number;
  completion_status: string;
  created_at: string;
  shipment_info: {
    shipment_number: string;
    created_at: string;
    status: string;
    operator: string;
    total_boxes: number;
  };
}

interface OrderDetails {
  order_summary: OrderSummary;
  order_items: OrderItem[];
  shipment_history: ShipmentHistory[];
}

// 新增props类型
interface OrderManagementPageProps {
  needNum?: string;
}

// 修改组件定义，支持props
const OrderManagementPage: React.FC<OrderManagementPageProps> = ({ needNum }) => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<string>('');
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [editForm] = Form.useForm();

  // 分页状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  // 根据props.needNum或selectedOrder决定加载详情还是列表
  useEffect(() => {
    if (needNum) {
      setSelectedOrder(needNum);
      fetchOrderDetails(needNum);
    } else if (selectedOrder) {
      fetchOrderDetails(selectedOrder);
    } else {
      fetchOrders();
    }
    // eslint-disable-next-line
  }, [needNum, selectedOrder]);

  // 获取需求单列表
  const fetchOrders = async (page = 1, pageSize = 20) => {
    setOrdersLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/order-management/orders?page=${page}&limit=${pageSize}`, {
        headers: {
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        setOrders(result.data.list);
        setPagination(prev => ({
          ...prev,
          current: page,
          total: result.data.total
        }));
  
      } else {
        message.error(result.message || '获取需求单列表失败');
      }
    } catch (error) {
      console.error('获取需求单列表失败:', error);
      message.error('获取需求单列表失败');
    } finally {
      setOrdersLoading(false);
    }
  };

  // 获取需求单详情
  const fetchOrderDetails = async (needNum: string) => {
    setDetailsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/order-management/orders/${needNum}/details`, {
        headers: {
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        setOrderDetails(result.data);
  
      } else {
        message.error(result.message || '获取需求单详情失败');
      }
    } catch (error) {
      console.error('获取需求单详情失败:', error);
      message.error('获取需求单详情失败');
    } finally {
      setDetailsLoading(false);
    }
  };

  // 修改需求数量
  const handleEditQuantity = async (values: { quantity: number }) => {
    if (!editingItem) return;
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/order-management/orders/${editingItem.need_num}/items/${editingItem.record_num}`, 
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
          },
          body: JSON.stringify({ quantity: values.quantity }),
        }
      );
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success('需求数量修改成功');
        setEditModalVisible(false);
        // 刷新需求单详情
        if (selectedOrder) {
          await fetchOrderDetails(selectedOrder);
        }
        // 刷新需求单列表
        await fetchOrders(pagination.current, pagination.pageSize);
      } else {
        message.error(result.message || '修改需求数量失败');
      }
    } catch (error) {
      console.error('修改需求数量失败:', error);
      message.error('修改需求数量失败');
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case '待发货':
        return 'blue';
      case '部分发出':
        return 'orange';
      case '全部发出':
        return 'green';
      case '已取消':
        return 'red';
      default:
        return 'default';
    }
  };

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case '待发货':
        return <ClockCircleOutlined />;
      case '部分发出':
        return <ExclamationCircleOutlined />;
      case '全部发出':
        return <CheckCircleOutlined />;
      default:
        return null;
    }
  };

  // 需求单表格列定义
  const orderColumns: ColumnsType<OrderSummary> = [
    {
      title: '需求单号',
      dataIndex: 'need_num',
      key: 'need_num',
      width: 150,
      fixed: 'left',
      render: (text: string) => (
        <Text strong style={{ fontSize: '12px' }}>{text}</Text>
      )
    },
    {
      title: '状态',
      dataIndex: 'order_status',
      key: 'order_status',
      width: 100,
      align: 'center',
      render: (status: string) => (
        <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
          {status}
        </Tag>
      )
    },
    {
      title: '进度',
      key: 'progress',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Progress 
          percent={record.completion_rate} 
          size="small" 
          status={record.completion_rate === 100 ? 'success' : 'active'}
          format={percent => `${percent}%`}
        />
      )
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 80,
      align: 'center'
    },
    {
      title: '平台',
      dataIndex: 'marketplace',
      key: 'marketplace',
      width: 80,
      align: 'center'
    },
    {
      title: 'SKU数量',
      dataIndex: 'total_items',
      key: 'total_items',
      width: 80,
      align: 'center',
      render: (value: number) => <Text strong>{value}</Text>
    },
    {
      title: '总需求',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 80,
      align: 'center',
      render: (value: number) => <Text>{value}</Text>
    },
    {
      title: '已发货',
      dataIndex: 'total_shipped',
      key: 'total_shipped',
      width: 80,
      align: 'center',
      render: (value: number) => <Text type="success">{value}</Text>
    },
    {
      title: '剩余',
      dataIndex: 'remaining_quantity',
      key: 'remaining_quantity',
      width: 80,
      align: 'center',
      render: (value: number) => (
        <Text type={value > 0 ? 'warning' : 'success'}>{value}</Text>
      )
    },
    {
      title: '发货次数',
      dataIndex: 'shipment_count',
      key: 'shipment_count',
      width: 90,
      align: 'center',
      render: (value: number) => (
        <Tag color={value > 0 ? 'blue' : 'default'} icon={<HistoryOutlined />}>
          {value}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
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
                setSelectedOrder(record.need_num);
                fetchOrderDetails(record.need_num);
              }}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  // SKU明细表格列定义
  const itemColumns: ColumnsType<OrderItem> = [
    {
      title: '本地SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      render: (text: string) => <Text>{text}</Text>
    },
    {
      title: 'Amazon SKU',
      dataIndex: 'amz_sku',
      key: 'amz_sku',
      width: 120,
      render: (text: string) => <Text>{text}</Text>
    },
    {
      title: '需求数量',
      dataIndex: 'ori_quantity',
      key: 'ori_quantity',
      width: 90,
      align: 'center',
      render: (value: number) => <Text strong>{value}</Text>
    },
    {
      title: '已发货',
      dataIndex: 'shipped_quantity',
      key: 'shipped_quantity',
      width: 80,
      align: 'center',
      render: (value: number) => <Text type="success">{value}</Text>
    },
    {
      title: '剩余',
      dataIndex: 'remaining_quantity',
      key: 'remaining_quantity',
      width: 80,
      align: 'center',
      render: (value: number) => (
        <Text type={value > 0 ? 'warning' : 'success'}>{value}</Text>
      )
    },
    {
      title: '整箱库存',
      key: 'whole_box_info',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <div>
          <div><Text>{record.whole_box_quantity}</Text></div>
          <div><Text type="secondary" style={{ fontSize: '12px' }}>({record.whole_box_count}箱)</Text></div>
        </div>
      )
    },
    {
      title: '混合箱库存',
      dataIndex: 'mixed_box_quantity',
      key: 'mixed_box_quantity',
      width: 100,
      align: 'center',
      render: (value: number) => <Text>{value}</Text>
    },
    {
      title: '缺货',
      dataIndex: 'shortage',
      key: 'shortage',
      width: 80,
      align: 'center',
      render: (value: number) => (
        value > 0 ? <Text type="danger">{value}</Text> : <Text>-</Text>
      )
    },
    {
      title: '本地SKU',
      dataIndex: 'sku',
      key: 'sku_status',
      width: 120,
      align: 'center',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      align: 'center',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Tooltip title="修改数量">
          <Button 
            type="link" 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => {
              setEditingItem(record);
              editForm.setFieldsValue({ quantity: record.ori_quantity });
              setEditModalVisible(true);
            }}
          />
        </Tooltip>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <ShopOutlined /> 需求单管理
      </Title>
      
      <Row gutter={24}>
        {/* 左侧：需求单列表 */}
        {(needNum || selectedOrder) ? (
          <Col span={24}>
            <Card 
              title={
                <Space>
                  <EyeOutlined />
                  <span>需求单详情: {needNum || selectedOrder}</span>
                  <Button 
                    type="text" 
                    size="small"
                    onClick={() => {
                      setSelectedOrder('');
                      setOrderDetails(null);
                    }}
                  >
                    ×
                  </Button>
                </Space>
              }
              size="small"
              loading={detailsLoading}
            >
              {orderDetails && (
                <div>
                  {/* 需求单概览 */}
                  <Descriptions size="small" column={2} bordered>
                    <Descriptions.Item label="状态">
                      <Tag color={getStatusColor(orderDetails.order_summary.order_status)} icon={getStatusIcon(orderDetails.order_summary.order_status)}>
                        {orderDetails.order_summary.order_status}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="完成进度">
                      <Progress 
                        percent={orderDetails.order_summary.completion_rate} 
                        size="small"
                        status={orderDetails.order_summary.completion_rate === 100 ? 'success' : 'active'}
                      />
                    </Descriptions.Item>
                    <Descriptions.Item label="国家/平台">
                      {orderDetails.order_summary.country} / {orderDetails.order_summary.marketplace}
                    </Descriptions.Item>
                    <Descriptions.Item label="运输方式">
                      {orderDetails.order_summary.shipping_method || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="SKU数量">
                      {orderDetails.order_summary.total_items}
                    </Descriptions.Item>
                    <Descriptions.Item label="发货次数">
                      <Tag color="blue" icon={<HistoryOutlined />}>
                        {orderDetails.order_summary.shipment_count}
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>

                  <Divider />

                  {/* SKU明细 */}
                  <Title level={5}>SKU明细</Title>
                  <Table
                    columns={itemColumns}
                    dataSource={orderDetails.order_items}
                    rowKey="record_num"
                    size="small"
                    scroll={{ y: 300 }}
                    pagination={false}
                  />

                  {/* 发货历史 */}
                  {orderDetails.shipment_history.length > 0 && (
                    <>
                      <Divider />
                      <Title level={5}>发货历史</Title>
                      {orderDetails.shipment_history.map((history, index) => (
                        <Alert
                          key={history.relation_id}
                          message={
                            <Space>
                              <Text strong>{history.shipment_info.shipment_number}</Text>
                              <Tag color={history.completion_status === '全部完成' ? 'green' : 'orange'}>
                                {history.completion_status}
                              </Tag>
                            </Space>
                          }
                          description={
                            <div>
                              <Text>发货数量: {history.total_shipped}/{history.total_requested}</Text>
                              <br />
                              <Text type="secondary">
                                操作员: {history.shipment_info.operator} | 
                                时间: {new Date(history.shipment_info.created_at).toLocaleString('zh-CN')}
                              </Text>
                            </div>
                          }
                          type="info"
                          style={{ marginBottom: 8 }}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}
            </Card>
          </Col>
        ) : (
          <Col span={24}>
            <Card 
              title={
                <Space>
                  <BarChartOutlined />
                  <span>需求单列表</span>
                  <Button 
                    type="primary" 
                    size="small"
                    onClick={() => fetchOrders(pagination.current, pagination.pageSize)}
                  >
                    刷新
                  </Button>
                </Space>
              }
              size="small"
            >
              <Table
                columns={orderColumns}
                dataSource={orders}
                rowKey="need_num"
                loading={ordersLoading}
                size="small"
                scroll={{ x: 1200, y: 400 }}
                pagination={{
                  ...pagination,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                  onChange: (page, pageSize) => {
                    setPagination(prev => ({ ...prev, current: page, pageSize: pageSize || 20 }));
                    fetchOrders(page, pageSize);
                  }
                }}
                rowClassName={(record) => {
                  if (record.need_num === selectedOrder) return 'ant-table-row-selected';
                  return '';
                }}
              />
            </Card>
          </Col>
        )}
      </Row>

      {/* 修改数量模态框 */}
      <Modal
        title="修改需求数量"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => editForm.submit()}
        width={400}
      >
        {editingItem && (
          <Form
            form={editForm}
            onFinish={handleEditQuantity}
            layout="vertical"
          >
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="SKU">{editingItem.sku}</Descriptions.Item>
              <Descriptions.Item label="Amazon SKU">{editingItem.amz_sku}</Descriptions.Item>
              <Descriptions.Item label="已发货数量">{editingItem.shipped_quantity}</Descriptions.Item>
            </Descriptions>
            
            <Form.Item
              label="需求数量"
              name="quantity"
              rules={[
                { required: true, message: '请输入需求数量' },
                { type: 'number', min: editingItem.shipped_quantity, message: `数量不能小于已发货数量(${editingItem.shipped_quantity})` }
              ]}
            >
              <InputNumber 
                min={editingItem.shipped_quantity} 
                style={{ width: '100%' }}
                placeholder="请输入需求数量"
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default OrderManagementPage; 