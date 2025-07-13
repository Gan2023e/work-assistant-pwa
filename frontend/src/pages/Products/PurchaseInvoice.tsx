import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Modal,
  Form,
  DatePicker,
  Select,
  InputNumber,
  Upload,
  message,
  Tabs,
  Row,
  Col,
  Statistic,
  Tag,
  Popconfirm,
  Tooltip,
  Typography,
  Divider,
  Badge
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
  DollarCircleOutlined,
  FilePdfOutlined,
  FilterOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { API_BASE_URL } from '../../config/api';

const { TextArea } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

// 数据类型定义
interface PurchaseOrder {
  id: number;
  order_number: string;
  order_date: string;
  amount: number;
  seller_name: string;
  payment_account: string;
  invoice_status: '未开票' | '已开票' | '部分开票';
  invoice_id?: number;
  remarks?: string;
  created_at: string;
  updated_at: string;
  invoice?: Invoice;
}

interface Invoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  tax_amount?: number;
  invoice_file_url?: string;
  invoice_file_name?: string;
  file_size?: number;
  seller_name: string;
  buyer_name?: string;
  invoice_type: '增值税专用发票' | '增值税普通发票' | '收据' | '其他';
  status: '正常' | '作废' | '红冲';
  remarks?: string;
  created_at: string;
  updated_at: string;
  purchaseOrders?: PurchaseOrder[];
}

interface Statistics {
  overview: {
    totalOrders: number;
    unpaidOrders: number;
    partiallyPaidOrders: number;
    fullyPaidOrders: number;
    totalInvoices: number;
    totalAmount: number;
    unpaidAmount: number;
  };
  supplierStats: Array<{
    seller_name: string;
    order_count: number;
    total_amount: number;
  }>;
  monthlyStats: Array<{
    month: string;
    order_count: number;
    total_amount: number;
  }>;
}

const PurchaseInvoice: React.FC = () => {
  // 状态管理
  const [activeTab, setActiveTab] = useState('orders');
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // 订单相关状态
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [orderForm] = Form.useForm();
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [orderPagination, setOrderPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  
  // 发票相关状态
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [invoiceForm] = Form.useForm();
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [invoicePagination, setInvoicePagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  
  // 搜索筛选状态
  const [orderFilters, setOrderFilters] = useState({
    seller_name: '',
    invoice_status: '',
    payment_account: '',
    order_number: '',
    date_range: null as [string, string] | null
  });
  
  const [invoiceFilters, setInvoiceFilters] = useState({
    seller_name: '',
    invoice_number: '',
    invoice_type: '',
    status: '',
    date_range: null as [string, string] | null
  });

  // 页面加载时获取数据
  useEffect(() => {
    fetchStatistics();
    if (activeTab === 'orders') {
      fetchPurchaseOrders();
    } else {
      fetchInvoices();
    }
  }, [activeTab]);

  // 获取统计数据
  const fetchStatistics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/statistics`);
      const result = await response.json();
      if (result.code === 0) {
        setStatistics(result.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  // 获取采购订单列表
  const fetchPurchaseOrders = async (page = 1) => {
    setLoading(true);
    try {
      const queryParams: Record<string, string> = {
        page: page.toString(),
        limit: orderPagination.pageSize.toString(),
        seller_name: orderFilters.seller_name,
        invoice_status: orderFilters.invoice_status,
        payment_account: orderFilters.payment_account,
        order_number: orderFilters.order_number,
        ...(orderFilters.date_range ? {
          start_date: orderFilters.date_range[0],
          end_date: orderFilters.date_range[1]
        } : {})
      };
      
      // 过滤掉空值和null值
      const filteredParams = Object.fromEntries(
        Object.entries(queryParams).filter(([_, value]) => value !== '' && value !== null)
      );
      
      const params = new URLSearchParams(filteredParams);
      
      const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/orders?${params}`);
      const result = await response.json();
      
      if (result.code === 0) {
        setPurchaseOrders(result.data.records);
        setOrderPagination(prev => ({
          ...prev,
          current: result.data.page,
          total: result.data.total
        }));
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('获取采购订单失败');
    }
    setLoading(false);
  };

  // 获取发票列表
  const fetchInvoices = async (page = 1) => {
    setLoading(true);
    try {
      const queryParams: Record<string, string> = {
        page: page.toString(),
        limit: invoicePagination.pageSize.toString(),
        seller_name: invoiceFilters.seller_name,
        invoice_number: invoiceFilters.invoice_number,
        invoice_type: invoiceFilters.invoice_type,
        status: invoiceFilters.status,
        ...(invoiceFilters.date_range ? {
          start_date: invoiceFilters.date_range[0],
          end_date: invoiceFilters.date_range[1]
        } : {})
      };
      
      // 过滤掉空值和null值
      const filteredParams = Object.fromEntries(
        Object.entries(queryParams).filter(([_, value]) => value !== '' && value !== null)
      );
      
      const params = new URLSearchParams(filteredParams);
      
      const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/invoices?${params}`);
      const result = await response.json();
      
      if (result.code === 0) {
        setInvoices(result.data.records);
        setInvoicePagination(prev => ({
          ...prev,
          current: result.data.page,
          total: result.data.total
        }));
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('获取发票失败');
    }
    setLoading(false);
  };

  // 处理订单表单提交
  const handleOrderSubmit = async (values: any) => {
    try {
      const data = {
        ...values,
        order_date: values.order_date.format('YYYY-MM-DD')
      };
      
      const url = editingOrder 
        ? `${API_BASE_URL}/api/purchase-invoice/orders/${editingOrder.id}`
        : `${API_BASE_URL}/api/purchase-invoice/orders`;
      
      const response = await fetch(url, {
        method: editingOrder ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success(editingOrder ? '更新成功' : '创建成功');
        setOrderModalVisible(false);
        setEditingOrder(null);
        orderForm.resetFields();
        fetchPurchaseOrders();
        fetchStatistics();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 处理发票表单提交
  const handleInvoiceSubmit = async (values: any) => {
    try {
      const data = {
        ...values,
        invoice_date: values.invoice_date.format('YYYY-MM-DD')
      };
      
      const url = editingInvoice 
        ? `${API_BASE_URL}/api/purchase-invoice/invoices/${editingInvoice.id}`
        : `${API_BASE_URL}/api/purchase-invoice/invoices`;
      
      const response = await fetch(url, {
        method: editingInvoice ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success(editingInvoice ? '更新成功' : '创建成功');
        setInvoiceModalVisible(false);
        setEditingInvoice(null);
        invoiceForm.resetFields();
        fetchInvoices();
        fetchStatistics();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 处理文件上传
  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/upload-invoice`, {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success('文件上传成功');
        
        // 更新表单中的文件信息
        const currentValues = invoiceForm.getFieldsValue();
        invoiceForm.setFieldsValue({
          ...currentValues,
          invoice_file_url: result.data.url,
          invoice_file_name: result.data.filename,
          file_size: result.data.size
        });
        
        return {
          success: true,
          data: result.data
        };
      } else {
        message.error(result.message);
        return { success: false, error: result.message };
      }
         } catch (error: any) {
       message.error('文件上传失败');
       return { success: false, error: error.message };
     }
  };

  // 删除订单
  const handleDeleteOrder = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/orders/${id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success('删除成功');
        fetchPurchaseOrders();
        fetchStatistics();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 删除发票
  const handleDeleteInvoice = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/invoices/${id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success('删除成功');
        fetchInvoices();
        fetchStatistics();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 批量更新订单开票状态
  const handleBatchUpdateInvoiceStatus = async (status: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要更新的订单');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/orders/batch-invoice-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          order_ids: selectedRowKeys,
          invoice_status: status
        })
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success('批量更新成功');
        setSelectedRowKeys([]);
        fetchPurchaseOrders();
        fetchStatistics();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('批量更新失败');
    }
  };

  // 采购订单表格列
  const orderColumns: ColumnsType<PurchaseOrder> = [
    {
      title: '订单号',
      dataIndex: 'order_number',
      key: 'order_number',
      width: 150,
      render: (text: string) => <Text copyable>{text}</Text>
    },
    {
      title: '订单日期',
      dataIndex: 'order_date',
      key: 'order_date',
      width: 120,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD')
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (amount: number) => `¥${amount.toLocaleString()}`
    },
    {
      title: '卖家名称',
      dataIndex: 'seller_name',
      key: 'seller_name',
      width: 120
    },
    {
      title: '支付账户',
      dataIndex: 'payment_account',
      key: 'payment_account',
      width: 120
    },
    {
      title: '开票情况',
      dataIndex: 'invoice_status',
      key: 'invoice_status',
      width: 100,
      render: (status: string) => {
        const colors = {
          '未开票': 'red',
          '部分开票': 'orange',
          '已开票': 'green'
        };
        return <Tag color={colors[status as keyof typeof colors]}>{status}</Tag>;
      }
    },
    {
      title: '关联发票',
      dataIndex: 'invoice',
      key: 'invoice',
      width: 150,
      render: (invoice: Invoice) => 
        invoice ? (
          <Tooltip title={`发票号: ${invoice.invoice_number}`}>
            <Tag color="blue">{invoice.invoice_number}</Tag>
          </Tooltip>
        ) : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => {
              setEditingOrder(record);
              orderForm.setFieldsValue({
                ...record,
                order_date: dayjs(record.order_date)
              });
              setOrderModalVisible(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个订单吗？"
            onConfirm={() => handleDeleteOrder(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="link" 
              size="small" 
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 发票表格列
  const invoiceColumns: ColumnsType<Invoice> = [
    {
      title: '发票号',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      width: 150,
      render: (text: string) => <Text copyable>{text}</Text>
    },
    {
      title: '开票日期',
      dataIndex: 'invoice_date',
      key: 'invoice_date',
      width: 120,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD')
    },
    {
      title: '发票金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 100,
      render: (amount: number) => `¥${amount.toLocaleString()}`
    },
    {
      title: '开票方',
      dataIndex: 'seller_name',
      key: 'seller_name',
      width: 120
    },
    {
      title: '发票类型',
      dataIndex: 'invoice_type',
      key: 'invoice_type',
      width: 120,
      render: (type: string) => <Tag>{type}</Tag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => {
        const colors = {
          '正常': 'green',
          '作废': 'red',
          '红冲': 'orange'
        };
        return <Tag color={colors[status as keyof typeof colors]}>{status}</Tag>;
      }
    },
    {
      title: '发票文件',
      dataIndex: 'invoice_file_url',
      key: 'invoice_file_url',
      width: 120,
      render: (url: string, record) => 
        url ? (
          <Button 
            type="link" 
            size="small" 
            icon={<FilePdfOutlined />}
            onClick={() => window.open(url, '_blank')}
          >
            查看文件
          </Button>
        ) : (
          <Text type="secondary">无文件</Text>
        )
    },
    {
      title: '关联订单',
      dataIndex: 'purchaseOrders',
      key: 'purchaseOrders',
      width: 100,
      render: (orders: PurchaseOrder[]) => (
        <Badge count={orders?.length || 0} showZero />
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => {
              setEditingInvoice(record);
              invoiceForm.setFieldsValue({
                ...record,
                invoice_date: dayjs(record.invoice_date)
              });
              setInvoiceModalVisible(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个发票吗？"
            onConfirm={() => handleDeleteInvoice(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="link" 
              size="small" 
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <FileTextOutlined style={{ marginRight: '8px' }} />
        采购发票管理
      </Title>
      
      {/* 统计卡片 */}
      {statistics && (
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={4}>
            <Card>
              <Statistic
                title="总订单数"
                value={statistics.overview.totalOrders}
                prefix={<ShoppingCartOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="未开票订单"
                value={statistics.overview.unpaidOrders}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="总发票数"
                value={statistics.overview.totalInvoices}
                prefix={<FilePdfOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="订单总金额"
                value={statistics.overview.totalAmount}
                prefix={<DollarCircleOutlined />}
                precision={2}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="未开票金额"
                value={statistics.overview.unpaidAmount}
                prefix={<DollarCircleOutlined />}
                precision={2}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 主要内容 */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="采购订单管理" key="orders">
            <Space style={{ marginBottom: '16px' }}>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingOrder(null);
                  orderForm.resetFields();
                  setOrderModalVisible(true);
                }}
              >
                新增订单
              </Button>
              <Button 
                icon={<ReloadOutlined />}
                onClick={() => fetchPurchaseOrders()}
              >
                刷新
              </Button>
              <Select
                placeholder="批量更新开票状态"
                style={{ width: 160 }}
                onChange={handleBatchUpdateInvoiceStatus}
                disabled={selectedRowKeys.length === 0}
              >
                <Option value="未开票">未开票</Option>
                <Option value="部分开票">部分开票</Option>
                <Option value="已开票">已开票</Option>
              </Select>
              {selectedRowKeys.length > 0 && (
                <Text type="secondary">
                  已选择 {selectedRowKeys.length} 项
                </Text>
              )}
            </Space>
            
            <Table
              columns={orderColumns}
              dataSource={purchaseOrders}
              rowKey="id"
              loading={loading}
              pagination={{
                ...orderPagination,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
                onChange: (page, pageSize) => {
                  setOrderPagination(prev => ({ ...prev, current: page, pageSize }));
                  fetchPurchaseOrders(page);
                }
              }}
              rowSelection={{
                selectedRowKeys,
                onChange: setSelectedRowKeys,
                preserveSelectedRowKeys: true
              }}
            />
          </TabPane>
          
          <TabPane tab="发票管理" key="invoices">
            <Space style={{ marginBottom: '16px' }}>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingInvoice(null);
                  invoiceForm.resetFields();
                  setInvoiceModalVisible(true);
                }}
              >
                新增发票
              </Button>
              <Button 
                icon={<ReloadOutlined />}
                onClick={() => fetchInvoices()}
              >
                刷新
              </Button>
            </Space>
            
            <Table
              columns={invoiceColumns}
              dataSource={invoices}
              rowKey="id"
              loading={loading}
              pagination={{
                ...invoicePagination,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
                onChange: (page, pageSize) => {
                  setInvoicePagination(prev => ({ ...prev, current: page, pageSize }));
                  fetchInvoices(page);
                }
              }}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* 订单编辑模态框 */}
      <Modal
        title={editingOrder ? '编辑订单' : '新增订单'}
        open={orderModalVisible}
        onOk={() => orderForm.submit()}
        onCancel={() => {
          setOrderModalVisible(false);
          setEditingOrder(null);
          orderForm.resetFields();
        }}
        width={600}
      >
        <Form
          form={orderForm}
          layout="vertical"
          onFinish={handleOrderSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="订单号"
                name="order_number"
                rules={[{ required: true, message: '请输入订单号' }]}
              >
                <Input placeholder="请输入订单号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="订单日期"
                name="order_date"
                rules={[{ required: true, message: '请选择订单日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="金额"
                name="amount"
                rules={[{ required: true, message: '请输入金额' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入金额"
                  min={0}
                  precision={2}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="卖家名称"
                name="seller_name"
                rules={[{ required: true, message: '请输入卖家名称' }]}
              >
                <Input placeholder="请输入卖家名称" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="支付账户"
                name="payment_account"
                rules={[{ required: true, message: '请输入支付账户' }]}
              >
                <Input placeholder="请输入支付账户" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="开票情况"
                name="invoice_status"
                rules={[{ required: true, message: '请选择开票情况' }]}
              >
                <Select placeholder="请选择开票情况">
                  <Option value="未开票">未开票</Option>
                  <Option value="部分开票">部分开票</Option>
                  <Option value="已开票">已开票</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item label="备注" name="remarks">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 发票编辑模态框 */}
      <Modal
        title={editingInvoice ? '编辑发票' : '新增发票'}
        open={invoiceModalVisible}
        onOk={() => invoiceForm.submit()}
        onCancel={() => {
          setInvoiceModalVisible(false);
          setEditingInvoice(null);
          invoiceForm.resetFields();
        }}
        width={700}
      >
        <Form
          form={invoiceForm}
          layout="vertical"
          onFinish={handleInvoiceSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="发票号"
                name="invoice_number"
                rules={[{ required: true, message: '请输入发票号' }]}
              >
                <Input placeholder="请输入发票号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="开票日期"
                name="invoice_date"
                rules={[{ required: true, message: '请选择开票日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="发票金额"
                name="total_amount"
                rules={[{ required: true, message: '请输入发票金额' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入发票金额"
                  min={0}
                  precision={2}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="税额" name="tax_amount">
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入税额"
                  min={0}
                  precision={2}
                />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="开票方"
                name="seller_name"
                rules={[{ required: true, message: '请输入开票方名称' }]}
              >
                <Input placeholder="请输入开票方名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="收票方" name="buyer_name">
                <Input placeholder="请输入收票方名称" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="发票类型"
                name="invoice_type"
                rules={[{ required: true, message: '请选择发票类型' }]}
              >
                <Select placeholder="请选择发票类型">
                  <Option value="增值税专用发票">增值税专用发票</Option>
                  <Option value="增值税普通发票">增值税普通发票</Option>
                  <Option value="收据">收据</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="发票状态"
                name="status"
                rules={[{ required: true, message: '请选择发票状态' }]}
              >
                <Select placeholder="请选择发票状态">
                  <Option value="正常">正常</Option>
                  <Option value="作废">作废</Option>
                  <Option value="红冲">红冲</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item label="发票文件" name="invoice_file_url">
            <Upload
              accept=".pdf"
              maxCount={1}
              beforeUpload={() => false}
            >
              <Button icon={<UploadOutlined />}>选择PDF文件</Button>
            </Upload>
          </Form.Item>
          
          <Form.Item label="备注" name="remarks">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PurchaseInvoice; 