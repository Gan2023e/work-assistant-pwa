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
  Row,
  Col,
  Statistic,
  Tag,
  Typography,
  Badge,
  Descriptions,
  Alert
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  UploadOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
  DollarCircleOutlined,
  FilePdfOutlined,
  ReloadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload';
import dayjs from 'dayjs';
import { API_BASE_URL } from '../../config/api';

const { TextArea } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

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
  tax_rate?: string;
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
}

interface ExtractedInvoiceInfo {
  invoice_number: string;
  invoice_date: string;
  total_amount: string;
  tax_amount: string;
  tax_rate: string;
  seller_name: string;
  buyer_name: string;
  invoice_type: string;
}

interface ParseQuality {
  hasInvoiceNumber: boolean;
  hasInvoiceDate: boolean;
  hasTotalAmount: boolean;
  hasSellerName: boolean;
  completeness: number;
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
}

const PurchaseInvoice: React.FC = () => {
  // 状态管理
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // 订单相关状态
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [orderForm] = Form.useForm();
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  
  // 发票相关状态
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [invoiceForm] = Form.useForm();
  const [extractedInfo, setExtractedInfo] = useState<ExtractedInvoiceInfo | null>(null);
  const [parseQuality, setParseQuality] = useState<ParseQuality | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [amountDifference, setAmountDifference] = useState<number>(0);
  const [pdfParseResults, setPdfParseResults] = useState<any>(null);
  
  // 搜索筛选状态
  const [filters, setFilters] = useState({
    seller_name: '',
    invoice_status: '',
    payment_account: '',
    order_number: '',
    date_range: null as [string, string] | null
  });

  // 页面加载时获取数据
  useEffect(() => {
    fetchStatistics();
    fetchPurchaseOrders();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

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
        limit: pagination.pageSize.toString(),
        seller_name: filters.seller_name,
        invoice_status: filters.invoice_status,
        payment_account: filters.payment_account,
        order_number: filters.order_number,
        ...(filters.date_range ? {
          start_date: filters.date_range[0],
          end_date: filters.date_range[1]
        } : {})
      };
      
      // 过滤掉空值
      const filteredParams = Object.fromEntries(
        Object.entries(queryParams).filter(([_, value]) => value !== '' && value !== null)
      );
      
      const params = new URLSearchParams(filteredParams);
      
      const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/orders?${params}`);
      const result = await response.json();
      
      if (result.code === 0) {
        setPurchaseOrders(result.data.records);
        setPagination((prev: any) => ({
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

  // 处理订单提交
  const handleOrderSubmit = async (values: any) => {
    try {
      const orderData = {
        ...values,
        order_date: values.order_date.format('YYYY-MM-DD')
      };
      
      const url = editingOrder 
        ? `${API_BASE_URL}/api/purchase-invoice/orders/${editingOrder.id}`
        : `${API_BASE_URL}/api/purchase-invoice/orders`;
      
      const method = editingOrder ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
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

  // 处理PDF上传和解析
  const handlePdfUpload = async (file: any) => {
    setPdfUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/upload-and-parse-invoice`, {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        const extractedInfo = result.data.extractedInfo;
        const parseQuality = result.data.parseQuality;
        
        setExtractedInfo(extractedInfo);
        setParseQuality(parseQuality);
        setPdfParseResults(result.data);
        
        // 自动填充表单
        const formValues = {
          invoice_number: extractedInfo.invoice_number,
          invoice_date: extractedInfo.invoice_date ? dayjs(extractedInfo.invoice_date) : null,
          total_amount: extractedInfo.total_amount ? parseFloat(extractedInfo.total_amount) : null,
          tax_amount: extractedInfo.tax_amount ? parseFloat(extractedInfo.tax_amount) : null,
          tax_rate: extractedInfo.tax_rate,
          seller_name: extractedInfo.seller_name,
          buyer_name: extractedInfo.buyer_name,
          invoice_file_url: result.data.fileInfo?.url,
          invoice_file_name: result.data.fileInfo?.filename,
          file_size: result.data.fileInfo?.size,
          invoice_type: extractedInfo.invoice_type || '增值税普通发票',
          status: '正常'
        };
        
        invoiceForm.setFieldsValue(formValues);
        
        // 计算金额差异
        const invoiceAmount = parseFloat(extractedInfo.total_amount) || 0;
        const ordersAmount = getSelectedOrdersAmount();
        const difference = Math.abs(invoiceAmount - ordersAmount);
        setAmountDifference(difference);
        
        // 根据解析质量提供不同的提示
        if (parseQuality.completeness >= 90) {
          if (difference > 0.01) {
            message.warning(`PDF解析成功(完整度${parseQuality.completeness}%)，但发票金额(¥${invoiceAmount.toLocaleString()})与订单金额(¥${ordersAmount.toLocaleString()})不一致，差额¥${difference.toLocaleString()}`);
          } else {
            message.success(`PDF解析成功(完整度${parseQuality.completeness}%)，发票金额与订单金额一致`);
          }
        } else if (parseQuality.completeness >= 70) {
          message.warning(`PDF解析完成(完整度${parseQuality.completeness}%)，请检查并补充缺失的信息`);
        } else {
          message.error(`PDF解析完成(完整度${parseQuality.completeness}%)，解析质量较低，请手动核查所有信息`);
        }
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('PDF解析失败');
    } finally {
      setPdfUploading(false);
    }
    
    return false; // 阻止默认上传
  };



  // 处理发票提交
  const handleInvoiceSubmit = async (values: any) => {
    try {
      if (selectedRowKeys.length === 0) {
        message.error('请先选择要开票的订单');
        return;
      }
      
      const invoiceData = {
        ...values,
        invoice_date: values.invoice_date.format('YYYY-MM-DD')
      };
      
      const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/associate-orders-with-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_ids: selectedRowKeys,
          invoice_data: invoiceData
        }),
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success('发票创建并关联成功');
        setInvoiceModalVisible(false);
        setSelectedRowKeys([]);
        setExtractedInfo(null);
        setParseQuality(null);
        setPdfParseResults(null);
        setFileList([]);
        setAmountDifference(0);
        invoiceForm.resetFields();
        fetchPurchaseOrders();
        fetchStatistics();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };



  // 搜索功能
  const handleSearch = () => {
    setPagination((prev: any) => ({ ...prev, current: 1 }));
    fetchPurchaseOrders(1);
  };

  // 重置搜索
  const handleReset = () => {
    setFilters({
      seller_name: '',
      invoice_status: '',
      payment_account: '',
      order_number: '',
      date_range: null
    });
    setTimeout(() => {
      fetchPurchaseOrders(1);
    }, 100);
  };

  // 表格列定义
  const columns: ColumnsType<PurchaseOrder> = [
    {
      title: '订单编号',
      dataIndex: 'order_number',
      key: 'order_number',
      width: 150,
      render: (text: string) => <Text copyable>{text}</Text>
    },
    {
      title: '订单日期',
      dataIndex: 'order_date',
      key: 'order_date',
      width: 110,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD')
    },
    {
      title: '卖家公司名',
      dataIndex: 'seller_name',
      key: 'seller_name',
      width: 140
    },
    {
      title: '买家公司名',
      dataIndex: 'payment_account',
      key: 'payment_account',
      width: 140
    },
    {
      title: '实付款(元)',
      dataIndex: 'amount',
      key: 'amount',
      width: 110,
      render: (amount: number) => amount ? `¥${amount.toLocaleString()}` : '-'
    },
    {
      title: '开票状态',
      dataIndex: 'invoice_status',
      key: 'invoice_status',
      width: 90,
      render: (status: string) => {
        const color = status === '未开票' ? 'red' : status === '已开票' ? 'green' : 'orange';
        return <Tag color={color}>{status}</Tag>;
      }
    },
    {
      title: '关联发票信息',
      dataIndex: 'invoice',
      key: 'invoice',
      width: 300,
      render: (invoice: Invoice) => {
        if (!invoice) return '-';
        return (
          <div>
            <div style={{ fontWeight: 'bold' }}>
              <Text copyable>{invoice.invoice_number}</Text>
              {invoice.invoice_file_url ? (
                <Button
                  type="link"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => handleViewInvoiceFile(invoice.id)}
                  style={{ padding: '0 4px', marginLeft: '8px' }}
                  title="查看发票文件"
                >
                  查看
                </Button>
              ) : (
                <Space style={{ marginLeft: '8px' }}>
                  <Tag 
                    color="default" 
                    style={{ fontSize: '10px' }}
                    title="该发票未上传文件"
                  >
                    无文件
                  </Tag>
                  <Button
                    type="link"
                    size="small"
                    icon={<UploadOutlined />}
                    onClick={() => handleUploadFileToInvoice(invoice.id)}
                    style={{ padding: '0 4px', fontSize: '10px' }}
                    title="为该发票上传文件"
                  >
                    上传
                  </Button>
                </Space>
              )}
              {/* 删除发票按钮 */}
              <Button
                type="link"
                size="small"
                danger
                style={{ padding: '0 4px', marginLeft: '8px' }}
                onClick={() => handleDeleteInvoice(invoice.id)}
              >
                删除发票
              </Button>
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              开票日期: {dayjs(invoice.invoice_date).format('YYYY-MM-DD')}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              发票金额: ¥{invoice.total_amount.toLocaleString()}
            </div>
            {invoice.tax_amount && (
              <div style={{ fontSize: '12px', color: '#666' }}>
                税额: ¥{invoice.tax_amount.toLocaleString()}
              </div>
            )}
            {invoice.tax_rate && (
              <div style={{ fontSize: '12px', color: '#666' }}>
                税率: {invoice.tax_rate}
              </div>
            )}
            <div style={{ fontSize: '12px', color: '#666' }}>
              类型: <Tag>{invoice.invoice_type}</Tag>
              状态: <Tag color={invoice.status === '正常' ? 'green' : 'red'}>{invoice.status}</Tag>
            </div>
          </div>
        );
      }
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      width: 120,
      ellipsis: true
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: any, record: any) => (
        <Button 
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
      )
    }
  ];

  // 获取选中订单的总金额
  const getSelectedOrdersAmount = () => {
    return purchaseOrders
      .filter((order: any) => selectedRowKeys.includes(order.id))
      .reduce((sum: any, order: any) => sum + order.amount, 0);
  };

  // 获取选中订单的卖家名称列表
  const getSelectedSellers = () => {
    const sellers = purchaseOrders
      .filter((order: any) => selectedRowKeys.includes(order.id))
      .map((order: any) => order.seller_name);
    return sellers.filter((seller: any, index: any) => sellers.indexOf(seller) === index);
  };

  // 查看发票文件（直接打开代理URL）
  const handleViewInvoiceFile = (invoiceId: number) => {
    // 直接在新窗口打开后端代理URL
    const fileUrl = `${API_BASE_URL}/api/purchase-invoice/invoices/${invoiceId}/file`;
    window.open(fileUrl, '_blank');
  };

  // 上传文件到发票
  const handleUploadFileToInvoice = async (invoiceId: number) => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf';
    fileInput.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        
        message.loading('正在上传文件...', 0);
        setPdfUploading(true);
        
        try {
          console.log('开始上传文件:', file.name);
          const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/invoices/${invoiceId}/upload-file`, {
            method: 'POST',
            body: formData,
          });
          
          console.log('上传响应状态:', response.status);
          const result = await response.json();
          console.log('上传结果:', result);
          
          message.destroy(); // 清除loading消息
          
          if (result.code === 0) {
            message.success('文件上传成功');
            fetchPurchaseOrders(); // 刷新列表以更新发票状态
            fetchStatistics(); // 刷新统计
          } else {
            message.error(`文件上传失败: ${result.message}`);
            if (result.message.includes('OSS配置')) {
              message.warning('请联系管理员配置OSS存储服务', 5);
            }
          }
        } catch (error) {
          message.destroy(); // 清除loading消息
          console.error('文件上传失败:', error);
          message.error('文件上传失败: 网络错误或服务器问题');
        } finally {
          setPdfUploading(false);
        }
      }
    };
    fileInput.click();
  };

  // 在组件内添加删除发票方法
  const handleDeleteInvoice = (invoiceId: number) => {
    Modal.confirm({
      title: '确认删除该发票？',
      content: '删除后可重新上传发票，且该发票记录将被移除。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setLoading(true);
          const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/invoices/${invoiceId}`, {
            method: 'DELETE',
          });
          const result = await response.json();
          if (result.code === 0) {
            message.success('发票删除成功');
            fetchPurchaseOrders();
            fetchStatistics();
          } else {
            message.error(result.message || '删除失败');
          }
        } catch (error) {
          message.error('删除失败');
        } finally {
          setLoading(false);
        }
      },
    });
  };

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
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="已开票订单"
                value={statistics.overview.fullyPaidOrders}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
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
        {/* 搜索筛选区域 */}
        <Row gutter={16} style={{ marginBottom: '16px' }}>
          <Col span={4}>
            <Input
              placeholder="订单编号"
              value={filters.order_number}
              onChange={(e: any) => setFilters((prev: any) => ({ ...prev, order_number: e.target.value }))}
              allowClear
            />
          </Col>
          <Col span={4}>
            <Input
              placeholder="卖家公司名"
              value={filters.seller_name}
              onChange={(e: any) => setFilters((prev: any) => ({ ...prev, seller_name: e.target.value }))}
              allowClear
            />
          </Col>
          <Col span={4}>
            <Input
              placeholder="买家公司名"
              value={filters.payment_account}
              onChange={(e: any) => setFilters((prev: any) => ({ ...prev, payment_account: e.target.value }))}
              allowClear
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="开票状态"
              value={filters.invoice_status}
              onChange={(value: any) => setFilters((prev: any) => ({ ...prev, invoice_status: value }))}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="未开票">未开票</Option>
              <Option value="部分开票">部分开票</Option>
              <Option value="已开票">已开票</Option>
            </Select>
          </Col>
          <Col span={5}>
            <RangePicker
              style={{ width: '100%' }}
              value={filters.date_range ? [dayjs(filters.date_range[0]), dayjs(filters.date_range[1])] : null}
              onChange={(dates: any) => {
                setFilters((prev: any) => ({ 
                  ...prev, 
                  date_range: dates ? [dates[0]!.format('YYYY-MM-DD'), dates[1]!.format('YYYY-MM-DD')] : null 
                }));
              }}
            />
          </Col>
          <Col span={3}>
            <Space>
              <Button 
                type="primary" 
                icon={<SearchOutlined />} 
                onClick={handleSearch}
              >
                搜索
              </Button>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={handleReset}
              >
                重置
              </Button>
            </Space>
          </Col>
        </Row>

        {/* 操作按钮区域 */}
        <Row justify="space-between" style={{ marginBottom: '16px' }}>
          <Col>
            <Space>
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
                type="primary" 
                icon={<UploadOutlined />}
                disabled={selectedRowKeys.length === 0}
                                 onClick={() => {
                   setExtractedInfo(null);
                   setFileList([]);
                   setAmountDifference(0);
                   invoiceForm.resetFields();
                   setInvoiceModalVisible(true);
                 }}
              >
                批量开票 ({selectedRowKeys.length})
              </Button>
              <Button 
                icon={<ReloadOutlined />}
                onClick={() => fetchPurchaseOrders()}
              >
                刷新
              </Button>

            </Space>
          </Col>
          <Col>
            <Text type="secondary">
              共 {pagination.total} 条记录
              {selectedRowKeys.length > 0 && (
                <span style={{ marginLeft: '16px' }}>
                  已选择 {selectedRowKeys.length} 条，金额合计: ¥{getSelectedOrdersAmount().toLocaleString()}
                </span>
              )}
            </Text>
          </Col>
        </Row>
        
        {/* 表格 */}
        <Table
          columns={columns}
          dataSource={purchaseOrders}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total: any, range: any) => 
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
            onChange: (page: any, pageSize: any) => {
              setPagination((prev: any) => ({ ...prev, current: page, pageSize }));
              fetchPurchaseOrders(page);
            }
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            preserveSelectedRowKeys: true,
            getCheckboxProps: (record: any) => ({
              disabled: record.invoice_status === '已开票', // 已开票的订单不允许选择
            })
          }}
          scroll={{ x: 1200 }}
        />
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
        confirmLoading={loading}
      >
        <Form
          form={orderForm}
          layout="vertical"
          onFinish={handleOrderSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="订单编号"
                name="order_number"
                rules={[{ required: true, message: '请输入订单编号' }]}
              >
                <Input placeholder="请输入订单编号" />
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
                label="卖家公司名"
                name="seller_name"
                rules={[{ required: true, message: '请输入卖家公司名' }]}
              >
                <Input placeholder="请输入卖家公司名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="买家公司名"
                name="payment_account"
                rules={[{ required: true, message: '请输入买家公司名' }]}
              >
                <Input placeholder="请输入买家公司名" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="实付款(元)"
                name="amount"
                rules={[{ required: true, message: '请输入实付款' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入实付款"
                  min={0}
                  precision={2}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="开票状态"
                name="invoice_status"
                initialValue="未开票"
              >
                <Select>
                  <Option value="未开票">未开票</Option>
                  <Option value="部分开票">部分开票</Option>
                  <Option value="已开票">已开票</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            label="备注"
            name="remarks"
          >
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 发票录入模态框 */}
      <Modal
        title="批量开票"
        open={invoiceModalVisible}
        onOk={() => invoiceForm.submit()}
        onCancel={() => {
          setInvoiceModalVisible(false);
          setExtractedInfo(null);
          setParseQuality(null);
          setPdfParseResults(null);
          setFileList([]);
          setAmountDifference(0);
          invoiceForm.resetFields();
        }}
        width={800}
        confirmLoading={loading}
      >
        {/* 选中订单信息 */}
        <Alert
          message={
            <div>
              <strong>将为以下订单开票：</strong>
              <div style={{ marginTop: '8px' }}>
                选中订单数量: {selectedRowKeys.length} 个 | 
                金额合计: ¥{getSelectedOrdersAmount().toLocaleString()} | 
                涉及卖家: {getSelectedSellers().join(', ')}
              </div>
            </div>
          }
          type="info"
          style={{ marginBottom: '16px' }}
        />

        <Form
          form={invoiceForm}
          layout="vertical"
          onFinish={handleInvoiceSubmit}
        >
          {/* PDF上传区域 */}
          <Form.Item label="上传发票PDF（自动识别）">
            <Upload.Dragger
              accept=".pdf"
              beforeUpload={handlePdfUpload}
              fileList={fileList}
              onChange={({ fileList }: any) => setFileList(fileList)}
              showUploadList={false}
              style={{ padding: '20px' }}
            >
              <div>
                <FilePdfOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
                <p style={{ marginTop: '8px', fontSize: '16px' }}>
                  {pdfUploading ? '正在解析PDF...' : '点击或拖拽PDF文件到此区域上传'}
                </p>
                <p style={{ fontSize: '14px', color: '#666' }}>
                  支持PDF格式，自动识别发票信息并填充表单
                </p>
              </div>
            </Upload.Dragger>
            
            {/* PDF解析结果显示 */}
            {extractedInfo && parseQuality && (
              <div style={{ marginTop: '16px' }}>
                <Descriptions
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      <span>PDF解析完成</span>
                      <Badge 
                        count={`${parseQuality.completeness}%`}
                        style={{ 
                          backgroundColor: parseQuality.completeness >= 90 ? '#52c41a' : 
                                         parseQuality.completeness >= 70 ? '#faad14' : '#f5222d'
                        }}
                      />
                    </div>
                  }
                  bordered
                  size="small"
                  column={3}
                  style={{ marginBottom: '16px' }}
                >
                  <Descriptions.Item label="发票号">
                    <span style={{ color: parseQuality.hasInvoiceNumber ? '#52c41a' : '#ff4d4f' }}>
                      {extractedInfo.invoice_number || '未识别'}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="开票日期">
                    <span style={{ color: parseQuality.hasInvoiceDate ? '#52c41a' : '#ff4d4f' }}>
                      {extractedInfo.invoice_date || '未识别'}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="总金额">
                    <span style={{ color: parseQuality.hasTotalAmount ? '#52c41a' : '#ff4d4f' }}>
                      {extractedInfo.total_amount ? `¥${parseFloat(extractedInfo.total_amount).toLocaleString()}` : '未识别'}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="税额">
                    <span style={{ color: extractedInfo.tax_amount ? '#52c41a' : '#faad14' }}>
                      {extractedInfo.tax_amount ? `¥${parseFloat(extractedInfo.tax_amount).toLocaleString()}` : '未识别'}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="税率">
                    <span style={{ color: extractedInfo.tax_rate ? '#52c41a' : '#faad14' }}>
                      {extractedInfo.tax_rate || '未识别'}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="开票方">
                    <span style={{ color: parseQuality.hasSellerName ? '#52c41a' : '#ff4d4f' }}>
                      {extractedInfo.seller_name || '未识别'}
                    </span>
                  </Descriptions.Item>
                </Descriptions>
                
                {/* 解析质量提示 */}
                {parseQuality.completeness >= 90 ? (
                  <Alert
                    message="解析质量优秀"
                    description="PDF解析完成度高，已自动填充表单，请确认信息无误后提交。"
                    type="success"
                    showIcon
                    style={{ marginBottom: '8px' }}
                  />
                ) : parseQuality.completeness >= 70 ? (
                  <Alert
                    message="解析质量良好"
                    description="PDF解析基本完成，请检查并补充红色标记的缺失信息。"
                    type="warning"
                    showIcon
                    style={{ marginBottom: '8px' }}
                  />
                ) : (
                  <Alert
                    message="解析质量较低"
                    description="PDF解析质量不理想，请仔细核对所有信息并手动补充。"
                    type="error"
                    showIcon
                    style={{ marginBottom: '8px' }}
                  />
                )}
                
                {/* 金额匹配提示 */}
                {amountDifference > 0.01 && (
                  <Alert
                    message={`金额不匹配警告：发票金额与选中订单总额相差¥${amountDifference.toLocaleString()}`}
                    description="请检查发票金额或重新选择订单"
                    type="warning"
                    showIcon
                    action={
                      <Button size="small" onClick={() => setInvoiceModalVisible(false)}>
                        重新选择订单
                      </Button>
                    }
                  />
                )}
              </div>
            )}
          </Form.Item>

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
            <Col span={8}>
              <Form.Item
                label="发票总金额"
                name="total_amount"
                rules={[{ required: true, message: '请输入发票总金额' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入发票总金额"
                  min={0}
                  precision={2}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="税额"
                name="tax_amount"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入税额"
                  min={0}
                  precision={2}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="税率"
                name="tax_rate"
              >
                <Input placeholder="如：13%" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="开票方"
                name="seller_name"
                rules={[{ required: true, message: '请输入开票方' }]}
              >
                <Input placeholder="请输入开票方" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="收票方"
                name="buyer_name"
              >
                <Input placeholder="请输入收票方" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="发票类型"
                name="invoice_type"
                initialValue="增值税普通发票"
              >
                <Select>
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
                initialValue="正常"
              >
                <Select>
                  <Option value="正常">正常</Option>
                  <Option value="作废">作废</Option>
                  <Option value="红冲">红冲</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            label="备注"
            name="remarks"
          >
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>


    </div>
  );
};

export default PurchaseInvoice; 