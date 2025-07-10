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
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  DatabaseOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { API_BASE_URL } from '../../config/api';
import HsCodeManagement from './HsCodeManagement';
import WarehouseManagement from './WarehouseManagement';

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
  const [warehouseModalVisible, setWarehouseModalVisible] = useState(false);
  const [hsCodeModalVisible, setHsCodeModalVisible] = useState(false);
  const [newShipmentModalVisible, setNewShipmentModalVisible] = useState(false);
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [logisticsProviders, setLogisticsProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [form] = Form.useForm();
  const [shipmentForm] = Form.useForm();
  const [statisticsData, setStatisticsData] = useState({
    yearlyCount: 0,
    transitProductCount: 0,
    transitPackageCount: 0,
    unpaidTotalFee: 0,
    pendingWarehouseCount: 0
  });

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
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };





  // 获取物流商列表
  const fetchLogisticsProviders = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipments/providers`);
      const result = await response.json();
      if (result.code === 0) {
        setLogisticsProviders(result.data);
      }
    } catch (error) {
      console.error('获取物流商列表失败:', error);
      message.error('获取物流商列表失败');
    }
  };

  // 处理PDF上传和解析
  const handlePdfUpload = async (file: File) => {
    setPdfExtracting(true);
    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch(`${API_BASE_URL}/api/shipments/extract-pdf`, {
          method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (result.code === 0) {
        setExtractedData(result.data);
        shipmentForm.setFieldsValue({
          packageCount: result.data.packageCount,
          destinationWarehouse: result.data.destinationWarehouse,
          destinationCountry: result.data.destinationCountry
        });
        message.success('PDF解析成功');
      } else {
        message.error(result.message || 'PDF解析失败');
      }
    } catch (error) {
      console.error('PDF解析失败:', error);
      message.error('PDF解析失败');
    } finally {
      setPdfExtracting(false);
    }
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
        // 查询在途状态的记录
        params.filters = { status: ['在途'] };
        break;
      case 'transitPackage':
        // 查询在途状态的记录（显示箱数）
        params.filters = { status: ['在途'] };
        break;
      case 'unpaid':
        // 查询未付款的记录
        params.filters = { paymentStatus: ['未付'] };
        break;
      case 'pendingWarehouse':
        // 查询即将到仓的记录（只统计状态为"在途"的记录）
        params.filters = { specialQuery: 'pendingWarehouse' };
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
      const trimmedLine = line.trim();
      // 支持中文冒号和英文冒号
      if (trimmedLine.includes('：') || trimmedLine.includes(':')) {
        // 优先使用中文冒号分割，如果没有则使用英文冒号
        const separator = trimmedLine.includes('：') ? '：' : ':';
        const [key, value] = trimmedLine.split(separator).map(s => s.trim());
        
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

    // 添加详细的调试信息
    console.log('🔍 调试信息 - 批量删除前检查:');
    console.log('📋 selectedRowKeys:', selectedRowKeys);
    console.log('📋 selectedRowKeys类型:', typeof selectedRowKeys);
    console.log('📋 selectedRowKeys长度:', selectedRowKeys.length);
    console.log('📋 selectedRowKeys内容:', selectedRowKeys.map(key => `"${key}" (${typeof key})`));
    
    // 检查token
    const token = localStorage.getItem('token');
    console.log('🔑 Token检查:', token ? `存在 (长度: ${token.length})` : '不存在');
    
    // 检查API地址
    console.log('🌐 API地址:', API_BASE_URL);

    // 检查Modal对象
    console.log('🔍 Modal对象检查:', typeof Modal);
    console.log('🔍 Modal.confirm检查:', typeof Modal.confirm);
    
    try {
      console.log('🔥 准备调用Modal.confirm...');
      
      // 使用try-catch包装Modal.confirm调用
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
        onOk: async () => {
          setBatchLoading(true);
          try {
            console.log('🔥 开始批量删除操作');
            console.log('📋 选中的记录:', selectedRowKeys);
            console.log('🌐 API地址:', API_BASE_URL);
            
            const requestPayload = {
              shippingIds: selectedRowKeys
            };
            console.log('📤 请求数据:', requestPayload);
            console.log('📤 请求数据JSON:', JSON.stringify(requestPayload));
            
            const token = localStorage.getItem('token');
            if (!token) {
              throw new Error('未找到认证token，请重新登录');
            }
            
            console.log('🔑 使用token:', token.substring(0, 20) + '...');
            
            const headers = { 
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`
            };
            console.log('📤 请求头:', headers);
            
            const response = await fetch(`${API_BASE_URL}/api/logistics/batch-delete`, {
              method: 'POST',
              headers,
              body: JSON.stringify(requestPayload),
            });

            console.log('📥 响应状态:', response.status);
            console.log('📥 响应状态文本:', response.statusText);
            console.log('📥 响应头:', Object.fromEntries(response.headers.entries()));
            
            // 获取响应文本，无论是否为JSON
            const responseText = await response.text();
            console.log('📥 原始响应文本:', responseText);
            
            if (!response.ok) {
              console.error('❌ HTTP错误:', response.status, response.statusText);
              console.error('❌ 响应内容:', responseText);
              throw new Error(`HTTP ${response.status}: ${response.statusText}\n响应内容: ${responseText}`);
            }
            
            let result;
            try {
              result = JSON.parse(responseText);
            } catch (parseError) {
              console.error('❌ JSON解析失败:', parseError);
              console.error('❌ 原始响应:', responseText);
              throw new Error(`服务器返回了无效的JSON格式: ${responseText}`);
            }
            
            console.log('📥 解析后的响应数据:', result);
            
            if (result.code === 0) {
              const deletedCount = result.data?.deletedCount || selectedRowKeys.length;
              message.success(`🎉 成功删除 ${deletedCount} 条记录`);
              
              // 清空选择状态
              setSelectedRowKeys([]);
              setBatchStatusValue(undefined);
              setBatchPaymentStatusValue(undefined);
              setBatchTaxStatusValue(undefined);
              
              // 延迟一下再刷新数据，确保状态更新完成
              setTimeout(() => {
                refetchData();
              }, 300);
            } else {
              const errorMsg = result.message || `删除失败 (HTTP ${response.status})`;
              console.error('❌ 删除失败:', errorMsg);
              console.error('❌ 完整错误信息:', result);
              message.error(`删除失败: ${errorMsg}`);
            }
          } catch (error) {
            console.error('💥 批量删除异常:', error);
            console.error('💥 错误详情:', {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              selectedRowKeys,
              API_BASE_URL
            });
            message.error(`网络错误: ${error instanceof Error ? error.message : '未知错误'}`);
          } finally {
            setBatchLoading(false);
          }
        }
      });
      
      console.log('✅ Modal.confirm调用成功，返回值:', modalResult);
      
    } catch (modalError) {
      console.error('💥 Modal.confirm调用失败:', modalError);
      console.error('💥 错误详情:', modalError);
      
      // 回退到原生确认对话框
      console.log('🔄 回退到原生确认对话框');
      const confirmed = window.confirm(`您确定要删除选中的 ${selectedRowKeys.length} 条物流记录吗？\n\n选中的记录ID: ${selectedRowKeys.join(', ')}\n\n警告：此操作不可撤销！`);
      
      if (confirmed) {
        console.log('✅ 用户确认删除，开始执行删除操作');
        // 在这里执行删除逻辑，但先通过message.error通知用户Modal有问题
        message.error('Modal组件异常，请联系技术支持。当前使用备用删除方式。');
        
        // 手动执行删除逻辑
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
              
              setTimeout(() => {
                refetchData();
              }, 300);
            } else {
              message.error(`删除失败: ${result.message}`);
            }
          } catch (error) {
            console.error('💥 备用删除方式异常:', error);
            message.error(`网络错误: ${error instanceof Error ? error.message : '未知错误'}`);
          } finally {
            setBatchLoading(false);
          }
        })();
      } else {
        console.log('❌ 用户取消删除');
      }
    }
  };

  // 重新获取数据（使用当前搜索参数）
  const refetchData = () => {
    if (currentSearchParams) {
      fetchData(currentSearchParams, false); // 不显示加载消息，避免覆盖操作成功消息
    } else {
      // 如果没有保存的搜索参数，使用默认参数
      fetchData({ filters: { status: ['在途', '入库中'] } }, false);
    }
  };

  // 取消选择
  const handleCancelSelection = () => {
    setSelectedRowKeys([]);
    setBatchStatusValue(undefined);
    setBatchPaymentStatusValue(undefined);
    setBatchTaxStatusValue(undefined);
  };

  // 初始化数据
  useEffect(() => {
    console.log('🚀 LogisticsPage 初始化');
    console.log('🌐 当前API地址:', API_BASE_URL);
    console.log('🌍 环境变量:', {
      NODE_ENV: process.env.NODE_ENV,
      REACT_APP_API_BASE_URL: process.env.REACT_APP_API_BASE_URL
    });
    
    fetchFilterOptions();
    fetchStatistics();
    // 默认加载状态不为"完成"的物流记录，按预计到港日排序
    fetchData({ filters: { status: ['在途', '入库中'] } });
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
    fetchData({ filters: { status: ['在途', '入库中'] } });
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

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        <TruckOutlined style={{ marginRight: 8 }} />
        头程物流管理
      </Title>
      <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
        默认显示状态为"在途"和"入库中"的物流记录，按预计到港日升序排列
      </Text>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={5}>
          <Card style={{ cursor: 'pointer' }} onClick={() => handleStatisticClick('yearly')}>
            <Statistic
              title="今年发货票数"
              value={statisticsData.yearlyCount}
              prefix={<BoxPlotOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card style={{ cursor: 'pointer' }} onClick={() => handleStatisticClick('transit')}>
            <Statistic
              title="在途产品数"
              value={statisticsData.transitProductCount}
              prefix={<TruckOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card style={{ cursor: 'pointer' }} onClick={() => handleStatisticClick('transitPackage')}>
            <Statistic
              title="在途箱数"
              value={statisticsData.transitPackageCount}
              prefix={<BoxPlotOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={5}>
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
        <Col span={4}>
          <Card style={{ cursor: 'pointer' }} onClick={() => handleStatisticClick('pendingWarehouse')}>
            <Statistic
              title="待调整到仓日货件数"
              value={statisticsData.pendingWarehouseCount}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
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
                    icon={<BoxPlotOutlined />}
                    onClick={() => setWarehouseModalVisible(true)}
                  >
                    亚马逊仓库管理
                  </Button>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => {
                      setHsCodeModalVisible(true);
                    }}
                  >
                    HSCODE编码管理
                  </Button>
                  <Button
                    type="primary"
                    icon={<TruckOutlined />}
                    onClick={() => {
                      setNewShipmentModalVisible(true);
                      fetchLogisticsProviders();
                      setExtractedData(null);
                      shipmentForm.resetFields();
                    }}
                  >
                    新建货件及发票
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

      {/* 亚马逊仓库管理模态框 */}
      <Modal
        title="亚马逊仓库管理"
        open={warehouseModalVisible}
        onCancel={() => setWarehouseModalVisible(false)}
        width="95%"
        style={{ maxWidth: '1600px', top: 20 }}
        footer={null}
        destroyOnClose
      >
        <WarehouseManagement />
      </Modal>

            {/* HSCODE编码管理模态框 */}
      <Modal
        title="HSCODE编码管理"
        open={hsCodeModalVisible}
        onCancel={() => setHsCodeModalVisible(false)}
        width="95%"
        style={{ maxWidth: '1600px', top: 20 }}
        footer={null}
        destroyOnClose
      >
        <HsCodeManagement />
      </Modal>

      {/* 新建货件及发票模态框 */}
      <Modal
        title="新建货件及发票"
        open={newShipmentModalVisible}
        onCancel={() => {
          setNewShipmentModalVisible(false);
          setExtractedData(null);
          setSelectedProvider('');
          shipmentForm.resetFields();
        }}
        width={900}
        footer={null}
      >
        <div>
          <Form
            form={shipmentForm}
            layout="vertical"
            onFinish={async (values) => {
              try {
                const shipmentData = {
                  ...values,
                  packageNumbers: extractedData?.packageNumbers || [],
                  products: extractedData?.products || []
                };

                const response = await fetch(`${API_BASE_URL}/api/shipments`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(shipmentData)
                });

                const result = await response.json();
                if (result.code === 0) {
                  message.success('货件创建成功');
                  setNewShipmentModalVisible(false);
                  setExtractedData(null);
                  shipmentForm.resetFields();
                  // 刷新物流列表
                  fetchData({ filters });
                } else {
                  message.error(result.message || '创建失败');
                }
              } catch (error) {
                message.error('创建失败');
              }
            }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="logisticsProvider" label="物流商" rules={[{ required: true }]}>
                  <Select
                    placeholder="请选择物流商"
                    onChange={(value) => {
                      setSelectedProvider(value);
                      shipmentForm.setFieldsValue({ channel: undefined });
                    }}
                  >
                    {logisticsProviders.map(provider => (
                      <Option key={provider.name} value={provider.name}>
                        {provider.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="channel" label="物流渠道" rules={[{ required: true }]}>
                  <Select placeholder="请选择物流渠道">
                    {selectedProvider && logisticsProviders
                      .find(p => p.name === selectedProvider)
                      ?.channels.map((channel: string) => (
                        <Option key={channel} value={channel}>
                          {channel}
                        </Option>
                      ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={24}>
                <Form.Item label="上传发货单PDF">
                  <Upload
                    accept=".pdf"
                    maxCount={1}
                    beforeUpload={(file) => {
                      handlePdfUpload(file);
                      return false; // 阻止自动上传
                    }}
                    showUploadList={false}
                  >
                    <Button loading={pdfExtracting}>
                      {pdfExtracting ? '解析中...' : '选择PDF文件'}
                    </Button>
                  </Upload>
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    支持自动提取箱数、产品SKU、目的仓库等信息
                  </Text>
                </Form.Item>
              </Col>
            </Row>

            {extractedData && (
              <Card title="PDF解析结果" size="small" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={6}>
                    <Text strong>箱数：</Text>
                    <Text>{extractedData.packageCount || 0}</Text>
                  </Col>
                  <Col span={6}>
                    <Text strong>目的国：</Text>
                    <Text>{extractedData.destinationCountry || '-'}</Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>目的仓库：</Text>
                    <Text>{extractedData.destinationWarehouse || '-'}</Text>
                  </Col>
                </Row>
                {extractedData.packageNumbers?.length > 0 && (
                  <Row style={{ marginTop: 8 }}>
                    <Col span={24}>
                      <Text strong>箱号：</Text>
                      <Text>{extractedData.packageNumbers.join(', ')}</Text>
                    </Col>
                  </Row>
                )}
                {extractedData.products?.length > 0 && (
                  <Row style={{ marginTop: 8 }}>
                    <Col span={24}>
                      <Text strong>产品SKU：</Text>
                      <Text>{extractedData.products.join(', ')}</Text>
                    </Col>
                  </Row>
                )}
              </Card>
            )}

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="packageCount" label="箱数" rules={[{ required: true }]}>
                  <InputNumber 
                    placeholder="箱数" 
                    style={{ width: '100%' }} 
                    min={1}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="destinationCountry" label="目的国" rules={[{ required: true }]}>
                  <Input placeholder="目的国" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="destinationWarehouse" label="目的仓库" rules={[{ required: true }]}>
                  <Input placeholder="目的仓库" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="notes" label="备注">
                  <TextArea rows={3} placeholder="请输入备注信息" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  创建货件
                </Button>
          <Button 
                  onClick={async () => {
                    if (!selectedProvider) {
                      message.warning('请先选择物流商');
                      return;
                    }
                    // 这里可以实现发票生成功能
                    message.info('发票生成功能开发中...');
                  }}
                >
                  生成发票
                </Button>
                <Button onClick={() => {
                  setNewShipmentModalVisible(false);
                  setExtractedData(null);
                  shipmentForm.resetFields();
                }}>
                  取消
          </Button>
        </Space>
            </Form.Item>
          </Form>
        </div>
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