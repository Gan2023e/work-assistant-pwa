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
  DatabaseOutlined
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

// 亚马逊仓库接口
interface AmzWarehouse {
  id: number;
  warehouseName: string;
  warehouseCode: string;
  country: string;
  state?: string;
  city: string;
  address: string;
  zipCode: string;
  phone?: string;
  status: 'active' | 'inactive';
  notes?: string;
}

// HSCODE接口
interface HsCode {
  id: number;
  hsCode: string;
  productName: string;
  productNameEn?: string;
  category?: string;
  description?: string;
  declaredValue?: number;
  declaredValueCurrency: string;
  tariffRate?: number;
  imageUrl?: string;
  imageName?: string;
  status: 'active' | 'inactive';
  usageCount: number;
  lastUsedAt?: string;
  notes?: string;
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
  const [editingKey, setEditingKey] = useState('');
  const [editingField, setEditingField] = useState('');
  const [editingValue, setEditingValue] = useState<any>('');
  const [batchUpdateModalVisible, setBatchUpdateModalVisible] = useState(false);
  const [batchUpdateText, setBatchUpdateText] = useState('');
  const [parsedBatchData, setParsedBatchData] = useState<BatchUpdateData[]>([]);
  const [warehouseModalVisible, setWarehouseModalVisible] = useState(false);
  const [hsCodeModalVisible, setHsCodeModalVisible] = useState(false);
  const [newShipmentModalVisible, setNewShipmentModalVisible] = useState(false);
  const [warehouseList, setWarehouseList] = useState<AmzWarehouse[]>([]);
  const [hsCodeList, setHsCodeList] = useState<HsCode[]>([]);
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [hsCodeLoading, setHsCodeLoading] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<AmzWarehouse | null>(null);
  const [editingHsCode, setEditingHsCode] = useState<HsCode | null>(null);
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [logisticsProviders, setLogisticsProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [form] = Form.useForm();
  const [warehouseForm] = Form.useForm();
  const [hsCodeForm] = Form.useForm();
  const [shipmentForm] = Form.useForm();
  const [statisticsData, setStatisticsData] = useState({
    yearlyCount: 0,
    transitProductCount: 0,
    transitPackageCount: 0,
    unpaidTotalFee: 0,
    pendingWarehouseCount: 0
  });

  // API调用函数
  const fetchData = async (params: SearchParams) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/logistics/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        });
        
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
      const result = await response.json();
      const sortedData = (result.data || []).sort((a: LogisticsRecord, b: LogisticsRecord) => {
        const dateA = a.estimatedArrivalDate ? new Date(a.estimatedArrivalDate).getTime() : 0;
        const dateB = b.estimatedArrivalDate ? new Date(b.estimatedArrivalDate).getTime() : 0;
        return dateA - dateB;
      });

      setData(sortedData);
      
      if (params.shippingIds?.length) {
        message.success(`找到 ${sortedData.length} 条匹配记录`);
      } else {
        message.success(`加载了 ${sortedData.length} 条物流记录`);
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

  // 获取仓库列表
  const fetchWarehouses = async () => {
    setWarehouseLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/warehouse`);
      const result = await response.json();
      if (result.code === 0) {
        setWarehouseList(result.data);
      }
    } catch (error) {
      console.error('获取仓库列表失败:', error);
      message.error('获取仓库列表失败');
    } finally {
      setWarehouseLoading(false);
    }
  };

  // 获取HSCODE列表
  const fetchHsCodes = async () => {
    setHsCodeLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/hscode`);
      const result = await response.json();
      if (result.code === 0) {
        setHsCodeList(result.data);
      }
    } catch (error) {
      console.error('获取HSCODE列表失败:', error);
      message.error('获取HSCODE列表失败');
    } finally {
      setHsCodeLoading(false);
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
      const response = await fetch(`${API_BASE_URL}/api/logistics/update`, {
          method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const response = await fetch(`${API_BASE_URL}/api/logistics/batch-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        // 刷新数据
        fetchData({ filters });
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
      const response = await fetch(`${API_BASE_URL}/api/logistics/batch-update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        // 刷新数据
        fetchData({ filters });
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

  // 取消选择
  const handleCancelSelection = () => {
    setSelectedRowKeys([]);
    setBatchStatusValue(undefined);
  };

  // 初始化数据
  useEffect(() => {
    fetchFilterOptions();
    fetchStatistics();
    // 默认加载未完成的物流记录
    fetchData({ filters: { status: ['not_completed'] } });
  }, []);

  // 搜索处理
  const handleSearch = () => {
    const shippingIds = searchInput
      .split('\n')
      .map(id => id.trim())
      .filter(Boolean);

    const params: SearchParams = { filters };
    if (shippingIds.length > 0) {
      params.shippingIds = shippingIds;
    }

    fetchData(params);
  };

  // 重置搜索
  const handleReset = () => {
    setSearchInput('');
    setFilters({});
    setSelectedRowKeys([]);
    setBatchStatusValue(undefined);
    fetchData({ filters: { status: ['not_completed'] } });
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
      defaultSortOrder: 'descend',
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
                onChange={(value) => setEditingValue(value)}
                size="small"
                style={{ width: 80 }}
                onSelect={handleSaveEdit}
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
                onChange={(value) => setEditingValue(value)}
                size="small"
                style={{ width: 80 }}
                onSelect={handleSaveEdit}
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
  const handleTableChange = (pagination: any, tableFilters: any) => {
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
    fetchData({ filters: newFilters });
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        <TruckOutlined style={{ marginRight: 8 }} />
        头程物流管理
      </Title>

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
                    onClick={() => {
                      setWarehouseModalVisible(true);
                      fetchWarehouses();
                    }}
                  >
                    亚马逊仓库管理
                  </Button>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => {
                      setHsCodeModalVisible(true);
                      fetchHsCodes();
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
          <Space>
            <Text strong>批量操作：</Text>
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
        onCancel={() => {
          setWarehouseModalVisible(false);
          setEditingWarehouse(null);
          warehouseForm.resetFields();
        }}
        width={1200}
        footer={null}
      >
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button 
              type="primary" 
              onClick={() => {
                setEditingWarehouse(null);
                warehouseForm.resetFields();
              }}
            >
              新增仓库
            </Button>
          </Space>
          
          <Form
            form={warehouseForm}
            layout="vertical"
            style={{ marginBottom: 16 }}
            onFinish={async (values) => {
              try {
                const url = editingWarehouse 
                  ? `${API_BASE_URL}/api/warehouse/${editingWarehouse.id}`
                  : `${API_BASE_URL}/api/warehouse`;
                const method = editingWarehouse ? 'PUT' : 'POST';
                
                const response = await fetch(url, {
                  method,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(values)
                });
                
                const result = await response.json();
                if (result.code === 0) {
                  message.success(editingWarehouse ? '更新成功' : '创建成功');
                  fetchWarehouses();
                  setEditingWarehouse(null);
                  warehouseForm.resetFields();
                } else {
                  message.error(result.message || '操作失败');
                }
              } catch (error) {
                message.error('操作失败');
              }
            }}
          >
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item name="warehouseName" label="仓库名称" rules={[{ required: true }]}>
                  <Input placeholder="请输入仓库名称" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="warehouseCode" label="仓库代码" rules={[{ required: true }]}>
                  <Input placeholder="请输入仓库代码" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="country" label="国家" rules={[{ required: true }]}>
                  <Input placeholder="请输入国家" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="state" label="州/省">
                  <Input placeholder="请输入州/省" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item name="city" label="城市" rules={[{ required: true }]}>
                  <Input placeholder="请输入城市" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="zipCode" label="邮编" rules={[{ required: true }]}>
                  <Input placeholder="请输入邮编" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="phone" label="电话">
                  <Input placeholder="请输入电话" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="status" label="状态" initialValue="active">
                  <Select>
                    <Option value="active">启用</Option>
                    <Option value="inactive">禁用</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="address" label="详细地址" rules={[{ required: true }]}>
                  <TextArea rows={2} placeholder="请输入详细地址" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="notes" label="备注">
                  <TextArea rows={2} placeholder="请输入备注" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  {editingWarehouse ? '更新' : '创建'}
                </Button>
                <Button onClick={() => {
                  setEditingWarehouse(null);
                  warehouseForm.resetFields();
                }}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
          
          <Table
            dataSource={warehouseList}
            loading={warehouseLoading}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10 }}
            columns={[
              { title: '仓库名称', dataIndex: 'warehouseName', width: 120 },
              { title: '仓库代码', dataIndex: 'warehouseCode', width: 100 },
              { title: '国家', dataIndex: 'country', width: 80 },
              { title: '州/省', dataIndex: 'state', width: 80 },
              { title: '城市', dataIndex: 'city', width: 80 },
              { title: '邮编', dataIndex: 'zipCode', width: 80 },
              { 
                title: '状态', 
                dataIndex: 'status', 
                width: 80,
                render: (status: string) => (
                  <Tag color={status === 'active' ? 'green' : 'red'}>
                    {status === 'active' ? '启用' : '禁用'}
                  </Tag>
                )
              },
              {
                title: '操作',
                width: 120,
                render: (_, record: AmzWarehouse) => (
                  <Space>
                    <Button 
                      size="small" 
                      onClick={() => {
                        setEditingWarehouse(record);
                        warehouseForm.setFieldsValue(record);
                      }}
                    >
                      编辑
                    </Button>
                    <Button 
                      size="small" 
                      danger
                      onClick={async () => {
                        try {
                          const response = await fetch(`${API_BASE_URL}/api/warehouse/${record.id}`, {
                            method: 'DELETE'
                          });
                          const result = await response.json();
                          if (result.code === 0) {
                            message.success('删除成功');
                            fetchWarehouses();
                          } else {
                            message.error(result.message || '删除失败');
                          }
                        } catch (error) {
                          message.error('删除失败');
                        }
                      }}
                    >
                      删除
                    </Button>
                  </Space>
                )
              }
            ]}
          />
        </div>
      </Modal>

      {/* HSCODE编码管理模态框 */}
      <Modal
        title="HSCODE编码管理"
        open={hsCodeModalVisible}
        onCancel={() => {
          setHsCodeModalVisible(false);
          setEditingHsCode(null);
          hsCodeForm.resetFields();
        }}
        width={1400}
        footer={null}
      >
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button 
              type="primary" 
              onClick={() => {
                setEditingHsCode(null);
                hsCodeForm.resetFields();
              }}
            >
              新增HSCODE
            </Button>
            <Text type="secondary">
              图片建议保存到文件系统，数据库只存储图片路径。支持上传5MB以内的图片文件。
            </Text>
          </Space>
          
          <Form
            form={hsCodeForm}
            layout="vertical"
            style={{ marginBottom: 16 }}
            onFinish={async (values) => {
              try {
                const formData = new FormData();
                Object.keys(values).forEach(key => {
                  if (values[key] !== undefined && values[key] !== null) {
                    formData.append(key, values[key]);
                  }
                });
                
                const url = editingHsCode 
                  ? `${API_BASE_URL}/api/hscode/${editingHsCode.id}`
                  : `${API_BASE_URL}/api/hscode`;
                const method = editingHsCode ? 'PUT' : 'POST';
                
                const response = await fetch(url, {
                  method,
                  body: formData
                });
                
                const result = await response.json();
                if (result.code === 0) {
                  message.success(editingHsCode ? '更新成功' : '创建成功');
                  fetchHsCodes();
                  setEditingHsCode(null);
                  hsCodeForm.resetFields();
                } else {
                  message.error(result.message || '操作失败');
                }
              } catch (error) {
                message.error('操作失败');
              }
            }}
          >
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item name="hsCode" label="HSCODE编码" rules={[{ required: true }]}>
                  <Input placeholder="请输入HSCODE编码" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="productName" label="产品名称" rules={[{ required: true }]}>
                  <Input placeholder="请输入产品名称" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="productNameEn" label="英文名称">
                  <Input placeholder="请输入英文名称" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="category" label="产品类别">
                  <Input placeholder="请输入产品类别" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item name="declaredValue" label="申报价值">
                  <InputNumber placeholder="申报价值" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="declaredValueCurrency" label="货币" initialValue="USD">
                  <Select>
                    <Option value="USD">USD</Option>
                    <Option value="EUR">EUR</Option>
                    <Option value="GBP">GBP</Option>
                    <Option value="CNY">CNY</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="tariffRate" label="关税税率(%)">
                  <InputNumber placeholder="关税税率" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="status" label="状态" initialValue="active">
                  <Select>
                    <Option value="active">启用</Option>
                    <Option value="inactive">禁用</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="description" label="产品描述">
                  <TextArea rows={2} placeholder="请输入产品描述" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="notes" label="备注">
                  <TextArea rows={2} placeholder="请输入备注" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  {editingHsCode ? '更新' : '创建'}
                </Button>
                <Button onClick={() => {
                  setEditingHsCode(null);
                  hsCodeForm.resetFields();
                }}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
          
          <Table
            dataSource={hsCodeList}
            loading={hsCodeLoading}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 8 }}
            scroll={{ y: 400 }}
            columns={[
              { title: 'HSCODE', dataIndex: 'hsCode', width: 100, fixed: 'left' },
              { title: '产品名称', dataIndex: 'productName', width: 120 },
              { title: '英文名称', dataIndex: 'productNameEn', width: 120 },
              { title: '类别', dataIndex: 'category', width: 80 },
              { 
                title: '申报价值', 
                width: 100,
                render: (_, record: HsCode) => 
                  record.declaredValue ? `${record.declaredValue} ${record.declaredValueCurrency}` : '-'
              },
              { 
                title: '关税率', 
                dataIndex: 'tariffRate', 
                width: 80,
                render: (rate: number) => rate ? `${rate}%` : '-'
              },
              { 
                title: '使用次数', 
                dataIndex: 'usageCount', 
                width: 80,
                sorter: (a: HsCode, b: HsCode) => a.usageCount - b.usageCount
              },
              { 
                title: '状态', 
                dataIndex: 'status', 
                width: 80,
                render: (status: string) => (
                  <Tag color={status === 'active' ? 'green' : 'red'}>
                    {status === 'active' ? '启用' : '禁用'}
                  </Tag>
                )
              },
              {
                title: '操作',
                width: 120,
                fixed: 'right',
                render: (_, record: HsCode) => (
                  <Space>
                    <Button 
                      size="small" 
                      onClick={() => {
                        setEditingHsCode(record);
                        hsCodeForm.setFieldsValue(record);
                      }}
                    >
                      编辑
                    </Button>
                    <Button 
                      size="small" 
                      danger
                      onClick={async () => {
                        try {
                          const response = await fetch(`${API_BASE_URL}/api/hscode/${record.id}`, {
                            method: 'DELETE'
                          });
                          const result = await response.json();
                          if (result.code === 0) {
                            message.success('删除成功');
                            fetchHsCodes();
                          } else {
                            message.error(result.message || '删除失败');
                          }
                        } catch (error) {
                          message.error('删除失败');
                        }
                      }}
                    >
                      删除
                    </Button>
                  </Space>
                )
              }
            ]}
          />
        </div>
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