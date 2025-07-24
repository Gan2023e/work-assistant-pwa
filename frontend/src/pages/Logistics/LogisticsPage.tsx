import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, 
  Input, 
  Space, 
  Button, 
  message, 
  Card, 
  Row, 
  Col,
  Statistic,
  Tag,
  Select,
  DatePicker,
  Divider,
  Typography,
  Tooltip,
  Modal,
  Form,
  InputNumber,
  Upload
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { 
  SearchOutlined, 
  ReloadOutlined, 
  ExportOutlined,
  FilterOutlined,
  TruckOutlined,
  BoxPlotOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  SaveOutlined,
  CloseOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  FileTextOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { API_BASE_URL } from '../../config/api';


const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;

// 物流记录接口
interface LogisticsRecord {
  shippingId: string;
  logisticsProvider: string;
  trackingNumber: string;
  packageCount: number;
  productCount: number;
  channel: string;
  status: string;
  departureDate: string;
  sailingDate: string;
  estimatedArrivalDate: string;
  estimatedWarehouseDate: string;
  logisticsNode: string;
  destinationCountry: string;
  destinationWarehouse: string;
  price: number;
  billingWeight: number;
  mrn: string;
  customsDuty: number;
  taxPaymentStatus: string;
  taxDeclarationStatus: string;
  dimensions: string;
  paymentStatus: string;
  // VAT税单相关字段
  vatReceiptUrl?: string;
  vatReceiptObjectName?: string;
  vatReceiptFileName?: string;
  vatReceiptFileSize?: number;
  vatReceiptUploadTime?: string;
  vatReceiptTaxAmount?: number;
  vatReceiptTaxDate?: string;
}

// 筛选选项接口
interface FilterOptions {
  logisticsProvider?: string[];
  channel?: string[];
  status?: string[];
  destinationCountry?: string[];
  taxPaymentStatus?: string[];
  taxDeclarationStatus?: string[];
  paymentStatus?: string[];
}

// 搜索参数接口
interface SearchParams {
  shippingIds?: string[];
  filters: {
    logisticsProvider?: string[];
    channel?: string[];
    status?: string[];
    destinationCountry?: string[];
    taxPaymentStatus?: string[];
    taxDeclarationStatus?: string[];
    paymentStatus?: string[];
    specialQuery?: string;
  };
}

// 批量更新数据接口
interface BatchUpdateData {
  shippingId: string;
  updates: { [key: string]: any };
}



// HSCODE接口
interface HsCode {
  parent_sku: string; // 主键
  weblink: string;
  uk_hscode: string;
  us_hscode: string;
  declared_value?: number;
  declared_value_currency?: string;
  created_at?: string;
  updated_at?: string;
}

const LogisticsPage: React.FC = () => {
  // 状态管理
  const [data, setData] = useState<LogisticsRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({});
  const [filters, setFilters] = useState<SearchParams['filters']>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchStatusValue, setBatchStatusValue] = useState<string | undefined>(undefined);
  const [batchPaymentStatusValue, setBatchPaymentStatusValue] = useState<string | undefined>(undefined);
  const [batchTaxStatusValue, setBatchTaxStatusValue] = useState<string | undefined>(undefined);
  const [currentSearchParams, setCurrentSearchParams] = useState<SearchParams | null>(null);
  const [editingKey, setEditingKey] = useState('');
  const [editingField, setEditingField] = useState('');
  const [editingValue, setEditingValue] = useState<any>('');
  const [batchUpdateModalVisible, setBatchUpdateModalVisible] = useState(false);
  const [batchUpdateText, setBatchUpdateText] = useState('');
  const [parsedBatchData, setParsedBatchData] = useState<BatchUpdateData[]>([]);

  const [form] = Form.useForm();
  const [statisticsData, setStatisticsData] = useState({
    yearlyCount: 0,
    transitProductCount: 0,
    transitPackageCount: 0,
    unpaidTotalFee: 0,
    pendingWarehouseCount: 0,
    unuploadedVatReceiptCount: 0,
    inspectingCount: 0
  });
  const [vatUploadingIds, setVatUploadingIds] = useState<Set<string>>(new Set());
  const [vatDeletingIds, setVatDeletingIds] = useState<Set<string>>(new Set());

  // VAT税单上传对话框相关状态
  const [vatUploadModalVisible, setVatUploadModalVisible] = useState(false);
  const [vatUploadModalLoading, setVatUploadModalLoading] = useState(false);
  const [selectedVatFile, setSelectedVatFile] = useState<File | null>(null);
  const [selectedShippingId, setSelectedShippingId] = useState<string>('');
  const [vatExtractedData, setVatExtractedData] = useState<{
    mrn: string;
    taxAmount: number | null;
    taxDate: string | null;
  } | null>(null);
  const [vatUploadStep, setVatUploadStep] = useState<'select' | 'confirm' | 'uploading'>('select');
  const [vatForm] = Form.useForm();
  const [isDragOver, setIsDragOver] = useState(false);
  const [exportVatLoading, setExportVatLoading] = useState(false);

  // VAT税单编辑相关状态
  const [vatEditModalVisible, setVatEditModalVisible] = useState(false);
  const [editingVatRecord, setEditingVatRecord] = useState<LogisticsRecord | null>(null);
  const [vatEditForm] = Form.useForm();
  const [vatEditLoading, setVatEditLoading] = useState(false);

  // API调用函数
  const fetchData = async (params: SearchParams, showMessage: boolean = true) => {
    setLoading(true);
    try {
      // 保存当前搜索参数
      setCurrentSearchParams(params);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/logistics/search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(params),
        });
        
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
      const result = await response.json();
      
      // 根据是否有搜索的Shipping ID来决定排序方式
      let sortedData: LogisticsRecord[];
      if (params.shippingIds && params.shippingIds.length > 0) {
        // 如果有搜索的Shipping ID，严格按照输入顺序排列
        const shippingIdOrder = params.shippingIds;
        const dataMap = new Map<string, LogisticsRecord>();
        
        // 将数据按shippingId存储到Map中
        (result.data || []).forEach((item: LogisticsRecord) => {
          dataMap.set(item.shippingId, item);
        });
        
        // 按照输入顺序重新排列数据
        sortedData = [];
        shippingIdOrder.forEach((shippingId: string) => {
          if (dataMap.has(shippingId)) {
            sortedData.push(dataMap.get(shippingId)!);
          }
        });
        
        // 添加不在搜索列表中的数据（按预计到港日排序）
        const unmatchedData = (result.data || []).filter((item: LogisticsRecord) => 
          !shippingIdOrder.includes(item.shippingId)
        ).sort((a: LogisticsRecord, b: LogisticsRecord) => {
          const dateA = a.estimatedArrivalDate ? new Date(a.estimatedArrivalDate).getTime() : 0;
          const dateB = b.estimatedArrivalDate ? new Date(b.estimatedArrivalDate).getTime() : 0;
          return dateA - dateB;
        });
        
        sortedData = [...sortedData, ...unmatchedData];
      } else {
        // 如果没有搜索条件，按照预计到港日排序
        sortedData = (result.data || []).sort((a: LogisticsRecord, b: LogisticsRecord) => {
          const dateA = a.estimatedArrivalDate ? new Date(a.estimatedArrivalDate).getTime() : 0;
          const dateB = b.estimatedArrivalDate ? new Date(b.estimatedArrivalDate).getTime() : 0;
          return dateA - dateB;
        });
      }

      setData(sortedData);
      
      // 只在需要时显示消息
      if (showMessage) {
        if (params.shippingIds?.length) {
          message.success(`找到 ${sortedData.length} 条匹配记录，已按输入顺序排列`);
        } else if (params.filters?.status?.length) {
          message.success(`加载了 ${sortedData.length} 条未完成物流记录，按预计到港日升序排列`);
        } else {
          message.success(`加载了 ${sortedData.length} 条物流记录`);
        }
      }
    } catch (error) {
      console.error('获取数据失败:', error);
      message.error(`获取数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // 获取筛选选项
  const fetchFilterOptions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/logistics/filters`);
      const result = await response.json();
        setFilterOptions(result.data || {});
    } catch (error) {
      console.error('获取筛选选项失败:', error);
      }
    };

  // 获取统计数据
  const fetchStatistics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/logistics/statistics`);
      const result = await response.json();
      
      if (result.code === 0) {
        setStatisticsData(result.data);
      } else {
        throw new Error(result.message || '获取统计数据失败');
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
      message.error(`获取统计数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 打开VAT税单上传对话框
  const handleOpenVatUploadModal = (shippingId: string) => {
    setSelectedShippingId(shippingId);
    setVatUploadModalVisible(true);
    setVatUploadStep('select');
    setSelectedVatFile(null);
    setVatExtractedData(null);
    setIsDragOver(false);
    vatForm.resetFields();
  };

  // 解析VAT税单PDF
  const handleParseVatReceipt = async (file: File) => {
    setVatUploadModalLoading(true);
    try {
      const formData = new FormData();
      formData.append('vatReceipt', file);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/logistics/parse-vat-receipt`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: formData
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        setVatExtractedData(result.data);
        // 将解析的数据填入表单
        vatForm.setFieldsValue({
          mrn: result.data.mrn || '',
          taxAmount: result.data.taxAmount || null,
          taxDate: result.data.taxDate ? dayjs(result.data.taxDate) : null
        });
        setVatUploadStep('confirm');
        message.success('PDF解析成功，请确认并编辑信息');
      } else {
        throw new Error(result.message || 'PDF解析失败');
      }
    } catch (error) {
      console.error('VAT税单解析失败:', error);
      message.error(`PDF解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setVatUploadModalLoading(false);
    }
  };

  // 确认并上传VAT税单
  const handleConfirmAndUploadVatReceipt = async () => {
    if (!selectedVatFile) {
      message.error('请选择要上传的文件');
      return;
    }

    // 获取表单数据
    const formData = await vatForm.validateFields();
    
    setVatUploadStep('uploading');
    setVatUploadModalLoading(true);
    
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('vatReceipt', selectedVatFile);
      // 添加解析的数据
      uploadFormData.append('mrn', formData.mrn || '');
      uploadFormData.append('taxAmount', formData.taxAmount?.toString() || '');
      uploadFormData.append('taxDate', formData.taxDate?.format('YYYY-MM-DD') || '');
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/logistics/upload-vat-receipt/${selectedShippingId}`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: uploadFormData
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success('VAT税单上传成功');
        // 更新本地数据
        setData(prevData =>
          prevData.map(item =>
            item.shippingId === selectedShippingId
              ? {
                  ...item,
                  vatReceiptUrl: result.data.url,
                  vatReceiptFileName: result.data.fileName,
                  vatReceiptFileSize: result.data.fileSize,
                  vatReceiptUploadTime: result.data.uploadTime,
                  // 使用表单数据更新相关字段
                  mrn: formData.mrn || result.data.extractedData?.mrn,
                  vatReceiptTaxAmount: formData.taxAmount || result.data.extractedData?.taxAmount,
                  vatReceiptTaxDate: formData.taxDate?.format('YYYY-MM-DD') || result.data.extractedData?.taxDate
                }
              : item
          )
        );
        
        // 刷新统计数据以更新"未上传VAT税单"卡片
        await fetchStatistics();
        
        // 关闭对话框
        setVatUploadModalVisible(false);
        setVatUploadStep('select');
        setSelectedVatFile(null);
        setVatExtractedData(null);
        setSelectedShippingId('');
        vatForm.resetFields();
      } else {
        throw new Error(result.message || 'VAT税单上传失败');
      }
    } catch (error) {
      console.error('VAT税单上传失败:', error);
      message.error(`VAT税单上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setVatUploadStep('confirm');
    } finally {
      setVatUploadModalLoading(false);
    }
  };

  // 取消VAT税单上传
  const handleCancelVatUpload = () => {
    setVatUploadModalVisible(false);
    setVatUploadStep('select');
    setSelectedVatFile(null);
    setVatExtractedData(null);
    setSelectedShippingId('');
    setIsDragOver(false);
    vatForm.resetFields();
  };

  // 导出上季VAT税单
  const handleExportLastQuarterVat = async () => {
    setExportVatLoading(true);
    try {
      // 计算上季度的时间范围
      const now = new Date();
      const currentMonth = now.getMonth() + 1; // 1-12月
      let startDate: string;
      let endDate: string;
      let quarterName: string;

      if (currentMonth >= 4 && currentMonth <= 6) {
        // 4-6月，导出1-3月
        startDate = `${now.getFullYear()}-01-01`;
        endDate = `${now.getFullYear()}-03-31`;
        quarterName = `${now.getFullYear()}年第一季度`;
      } else if (currentMonth >= 7 && currentMonth <= 9) {
        // 7-9月，导出4-6月
        startDate = `${now.getFullYear()}-04-01`;
        endDate = `${now.getFullYear()}-06-30`;
        quarterName = `${now.getFullYear()}年第二季度`;
      } else if (currentMonth >= 10 && currentMonth <= 12) {
        // 10-12月，导出7-9月
        startDate = `${now.getFullYear()}-07-01`;
        endDate = `${now.getFullYear()}-09-30`;
        quarterName = `${now.getFullYear()}年第三季度`;
      } else {
        // 1-3月，导出上一年10-12月
        startDate = `${now.getFullYear() - 1}-10-01`;
        endDate = `${now.getFullYear() - 1}-12-31`;
        quarterName = `${now.getFullYear() - 1}年第四季度`;
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/logistics/export-vat-receipts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          startDate,
          endDate,
          destinationCountry: '英国'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `英国VAT税单_${quarterName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      message.success(`成功导出${quarterName}的英国VAT税单包（包含Excel和PDF文件）`);
    } catch (error) {
      console.error('导出VAT税单失败:', error);
      message.error(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setExportVatLoading(false);
    }
  };

  // 处理拖拽事件
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!vatUploadModalLoading) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (vatUploadModalLoading) return;
    
    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    
    if (pdfFile) {
      setSelectedVatFile(pdfFile);
      handleParseVatReceipt(pdfFile);
    } else {
      message.error('请拖拽PDF文件');
    }
  };

  // 删除VAT税单
  const handleDeleteVatReceipt = async (shippingId: string) => {
    Modal.confirm({
      title: '确认删除VAT税单',
      content: '您确定要删除这个VAT税单吗？此操作不可撤销。',
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        // 添加到删除中状态
        setVatDeletingIds(prev => new Set(prev).add(shippingId));
        
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/api/logistics/delete-vat-receipt/${shippingId}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            }
          });
          
          const result = await response.json();
          
          if (result.code === 0) {
            message.success('VAT税单删除成功');
            // 更新本地数据
            setData(prevData =>
              prevData.map(item =>
                item.shippingId === shippingId
                  ? {
                      ...item,
                      vatReceiptUrl: undefined,
                      vatReceiptObjectName: undefined,
                      vatReceiptFileName: undefined,
                      vatReceiptFileSize: undefined,
                      vatReceiptUploadTime: undefined
                    }
                  : item
              )
            );
            
            // 刷新统计数据以更新"未上传VAT税单"卡片
            await fetchStatistics();
          } else {
            throw new Error(result.message || 'VAT税单删除失败');
          }
        } catch (error) {
          console.error('VAT税单删除失败:', error);
          message.error(`VAT税单删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
          // 从删除中状态移除
          setVatDeletingIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(shippingId);
            return newSet;
          });
        }
      }
    });
  };







  // 点击统计卡片时查询对应数据
  const handleStatisticClick = (type: string) => {
    let params: SearchParams = { filters: {} };
    
    switch (type) {
      case 'yearly':
        // 查询今年发货的记录（发出日期为今年）
        params.filters = { specialQuery: 'yearlyShipments' };
        break;
      case 'transit':
        // 查询在途状态的记录，包含"查验中"
        params.filters = { status: ['在途', '查验中'] };
        break;
      case 'transitPackage':
        // 查询在途状态的记录（显示箱数），包含"查验中"
        params.filters = { status: ['在途', '查验中'] };
        break;
      case 'unpaid':
        // 查询未付款的记录
        params.filters = { paymentStatus: ['未付'] };
        break;
      case 'pendingWarehouse':
        // 查询即将到仓的记录（只统计状态为"在途"的记录）
        params.filters = { specialQuery: 'pendingWarehouse' };
        break;
      case 'unuploadedVatReceipt':
        // 查询目的地为英国且未上传VAT税单的记录
        params.filters = { 
          destinationCountry: ['英国'],
          specialQuery: 'unuploadedVatReceipt'
        };
        break;
      case 'inspecting':
        // 查询查验中状态的记录
        params.filters = { status: ['查验中'] };
        break;
    }
    
    fetchData(params);
  };

  // 单元格编辑保存
  const handleSaveEdit = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/logistics/update`, {
          method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          shippingId: editingKey,
          [editingField]: editingValue
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        message.success('更新成功');
        // 更新本地数据
        setData(prevData =>
          prevData.map(item =>
            item.shippingId === editingKey
              ? { ...item, [editingField]: editingValue }
              : item
          )
        );
        setEditingKey('');
        setEditingField('');
        setEditingValue('');
        // 修改：无论编辑哪个字段都刷新统计卡片
        await fetchStatistics();
      } else {
        throw new Error(result.message || '更新失败');
      }
    } catch (error) {
      console.error('更新失败:', error);
      message.error(`更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 单元格编辑保存（直接传值版本）
  const handleSaveEditWithValue = async (value: any) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/logistics/update`, {
          method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          shippingId: editingKey,
          [editingField]: value
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        message.success('更新成功');
        // 更新本地数据
        setData(prevData =>
          prevData.map(item =>
            item.shippingId === editingKey
              ? { ...item, [editingField]: value }
              : item
          )
        );
        setEditingKey('');
        setEditingField('');
        setEditingValue('');
        
        // 如果更新的是状态字段，自动刷新统计数据
        if (editingField === 'status') {
          await fetchStatistics();
        }
      } else {
        throw new Error(result.message || '更新失败');
      }
    } catch (error) {
      console.error('更新失败:', error);
      message.error(`更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingKey('');
    setEditingField('');
    setEditingValue('');
  };

  // 开始编辑
  const handleStartEdit = (shippingId: string, field: string, value: any) => {
    setEditingKey(shippingId);
    setEditingField(field);
    setEditingValue(value);
  };

  // 解析批量更新文本
  const parseBatchUpdateText = (text: string): BatchUpdateData[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const result: BatchUpdateData[] = [];
    let currentShippingId = '';
    let currentUpdates: { [key: string]: any } = {};

    for (const line of lines) {
      // 去除零宽度字符和其他不可见字符
      const cleanLine = line.replace(/[\u200B-\u200F\uFEFF]/g, '').trim();
      
      // 支持中文冒号和英文冒号
      if (cleanLine.includes('：') || cleanLine.includes(':')) {
        // 优先使用中文冒号分割，如果没有则使用英文冒号
        const separator = cleanLine.includes('：') ? '：' : ':';
        const parts = cleanLine.split(separator);
        
        if (parts.length < 2) continue;
        
        // 清理 key 和 value 的空格和特殊字符
        const key = parts[0].trim().replace(/[\u200B-\u200F\uFEFF]/g, '');
        const value = parts.slice(1).join(separator).trim(); // 处理值中包含冒号的情况
        
        if (key === 'Shipping ID') {
          // 如果遇到新的Shipping ID，先保存之前的数据
          if (currentShippingId && Object.keys(currentUpdates).length > 0) {
            result.push({
              shippingId: currentShippingId,
              updates: { ...currentUpdates }
            });
          }
          currentShippingId = value;
          currentUpdates = {};
        } else {
          // 映射字段名
          const fieldMap: { [key: string]: string } = {
            '渠道': 'channel',
            '物流节点': 'logisticsNode',
            '物流商': 'logisticsProvider',
            '状态': 'status',
            '目的国': 'destinationCountry',
            '目的仓库': 'destinationWarehouse',
            '单价': 'price',
            '计费重量': 'billingWeight',
            '箱数': 'packageCount',
            '产品数': 'productCount',
            '跟踪号': 'trackingNumber',
            '转单号': 'trackingNumber',
            '件数': 'packageCount',
            '发出日期': 'departureDate',
            '开航日': 'sailingDate',
            '预计到港日': 'estimatedArrivalDate',
            '预计到仓日': 'estimatedWarehouseDate',
            'MRN': 'mrn',
            '关税': 'customsDuty',
            '税金状态': 'taxPaymentStatus',
            '报税状态': 'taxDeclarationStatus',
            '尺寸': 'dimensions',
            '付款状态': 'paymentStatus'
          };
          
          console.log('解析字段:', key, '-> 映射到:', fieldMap[key], '值:', value);
          
          const fieldName = fieldMap[key];
          if (fieldName) {
            // 对日期字段进行格式化处理
            if (['departureDate', 'sailingDate', 'estimatedArrivalDate', 'estimatedWarehouseDate'].includes(fieldName)) {
              // 将 2025/5/25 格式转换为 2025-05-25 格式
              const formattedDate = value.replace(/\//g, '-');
              const dateParts = formattedDate.split('-');
              if (dateParts.length === 3) {
                const year = dateParts[0];
                const month = dateParts[1].padStart(2, '0');
                const day = dateParts[2].padStart(2, '0');
                currentUpdates[fieldName] = `${year}-${month}-${day}`;
              } else {
                currentUpdates[fieldName] = value;
              }
            } else {
              currentUpdates[fieldName] = value;
            }
          } else {
            console.warn('未找到字段映射:', key);
          }
        }
      }
    }

    // 保存最后一个Shipping ID的数据
    if (currentShippingId && Object.keys(currentUpdates).length > 0) {
      result.push({
        shippingId: currentShippingId,
        updates: { ...currentUpdates }
      });
    }

    console.log('解析结果:', result);
    return result;
  };

  // 处理批量更新确认
  const handleBatchUpdateConfirm = async () => {
    try {
      setBatchLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/logistics/batch-update`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ updates: parsedBatchData }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
      const result = await response.json();
      
      if (result.code === 0) {
        message.success(`成功更新 ${parsedBatchData.length} 条记录`);
        setBatchUpdateModalVisible(false);
        setBatchUpdateText('');
        setParsedBatchData([]);
        // 刷新数据，强制使用当前搜索参数
        if (currentSearchParams) {
          fetchData(currentSearchParams);
        } else {
          refetchData();
        }
        // 自动刷新统计数据
        await fetchStatistics();
        } else {
        throw new Error(result.message || '批量更新失败');
      }
    } catch (error) {
      console.error('批量更新失败:', error);
      message.error(`批量更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setBatchLoading(false);
    }
  };

  // 批量修改状态
  const handleBatchStatusUpdate = async (newStatus: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要修改的记录');
      return;
    }

    setBatchLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/logistics/batch-update-status`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          shippingIds: selectedRowKeys,
          status: newStatus
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
        
      if (result.code === 0) {
        message.success(`成功将 ${selectedRowKeys.length} 条记录的状态修改为"${newStatus}"`);
        setSelectedRowKeys([]);
        setBatchStatusValue(undefined);
        // 刷新数据，强制使用当前搜索参数
        if (currentSearchParams) {
          fetchData(currentSearchParams);
        } else {
          refetchData();
        }
        // 自动刷新统计数据
        await fetchStatistics();
        } else {
        throw new Error(result.message || '批量更新失败');
        }
    } catch (error) {
      console.error('批量更新失败:', error);
      message.error(`批量更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setBatchLoading(false);
    }
    };

  // 处理批量状态选择
  const handleBatchStatusChange = (value: string) => {
    setBatchStatusValue(value);
    handleBatchStatusUpdate(value);
  };

  // 批量修改付款状态
  const handleBatchPaymentStatusUpdate = async (newStatus: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要修改的记录');
      return;
    }

    setBatchLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/logistics/batch-update-payment-status`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          shippingIds: selectedRowKeys,
          paymentStatus: newStatus
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
        
      if (result.code === 0) {
        message.success(`成功将 ${selectedRowKeys.length} 条记录的付款状态修改为"${newStatus}"`);
        setSelectedRowKeys([]);
        setBatchPaymentStatusValue(undefined);
        // 刷新数据，强制使用当前搜索参数
        if (currentSearchParams) {
          fetchData(currentSearchParams);
        } else {
          refetchData();
        }
        } else {
        throw new Error(result.message || '批量更新失败');
        }
    } catch (error) {
      console.error('批量更新付款状态失败:', error);
      message.error(`批量更新付款状态失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setBatchLoading(false);
    }
  };

  // 处理批量付款状态选择
  const handleBatchPaymentStatusChange = (value: string) => {
    setBatchPaymentStatusValue(value);
    handleBatchPaymentStatusUpdate(value);
  };

  // 批量修改税金状态
  const handleBatchTaxStatusUpdate = async (newStatus: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要修改的记录');
      return;
    }

    setBatchLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/logistics/batch-update-tax-status`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          shippingIds: selectedRowKeys,
          taxPaymentStatus: newStatus
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
        
      if (result.code === 0) {
        message.success(`成功将 ${selectedRowKeys.length} 条记录的税金状态修改为"${newStatus}"`);
        setSelectedRowKeys([]);
        setBatchTaxStatusValue(undefined);
        // 刷新数据，强制使用当前搜索参数
        if (currentSearchParams) {
          fetchData(currentSearchParams);
        } else {
          refetchData();
        }
        } else {
        throw new Error(result.message || '批量更新失败');
        }
    } catch (error) {
      console.error('批量更新税金状态失败:', error);
      message.error(`批量更新税金状态失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setBatchLoading(false);
    }
  };

  // 处理批量税金状态选择
  const handleBatchTaxStatusChange = (value: string) => {
    setBatchTaxStatusValue(value);
    handleBatchTaxStatusUpdate(value);
  };

  // 批量删除处理
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的记录');
      return;
    }

    try {
      const modalResult = Modal.confirm({
        title: '确认批量删除',
        content: (
          <div>
            <p>您确定要删除选中的 <strong>{selectedRowKeys.length}</strong> 条物流记录吗？</p>
            <p style={{ color: '#ff4d4f', fontSize: '12px' }}>
              <strong>警告：</strong>此操作不可撤销，删除后数据将无法恢复！
            </p>
            <p style={{ color: '#1890ff', fontSize: '11px' }}>
              选中的记录ID: {selectedRowKeys.join(', ')}
            </p>
          </div>
        ),
        okText: '确认删除',
        cancelText: '取消',
        okType: 'danger',
        width: 500,
        zIndex: 9999,
        mask: true,
        maskClosable: false,
        onOk: async () => {
          setBatchLoading(true);
          try {
            const requestPayload = {
              shippingIds: selectedRowKeys
            };
            
            const token = localStorage.getItem('token');
            if (!token) {
              throw new Error('未找到认证token，请重新登录');
            }
            
            const response = await fetch(`${API_BASE_URL}/api/logistics/batch-delete`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(requestPayload),
            });

            const responseText = await response.text();
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}\n响应内容: ${responseText}`);
            }
            
            const result = JSON.parse(responseText);
            
            if (result.code === 0) {
              const deletedCount = result.data?.deletedCount || selectedRowKeys.length;
              message.success(`🎉 成功删除 ${deletedCount} 条记录`);
              
              // 清空选择状态
              setSelectedRowKeys([]);
              setBatchStatusValue(undefined);
              setBatchPaymentStatusValue(undefined);
              setBatchTaxStatusValue(undefined);
              
              // 刷新数据和统计数据
              setTimeout(async () => {
                refetchData();
                await fetchStatistics();
              }, 300);
            } else {
              const errorMsg = result.message || `删除失败 (HTTP ${response.status})`;
              message.error(`删除失败: ${errorMsg}`);
            }
          } catch (error) {
            message.error(`网络错误: ${error instanceof Error ? error.message : '未知错误'}`);
          } finally {
            setBatchLoading(false);
          }
        }
      });
      
      // 检查Modal是否正常创建，如果没有则使用备用方案
      setTimeout(() => {
        const newModals = document.querySelectorAll('.ant-modal-root, .ant-modal-wrap, .ant-modal');
        const newMasks = document.querySelectorAll('.ant-modal-mask');
        
        if (newModals.length === 0 && newMasks.length === 0) {
          // Modal创建失败，使用自定义确认对话框
          const customConfirm = createCustomConfirmDialog();
          customConfirm.show({
            title: '确认批量删除',
            content: `您确定要删除选中的 ${selectedRowKeys.length} 条物流记录吗？\n\n警告：此操作不可撤销！\n\n选中的记录ID: ${selectedRowKeys.join(', ')}`,
            onConfirm: async () => {
              setBatchLoading(true);
              try {
                const requestPayload = {
                  shippingIds: selectedRowKeys
                };
                
                const token = localStorage.getItem('token');
                if (!token) {
                  throw new Error('未找到认证token，请重新登录');
                }
                
                const response = await fetch(`${API_BASE_URL}/api/logistics/batch-delete`, {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify(requestPayload),
                });

                const responseText = await response.text();
                
                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}\n响应内容: ${responseText}`);
                }
                
                const result = JSON.parse(responseText);
                
                if (result.code === 0) {
                  const deletedCount = result.data?.deletedCount || selectedRowKeys.length;
                  message.success(`🎉 成功删除 ${deletedCount} 条记录`);
                  
                  // 清空选择状态
                  setSelectedRowKeys([]);
                  setBatchStatusValue(undefined);
                  setBatchPaymentStatusValue(undefined);
                  setBatchTaxStatusValue(undefined);
                  
                  // 刷新数据和统计数据
                  setTimeout(async () => {
                    refetchData();
                    await fetchStatistics();
                  }, 300);
                } else {
                  message.error(`删除失败: ${result.message}`);
                }
              } catch (error) {
                message.error(`网络错误: ${error instanceof Error ? error.message : '未知错误'}`);
              } finally {
                setBatchLoading(false);
              }
            }
          });
        }
      }, 500);
      
    } catch (modalError) {
      // Modal.confirm调用失败，回退到原生确认对话框
      const confirmed = window.confirm(`您确定要删除选中的 ${selectedRowKeys.length} 条物流记录吗？\n\n选中的记录ID: ${selectedRowKeys.join(', ')}\n\n警告：此操作不可撤销！`);
      
      if (confirmed) {
        (async () => {
          setBatchLoading(true);
          try {
            const requestPayload = {
              shippingIds: selectedRowKeys
            };
            
            const token = localStorage.getItem('token');
            if (!token) {
              throw new Error('未找到认证token，请重新登录');
            }
            
            const response = await fetch(`${API_BASE_URL}/api/logistics/batch-delete`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(requestPayload),
            });

            const responseText = await response.text();
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}\n响应内容: ${responseText}`);
            }
            
            const result = JSON.parse(responseText);
            
            if (result.code === 0) {
              const deletedCount = result.data?.deletedCount || selectedRowKeys.length;
              message.success(`🎉 成功删除 ${deletedCount} 条记录`);
              
              setSelectedRowKeys([]);
              setBatchStatusValue(undefined);
              setBatchPaymentStatusValue(undefined);
              setBatchTaxStatusValue(undefined);
              
              setTimeout(async () => {
                refetchData();
                await fetchStatistics();
              }, 300);
            } else {
              message.error(`删除失败: ${result.message}`);
            }
          } catch (error) {
            message.error(`网络错误: ${error instanceof Error ? error.message : '未知错误'}`);
          } finally {
            setBatchLoading(false);
          }
        })();
      }
    }
  };

  // 创建自定义确认对话框（备用方案）
  const createCustomConfirmDialog = () => {
    return {
      show: (options: { title: string; content: string; onConfirm: () => void }) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 10000;
          display: flex;
          justify-content: center;
          align-items: center;
        `;
        
        const modal = document.createElement('div');
        modal.style.cssText = `
          background: white;
          padding: 24px;
          border-radius: 8px;
          min-width: 400px;
          max-width: 600px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        
        modal.innerHTML = `
          <div style="margin-bottom: 16px; font-size: 16px; font-weight: 500;">
            ${options.title}
          </div>
          <div style="margin-bottom: 24px; color: #666; white-space: pre-line;">
            ${options.content}
          </div>
          <div style="text-align: right;">
            <button id="customCancel" style="margin-right: 8px; padding: 6px 15px; border: 1px solid #d9d9d9; background: white; border-radius: 4px; cursor: pointer;">
              取消
            </button>
            <button id="customOk" style="padding: 6px 15px; border: none; background: #ff4d4f; color: white; border-radius: 4px; cursor: pointer;">
              确认删除
            </button>
          </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        const cleanup = () => document.body.removeChild(overlay);
        
        modal.querySelector('#customOk')!.addEventListener('click', () => {
          cleanup();
          options.onConfirm();
        });
        
        modal.querySelector('#customCancel')!.addEventListener('click', cleanup);
        
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) cleanup();
        });
      }
    };
  };

  // 重新获取数据（使用当前搜索参数）
  const refetchData = () => {
    if (currentSearchParams) {
      fetchData(currentSearchParams, false); // 不显示加载消息，避免覆盖操作成功消息
    } else {
      // 如果没有保存的搜索参数，使用默认参数
      fetchData({ filters: { status: ['在途', '入库中', '查验中'] } }, false);
    }
  };

  // 取消选择
  const handleCancelSelection = () => {
    setSelectedRowKeys([]);
    setBatchStatusValue(undefined);
    setBatchPaymentStatusValue(undefined);
    setBatchTaxStatusValue(undefined);
  };

  // 组件初始化
  useEffect(() => {
    fetchFilterOptions();
    fetchStatistics();
    // 默认加载状态不为"完成"的物流记录，按预计到港日排序，包含"查验中"状态
    fetchData({ filters: { status: ['在途', '入库中', '查验中'] } });
  }, []);

  // 搜索处理
  const handleSearch = () => {
    const shippingIds = searchInput
      .split('\n')
      .map(id => id.trim())
      .filter(Boolean);
    
    // 去除重复项
    const uniqueShippingIds = Array.from(new Set(shippingIds));
    
    // 如果去重后数量有变化，提示用户
    if (shippingIds.length !== uniqueShippingIds.length) {
      message.info(`已去除 ${shippingIds.length - uniqueShippingIds.length} 个重复的Shipping ID`);
    }

    const params: SearchParams = { filters };
    if (uniqueShippingIds.length > 0) {
      params.shippingIds = uniqueShippingIds;
    }

    fetchData(params);
  };

  // 重置搜索
  const handleReset = () => {
    setSearchInput('');
    setFilters({});
    setSelectedRowKeys([]);
    setBatchStatusValue(undefined);
    fetchData({ filters: { status: ['在途', '入库中', '查验中'] } });
  };

  // 查询所有数据
  const handleSearchAll = () => {
    setFilters({});
    setSelectedRowKeys([]);
    setBatchStatusValue(undefined);
    fetchData({ filters: {} });
  };

  // 当前显示数据的统计
  const currentDataStats = useMemo(() => {
    const totalPackages = data.reduce((sum, item) => sum + (item.packageCount || 0), 0);
    const totalProducts = data.reduce((sum, item) => sum + (item.productCount || 0), 0);
    const totalFee = data.reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const weight = Number(item.billingWeight) || 0;
      return sum + (price * weight);
    }, 0);

    return { totalPackages, totalProducts, totalFee };
  }, [data]);

  // 状态标签渲染
  const renderStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
      '在途': { color: 'processing', icon: <TruckOutlined /> },
      '查验中': { color: 'orange', icon: <SearchOutlined /> },
      '完成': { color: 'success', icon: <BoxPlotOutlined /> },
      '入库中': { color: 'warning', icon: <ClockCircleOutlined /> },
    };

    const config = statusConfig[status] || { color: 'default', icon: null };
    return (
      <Tag color={config.color} icon={config.icon}>
        {status}
      </Tag>
    );
  };

  // 付款状态标签渲染
  const renderPaymentTag = (status: string) => {
    return (
      <Tag color={status === '已付' ? 'success' : 'error'}>
        {status}
      </Tag>
    );
  };

  // 日期格式化
  const formatDate = (dateString: string, showYear: boolean = false) => {
    if (!dateString) return '-';
    return showYear ? dayjs(dateString).format('YYYY-MM-DD') : dayjs(dateString).format('MM-DD');
  };

  // VAT税单日期格式化 - 始终显示年月日格式
  const formatVatDate = (dateString: string) => {
    if (!dateString) return '-';
    return dayjs(dateString).format('YYYY-MM-DD');
  };

  // 可编辑单元格渲染
  const renderEditableCell = (text: any, record: LogisticsRecord, field: string) => {
    const isEditing = editingKey === record.shippingId && editingField === field;
    
    // 根据字段类型确定对齐方式
    const getAlignment = (field: string) => {
      if (['packageCount', 'productCount', 'price', 'billingWeight'].includes(field)) {
        return 'right';
      } else if (field === 'logisticsNode') {
        return 'left';
      } else {
        return 'center';
      }
    };

    // 判断是否为日期字段
    const isDateField = (field: string) => {
      return ['departureDate', 'sailingDate', 'estimatedArrivalDate', 'estimatedWarehouseDate'].includes(field);
    };

    const alignment = getAlignment(field);
    
    if (isEditing) {
      return (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 4,
          justifyContent: alignment === 'right' ? 'flex-end' : alignment === 'left' ? 'flex-start' : 'center'
        }}>
          {isDateField(field) ? (
            <DatePicker
              value={editingValue ? dayjs(editingValue) : null}
              onChange={(date) => setEditingValue(date ? date.format('YYYY-MM-DD') : null)}
              size="small"
              format="YYYY-MM-DD"
            />
          ) : typeof text === 'number' ? (
            <InputNumber
              value={editingValue}
              onChange={(value) => setEditingValue(value)}
              size="small"
              style={{ width: 80 }}
              onPressEnter={handleSaveEdit}
            />
          ) : (
            <Input
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              size="small"
              style={{ width: field === 'logisticsNode' ? 160 : 120 }}
              onPressEnter={handleSaveEdit}
            />
          )}
          <Button
            type="text"
            size="small"
            icon={<SaveOutlined />}
            onClick={handleSaveEdit}
          />
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={handleCancelEdit}
          />
        </div>
      );
    }

    return (
      <div
        onDoubleClick={() => handleStartEdit(record.shippingId, field, text)}
        style={{ 
          cursor: 'pointer', 
          minHeight: 22,
          textAlign: alignment
        }}
        title="双击编辑"
      >
        {text || '-'}
      </div>
    );
  };

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record: LogisticsRecord) => ({
      disabled: false,
      name: record.shippingId,
    }),
  };

  // 表格列配置
  const columns: ColumnsType<LogisticsRecord> = [
    {
      title: 'Shipping ID',
      dataIndex: 'shippingId',
      key: 'shippingId',
      fixed: 'left',
      width: 140,
      align: 'center',
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: '物流商',
      dataIndex: 'logisticsProvider',
      key: 'logisticsProvider',
      width: 100,
      align: 'center',
      render: (text, record) => renderEditableCell(text, record, 'logisticsProvider'),
      filters: filterOptions.logisticsProvider?.map(item => ({ text: item, value: item })),
      filteredValue: filters.logisticsProvider || null,
      filterMode: 'tree',
      filterSearch: true,
    },
    {
      title: '渠道',
      dataIndex: 'channel',
      key: 'channel',
      width: 120,
      align: 'center',
      render: (text, record) => renderEditableCell(text, record, 'channel'),
      filters: filterOptions.channel?.map(item => ({ text: item, value: item })),
      filteredValue: filters.channel || null,
      filterMode: 'tree',
      filterSearch: true,
    },
    {
      title: '跟踪号',
      dataIndex: 'trackingNumber',
      key: 'trackingNumber',
      width: 120,
      align: 'center',
      render: (text, record) => {
        const isEditing = editingKey === record.shippingId && editingField === 'trackingNumber';
        if (isEditing) {
          return renderEditableCell(text, record, 'trackingNumber');
        }
        return text ? (
          <div
            onClick={() => window.open(`https://t.17track.net/zh-cn#nums=${text}`, '_blank')}
            onDoubleClick={() => handleStartEdit(record.shippingId, 'trackingNumber', text)}
            style={{ 
              cursor: 'pointer', 
              textAlign: 'center',
              color: '#1890ff',
              textDecoration: 'underline'
            }}
            title="单击查看物流，双击编辑"
          >
            {text}
          </div>
        ) : (
          <div
            onDoubleClick={() => handleStartEdit(record.shippingId, 'trackingNumber', text)}
            style={{ cursor: 'pointer', textAlign: 'center' }}
            title="双击编辑"
          >
            -
          </div>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (status, record) => {
        const isEditing = editingKey === record.shippingId && editingField === 'status';
        if (isEditing) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
              <Select
                value={editingValue}
                onChange={(value) => setEditingValue(value)}
                size="small"
                style={{ width: 100 }}
                onSelect={handleSaveEdit}
              >
                <Option value="在途">在途</Option>
                <Option value="查验中">查验中</Option>
                <Option value="入库中">入库中</Option>
                <Option value="完成">完成</Option>
              </Select>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleCancelEdit}
              />
            </div>
          );
        }
        return (
          <div
            onDoubleClick={() => handleStartEdit(record.shippingId, 'status', status)}
            style={{ cursor: 'pointer', textAlign: 'center' }}
            title="双击编辑"
          >
            {renderStatusTag(status)}
          </div>
        );
      },
      filters: filterOptions.status?.map(item => ({ text: item, value: item })),
      filteredValue: filters.status || null,
      filterMode: 'tree',
    },
    {
      title: '箱数',
      dataIndex: 'packageCount',
      key: 'packageCount',
      width: 80,
      align: 'right',
      sorter: (a: LogisticsRecord, b: LogisticsRecord) => (Number(a.packageCount) || 0) - (Number(b.packageCount) || 0),
      render: (text, record) => renderEditableCell(text, record, 'packageCount'),
    },
    {
      title: '产品数',
      dataIndex: 'productCount',
      key: 'productCount',
      width: 80,
      align: 'right',
      sorter: (a: LogisticsRecord, b: LogisticsRecord) => (Number(a.productCount) || 0) - (Number(b.productCount) || 0),
      render: (text, record) => renderEditableCell(text, record, 'productCount'),
    },
    {
      title: '发出日期',
      dataIndex: 'departureDate',
      key: 'departureDate',
      width: 80,
      sorter: (a: LogisticsRecord, b: LogisticsRecord) => {
        const dateA = a.departureDate ? new Date(a.departureDate).getTime() : 0;
        const dateB = b.departureDate ? new Date(b.departureDate).getTime() : 0;
        return dateA - dateB;
      },
      render: (date, record) => {
        const isEditing = editingKey === record.shippingId && editingField === 'departureDate';
        if (isEditing) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
              <DatePicker
                value={editingValue ? dayjs(editingValue) : null}
                onChange={(date) => setEditingValue(date ? date.format('YYYY-MM-DD') : null)}
                size="small"
                format="YYYY-MM-DD"
              />
              <Button
                type="text"
                size="small"
                icon={<SaveOutlined />}
                onClick={handleSaveEdit}
              />
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleCancelEdit}
              />
            </div>
          );
        }
        return (
          <div
            onDoubleClick={() => handleStartEdit(record.shippingId, 'departureDate', date)}
            style={{ cursor: 'pointer', textAlign: 'center' }}
            title="双击编辑"
          >
            {formatDate(date, true)}
          </div>
        );
      },
      align: 'center',
    },
    {
      title: '开航日',
      dataIndex: 'sailingDate',
      key: 'sailingDate',
      width: 80,
      sorter: (a: LogisticsRecord, b: LogisticsRecord) => {
        const dateA = a.sailingDate ? new Date(a.sailingDate).getTime() : 0;
        const dateB = b.sailingDate ? new Date(b.sailingDate).getTime() : 0;
        return dateA - dateB;
      },
      render: (date, record) => {
        const isEditing = editingKey === record.shippingId && editingField === 'sailingDate';
        if (isEditing) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
              <DatePicker
                value={editingValue ? dayjs(editingValue) : null}
                onChange={(date) => setEditingValue(date ? date.format('YYYY-MM-DD') : null)}
                size="small"
                format="YYYY-MM-DD"
              />
              <Button
                type="text"
                size="small"
                icon={<SaveOutlined />}
                onClick={handleSaveEdit}
              />
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleCancelEdit}
              />
            </div>
          );
        }
        return (
          <div
            onDoubleClick={() => handleStartEdit(record.shippingId, 'sailingDate', date)}
            style={{ cursor: 'pointer', textAlign: 'center' }}
            title="双击编辑"
          >
            {formatDate(date)}
          </div>
        );
      },
      align: 'center',
    },
    {
      title: '预计到港日',
      dataIndex: 'estimatedArrivalDate',
      key: 'estimatedArrivalDate',
      width: 80,
      sorter: (a: LogisticsRecord, b: LogisticsRecord) => {
        const dateA = a.estimatedArrivalDate ? new Date(a.estimatedArrivalDate).getTime() : 0;
        const dateB = b.estimatedArrivalDate ? new Date(b.estimatedArrivalDate).getTime() : 0;
        return dateA - dateB;
      },
      render: (date, record) => {
        const isEditing = editingKey === record.shippingId && editingField === 'estimatedArrivalDate';
        if (isEditing) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
              <DatePicker
                value={editingValue ? dayjs(editingValue) : null}
                onChange={(date) => setEditingValue(date ? date.format('YYYY-MM-DD') : null)}
                size="small"
                format="YYYY-MM-DD"
              />
              <Button
                type="text"
                size="small"
                icon={<SaveOutlined />}
                onClick={handleSaveEdit}
              />
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleCancelEdit}
              />
            </div>
          );
        }
        return (
          <div
            onDoubleClick={() => handleStartEdit(record.shippingId, 'estimatedArrivalDate', date)}
            style={{ cursor: 'pointer', textAlign: 'center' }}
            title="双击编辑"
          >
            {formatDate(date)}
          </div>
        );
      },
      align: 'center',
    },
    {
      title: '预计到仓日',
      dataIndex: 'estimatedWarehouseDate',
      key: 'estimatedWarehouseDate',
      width: 80,
      sorter: (a: LogisticsRecord, b: LogisticsRecord) => {
        const dateA = a.estimatedWarehouseDate ? new Date(a.estimatedWarehouseDate).getTime() : 0;
        const dateB = b.estimatedWarehouseDate ? new Date(b.estimatedWarehouseDate).getTime() : 0;
        return dateA - dateB;
      },
      render: (date, record) => {
        const isEditing = editingKey === record.shippingId && editingField === 'estimatedWarehouseDate';
        if (isEditing) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
              <DatePicker
                value={editingValue ? dayjs(editingValue) : null}
                onChange={(date) => setEditingValue(date ? date.format('YYYY-MM-DD') : null)}
                size="small"
                format="YYYY-MM-DD"
              />
              <Button
                type="text"
                size="small"
                icon={<SaveOutlined />}
                onClick={handleSaveEdit}
              />
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleCancelEdit}
              />
            </div>
          );
        }
        return (
          <div
            onDoubleClick={() => handleStartEdit(record.shippingId, 'estimatedWarehouseDate', date)}
            style={{ cursor: 'pointer', textAlign: 'center' }}
            title="双击编辑"
          >
            {formatDate(date)}
          </div>
        );
      },
      align: 'center',
    },
    {
      title: '目的国',
      dataIndex: 'destinationCountry',
      key: 'destinationCountry',
      width: 80,
      align: 'center',
      render: (text, record) => renderEditableCell(text, record, 'destinationCountry'),
      filters: filterOptions.destinationCountry?.map(item => ({ text: item, value: item })),
      filteredValue: filters.destinationCountry || null,
      filterMode: 'tree',
      filterSearch: true,
    },
    {
      title: '目的仓库',
      dataIndex: 'destinationWarehouse',
      key: 'destinationWarehouse',
      width: 100,
      align: 'center',
      render: (text, record) => renderEditableCell(text, record, 'destinationWarehouse'),
    },
    {
      title: '单价',
      dataIndex: 'price',
      key: 'price',
      width: 80,
      sorter: (a: LogisticsRecord, b: LogisticsRecord) => (Number(a.price) || 0) - (Number(b.price) || 0),
      render: (price, record) => {
        const isEditing = editingKey === record.shippingId && editingField === 'price';
        if (isEditing) {
          return renderEditableCell(price, record, 'price');
        }
        return (
          <div
            onDoubleClick={() => handleStartEdit(record.shippingId, 'price', price)}
            style={{ cursor: 'pointer', textAlign: 'right' }}
            title="双击编辑"
          >
            {price ? `¥${Number(price).toFixed(2)}` : '-'}
          </div>
        );
      },
      align: 'right',
    },
    {
      title: '计费重量',
      dataIndex: 'billingWeight',
      key: 'billingWeight',
      width: 90,
      sorter: (a: LogisticsRecord, b: LogisticsRecord) => (Number(a.billingWeight) || 0) - (Number(b.billingWeight) || 0),
      render: (weight, record) => {
        const isEditing = editingKey === record.shippingId && editingField === 'billingWeight';
        if (isEditing) {
          return renderEditableCell(weight, record, 'billingWeight');
        }
        return (
          <div
            onDoubleClick={() => handleStartEdit(record.shippingId, 'billingWeight', weight)}
            style={{ cursor: 'pointer', textAlign: 'right' }}
            title="双击编辑"
          >
            {weight ? `${Number(weight).toFixed(1)}kg` : '-'}
          </div>
        );
      },
      align: 'right',
    },
    {
      title: '平均计费箱重',
      key: 'avgBoxWeight',
      width: 110,
      sorter: (a: LogisticsRecord, b: LogisticsRecord) => {
        const avgA = (Number(a.packageCount) || 0) > 0 ? (Number(a.billingWeight) || 0) / (Number(a.packageCount) || 0) : 0;
        const avgB = (Number(b.packageCount) || 0) > 0 ? (Number(b.billingWeight) || 0) / (Number(b.packageCount) || 0) : 0;
        return avgA - avgB;
      },
      render: (_, record) => {
        const weight = Number(record.billingWeight) || 0;
        const boxes = Number(record.packageCount) || 0;
        const avgWeight = boxes > 0 ? weight / boxes : 0;
        return avgWeight > 0 ? `${avgWeight.toFixed(1)}kg/箱` : '-';
      },
      align: 'right',
    },
    {
      title: '运费',
      key: 'totalFee',
      width: 90,
      sorter: (a: LogisticsRecord, b: LogisticsRecord) => {
        const feeA = (Number(a.price) || 0) * (Number(a.billingWeight) || 0);
        const feeB = (Number(b.price) || 0) * (Number(b.billingWeight) || 0);
        return feeA - feeB;
      },
      render: (_, record) => {
        const price = Number(record.price) || 0;
        const weight = Number(record.billingWeight) || 0;
        const totalFee = price * weight;
        return totalFee > 0 ? `¥${totalFee.toFixed(2)}` : '-';
      },
      align: 'right',
    },
    {
      title: '付款状态',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      width: 90,
      align: 'center',
      render: (status, record) => {
        const isEditing = editingKey === record.shippingId && editingField === 'paymentStatus';
        if (isEditing) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
              <Select
                value={editingValue}
                onChange={async (value) => {
                  setEditingValue(value);
                  await handleSaveEditWithValue(value);
                }}
                size="small"
                style={{ width: 80 }}
              >
                <Option value="已付">已付</Option>
                <Option value="未付">未付</Option>
              </Select>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleCancelEdit}
              />
            </div>
          );
        }
        return (
          <div
            onDoubleClick={() => handleStartEdit(record.shippingId, 'paymentStatus', status)}
            style={{ cursor: 'pointer', textAlign: 'center' }}
            title="双击编辑"
          >
            {renderPaymentTag(status)}
          </div>
        );
      },
      filters: filterOptions.paymentStatus?.map(item => ({ text: item, value: item })),
      filteredValue: filters.paymentStatus || null,
      filterMode: 'tree',
    },
    {
      title: '税金状态',
      dataIndex: 'taxPaymentStatus',
      key: 'taxPaymentStatus',
      width: 90,
      align: 'center',
      render: (status, record) => {
        const isEditing = editingKey === record.shippingId && editingField === 'taxPaymentStatus';
        if (isEditing) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
              <Select
                value={editingValue}
                onChange={async (value) => {
                  setEditingValue(value);
                  await handleSaveEditWithValue(value);
                }}
                size="small"
                style={{ width: 80 }}
              >
                <Option value="已付">已付</Option>
                <Option value="未付">未付</Option>
              </Select>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleCancelEdit}
              />
            </div>
          );
        }
        return (
          <div
            onDoubleClick={() => handleStartEdit(record.shippingId, 'taxPaymentStatus', status)}
            style={{ cursor: 'pointer', textAlign: 'center' }}
            title="双击编辑"
          >
            {renderPaymentTag(status)}
          </div>
        );
      },
      filters: filterOptions.taxPaymentStatus?.map(item => ({ text: item, value: item })),
      filteredValue: filters.taxPaymentStatus || null,
      filterMode: 'tree',
    },
    {
      title: 'VAT税单',
      key: 'vatReceipt',
      width: 200,
      align: 'center',
      render: (_, record) => {
        // 只有目的地为英国的记录才显示VAT税单操作
        if (record.destinationCountry !== '英国') {
          return <span style={{ color: '#d9d9d9' }}>-</span>;
        }

        const isUploading = vatUploadingIds.has(record.shippingId);
        const isDeleting = vatDeletingIds.has(record.shippingId);
        
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {record.vatReceiptUrl ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                  <Button
                    type="link"
                    size="small"
                    onClick={async () => {
                      try {
                        // 添加加载状态
                        message.loading('正在获取VAT税单文件...', 0);
                        
                        const token = localStorage.getItem('token');
                        const fileUrl = `${API_BASE_URL}/api/logistics/vat-receipt/${record.shippingId}/file`;
                        
                        console.log('正在获取VAT税单文件:', fileUrl);
                        console.log('认证Token:', token ? '已提供' : '未提供');
                        
                        const response = await fetch(fileUrl, {
                          headers: {
                            ...(token ? { Authorization: `Bearer ${token}` } : {})
                          }
                        });
                        
                        console.log('响应状态:', response.status);
                        console.log('响应头:', Object.fromEntries(response.headers.entries()));
                        
                        if (!response.ok) {
                          const errorText = await response.text();
                          console.error('服务器响应错误:', response.status, errorText);
                          throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
                        }
                        
                        // 检查响应类型
                        const contentType = response.headers.get('content-type');
                        console.log('响应内容类型:', contentType);
                        
                        if (!contentType || !contentType.includes('application/pdf')) {
                          console.warn('响应内容类型不是PDF:', contentType);
                        }
                        
                        const blob = await response.blob();
                        console.log('获取到文件大小:', blob.size, '字节');
                        
                        if (blob.size === 0) {
                          throw new Error('获取到的文件为空');
                        }
                        
                        const url = window.URL.createObjectURL(blob);
                        console.log('创建的文件URL:', url);
                        
                        // 关闭加载消息
                        message.destroy();
                        message.success('VAT税单文件获取成功');
                        
                        // 在新窗口打开文件
                        const newWindow = window.open(url, '_blank');
                        
                        // 如果新窗口被阻止，提供下载链接
                        if (!newWindow) {
                          message.warning('弹窗被阻止，请允许弹窗后重试');
                          // 创建下载链接
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = record.vatReceiptFileName || 'VAT税单.pdf';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }
                        
                        // 清理URL对象
                        setTimeout(() => {
                          window.URL.revokeObjectURL(url);
                        }, 60000); // 1分钟后清理
                        
                      } catch (error) {
                        console.error('获取VAT税单文件失败:', error);
                        message.destroy(); // 关闭加载消息
                        
                        // 提供更详细的错误信息
                        let errorMessage = '获取VAT税单文件失败';
                        if (error instanceof Error) {
                          if (error.message.includes('HTTP 401')) {
                            errorMessage = '认证失败，请重新登录';
                          } else if (error.message.includes('HTTP 404')) {
                            errorMessage = 'VAT税单文件不存在';
                          } else if (error.message.includes('HTTP 500')) {
                            errorMessage = '服务器内部错误，请联系管理员';
                          } else if (error.message.includes('Failed to fetch')) {
                            errorMessage = '网络连接失败，请检查网络连接';
                          } else {
                            errorMessage = `获取VAT税单文件失败: ${error.message}`;
                          }
                        }
                        
                        message.error(errorMessage);
                      }
                    }}
                    title={`查看VAT税单: ${record.vatReceiptFileName}`}
                    disabled={isDeleting}
                  >
                    查看
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => handleOpenVatEditModal(record)}
                    title="编辑VAT税单信息"
                    disabled={isDeleting}
                  >
                    编辑
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    danger
                    onClick={() => handleDeleteVatReceipt(record.shippingId)}
                    title="删除VAT税单"
                    loading={isDeleting}
                    disabled={isDeleting}
                  >
                    {isDeleting ? '删除中' : '删除'}
                  </Button>
                </div>
                {/* 显示解析到的信息 */}
                {(record.mrn || record.vatReceiptTaxAmount || record.vatReceiptTaxDate) && (
                  <div style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>
                    {record.mrn && <div>MRN: {record.mrn}</div>}
                    {record.vatReceiptTaxAmount && <div>税金: £{record.vatReceiptTaxAmount}</div>}
                    {record.vatReceiptTaxAmount && record.productCount && record.productCount > 0 && (
                      <div>平均税金: £{(record.vatReceiptTaxAmount / record.productCount).toFixed(2)}</div>
                    )}
                    {record.vatReceiptTaxDate && <div>日期: {formatVatDate(record.vatReceiptTaxDate)}</div>}
                  </div>
                )}
              </>
            ) : (
              <Button 
                type="link" 
                size="small" 
                title="上传VAT税单PDF"
                onClick={() => handleOpenVatUploadModal(record.shippingId)}
                disabled={isUploading}
              >
                上传
              </Button>
            )}
          </div>
        );
      },
    },
    {
      title: '物流节点',
      dataIndex: 'logisticsNode',
      key: 'logisticsNode',
      width: 200,
      align: 'left',
      render: (text, record) => {
        const isEditing = editingKey === record.shippingId && editingField === 'logisticsNode';
        if (isEditing) {
          return renderEditableCell(text, record, 'logisticsNode');
        }
        return (
          <Tooltip title={text}>
            <div
              onDoubleClick={() => handleStartEdit(record.shippingId, 'logisticsNode', text)}
              style={{ cursor: 'pointer', textAlign: 'left' }}
              title="双击编辑"
            >
              <Text ellipsis>{text}</Text>
            </div>
          </Tooltip>
        );
      },
    },
  ];

  // 表格筛选变化处理
  const handleTableChange = (pagination: any, tableFilters: any, sorter: any) => {
    const newFilters: SearchParams['filters'] = {
      logisticsProvider: tableFilters.logisticsProvider,
      channel: tableFilters.channel,
      status: tableFilters.status,
      destinationCountry: tableFilters.destinationCountry,
      taxPaymentStatus: tableFilters.taxPaymentStatus,
      paymentStatus: tableFilters.paymentStatus,
    };
    
    setFilters(newFilters);
    setSelectedRowKeys([]);
    setBatchStatusValue(undefined);
    setBatchPaymentStatusValue(undefined);
    setBatchTaxStatusValue(undefined);
    
    // 更新搜索参数，保持原有的shippingIds
    const updatedParams: SearchParams = {
      filters: newFilters,
      ...(currentSearchParams?.shippingIds && { shippingIds: currentSearchParams.shippingIds })
    };
    
    fetchData(updatedParams);
  };

  // 打开VAT税单编辑对话框
  const handleOpenVatEditModal = (record: LogisticsRecord) => {
    setEditingVatRecord(record);
    setVatEditModalVisible(true);
    vatEditForm.setFieldsValue({
      mrn: record.mrn || '',
      taxAmount: record.vatReceiptTaxAmount || null,
      taxDate: record.vatReceiptTaxDate ? dayjs(record.vatReceiptTaxDate) : null
    });
  };

  // 保存VAT税单编辑
  const handleSaveVatEdit = async () => {
    if (!editingVatRecord) return;
    
    try {
      setVatEditLoading(true);
      const formData = await vatEditForm.validateFields();
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/logistics/update-vat-receipt/${editingVatRecord.shippingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          mrn: formData.mrn || '',
          taxAmount: formData.taxAmount || null,
          taxDate: formData.taxDate?.format('YYYY-MM-DD') || null
        })
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success('VAT税单信息更新成功');
        // 更新本地数据
        setData(prevData =>
          prevData.map(item =>
            item.shippingId === editingVatRecord.shippingId
              ? {
                  ...item,
                  mrn: formData.mrn || '',
                  vatReceiptTaxAmount: formData.taxAmount || null,
                  vatReceiptTaxDate: formData.taxDate?.format('YYYY-MM-DD') || null
                }
              : item
          )
        );
        
        // 关闭对话框
        setVatEditModalVisible(false);
        setEditingVatRecord(null);
        vatEditForm.resetFields();
      } else {
        throw new Error(result.message || 'VAT税单信息更新失败');
      }
    } catch (error) {
      console.error('VAT税单信息更新失败:', error);
      message.error(`VAT税单信息更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setVatEditLoading(false);
    }
  };

  // 取消VAT税单编辑
  const handleCancelVatEdit = () => {
    setVatEditModalVisible(false);
    setEditingVatRecord(null);
    vatEditForm.resetFields();
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        <TruckOutlined style={{ marginRight: 8 }} />
        头程物流管理
      </Title>
      <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
        默认显示状态为"在途"、"入库中"和"查验中"的物流记录，按预计到港日升序排列
      </Text>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={3}>
          <Card style={{ cursor: 'pointer' }} onClick={() => handleStatisticClick('yearly')}>
            <Statistic
              title="今年发货票数"
              value={statisticsData.yearlyCount}
              prefix={<BoxPlotOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card style={{ cursor: 'pointer' }} onClick={() => handleStatisticClick('transit')}>
            <Statistic
              title="在途产品数"
              value={statisticsData.transitProductCount}
              prefix={<TruckOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card style={{ cursor: 'pointer' }} onClick={() => handleStatisticClick('transitPackage')}>
            <Statistic
              title="在途箱数"
              value={statisticsData.transitPackageCount}
              prefix={<BoxPlotOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card style={{ cursor: 'pointer' }} onClick={() => handleStatisticClick('inspecting')}>
            <Statistic
              title="查验中"
              value={statisticsData.inspectingCount}
              prefix={<SearchOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card style={{ cursor: 'pointer' }} onClick={() => handleStatisticClick('unpaid')}>
            <Statistic
              title="未付总运费"
              value={statisticsData.unpaidTotalFee}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card style={{ cursor: 'pointer' }} onClick={() => handleStatisticClick('pendingWarehouse')}>
            <Statistic
              title={
                <span>
                  待调整到仓日货件数
                  <Tooltip title="统计10天内预计到仓且状态为'在途'或'查验中'的货件数。">
                    <InfoCircleOutlined style={{ marginLeft: 4, color: '#1890ff', cursor: 'pointer' }} />
                  </Tooltip>
                </span>
              }
              value={statisticsData.pendingWarehouseCount}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={3}>
          <Card style={{ cursor: 'pointer' }} onClick={() => handleStatisticClick('unuploadedVatReceipt')}>
            <Statistic
              title="未上传VAT税单"
              value={statisticsData.unuploadedVatReceiptCount}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col span={3}>
          <div></div>
        </Col>
      </Row>

      {/* 搜索区域 */}
      <Card title="搜索和筛选" style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col span={8}>
          <TextArea
            rows={4}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
            placeholder="请输入Shipping ID（每行一个）"
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
              />
            </Col>
            <Col span={16}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space wrap>
          <Button 
                    type="primary"
                    icon={<SearchOutlined />}
            onClick={handleSearch} 
            loading={loading}
          >
            搜索
          </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={handleReset}
                    loading={loading}
                  >
                    重置
                  </Button>
                  <Button
                    icon={<FilterOutlined />}
                    onClick={handleSearchAll}
                    loading={loading}
                  >
                    查询全部
                  </Button>
                </Space>
                <Space wrap>
                  <Button
                    icon={<DatabaseOutlined />}
                    onClick={() => setBatchUpdateModalVisible(true)}
                  >
                    批量更新货件详情
          </Button>


                  <Button
                    type="default"
                    icon={<ExportOutlined />}
                    onClick={handleExportLastQuarterVat}
                    loading={exportVatLoading}
                  >
                    导出上季VAT税单
                  </Button>
        </Space>
                <Text type="secondary">
                  当前显示: {data.length} 条记录
                  {selectedRowKeys.length > 0 && ` | 已选择: ${selectedRowKeys.length} 条`}
                </Text>
              </Space>
            </Col>
          </Row>
        </Space>
      </Card>

      {/* 批量操作区域 */}
      {selectedRowKeys.length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <Space wrap>
            <Text strong>批量操作：</Text>
            
            <Space>
              <Text>修改状态为：</Text>
              <Select
                placeholder="选择状态"
                style={{ width: 120 }}
                value={batchStatusValue}
                onChange={handleBatchStatusChange}
                loading={batchLoading}
              >
                <Option value="在途">在途</Option>
                <Option value="查验中">查验中</Option>
                <Option value="入库中">入库中</Option>
                <Option value="完成">完成</Option>
              </Select>
            </Space>

            <Space>
              <Text>修改付款状态为：</Text>
              <Select
                placeholder="选择付款状态"
                style={{ width: 130 }}
                value={batchPaymentStatusValue}
                onChange={handleBatchPaymentStatusChange}
                loading={batchLoading}
              >
                <Option value="已付">已付</Option>
                <Option value="未付">未付</Option>
              </Select>
            </Space>

            <Space>
              <Text>修改税金状态为：</Text>
              <Select
                placeholder="选择税金状态"
                style={{ width: 130 }}
                value={batchTaxStatusValue}
                onChange={handleBatchTaxStatusChange}
                loading={batchLoading}
              >
                <Option value="已付">已付</Option>
                <Option value="未付">未付</Option>
              </Select>
            </Space>

            <Button 
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleBatchDelete()}
              disabled={batchLoading}
              size="small"
            >
              批量删除
            </Button>

            <Button 
              size="small" 
              onClick={handleCancelSelection}
              disabled={batchLoading}
            >
              取消选择
            </Button>
            
            <Text type="secondary">
              已选择 {selectedRowKeys.length} 条记录
            </Text>
          </Space>
        </Card>
      )}

      {/* 数据表格 */}
      <Card>
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={data}
          rowKey="shippingId"
          loading={loading}
          scroll={{ x: 'max-content' }}
          bordered
          size="small"
          onChange={handleTableChange}
          showSorterTooltip={false}
          pagination={{
            defaultPageSize: 50,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range?.[0]}-${range?.[1]} 条，共 ${total} 条记录`,
            pageSizeOptions: ['20', '50', '100', '200'],
          }}
          rowClassName={(record) => {
            if (record.status === '完成') return 'logistics-completed';
            if (record.status === '在途') return 'logistics-transit';
            return '';
          }}
        />
      </Card>

      {/* 批量更新模态框 */}
      <Modal
        title="批量更新货件详情"
        open={batchUpdateModalVisible}
        onCancel={() => {
          setBatchUpdateModalVisible(false);
          setBatchUpdateText('');
          setParsedBatchData([]);
        }}
        width={800}
        footer={null}
      >
        <div>
          <TextArea
            rows={10}
            value={batchUpdateText}
            onChange={(e) => {
              setBatchUpdateText(e.target.value);
              setParsedBatchData(parseBatchUpdateText(e.target.value));
            }}
            placeholder="支持格式：Shipping ID:货件号 或 字段名:值（支持中英文冒号）"
          />
          
          {parsedBatchData.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <Text strong>解析结果预览：</Text>
              <div style={{ maxHeight: '300px', overflow: 'auto', marginTop: '8px' }}>
                {parsedBatchData.map((item, index) => (
                  <div key={index} style={{ 
                    border: '1px dashed #d9d9d9', 
                    padding: '8px', 
                    marginBottom: '8px',
                    backgroundColor: '#fafafa'
                  }}>
                    <Text strong>Shipping ID: {item.shippingId}</Text>
                    <div style={{ marginTop: '4px' }}>
                      {Object.entries(item.updates).map(([key, value]) => (
                        <div key={key}>
                          <Text>{key}: </Text>
                          <Text type="secondary">{value}</Text>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div style={{ marginTop: '16px', textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setBatchUpdateModalVisible(false);
                setBatchUpdateText('');
                setParsedBatchData([]);
              }}>
                取消
              </Button>
              <Button
                type="primary"
                onClick={handleBatchUpdateConfirm}
                loading={batchLoading}
                disabled={parsedBatchData.length === 0}
              >
                确认更新 ({parsedBatchData.length} 条记录)
              </Button>
      </Space>
          </div>
        </div>
      </Modal>





      {/* VAT税单编辑对话框 */}
      <Modal
        title="编辑VAT税单信息"
        open={vatEditModalVisible}
        onCancel={handleCancelVatEdit}
        width={500}
        footer={[
          <Button key="cancel" onClick={handleCancelVatEdit}>
            取消
          </Button>,
          <Button 
            key="save" 
            type="primary" 
            loading={vatEditLoading}
            onClick={handleSaveVatEdit}
          >
            保存
          </Button>
        ]}
      >
        <Form
          form={vatEditForm}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="mrn"
            label="MRN号码"
            rules={[
              { required: true, message: '请输入MRN号码' },
              { pattern: /^[A-Z0-9Ø]+$/i, message: 'MRN号码只能包含字母和数字' }
            ]}
          >
            <Input 
              placeholder="请输入MRN号码" 
              style={{ width: '100%' }}
            />
          </Form.Item>
          
          <Form.Item
            name="taxAmount"
            label="税金金额 (£)"
            rules={[
              { required: true, message: '请输入税金金额' },
              { type: 'number', min: 0, message: '税金金额必须大于等于0' }
            ]}
          >
            <InputNumber
              placeholder="请输入税金金额"
              style={{ width: '100%' }}
              precision={2}
              min={0}
              addonBefore="£"
            />
          </Form.Item>
          
          <Form.Item
            name="taxDate"
            label="税金日期"
            rules={[
              { required: true, message: '请选择税金日期' }
            ]}
          >
            <DatePicker
              placeholder="请选择税金日期"
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* VAT税单上传对话框 */}
      <Modal
        title="上传VAT税单"
        open={vatUploadModalVisible}
        onCancel={handleCancelVatUpload}
        footer={null}
        width={600}
        destroyOnClose
      >
        {vatUploadStep === 'select' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text>请选择或拖拽VAT税单PDF文件，系统将自动解析其中的信息：</Text>
            </div>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{ 
                padding: '20px',
                border: `2px dashed ${isDragOver ? '#1890ff' : vatUploadModalLoading ? '#d9d9d9' : '#d9d9d9'}`,
                borderRadius: '6px',
                backgroundColor: isDragOver ? '#e6f7ff' : vatUploadModalLoading ? '#f5f5f5' : '#fafafa',
                cursor: vatUploadModalLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              <Upload.Dragger
                accept=".pdf"
                maxCount={1}
                showUploadList={false}
                beforeUpload={(file) => {
                  setSelectedVatFile(file);
                  handleParseVatReceipt(file);
                  return false;
                }}
                disabled={vatUploadModalLoading}
                style={{ 
                  border: 'none',
                  backgroundColor: 'transparent'
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <FileTextOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                  <p style={{ fontSize: '16px', marginBottom: '8px', color: vatUploadModalLoading ? '#bfbfbf' : '#262626' }}>
                    {vatUploadModalLoading ? '正在解析PDF...' : '点击或拖拽PDF文件到此区域上传'}
                  </p>
                  <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                    支持PDF格式，自动识别发票信息并填充表单
                  </p>
                  <Button 
                    type="primary" 
                    loading={vatUploadModalLoading}
                    disabled={vatUploadModalLoading}
                    icon={<FileTextOutlined />}
                  >
                    {vatUploadModalLoading ? '解析中...' : '选择PDF文件'}
                  </Button>
                </div>
              </Upload.Dragger>
            </div>
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                支持解析MRN号码、税金金额、税金日期等信息
              </Text>
            </div>
          </div>
        )}

        {vatUploadStep === 'confirm' && vatExtractedData && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>PDF解析结果 - 请确认并编辑信息：</Text>
            </div>
            
            <Form
              form={vatForm}
              layout="vertical"
              style={{ marginBottom: 16 }}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="mrn"
                    label="MRN号码"
                    rules={[
                      { required: true, message: '请输入MRN号码' },
                      { pattern: /^[A-Z0-9Ø]+$/i, message: 'MRN号码只能包含字母和数字' }
                    ]}
                  >
                    <Input 
                      placeholder="请输入MRN号码" 
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="taxAmount"
                    label="税金金额 (£)"
                    rules={[
                      { required: true, message: '请输入税金金额' },
                      { type: 'number', min: 0, message: '税金金额必须大于等于0' }
                    ]}
                  >
                    <InputNumber
                      placeholder="请输入税金金额"
                      style={{ width: '100%' }}
                      precision={2}
                      min={0}
                      addonBefore="£"
                    />
                  </Form.Item>
                </Col>
              </Row>
              
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="taxDate"
                    label="税金日期"
                    rules={[
                      { required: true, message: '请选择税金日期' }
                    ]}
                  >
                    <DatePicker
                      placeholder="请选择税金日期"
                      style={{ width: '100%' }}
                      format="YYYY-MM-DD"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <div style={{ paddingTop: 32 }}>
                    <Text type="secondary">
                      原始解析结果：
                    </Text>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                      {vatExtractedData.mrn && <div>MRN: {vatExtractedData.mrn}</div>}
                      {vatExtractedData.taxAmount && <div>税金: £{vatExtractedData.taxAmount}</div>}
                      {vatExtractedData.taxDate && <div>日期: {formatVatDate(vatExtractedData.taxDate)}</div>}
                    </div>
                  </div>
                </Col>
              </Row>
            </Form>
            
            <div style={{ marginBottom: 16 }}>
              <Text>请确认以上信息无误后点击上传：</Text>
            </div>
            <Space>
              <Button 
                type="primary" 
                onClick={handleConfirmAndUploadVatReceipt}
                loading={vatUploadModalLoading}
                disabled={vatUploadModalLoading}
              >
                {vatUploadModalLoading ? '上传中...' : '确认上传'}
              </Button>
              <Button onClick={() => setVatUploadStep('select')}>
                重新选择文件
              </Button>
              <Button onClick={handleCancelVatUpload}>
                取消
              </Button>
            </Space>
          </div>
        )}

        {vatUploadStep === 'uploading' && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ marginBottom: 16 }}>
              <Text>正在上传VAT税单到阿里云OSS...</Text>
            </div>
            <div>
              <Text type="secondary">请稍候，上传完成后将自动关闭对话框</Text>
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        .logistics-completed {
          background-color: #f6ffed;
        }
        .logistics-transit {
          background-color: #e6f7ff;
        }
        .ant-table-thead > tr > th {
          text-align: center !important;
        }
      `}</style>
    </div>
  );
};

export default LogisticsPage; 