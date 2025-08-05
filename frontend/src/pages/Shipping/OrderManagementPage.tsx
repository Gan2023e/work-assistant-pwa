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
  Tooltip,
  Popconfirm,
  Input,
  Select,
  DatePicker
} from 'antd';
import { 
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ShopOutlined,
  HistoryOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
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
  local_sku: string; // 添加本地SKU字段
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

interface ConflictSku {
  sku: string;
  existingQuantity: number;
  needNum: string;
  recordNum: number;
  newQuantity: number;
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
  
  // 发货详情Modal相关状态
  const [shipmentDetailsModalVisible, setShipmentDetailsModalVisible] = useState(false);
  const [shipmentDetailsLoading, setShipmentDetailsLoading] = useState(false);
  const [shipmentDetails, setShipmentDetails] = useState<any>(null);
  
  // 添加需求单Modal相关状态
  const [addOrderModalVisible, setAddOrderModalVisible] = useState(false);
  const [addOrderForm] = Form.useForm();
  
  // SKU冲突相关状态
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const [conflictSkus, setConflictSkus] = useState<any[]>([]);
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0);
  const [conflictResolutions, setConflictResolutions] = useState<{[key: string]: string}>({});
  const [pendingOrderData, setPendingOrderData] = useState<any>(null);

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

  // 获取发货详情
  const fetchShipmentDetails = async (shipmentId: number) => {
    setShipmentDetailsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/shipment-history/${shipmentId}/details`, {
        headers: {
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        setShipmentDetails(result.data);
        setShipmentDetailsModalVisible(true);
      } else {
        message.error(result.message || '获取发货详情失败');
      }
    } catch (error) {
      console.error('获取发货详情失败:', error);
      message.error('获取发货详情失败');
    } finally {
      setShipmentDetailsLoading(false);
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

  // 检查SKU冲突
  const checkSkuConflicts = async (skuData: string, orderInfo: any) => {
    try {
      // 解析SKU数据
      const skuLines = skuData.trim().split('\n').filter(line => line.trim());
      const skus = skuLines.map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          sku: parts[0],
          quantity: parseInt(parts[1]) || 0
        };
      }).filter(item => item.sku && item.quantity > 0);

      if (skus.length === 0) {
        message.error('请输入有效的SKU和数量');
        return;
      }

      // 检查每个SKU是否有待发需求
      const response = await fetch(`${API_BASE_URL}/api/order-management/check-conflicts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
        body: JSON.stringify({
          skus: skus.map(s => s.sku),
          country: orderInfo.country,
          marketplace: orderInfo.marketplace
        })
      });

      const result = await response.json();
      
      if (result.code === 0) {
        const conflicts = result.data.conflicts || [];
        
        if (conflicts.length > 0) {
          // 有冲突，开始冲突解决流程
          const conflictSkuData = conflicts.map((conflict: any) => {
            const inputSku = skus.find(s => s.sku === conflict.sku);
            return {
              ...conflict,
              newQuantity: inputSku?.quantity || 0
            };
          });
          
          setConflictSkus(conflictSkuData);
          setCurrentConflictIndex(0);
          setConflictResolutions({});
          setPendingOrderData({
            orderInfo,
            allSkus: skus,
            nonConflictSkus: skus.filter(s => !conflicts.some((c: any) => c.sku === s.sku))
          });
          setConflictModalVisible(true);
        } else {
          // 没有冲突，直接创建需求单
          await createNewOrder({
            ...orderInfo,
            sku_data: skuData
          });
        }
      } else {
        message.error(result.message || '检查SKU冲突失败');
      }
    } catch (error) {
      console.error('检查SKU冲突失败:', error);
      message.error('检查SKU冲突失败');
    }
  };

  // 处理冲突解决选择
  const handleConflictResolution = (resolution: string) => {
    const currentSku = conflictSkus[currentConflictIndex];
    const newResolutions = {
      ...conflictResolutions,
      [currentSku.sku]: resolution
    };
    setConflictResolutions(newResolutions);

    if (currentConflictIndex < conflictSkus.length - 1) {
      // 继续下一个冲突
      setCurrentConflictIndex(currentConflictIndex + 1);
    } else {
      // 所有冲突都已处理，执行批量操作
      setConflictModalVisible(false);
      executeConflictResolutions(newResolutions);
    }
  };

  // 执行冲突解决方案
  const executeConflictResolutions = async (resolutions: {[key: string]: string}) => {
    try {
      const updatePromises: Promise<any>[] = [];
      const newOrderSkus: any[] = [];
      const notificationData: any[] = [];

      for (const conflictSku of conflictSkus) {
        const resolution = resolutions[conflictSku.sku];
        const newQuantity = conflictSku.newQuantity;

        switch (resolution) {
          case 'add':
            // 在原基础上添加
            const addQuantity = conflictSku.existingQuantity + newQuantity;
            updatePromises.push(
              fetch(`${API_BASE_URL}/api/order-management/orders/${conflictSku.needNum}/items/${conflictSku.recordNum}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
                },
                body: JSON.stringify({ quantity: addQuantity }),
              })
            );
            notificationData.push({
              sku: conflictSku.sku,
              action: '累加',
              oldQuantity: conflictSku.existingQuantity,
              newQuantity: addQuantity,
              needNum: conflictSku.needNum
            });
            break;

          case 'replace':
            // 用新数量覆盖
            updatePromises.push(
              fetch(`${API_BASE_URL}/api/order-management/orders/${conflictSku.needNum}/items/${conflictSku.recordNum}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
                },
                body: JSON.stringify({ quantity: newQuantity }),
              })
            );
            notificationData.push({
              sku: conflictSku.sku,
              action: '覆盖',
              oldQuantity: conflictSku.existingQuantity,
              newQuantity: newQuantity,
              needNum: conflictSku.needNum
            });
            break;

          case 'new':
            // 加入新需求单
            newOrderSkus.push({
              sku: conflictSku.sku,
              quantity: newQuantity
            });
            break;
        }
      }

      // 执行更新操作
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        
        // 发送钉钉通知
        await sendDingTalkNotification(notificationData);
      }

      // 创建新需求单（包含选择新建的SKU和原本没有冲突的SKU）
      const allNewSkus = [...newOrderSkus, ...pendingOrderData.nonConflictSkus];
      if (allNewSkus.length > 0) {
        const newSkuData = allNewSkus.map(s => `${s.sku} ${s.quantity}`).join('\n');
        await createNewOrder({
          ...pendingOrderData.orderInfo,
          sku_data: newSkuData
        });
      }

      message.success('需求单处理完成');
      
      // 刷新页面数据
      await fetchOrders(pagination.current, pagination.pageSize);
      
      // 清理状态
      setAddOrderModalVisible(false);
      addOrderForm.resetFields();
      setConflictSkus([]);
      setCurrentConflictIndex(0);
      setConflictResolutions({});
      setPendingOrderData(null);

    } catch (error) {
      console.error('执行冲突解决方案失败:', error);
      message.error('处理失败，请稍后重试');
    }
  };

  // 创建新需求单
  const createNewOrder = async (orderData: any) => {
    try {
      const formattedValues = {
        ...orderData,
        send_out_date: orderData.send_out_date ? dayjs(orderData.send_out_date).format('YYYY-MM-DD') : null,
        expect_sold_out_date: orderData.expect_sold_out_date ? dayjs(orderData.expect_sold_out_date).format('YYYY-MM-DD') : null
      };

      const response = await fetch(`${API_BASE_URL}/api/order-management/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
        body: JSON.stringify(formattedValues)
      });

      const result = await response.json();
      
      if (result.code === 0) {
        message.success('需求单创建成功');
        return result.data;
      } else {
        message.error(result.message || '创建失败');
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('创建需求单失败:', error);
      throw error;
    }
  };

  // 发送钉钉通知
  const sendDingTalkNotification = async (notificationData: any[]) => {
    try {
      let message_content = '📦 海外仓补货需求更新通知\n\n';
      
      notificationData.forEach(item => {
        message_content += `🔹 SKU: ${item.sku}\n`;
        message_content += `   操作: ${item.action}\n`;
        message_content += `   原数量: ${item.oldQuantity} → 新数量: ${item.newQuantity}\n`;
        message_content += `   需求单号: ${item.needNum}\n\n`;
      });
      
      message_content += `⏰ 更新时间: ${new Date().toLocaleString('zh-CN')}\n`;
      message_content += `👤 操作员: ${user?.username || '未知'}`;

      const response = await fetch(`${API_BASE_URL}/api/dingtalk/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
        body: JSON.stringify({
          message: message_content,
          type: 'warehouse_demand_update'
        })
      });

      const result = await response.json();
      if (result.code === 0) {
        message.success('通知已发送到钉钉群');
      }
    } catch (error) {
      console.error('发送钉钉通知失败:', error);
      // 不影响主流程，只记录错误
    }
  };

  // 添加需求单处理函数
  const handleAddOrder = async (values: any) => {
    // 检查SKU冲突
    await checkSkuConflicts(values.sku_data, values);
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

  // 删除需求单
  const handleDeleteOrder = async (needNum: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/order-management/orders/${needNum}`, {
        method: 'DELETE',
        headers: {
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success('需求单删除成功');
        // 刷新需求单列表
        await fetchOrders(pagination.current, pagination.pageSize);
        // 如果当前选中的需求单被删除，清空详情页面
        if (selectedOrder === needNum) {
          setSelectedOrder('');
          setOrderDetails(null);
        }
      } else {
        message.error(result.message || '删除需求单失败');
      }
    } catch (error) {
      console.error('删除需求单失败:', error);
      message.error('删除需求单失败');
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
      width: 150,
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
          <Popconfirm
            title="确认删除需求单"
            description={`确定要删除需求单 "${record.need_num}" 吗？删除后无法恢复。`}
            onConfirm={() => handleDeleteOrder(record.need_num)}
            okText="确定删除"
            cancelText="取消"
            okType="danger"
          >
            <Tooltip title="删除需求单">
              <Button 
                type="text" 
                size="small" 
                icon={<DeleteOutlined />}
                danger
                disabled={record.total_shipped > 0}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // SKU明细表格列定义
  const itemColumns: ColumnsType<OrderItem> = [
    {
      title: '本地SKU',
      dataIndex: 'local_sku',
      key: 'local_sku',
      width: 120,
      render: (text: string) => <Text>{text || '-'}</Text>
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
      title: '现有库存',
      dataIndex: 'total_available',
      key: 'total_available',
      width: 90,
      align: 'center',
      render: (value: number, record) => (
        <Text 
          type={value >= record.remaining_quantity ? 'success' : 'danger'}
          strong
        >
          {value}
        </Text>
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
      width: 150,
      align: 'center',
      render: (_, record) => (
        <Space>
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
                                  <Popconfirm
             title={record.shipped_quantity > 0 ? "删除未发货数量" : "确定删除此SKU吗？"}
             description={
               record.shipped_quantity > 0 
                 ? `该SKU已发货 ${record.shipped_quantity} 件，剩余 ${record.remaining_quantity} 件未发货。确认删除未发货部分吗？` 
                 : "删除后无法恢复，确认删除吗？"
             }
             onConfirm={async () => {
               try {
                 if (record.shipped_quantity > 0) {
                   // 如果有已发货数量，调用修改数量API，将需求数量改为已发货数量
                   const response = await fetch(
                     `${API_BASE_URL}/api/order-management/orders/${record.need_num}/items/${record.record_num}`,
                     {
                       method: 'PUT',
                       headers: {
                         'Content-Type': 'application/json',
                         ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
                       },
                       body: JSON.stringify({ quantity: record.shipped_quantity }),
                     }
                   );
                   const result = await response.json();
                   if (result.code === 0) {
                     message.success(`已删除未发货数量，当前需求数量调整为 ${record.shipped_quantity} 件`);
                     if (selectedOrder) {
                       await fetchOrderDetails(selectedOrder);
                     }
                     await fetchOrders(pagination.current, pagination.pageSize);
                   } else {
                     message.error(result.message || '修改数量失败');
                   }
                 } else {
                   // 如果没有已发货数量，直接删除SKU
                   const response = await fetch(
                     `${API_BASE_URL}/api/shipping/needs/${record.record_num}`,
                     {
                       method: 'DELETE',
                       headers: {
                         'Content-Type': 'application/json',
                         ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
                       },
                     }
                   );
                   const result = await response.json();
                   if (result.code === 0) {
                     message.success('SKU删除成功');
                     if (selectedOrder) {
                       await fetchOrderDetails(selectedOrder);
                     }
                     await fetchOrders(pagination.current, pagination.pageSize);
                   } else {
                     message.error(result.message || 'SKU删除失败');
                   }
                 }
               } catch (error) {
                 console.error('操作失败:', error);
                 message.error('操作失败');
               }
             }}
             okText="确定"
             cancelText="取消"
           >
            <Tooltip title="删除SKU">
                             <Button 
                 type="link" 
                 size="small" 
                 icon={<DeleteOutlined />}
                 danger
               />
            </Tooltip>
          </Popconfirm>
        </Space>
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
                              <Button 
                                type="link" 
                                style={{ padding: 0, height: 'auto', fontSize: 'inherit', fontWeight: 'bold' }}
                                onClick={() => fetchShipmentDetails(history.shipment_id)}
                                loading={shipmentDetailsLoading}
                              >
                                {history.shipment_info.shipment_number}
                              </Button>
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
                    onClick={() => setAddOrderModalVisible(true)}
                  >
                    添加需求单
                  </Button>
                  <Button 
                    type="default" 
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

      {/* 发货详情模态框 */}
      <Modal
        title="发货详情"
        open={shipmentDetailsModalVisible}
        onCancel={() => {
          setShipmentDetailsModalVisible(false);
          setShipmentDetails(null);
        }}
        width={1000}
        footer={null}
        loading={shipmentDetailsLoading}
      >
        {shipmentDetails && (
          <div>
            {/* 发货记录基本信息 */}
            <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="发货单号">
                <Text strong>{shipmentDetails.shipment_record.shipment_number}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="操作员">
                {shipmentDetails.shipment_record.operator}
              </Descriptions.Item>
              <Descriptions.Item label="发货时间">
                {new Date(shipmentDetails.shipment_record.created_at).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color="green">{shipmentDetails.shipment_record.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="总箱数">
                <Text strong>{shipmentDetails.shipment_record.total_boxes}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="总件数">
                <Text strong>{shipmentDetails.shipment_record.total_items}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="运输方式" span={2}>
                {shipmentDetails.shipment_record.shipping_method || '-'}
              </Descriptions.Item>
              {shipmentDetails.shipment_record.remark && (
                <Descriptions.Item label="备注" span={2}>
                  {shipmentDetails.shipment_record.remark}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* 发货统计 */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Statistic title="需求单数" value={shipmentDetails.summary.total_need_orders} />
              </Col>
              <Col span={6}>
                <Statistic title="SKU数量" value={shipmentDetails.summary.total_sku_count} />
              </Col>
              <Col span={6}>
                <Statistic 
                  title="总需求数量" 
                  value={shipmentDetails.summary.total_requested}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={6}>
                <Statistic 
                  title="实际发货" 
                  value={shipmentDetails.summary.total_shipped}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
            </Row>

            <Progress 
              percent={shipmentDetails.summary.overall_completion_rate} 
              status={shipmentDetails.summary.overall_completion_rate === 100 ? 'success' : 'active'}
              style={{ marginBottom: 16 }}
            />

            {/* 发货明细表格 */}
            <Title level={5}>发货明细</Title>
            <Table
              dataSource={shipmentDetails.shipment_items}
              columns={[
                { title: '需求单号', dataIndex: 'need_num', key: 'need_num', width: 120 },
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
              rowKey={(record, index) => `${record.need_num}_${record.local_sku}_${index}`}
              size="small"
              scroll={{ y: 400 }}
              pagination={false}
            />
          </div>
        )}
      </Modal>

      {/* 添加需求单对话框 */}
      <Modal
        title="海外仓补货需求提交"
        open={addOrderModalVisible}
        onCancel={() => {
          setAddOrderModalVisible(false);
          addOrderForm.resetFields();
        }}
        onOk={() => addOrderForm.submit()}
        width={600}
        okText="确定"
        cancelText="取消"
      >
        <Form
          form={addOrderForm}
          onFinish={handleAddOrder}
          layout="vertical"
          style={{ paddingTop: 16 }}
          initialValues={{
            country: '美国',
            shipping_method: '盐田海运',
            marketplace: '亚马逊',
            send_out_date: dayjs().add(7, 'day'),
            expect_sold_out_date: dayjs().add(3, 'month')
          }}
        >
          <Form.Item
            label="目的国"
            name="country"
            rules={[{ required: true, message: '请选择目的国' }]}
          >
            <Select placeholder="请选择目的国">
              <Select.Option value="美国">美国</Select.Option>
              <Select.Option value="英国">英国</Select.Option>
              <Select.Option value="加拿大">加拿大</Select.Option>
              <Select.Option value="阿联酋">阿联酋</Select.Option>
              <Select.Option value="澳大利亚">澳大利亚</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="物流方式"
            name="shipping_method"
            rules={[{ required: true, message: '请选择物流方式' }]}
          >
            <Select placeholder="请选择物流方式">
              <Select.Option value="盐田海运">盐田海运</Select.Option>
              <Select.Option value="美森海运">美森海运</Select.Option>
              <Select.Option value="空运">空运</Select.Option>
              <Select.Option value="快递">快递</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="平台"
            name="marketplace"
            rules={[{ required: true, message: '请选择平台' }]}
          >
            <Select placeholder="请选择平台">
              <Select.Option value="亚马逊">亚马逊</Select.Option>
              <Select.Option value="Shein">Shein</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="发货截止日"
            name="send_out_date"
            rules={[{ required: true, message: '请选择发货截止日' }]}
          >
            <DatePicker 
              style={{ width: '100%' }}
              placeholder="请选择发货截止日"
              format="YYYY/MM/DD"
            />
          </Form.Item>

          <Form.Item
            label="预计售完日"
            name="expect_sold_out_date"
            rules={[{ required: true, message: '请选择预计售完日' }]}
          >
            <DatePicker 
              style={{ width: '100%' }}
              placeholder="请选择预计售完日"
              format="YYYY/MM/DD"
            />
          </Form.Item>

          <Form.Item
            label="SKU及发货数量"
            name="sku_data"
            rules={[{ required: true, message: '请输入SKU及发货数量' }]}
          >
            <Input.TextArea
              rows={6}
              placeholder="请输入多行文本内容，希望输入SKU及数量&#10;例如：&#10;AGXB362D1 44&#10;NAXBA968H 32"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* SKU冲突解决对话框 */}
      <Modal
        title="SKU冲突检测"
        open={conflictModalVisible}
        onCancel={() => {
          setConflictModalVisible(false);
          setConflictSkus([]);
          setCurrentConflictIndex(0);
          setConflictResolutions({});
          setPendingOrderData(null);
        }}
        footer={null}
        width={600}
        maskClosable={false}
      >
        {conflictSkus.length > 0 && (
          <div>
            <Alert
              message={`发现 ${conflictSkus.length} 个SKU冲突`}
              description={`正在处理第 ${currentConflictIndex + 1} 个冲突 (共 ${conflictSkus.length} 个)`}
              type="warning"
              style={{ marginBottom: 16 }}
            />
            
            {conflictSkus[currentConflictIndex] && (
              <div>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="SKU">
                    <Text strong>{conflictSkus[currentConflictIndex].sku}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="原需求单号">
                    {conflictSkus[currentConflictIndex].needNum}
                  </Descriptions.Item>
                  <Descriptions.Item label="原需求数量">
                    <Text type="secondary">{conflictSkus[currentConflictIndex].existingQuantity}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="新增数量">
                    <Text style={{ color: '#1890ff', fontWeight: 'bold' }}>{conflictSkus[currentConflictIndex].newQuantity}</Text>
                  </Descriptions.Item>
                </Descriptions>

                <Divider />

                <div style={{ textAlign: 'center' }}>
                  <Text strong>请选择处理方式：</Text>
                  <div style={{ marginTop: 16 }}>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      <Button
                        type="primary"
                        size="large"
                        style={{ width: '100%', height: '60px' }}
                        onClick={() => handleConflictResolution('add')}
                      >
                        <div>
                          <div><strong>累加数量</strong></div>
                          <div style={{ fontSize: '12px', opacity: 0.8 }}>
                            {conflictSkus[currentConflictIndex].existingQuantity} + {conflictSkus[currentConflictIndex].newQuantity} = {conflictSkus[currentConflictIndex].existingQuantity + conflictSkus[currentConflictIndex].newQuantity}
                          </div>
                        </div>
                      </Button>

                      <Button
                        type="default"
                        size="large"
                        style={{ width: '100%', height: '60px' }}
                        onClick={() => handleConflictResolution('replace')}
                      >
                        <div>
                          <div><strong>覆盖数量</strong></div>
                          <div style={{ fontSize: '12px', opacity: 0.8 }}>
                            使用新数量 {conflictSkus[currentConflictIndex].newQuantity} 替换原数量
                          </div>
                        </div>
                      </Button>

                      <Button
                        type="dashed"
                        size="large"
                        style={{ width: '100%', height: '60px' }}
                        onClick={() => handleConflictResolution('new')}
                      >
                        <div>
                          <div><strong>创建新需求单</strong></div>
                          <div style={{ fontSize: '12px', opacity: 0.8 }}>
                            保持原需求单不变，新数量加入新需求单
                          </div>
                        </div>
                      </Button>
                    </Space>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default OrderManagementPage; 