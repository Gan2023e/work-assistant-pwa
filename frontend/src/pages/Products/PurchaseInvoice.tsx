import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  UploadOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
  FilePdfOutlined,
  ReloadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  DeleteOutlined,
  DownloadOutlined
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
  amount_difference_screenshot?: string;
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
    totalInvoices: number;
    totalAmount: number;
    companyStats: {
      [key: string]: {
        unpaidOrders: number;
        fullyPaidOrders: number;
        unpaidAmount: number;
      };
    };
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
    pageSize: 100,
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
  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const [uploadedScreenshots, setUploadedScreenshots] = useState<UploadFile[]>([]);
  const [canSubmitInvoice, setCanSubmitInvoice] = useState(false);
  
  // 搜索筛选状态
  const [filters, setFilters] = useState({
    seller_name: '',
    invoice_status: '',
    payment_account: '',
    order_number: '',
    invoice_number: '',
    date_range: null as [string, string] | null
  });

  // 卡片点击状态
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  
  // 卖家公司名列表
  const [sellerCompanies, setSellerCompanies] = useState<string[]>([]);
  
  // 买家公司名固定列表
  const buyerCompanies = ['深圳欣蓉电子商务有限公司', '深圳先春电子商务有限公司'];
  
  // 批量录入订单相关状态
  const [batchImportModalVisible, setBatchImportModalVisible] = useState(false);
  const [batchImportResult, setBatchImportResult] = useState<any>(null);
  const [batchImportLoading, setBatchImportLoading] = useState(false);
  
  // 导出相关状态
  const [exportLoading, setExportLoading] = useState(false);

  // 批量下载发票相关状态
  const [downloadInvoicesLoading, setDownloadInvoicesLoading] = useState(false);

  // 处理导出功能
  const handleExport = async () => {
    try {
      setExportLoading(true);
      
      // 处理多行输入，将每行作为一个搜索条件
      const processMultiLineInput = (input: string) => {
        if (!input || input.trim() === '') return '';
        return input.split('\n')
          .map(line => line.trim())
          .filter(line => line !== '')
          .join(',');
      };

      const exportData = {
        seller_name: filters.seller_name,
        invoice_status: filters.invoice_status,
        payment_account: filters.payment_account,
        order_number: processMultiLineInput(filters.order_number),
        invoice_number: processMultiLineInput(filters.invoice_number),
        ...(filters.date_range ? {
          start_date: filters.date_range[0],
          end_date: filters.date_range[1]
        } : {}),
        // 如果有选中的记录，传递选中的ID
        ...(selectedRowKeys.length > 0 ? {
          selected_ids: selectedRowKeys
        } : {})
      };
      
      const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/export-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // 获取文件名
      const contentDisposition = response.headers.get('content-disposition');
      let filename = '采购订单数据.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1]);
        }
      }
      
      // 下载文件
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      const exportMessage = selectedRowKeys.length > 0 
        ? `成功导出 ${selectedRowKeys.length} 条选中记录`
        : '成功导出所有筛选记录';
      message.success(exportMessage);
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败，请重试');
    } finally {
      setExportLoading(false);
    }
  };

  // 处理批量下载发票文件
  const handleDownloadInvoices = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要下载发票的订单');
      return;
    }

    // 检查选中的订单是否都已开票
    const selectedOrders = purchaseOrders.filter(order => selectedRowKeys.includes(order.id));
    const uninvoicedOrders = selectedOrders.filter(order => order.invoice_status !== '已开票');
    
    if (uninvoicedOrders.length > 0) {
      message.warning(`选中的订单中有 ${uninvoicedOrders.length} 个订单未开票，无法下载发票文件`);
      return;
    }

    // 检查选中的订单是否属于同一个买家公司
    const buyerCompanies = Array.from(new Set(selectedOrders.map(order => order.payment_account?.trim()).filter(Boolean)));
    console.log('选中的订单买家公司:', buyerCompanies);
    
    if (buyerCompanies.length > 1) {
      message.error(`选中的订单包含多个买家公司（${buyerCompanies.join('、')}），不能一起下载发票。请选择同一个买家公司的订单。`);
      return;
    }
    
    if (buyerCompanies.length === 0) {
      message.error('选中的订单中没有有效的买家公司信息');
      return;
    }

    // 检查是否有发票文件
    const ordersWithoutFiles = selectedOrders.filter(order => 
      !order.invoice || !order.invoice.invoice_file_url
    );
    
    if (ordersWithoutFiles.length > 0) {
      const hasOrdersWithFiles = selectedOrders.length > ordersWithoutFiles.length;
      if (hasOrdersWithFiles) {
        const confirmResult = await new Promise((resolve) => {
          Modal.confirm({
            title: '部分订单无发票文件',
            content: `选中的 ${selectedRowKeys.length} 个订单中，有 ${ordersWithoutFiles.length} 个订单没有上传发票文件。是否继续下载其他 ${selectedOrders.length - ordersWithoutFiles.length} 个订单的发票文件？`,
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        
        if (!confirmResult) {
          return;
        }
      } else {
        message.warning('选中的订单都没有发票文件可下载');
        return;
      }
    }

    try {
      setDownloadInvoicesLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/invoices/batch-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_ids: selectedRowKeys
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      // 获取文件名
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `采购发票_${new Date().toISOString().slice(0, 10)}.zip`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1]);
        }
      }
      
      // 下载ZIP文件
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success(`成功下载 ${selectedRowKeys.length} 个订单的发票文件`);
      
    } catch (error: any) {
      console.error('批量下载发票失败:', error);
      message.error(`批量下载发票失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setDownloadInvoicesLoading(false);
    }
  };

  // 处理批量录入订单
  const handleBatchImport = async (file: File) => {
    try {
      setBatchImportLoading(true);
      const formData = new FormData();
      formData.append('excel', file);

      const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/orders/batch`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      setBatchImportResult(result);

      if (result.code === 0) {
        message.success(`批量导入完成！成功导入 ${result.data.created} 条记录`);
        // 刷新数据
        await fetchPurchaseOrders();
        await fetchStatistics();
      } else {
        message.error(result.message || '批量导入失败');
      }
    } catch (error) {
      console.error('批量导入失败:', error);
      message.error('批量导入失败，请检查网络连接');
    } finally {
      setBatchImportLoading(false);
    }
  };

  // 处理卡片点击
  const handleCardClick = (cardType: string) => {
    // 如果点击的是当前激活的卡片，则取消选择
    if (selectedCard === cardType) {
      setSelectedCard(null);
      setFilters(prev => ({ ...prev, invoice_status: '', payment_account: '' }));
    } else {
      setSelectedCard(cardType);
      // 根据卡片类型设置过滤条件
      switch (cardType) {
        case 'total':
          setFilters(prev => ({ ...prev, invoice_status: '', payment_account: '' }));
          break;
        case 'xinrong-unpaid':
          setFilters(prev => ({ ...prev, invoice_status: '未开票', payment_account: '深圳欣蓉电子商务有限公司' }));
          break;
        case 'xinrong-paid':
          setFilters(prev => ({ ...prev, invoice_status: '已开票', payment_account: '深圳欣蓉电子商务有限公司' }));
          break;
        case 'xianchun-unpaid':
          setFilters(prev => ({ ...prev, invoice_status: '未开票', payment_account: '深圳先春电子商务有限公司' }));
          break;
        case 'xianchun-paid':
          setFilters(prev => ({ ...prev, invoice_status: '已开票', payment_account: '深圳先春电子商务有限公司' }));
          break;
        default:
          setFilters(prev => ({ ...prev, invoice_status: '', payment_account: '' }));
      }
    }
  };

  // 获取卡片样式
  const getCardStyle = (cardType: string) => {
    const baseStyle = {
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      marginBottom: '16px',
    };

    if (selectedCard === cardType) {
      return {
        ...baseStyle,
        boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
        border: '1px solid #1890ff',
        transform: 'translateY(-2px)',
      };
    }

    return baseStyle;
  };

  // 获取卡片className
  const getCardClassName = (cardType: string) => {
    return 'clickable-card';
  };

  // 获取卖家公司名列表
  const fetchSellerCompanies = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/seller-companies`);
      const result = await response.json();
      if (result.code === 0) {
        setSellerCompanies(result.data);
      }
    } catch (error) {
      console.error('获取卖家公司名失败:', error);
    }
  }, []);

  // 获取统计数据
  const fetchStatistics = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/statistics`);
      const result = await response.json();
      if (result.code === 0) {
        setStatistics(result.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  }, []);

  // 获取采购订单列表
  const fetchPurchaseOrders = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      // 处理多行输入，将每行作为一个搜索条件
      const processMultiLineInput = (input: string) => {
        if (!input || input.trim() === '') return '';
        return input.split('\n')
          .map(line => line.trim())
          .filter(line => line !== '')
          .join(',');
      };

      const queryParams: Record<string, string> = {
        page: page.toString(),
        limit: pagination.pageSize.toString(),
        seller_name: filters.seller_name,
        invoice_status: filters.invoice_status,
        payment_account: filters.payment_account,
        order_number: processMultiLineInput(filters.order_number),
        invoice_number: processMultiLineInput(filters.invoice_number),
        ...(filters.date_range ? {
          start_date: filters.date_range[0],
          end_date: dayjs(filters.date_range[1]).add(1, 'day').format('YYYY-MM-DD')
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
        setPagination(prev => ({
          ...prev,
          current: result.data.page,
          total: result.data.total
        }));
        // 数据刷新时清空选中状态
        setSelectedRowKeys([]);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('获取采购订单失败');
    }
    setLoading(false);
  }, [pagination.pageSize, filters]);

  // 页面加载时获取数据
  useEffect(() => {
    fetchStatistics();
    fetchPurchaseOrders();
    fetchSellerCompanies();
  }, [fetchStatistics, fetchPurchaseOrders, fetchSellerCompanies]);

  // 当selectedCard变化时，重新获取数据
  useEffect(() => {
    if (selectedCard) {
      fetchPurchaseOrders(1);
    }
  }, [selectedCard, fetchPurchaseOrders]);

  // 处理订单提交
  const handleOrderSubmit = async (values: any) => {
    try {
      const orderData = {
        ...values,
        order_date: values.order_date.format('YYYY-MM-DD'),
        // 去除字符串字段的前后空格
        order_number: values.order_number?.trim(),
        seller_name: values.seller_name?.trim(),
        payment_account: values.payment_account?.trim(),
        remarks: values.remarks?.trim()
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
          invoice_file_object_name: result.data.fileInfo?.name,
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
        
        // 检查表单完整性
        setTimeout(() => checkInvoiceFormCompleteness(), 100);
        
        // 根据解析质量提供不同的提示
        if (parseQuality.completeness >= 90) {
          if (difference > 0.01) {
            message.warning(`PDF解析成功(完整度${parseQuality.completeness}%)，但发票金额(¥${invoiceAmount.toLocaleString()})与订单金额(¥${ordersAmount.toLocaleString()})不一致，差额¥${difference.toLocaleString()}`);
          } else {
            message.success(`PDF解析成功(完整度${parseQuality.completeness}%)，发票金额与订单金额一致`);
          }
        } else if (parseQuality.completeness >= 70) {
          message.warning(`PDF解析完成(完整度${parseQuality.completeness}%)，请检查并补充缺失的信息，手动修改后可以提交`);
        } else if (parseQuality.completeness >= 50) {
          message.warning(`PDF解析完成(完整度${parseQuality.completeness}%)，解析质量一般，请仔细核对并手动完善信息后提交`);
        } else if (parseQuality.completeness > 0) {
          message.error(`PDF解析完成(完整度${parseQuality.completeness}%)，解析质量较低，建议手动输入所有信息后提交`);
        } else {
          message.error('PDF解析失败，未识别到有效信息，请手动输入发票信息后提交');
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

  // 处理金额差异截图上传
  const handleScreenshotUpload = async (file: any) => {
    setScreenshotUploading(true);
    
    // 检查文件大小 (限制5MB)
    if (file.size > 5 * 1024 * 1024) {
      message.error('截图文件过大，请选择小于5MB的图片');
      setScreenshotUploading(false);
      return false;
    }
    
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      message.error('只支持图片格式的文件');
      setScreenshotUploading(false);
      return false;
    }
    
    const formData = new FormData();
    formData.append('screenshot', file);
    
    // 显示上传进度消息
    const loadingMessage = message.loading('正在上传截图...', 0);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/upload-amount-difference-screenshot`, {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        const newFile: UploadFile = {
          uid: file.uid || `rc-upload-${Date.now()}-${Math.random()}`,
          name: result.data.filename,
          status: 'done',
          url: result.data.url,
          size: result.data.size,
          thumbUrl: result.data.url,
          response: {
            ...result.data
          }
        };
        
        setUploadedScreenshots(prev => [...prev, newFile]);
        loadingMessage(); // 关闭加载消息
        message.success(`截图上传成功：${result.data.filename}`);
        
        // 检查表单完整性
        setTimeout(() => checkInvoiceFormCompleteness(), 100);
      } else {
        loadingMessage(); // 关闭加载消息
        message.error(`截图上传失败: ${result.message || '未知错误'}`);
      }
    } catch (error) {
      loadingMessage(); // 关闭加载消息
      console.error('截图上传失败:', error);
      if (error instanceof Error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          message.error('网络连接失败，请检查网络连接后重试');
        } else {
          message.error(`截图上传失败：${error.message}`);
        }
      } else {
        message.error('截图上传失败：未知错误');
      }
    } finally {
      setScreenshotUploading(false);
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
      
      // 处理截图数据
      let screenshotData = null;
      if (uploadedScreenshots.length > 0) {
        const cleanScreenshots = uploadedScreenshots.map((file) => {
          // 确保获取到正确的objectName
          let objectName = null;
          if (file.response?.objectName) {
            objectName = file.response.objectName;
          } else if (file.response?.data?.objectName) {
            objectName = file.response.data.objectName;
          } else if (file.response?.name) {
            objectName = file.response.name;
          }
          
          console.log('📷 保存截图数据:', {
            uid: file.uid,
            name: file.name,
            objectName: objectName,
            url: file.url
          });
          
          return {
            uid: file.uid,
            name: file.name,
            url: file.url,
            size: file.size,
            status: file.status,
            objectName: objectName // 确保保存OSS对象名
          };
        });
        
        screenshotData = JSON.stringify(cleanScreenshots);
        console.log('📷 最终截图数据:', screenshotData);
      }
      
      const invoiceData = {
        ...values,
        invoice_date: values.invoice_date.format('YYYY-MM-DD'),
        amount_difference_screenshot: screenshotData
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
        setFileList([]);
        setAmountDifference(0);
        setUploadedScreenshots([]);
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
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchPurchaseOrders(1);
  };

  // 重置搜索
  const handleReset = () => {
    setFilters({
      seller_name: '',
      invoice_status: '',
      payment_account: '',
      order_number: '',
      invoice_number: '',
      date_range: null
    });
    setSelectedCard(null);
    setSelectedRowKeys([]); // 重置已勾选的记录
    setPagination(prev => ({ ...prev, current: 1 }));
    // 重置后重新获取数据
    setTimeout(() => fetchPurchaseOrders(1), 0);
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
      render: (invoice: Invoice, record: PurchaseOrder) => {
        if (!invoice) {
          return (
            <div>
              <Text type="secondary">未开票</Text>
              <div style={{ marginTop: '4px' }}>
                <Button
                  type="primary"
                  size="small"
                  icon={<UploadOutlined />}
                  onClick={() => handleSingleInvoice(record)}
                  disabled={record.invoice_status === '已开票'}
                  style={{ fontSize: '12px' }}
                >
                  上传发票
                </Button>
              </div>
            </div>
          );
        }
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
                {invoice.amount_difference_screenshot ? '删除发票及截图' : '删除发票'}
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
                        {/* 金额差异截图显示 */}
            {invoice.amount_difference_screenshot && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                <Button
                  type="link"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => handleViewScreenshots(invoice.amount_difference_screenshot!)}
                  style={{ padding: '0 4px', height: '20px' }}
                  title="查看金额差异截图"
                >
                  查看差异截图
                </Button>
              </div>
            )}
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
      width: 180,
      render: (_, record) => (
        <Space size="small">
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
          <Button 
            size="small" 
            danger
            icon={<DeleteOutlined />} 
            onClick={() => handleDeleteOrder(record)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  // 获取选中订单的总金额
  const getSelectedOrdersAmount = () => {
    if (!purchaseOrders || purchaseOrders.length === 0) {
      return 0;
    }
    
    return purchaseOrders
      .filter(order => selectedRowKeys.includes(order.id))
      .reduce((sum, order) => {
        const amount = typeof order.amount === 'number' ? order.amount : parseFloat(order.amount) || 0;
        return sum + amount;
      }, 0);
  };

  // 获取选中订单的卖家名称列表
  const getSelectedSellers = () => {
    const sellers = purchaseOrders
      .filter(order => selectedRowKeys.includes(order.id))
      .map(order => order.seller_name);
    return sellers.filter((seller, index) => sellers.indexOf(seller) === index);
  };

  // 检查发票表单必填字段是否完整
  const checkInvoiceFormCompleteness = () => {
    const values = invoiceForm.getFieldsValue();
    const requiredFields = ['invoice_number', 'invoice_date', 'total_amount', 'seller_name'];
    
    const isComplete = requiredFields.every(field => {
      const value = values[field];
      if (field === 'total_amount') {
        return value !== null && value !== undefined && value > 0;
      }
      return value !== null && value !== undefined && value !== '';
    });
    
    const hasAmountDifference = amountDifference > 0.01;
    const hasScreenshots = uploadedScreenshots.length > 0;
    
    // 表单完整且（没有金额差异或已上传截图）
    const canSubmit = isComplete && (!hasAmountDifference || hasScreenshots);
    
    setCanSubmitInvoice(canSubmit);
    return canSubmit;
  };

  // 查看发票文件（直接打开代理URL）
  const handleViewInvoiceFile = (invoiceId: number) => {
    // 直接在新窗口打开后端代理URL
    const fileUrl = `${API_BASE_URL}/api/purchase-invoice/invoices/${invoiceId}/file`;
    window.open(fileUrl, '_blank');
  };

  // 预览上传中的截图文件
  const handlePreviewUploadedScreenshot = (file: UploadFile) => {
    console.log('预览上传文件:', file);
    
    // 获取文件URL，按优先级检查不同字段
    const url = file.url || file.thumbUrl || (file.response && file.response.url) || 
                (file.response && file.response.data && file.response.data.url);
    
    if (url) {
      Modal.info({
        title: '截图预览',
        width: 600,
        content: (
          <div style={{ textAlign: 'center' }}>
            <img
              src={url}
              alt={file.name || '截图'}
              style={{ 
                maxWidth: '100%', 
                maxHeight: '400px', 
                objectFit: 'contain',
                border: '1px solid #d9d9d9',
                borderRadius: '4px'
              }}
              onError={(e) => {
                console.error('图片预览失败:', url);
                message.error('图片预览失败');
              }}
              onLoad={() => {
                console.log('图片预览成功:', url);
              }}
            />
            <p style={{ marginTop: '8px', color: '#666' }}>
              文件名: {file.name}
            </p>
          </div>
        )
      });
    } else {
      console.error('无法获取文件URL:', file);
      message.error('无法预览该文件，未找到有效的URL');
    }
  };

  // 查看金额差异截图
  const handleViewScreenshots = (screenshotData: string) => {
    try {
      let screenshots: any;
      try {
        screenshots = JSON.parse(screenshotData);
      } catch (parseError) {
        message.error('截图数据格式错误，无法解析');
        return;
      }
      
      // 处理不同的数据格式
      let screenshotUrls: string[] = [];
      
      if (Array.isArray(screenshots)) {
        screenshotUrls = screenshots.map((shot: any) => {
          if (typeof shot === 'string') {
            return shot;
          }
          
          if (shot.url) {
            return shot.url;
          }
          
          if (shot.response) {
            if (typeof shot.response === 'string') {
              return shot.response;
            }
            if (shot.response.url) {
              return shot.response.url;
            }
            if (shot.response.data && shot.response.data.url) {
              return shot.response.data.url;
            }
          }
          
          if (shot.thumbUrl) {
            return shot.thumbUrl;
          }
          
          if (shot.src) {
            return shot.src;
          }
          
          return '';
        }).filter(url => url && url.trim() !== '');
      } else if (typeof screenshots === 'object' && screenshots !== null) {
        // 单个对象的情况
        const shot = screenshots;
        if (shot.url) {
          screenshotUrls = [shot.url];
        } else if (shot.response && shot.response.url) {
          screenshotUrls = [shot.response.url];
        } else if (typeof shot === 'string') {
          screenshotUrls = [shot];
        }
      } else if (typeof screenshots === 'string') {
        // 单个URL字符串
        screenshotUrls = [screenshots];
      }
      
      if (screenshotUrls.length === 0) {
        message.warning('没有找到有效的截图');
        return;
      }
      
      // 显示截图模态框
      Modal.info({
        title: '金额差异截图',
        width: 800,
        content: (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {screenshotUrls.map((url: string, index: number) => (
              <img
                key={index}
                src={url}
                alt={`截图 ${index + 1}`}
                style={{ 
                  maxWidth: '200px', 
                  maxHeight: '200px', 
                  objectFit: 'contain',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                onClick={() => window.open(url, '_blank')}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  message.error(`截图 ${index + 1} 加载失败`);
                }}
              />
            ))}
          </div>
        )
      });
    } catch (error) {
      console.error('查看截图时发生错误:', error);
      message.error('查看截图失败: ' + (error instanceof Error ? error.message : String(error)));
    }
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

  // 处理单个记录开票
  const handleSingleInvoice = (record: PurchaseOrder) => {
    // 清空之前选中的记录，设置为当前记录
    setSelectedRowKeys([record.id]);
    
    // 重置发票相关状态
    setExtractedInfo(null);
    setParseQuality(null);
    setFileList([]);
    setAmountDifference(0);
    setUploadedScreenshots([]);
    setCanSubmitInvoice(false);
    
    // 重置表单
    invoiceForm.resetFields();
    
    // 打开发票录入模态框
    setInvoiceModalVisible(true);
    
    // 显示提示信息
    message.info(`已选择订单：${record.order_number}，开始为其开票`);
    
    // 初始化表单完整性检查
    setTimeout(() => checkInvoiceFormCompleteness(), 100);
  };

  // 删除发票方法
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
            // 构建详细的删除结果消息
            const {
              resetOrdersCount = 0,
              ossDelete = {},
              screenshotDelete = {},
              operationDetails = {}
            } = result.data || {};
            
            let messages = ['发票删除成功'];
            
            // OSS文件删除结果
            if (operationDetails.hadFile) {
              if (ossDelete.success) {
                messages.push('OSS发票文件已删除');
              } else {
                messages.push('OSS发票文件删除失败');
              }
            }
            
            // 截图删除结果
            if (operationDetails.hadScreenshots) {
              if (screenshotDelete.success) {
                const deletedCount = screenshotDelete.deletedCount || 0;
                const failedCount = screenshotDelete.failedCount || 0;
                if (failedCount > 0) {
                  messages.push(`${deletedCount}个截图已删除，${failedCount}个删除失败`);
                } else {
                  messages.push(`${deletedCount}个截图已删除`);
                }
              } else {
                messages.push('截图删除失败');
              }
            }
            
            // 订单重置结果
            if (resetOrdersCount > 0) {
              messages.push(`已重置${resetOrdersCount}个相关订单的状态`);
            }
            
            const finalMessage = messages.join('，');
            
            // 根据是否有失败的操作选择消息类型
            const hasFailures = (operationDetails.hadFile && !ossDelete.success) || 
                               (operationDetails.hadScreenshots && !screenshotDelete.success);
            
            if (hasFailures) {
              message.warning(finalMessage);
            } else {
              message.success(finalMessage);
            }
            
            // 清空选中状态并刷新数据
            setSelectedRowKeys([]);
            await fetchPurchaseOrders();
            await fetchStatistics();
          } else {
            message.error(result.message || '删除失败');
          }
        } catch (error) {
          if (error instanceof Error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
              message.error('网络连接失败，请检查网络连接');
            } else if (error.name === 'SyntaxError') {
              message.error('服务器响应格式错误');
            } else {
              message.error(`删除失败: ${error.message}`);
            }
          } else {
            message.error(`删除失败: ${String(error)}`);
          }
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // 删除订单
  const handleDeleteOrder = (record: PurchaseOrder) => {
    // 检查开票状态
    if (record.invoice_status !== '未开票') {
      Modal.error({
        title: '无法删除',
        content: '该订单已开票，请先删除发票信息后再删除订单记录。',
        okText: '确定',
      });
      return;
    }

    // 如果是未开票状态，弹出确认对话框
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除订单 "${record.order_number}" 吗？删除后无法恢复。`,
      okText: '确定删除',
      cancelText: '取消',
      onOk: async () => {
        try {
          setLoading(true);
          const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/orders/${record.id}`, {
            method: 'DELETE',
          });
          
          const result = await response.json();
          
          if (result.code === 0) {
            message.success('订单删除成功');
            // 刷新数据
            await fetchPurchaseOrders();
            await fetchStatistics();
          } else {
            message.error(result.message || '删除失败');
          }
        } catch (error) {
          if (error instanceof Error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
              message.error('网络连接失败，请检查网络连接');
            } else if (error.name === 'SyntaxError') {
              message.error('服务器响应格式错误');
            } else {
              message.error(`删除失败: ${error.message}`);
            }
          } else {
            message.error(`删除失败: ${String(error)}`);
          }
        } finally {
          setLoading(false);
        }
      }
    });
  };

  return (
    <div style={{ padding: '24px' }}>
      <style>
        {`
          .clickable-card {
            transition: all 0.3s ease;
          }
          .clickable-card:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transform: translateY(-2px);
          }
          .upload-disabled {
            opacity: 0.6;
            pointer-events: none;
          }
          .ant-upload-list-picture-card .ant-upload-list-item-uploading {
            border-color: #1890ff;
          }
          .ant-upload-list-picture-card .ant-upload-list-item-uploading .ant-upload-list-item-thumbnail {
            filter: blur(1px);
          }
        `}
      </style>
      <Title level={2}>
        <FileTextOutlined style={{ marginRight: '8px' }} />
        采购发票管理
      </Title>
      
      {/* 统计卡片 */}
      {statistics && (
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={4}>
            <Card
              className={getCardClassName('total')}
              onClick={() => handleCardClick('total')}
              style={getCardStyle('total')}
            >
              <Statistic
                title="总订单数"
                value={statistics.overview.totalOrders}
                prefix={<ShoppingCartOutlined />}
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card
              className={getCardClassName('xinrong-unpaid')}
              onClick={() => handleCardClick('xinrong-unpaid')}
              style={getCardStyle('xinrong-unpaid')}
            >
              <Statistic
                title="欣蓉未开票订单"
                value={statistics.overview.companyStats['深圳欣蓉电子商务有限公司']?.unpaidOrders || 0}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card
              className={getCardClassName('xinrong-paid')}
              onClick={() => handleCardClick('xinrong-paid')}
              style={getCardStyle('xinrong-paid')}
            >
              <Statistic
                title="欣蓉已开票订单"
                value={statistics.overview.companyStats['深圳欣蓉电子商务有限公司']?.fullyPaidOrders || 0}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card
              className={getCardClassName('xianchun-unpaid')}
              onClick={() => handleCardClick('xianchun-unpaid')}
              style={getCardStyle('xianchun-unpaid')}
            >
              <Statistic
                title="先春未开票订单"
                value={statistics.overview.companyStats['深圳先春电子商务有限公司']?.unpaidOrders || 0}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={5}>
            <Card
              className={getCardClassName('xianchun-paid')}
              onClick={() => handleCardClick('xianchun-paid')}
              style={getCardStyle('xianchun-paid')}
            >
              <Statistic
                title="先春已开票订单"
                value={statistics.overview.companyStats['深圳先春电子商务有限公司']?.fullyPaidOrders || 0}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 主要内容 */}
      <Card>
        {/* 筛选状态提示 */}
        {selectedCard && (
          <Alert
            message={
              <div>
                <strong>当前筛选：</strong>
                {selectedCard === 'total' && '显示所有订单'}
                {selectedCard === 'xinrong-unpaid' && '显示欣蓉未开票订单'}
                {selectedCard === 'xinrong-paid' && '显示欣蓉已开票订单'}
                {selectedCard === 'xianchun-unpaid' && '显示先春未开票订单'}
                {selectedCard === 'xianchun-paid' && '显示先春已开票订单'}
                <Button 
                  type="link" 
                  size="small" 
                  onClick={() => {
                    setSelectedCard(null);
                    setFilters(prev => ({ ...prev, invoice_status: '', payment_account: '' }));
                  }}
                  style={{ marginLeft: '8px' }}
                >
                  清除筛选
                </Button>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        )}
        
        {/* 搜索筛选区域 */}
        <Row gutter={16} style={{ marginBottom: '16px' }}>
          <Col span={4}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>订单编号</label>
              <TextArea
                placeholder="请输入订单编号，每行一个"
                value={filters.order_number}
                onChange={(e) => setFilters(prev => ({ ...prev, order_number: e.target.value }))}
                autoSize={{ minRows: 2, maxRows: 8 }}
                allowClear
              />
            </div>
          </Col>
          <Col span={4}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>发票号</label>
              <TextArea
                placeholder="请输入发票号，每行一个"
                value={filters.invoice_number}
                onChange={(e) => setFilters(prev => ({ ...prev, invoice_number: e.target.value }))}
                autoSize={{ minRows: 2, maxRows: 8 }}
                allowClear
              />
            </div>
          </Col>
          <Col span={4}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>卖家公司名</label>
              <Select
                placeholder="请选择卖家公司名"
                value={filters.seller_name}
                onChange={(value) => {
                  setFilters(prev => ({ ...prev, seller_name: value }));
                  // 清空时自动刷新数据
                  if (!value) {
                    setTimeout(() => handleSearch(), 0);
                  }
                }}
                allowClear
                style={{ width: '100%' }}
                showSearch
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
              >
                {sellerCompanies.map(company => (
                  <Option key={company} value={company}>{company}</Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col span={4}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>买家公司名</label>
              <Select
                placeholder="请选择买家公司名"
                value={filters.payment_account}
                onChange={(value) => {
                  setFilters(prev => ({ ...prev, payment_account: value }));
                  // 清空时自动刷新数据
                  if (!value) {
                    setTimeout(() => handleSearch(), 0);
                  }
                }}
                allowClear
                style={{ width: '100%' }}
              >
                {buyerCompanies.map(company => (
                  <Option key={company} value={company}>{company}</Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col span={4}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>订单日期</label>
              <RangePicker
                style={{ width: '100%' }}
                placeholder={['开始日期', '结束日期']}
                value={filters.date_range ? [dayjs(filters.date_range[0]), dayjs(filters.date_range[1])] : null}
                onChange={(dates) => {
                  setFilters(prev => ({ 
                    ...prev, 
                    date_range: dates ? [dates[0]!.format('YYYY-MM-DD'), dates[1]!.format('YYYY-MM-DD')] : null 
                  }));
                }}
              />
            </div>
          </Col>
          <Col span={4}>
            <div style={{ paddingTop: '24px' }}>
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
            </div>
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
                onClick={() => {
                  setBatchImportModalVisible(true);
                  setBatchImportResult(null);
                }}
              >
                批量录入订单
              </Button>
              <Button 
                type="primary" 
                icon={<UploadOutlined />}
                disabled={selectedRowKeys.length === 0}
                onClick={() => {
                  // 检查选中的订单是否都是未开票状态
                  const selectedOrders = purchaseOrders.filter(order => selectedRowKeys.includes(order.id));
                  const invoicedOrders = selectedOrders.filter(order => order.invoice_status === '已开票');
                  
                  if (invoicedOrders.length > 0) {
                    message.warning(`选中的订单中有 ${invoicedOrders.length} 个订单已开票，无法重复开票`);
                    return;
                  }
                  
                  setExtractedInfo(null);
                  setFileList([]);
                  setAmountDifference(0);
                  setUploadedScreenshots([]);
                  setCanSubmitInvoice(false);
                  invoiceForm.resetFields();
                  setInvoiceModalVisible(true);
                  
                  // 初始化表单完整性检查
                  setTimeout(() => checkInvoiceFormCompleteness(), 100);
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
              <Tooltip
                title={
                  selectedRowKeys.length > 0 
                    ? `导出 ${selectedRowKeys.length} 条选中的记录`
                    : '导出当前筛选条件下的所有记录'
                }
              >
                <Button 
                  icon={<DownloadOutlined />}
                  loading={exportLoading}
                  onClick={handleExport}
                >
                  导出{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ''}
                </Button>
              </Tooltip>

              <Tooltip
                title={
                  selectedRowKeys.length > 0 
                    ? `下载 ${selectedRowKeys.length} 条选中记录的发票文件`
                    : '请先选择要下载发票的订单'
                }
              >
                <Button 
                  icon={<FilePdfOutlined />}
                  loading={downloadInvoicesLoading}
                  disabled={selectedRowKeys.length === 0}
                  onClick={handleDownloadInvoices}
                >
                  下载发票{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ''}
                </Button>
              </Tooltip>
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
            showTotal: (total, range) => 
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              setPagination(prev => ({ ...prev, current: page, pageSize }));
              fetchPurchaseOrders(page);
            }
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            preserveSelectedRowKeys: false, // 不保留跨页选中状态
            getCheckboxProps: (record) => ({
              disabled: false, // 允许选择所有订单，具体功能在按钮点击时验证
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
                <DatePicker style={{ width: '100%' }} placeholder="请选择订单日期" />
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
                  placeholder="请输入实付款金额"
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
                <Select placeholder="请选择开票状态">
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
        onCancel={() => {
          setInvoiceModalVisible(false);
          setExtractedInfo(null);
          setParseQuality(null);
          setFileList([]);
          setAmountDifference(0);
          setUploadedScreenshots([]);
          setCanSubmitInvoice(false);
          invoiceForm.resetFields();
        }}
        width={800}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setInvoiceModalVisible(false);
              setExtractedInfo(null);
              setParseQuality(null);
              setFileList([]);
              setAmountDifference(0);
              setUploadedScreenshots([]);
              setCanSubmitInvoice(false);
              invoiceForm.resetFields();
            }}
          >
            取消
          </Button>,
          <Tooltip
            key="submit"
            title={
              !canSubmitInvoice
                ? amountDifference > 0.01 && uploadedScreenshots.length === 0
                  ? "请填写必填字段并上传金额差异截图"
                  : "请填写所有必填字段（发票号、开票日期、发票总金额、开票方）"
                : ""
            }
          >
            <Button
              type="primary"
              loading={loading}
              disabled={!canSubmitInvoice}
              onClick={() => invoiceForm.submit()}
            >
              确定
            </Button>
          </Tooltip>
        ]}
      >
        {/* 选中订单信息 */}
        <Alert
          message={
            <div>
              <strong>将为以下订单开票：</strong>
              <div style={{ marginTop: '8px' }}>
                选中订单数量: {selectedRowKeys.length} 个 | 
                金额合计: ¥{getSelectedOrdersAmount().toFixed(2)} | 
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
          onValuesChange={checkInvoiceFormCompleteness}
        >
          {/* PDF上传区域 */}
          <Form.Item label="上传发票PDF（自动识别）">
            <Upload.Dragger
              accept=".pdf"
              beforeUpload={handlePdfUpload}
              fileList={fileList}
              onChange={({ fileList }) => setFileList(fileList)}
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
                      {!parseQuality.hasInvoiceNumber && <span style={{ color: '#ff4d4f', fontSize: '12px', marginLeft: '8px' }}>(必填，请手动输入)</span>}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="开票日期">
                    <span style={{ color: parseQuality.hasInvoiceDate ? '#52c41a' : '#ff4d4f' }}>
                      {extractedInfo.invoice_date || '未识别'}
                      {!parseQuality.hasInvoiceDate && <span style={{ color: '#ff4d4f', fontSize: '12px', marginLeft: '8px' }}>(必填，请手动选择)</span>}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="总金额">
                    <span style={{ color: parseQuality.hasTotalAmount ? '#52c41a' : '#ff4d4f' }}>
                      {extractedInfo.total_amount ? `¥${parseFloat(extractedInfo.total_amount).toLocaleString()}` : '未识别'}
                      {!parseQuality.hasTotalAmount && <span style={{ color: '#ff4d4f', fontSize: '12px', marginLeft: '8px' }}>(必填，请手动输入)</span>}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="税额">
                    <span style={{ color: extractedInfo.tax_amount ? '#52c41a' : '#faad14' }}>
                      {extractedInfo.tax_amount ? `¥${parseFloat(extractedInfo.tax_amount).toLocaleString()}` : '未识别'}
                      <span style={{ color: '#666', fontSize: '12px', marginLeft: '8px' }}>(可选)</span>
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="税率">
                    <span style={{ color: extractedInfo.tax_rate ? '#52c41a' : '#faad14' }}>
                      {extractedInfo.tax_rate || '未识别'}
                      <span style={{ color: '#666', fontSize: '12px', marginLeft: '8px' }}>(可选)</span>
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="开票方">
                    <span style={{ color: parseQuality.hasSellerName ? '#52c41a' : '#ff4d4f' }}>
                      {extractedInfo.seller_name || '未识别'}
                      {!parseQuality.hasSellerName && <span style={{ color: '#ff4d4f', fontSize: '12px', marginLeft: '8px' }}>(必填，请手动输入)</span>}
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
                    description={
                      <div>
                        <div>PDF解析基本完成，请填写标记为"必填"的红色字段后即可提交。</div>
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                          💡 提示：已识别字段无需修改，只需补充缺失的必填信息即可
                        </div>
                      </div>
                    }
                    type="warning"
                    showIcon
                    style={{ marginBottom: '8px' }}
                  />
                ) : parseQuality.completeness >= 50 ? (
                  <Alert
                    message="解析质量一般"
                    description={
                      <div>
                        <div>PDF解析部分完成，请仔细填写所有标记为"必填"的红色字段后提交。</div>
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                          💡 必填字段：发票号、开票日期、发票总金额、开票方
                        </div>
                      </div>
                    }
                    type="warning"
                    showIcon
                    style={{ marginBottom: '8px' }}
                  />
                ) : parseQuality.completeness > 0 ? (
                  <Alert
                    message="解析质量较低"
                    description={
                      <div>
                        <div>PDF解析识别有限，请手动填写下方表单中的所有必填字段后提交。</div>
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                          💡 必填字段：发票号、开票日期、发票总金额、开票方
                        </div>
                      </div>
                    }
                    type="error"
                    showIcon
                    style={{ marginBottom: '8px' }}
                  />
                ) : (
                  <Alert
                    message="解析失败"
                    description={
                      <div>
                        <div>PDF未能识别到有效信息，请手动填写下方表单中的所有必填字段后提交。</div>
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                          💡 必填字段：发票号、开票日期、发票总金额、开票方
                        </div>
                      </div>
                    }
                    type="error"
                    showIcon
                    style={{ marginBottom: '8px' }}
                  />
                )}
                
                {/* 金额匹配提示 */}
                {amountDifference > 0.01 && (
                  <Alert
                    message={`金额不匹配警告：发票金额与选中订单总额相差¥${amountDifference.toLocaleString()}`}
                    description={
                      <div>
                        <p>请检查发票金额或重新选择订单</p>
                        <p style={{ marginTop: '8px' }}>如果是因平台活动导致的金额差异，请上传相关订单记录截图：</p>
                        <Upload
                          accept="image/*"
                          beforeUpload={handleScreenshotUpload}
                          fileList={uploadedScreenshots}
                          onChange={({ fileList }) => {
                            // 如果fileList为空或者长度减少，说明是删除操作
                            if (fileList.length < uploadedScreenshots.length) {
                              setUploadedScreenshots(fileList);
                            }
                            // 如果是添加操作，保留现有状态，避免覆盖URL
                          }}
                          multiple
                          listType="picture-card"
                          showUploadList={{
                            showPreviewIcon: true,
                            showRemoveIcon: true,
                            showDownloadIcon: false
                          }}
                          onPreview={handlePreviewUploadedScreenshot}
                          disabled={screenshotUploading}
                          className={screenshotUploading ? 'upload-disabled' : ''}
                          onRemove={async (file) => {
                            try {
                              // 获取OSS对象名
                              let objectName = null;
                              if (file.response?.objectName) {
                                objectName = file.response.objectName;
                              } else if (file.response?.data?.objectName) {
                                objectName = file.response.data.objectName;
                              } else if (file.url && file.url.includes('screenshot-proxy?path=')) {
                                // 从代理URL中提取路径参数
                                try {
                                  const urlObj = new URL(file.url);
                                  objectName = decodeURIComponent(urlObj.searchParams.get('path') || '');
                                                                 } catch (urlError: any) {
                                   console.warn('⚠️ 从URL解析对象名失败:', file.url, urlError.message);
                                }
                              }
                              
                              if (objectName) {
                                // 调用后端删除OSS文件
                                const response = await fetch(`${API_BASE_URL}/api/purchase-invoice/delete-invoice-file`, {
                                  method: 'DELETE',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({ objectName }),
                                });
                                
                                const result = await response.json();
                                if (result.code === 0) {
                                  console.log('✅ OSS截图文件删除成功:', objectName);
                                } else {
                                  console.warn('⚠️ OSS截图文件删除失败:', objectName, result.message);
                                }
                              } else {
                                console.warn('⚠️ 无法获取截图的OSS对象名:', file);
                              }
                              
                              // 从前端状态中移除
                              setUploadedScreenshots(prev => 
                                prev.filter(item => item.uid !== file.uid)
                              );
                              message.success('截图删除成功');
                              
                              // 检查表单完整性
                              setTimeout(() => checkInvoiceFormCompleteness(), 100);
                              
                            } catch (error) {
                              console.error('删除截图时发生错误:', error);
                              // 即使OSS删除失败，也要从前端状态中移除
                              setUploadedScreenshots(prev => 
                                prev.filter(item => item.uid !== file.uid)
                              );
                              message.warning('截图从界面移除成功，但OSS文件可能删除失败');
                            }
                            
                            return true;
                          }}
                          style={{ marginTop: '8px' }}
                        >
                          {uploadedScreenshots.length >= 3 ? null : (
                            <div>
                              <PlusOutlined />
                              <div style={{ marginTop: 8 }}>
                                {screenshotUploading ? '上传中...' : '上传截图'}
                              </div>
                            </div>
                          )}
                        </Upload>
                      </div>
                    }
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
                <Input placeholder="请输入发票号码" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="开票日期"
                name="invoice_date"
                rules={[{ required: true, message: '请选择开票日期' }]}
              >
                <DatePicker style={{ width: '100%' }} placeholder="请选择开票日期" />
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
                <Input placeholder="请输入开票方公司名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="收票方"
                name="buyer_name"
              >
                <Input placeholder="请输入收票方公司名称" />
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
                initialValue="正常"
              >
                <Select placeholder="请选择发票状态">
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
          
          {/* 隐藏字段存储文件信息 */}
          <Form.Item name="invoice_file_url" style={{ display: 'none' }}>
            <Input type="hidden" />
          </Form.Item>
          <Form.Item name="invoice_file_object_name" style={{ display: 'none' }}>
            <Input type="hidden" />
          </Form.Item>
          <Form.Item name="invoice_file_name" style={{ display: 'none' }}>
            <Input type="hidden" />
          </Form.Item>
          <Form.Item name="file_size" style={{ display: 'none' }}>
            <Input type="hidden" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量录入订单模态框 */}
      <Modal
        title="批量录入订单"
        open={batchImportModalVisible}
        onCancel={() => {
          setBatchImportModalVisible(false);
          setBatchImportResult(null);
        }}
        width={800}
        footer={null}
      >
        <Alert
          message="上传说明"
          description={
            <div>
              <p>请上传包含以下列的Excel文件（列名必须完全匹配）：</p>
              <ul>
                <li><strong>订单编号</strong>：必填，系统会自动跳过已存在的订单</li>
                <li><strong>买家公司名</strong>：必填</li>
                <li><strong>卖家公司名</strong>：必填</li>
                <li><strong>实付款(元)</strong>：必填，数字格式（支持千位分隔符，如：20,400.00）</li>
                <li><strong>订单付款时间</strong>：必填，支持多种日期时间格式（如：2025/4/2、2025-04-02、2025/4/2 09:27:26、2025-04-02 09:27:26）</li>
              </ul>
              <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f6f8fa', borderRadius: '4px' }}>
                <p style={{ margin: 0, fontWeight: 'bold', color: '#0366d6' }}>✨ 新功能支持：</p>
                <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                  <li>✅ 自动处理Excel合并单元格</li>
                  <li>✅ 自动提取日期时间中的日期部分（忽略具体时间）</li>
                </ul>
              </div>
              <p>注意：列名必须完全匹配上述5个名称，否则无法识别。</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />
        
        <Upload
          beforeUpload={(file) => {
            // 检查文件类型
            const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                          file.type === 'application/vnd.ms-excel';
            if (!isExcel) {
              message.error('只能上传Excel文件！');
              return false;
            }
            
            // 检查文件大小
            const isLt10M = file.size / 1024 / 1024 < 10;
            if (!isLt10M) {
              message.error('文件大小不能超过10MB！');
              return false;
            }
            
            handleBatchImport(file);
            return false; // 阻止自动上传
          }}
          showUploadList={false}
        >
          <Button 
            icon={<UploadOutlined />} 
            loading={batchImportLoading}
            size="large"
            type="primary"
            style={{ width: '100%', height: '80px' }}
          >
            {batchImportLoading ? '正在处理中...' : '点击上传Excel文件'}
          </Button>
        </Upload>
        
        {/* 导入结果 */}
        {batchImportResult && (
          <div style={{ marginTop: '20px' }}>
            <Alert
              message={`导入结果`}
              description={
                <div>
                  <p>总计处理: {batchImportResult.data?.total || 0} 条记录</p>
                  <p>成功导入: {batchImportResult.data?.created || 0} 条</p>
                  <p>跳过重复: {batchImportResult.data?.skipped || 0} 条</p>
                  <p>错误记录: {batchImportResult.data?.error || 0} 条</p>
                </div>
              }
              type={batchImportResult.code === 0 ? 'success' : 'error'}
              showIcon
              style={{ marginBottom: '16px' }}
            />
            
            {/* 错误详情 */}
            {batchImportResult.data?.errorDetails && batchImportResult.data.errorDetails.length > 0 && (
              <div>
                <Typography.Title level={5}>错误详情：</Typography.Title>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {batchImportResult.data.errorDetails.map((error: any, index: number) => (
                    <div key={index} style={{ marginBottom: '8px' }}>
                      <Text type="danger">第{error.row}行: {error.reason}</Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 跳过详情 */}
            {batchImportResult.data?.skippedDetails && batchImportResult.data.skippedDetails.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <Typography.Title level={5}>跳过详情：</Typography.Title>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {batchImportResult.data.skippedDetails.map((skipped: any, index: number) => (
                    <div key={index} style={{ marginBottom: '8px' }}>
                      <Text type="warning">第{skipped.row}行: {skipped.reason}</Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

    </div>
  );
};

export default PurchaseInvoice; 