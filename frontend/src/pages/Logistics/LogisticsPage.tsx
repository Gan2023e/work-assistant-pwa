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
  InputNumber
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
  transferNumber: string;
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
  const [form] = Form.useForm();
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

  // 点击统计卡片时查询对应数据
  const handleStatisticClick = (type: string) => {
    let params: SearchParams = { filters: {} };
    
    switch (type) {
      case 'yearly':
        // 查询今年的所有记录
        params.filters = {};
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
        // 查询即将到仓的记录（通过后端特殊处理）
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
      if (trimmedLine.includes('：')) {
        const [key, value] = trimmedLine.split('：').map(s => s.trim());
        
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
            '产品数': 'productCount'
          };
          
          const fieldName = fieldMap[key];
          if (fieldName) {
            currentUpdates[fieldName] = value;
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
  const formatDate = (dateString: string) => {
    return dateString ? dayjs(dateString).format('MM-DD') : '-';
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
      title: '转单号',
      dataIndex: 'transferNumber',
      key: 'transferNumber',
      width: 120,
      align: 'center',
      render: (text, record) => renderEditableCell(text, record, 'transferNumber'),
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
      render: (text, record) => renderEditableCell(text, record, 'packageCount'),
    },
    {
      title: '产品数',
      dataIndex: 'productCount',
      key: 'productCount',
      width: 80,
      align: 'right',
      render: (text, record) => renderEditableCell(text, record, 'productCount'),
    },
    {
      title: '发出日期',
      dataIndex: 'departureDate',
      key: 'departureDate',
      width: 80,
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
            {formatDate(date)}
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
      render: (price, record) => {
        const isEditing = editingKey === record.shippingId && editingField === 'price';
        if (isEditing) {
          return renderEditableCell(price, record, 'price');
        }
        return price ? `¥${Number(price).toFixed(2)}` : '-';
      },
      align: 'right',
    },
    {
      title: '计费重量',
      dataIndex: 'billingWeight',
      key: 'billingWeight',
      width: 90,
      render: (weight, record) => {
        const isEditing = editingKey === record.shippingId && editingField === 'billingWeight';
        if (isEditing) {
          return renderEditableCell(weight, record, 'billingWeight');
        }
        return weight ? `${Number(weight).toFixed(1)}kg` : '-';
      },
      align: 'right',
    },
    {
      title: '平均计费箱重',
      key: 'avgBoxWeight',
      width: 110,
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
        <Col span={4}>
          <Card style={{ cursor: 'pointer' }} onClick={() => handleStatisticClick('yearly')}>
            <Statistic
              title="今年发货票数"
              value={statisticsData.yearlyCount}
              prefix={<BoxPlotOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card style={{ cursor: 'pointer' }} onClick={() => handleStatisticClick('transit')}>
            <Statistic
              title="在途产品数"
              value={statisticsData.transitProductCount}
              prefix={<TruckOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card style={{ cursor: 'pointer' }} onClick={() => handleStatisticClick('transitPackage')}>
            <Statistic
              title="在途箱数"
              value={statisticsData.transitPackageCount}
              prefix={<BoxPlotOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={4}>
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
        <Col span={4}>
          <Card>
            <div style={{ textAlign: 'center', color: '#666', fontSize: '12px', marginBottom: '8px' }}>
              当前显示数据统计
            </div>
            <div style={{ fontSize: '14px', color: '#333' }}>
              <div>箱数: {currentDataStats.totalPackages}</div>
              <div>产品数: {currentDataStats.totalProducts}</div>
              <div>运费: ¥{currentDataStats.totalFee.toFixed(2)}</div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 搜索区域 */}
      <Card title="搜索和筛选" style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col span={12}>
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
            <Col span={12}>
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
                  <Button
                    icon={<DatabaseOutlined />}
                    onClick={() => setBatchUpdateModalVisible(true)}
                  >
                    批量更新货件详情
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
          <Text strong>请按以下格式输入数据：</Text>
          <pre style={{ backgroundColor: '#f5f5f5', padding: '8px', marginTop: '8px' }}>
{`Shipping ID：FBA18YCL0JBL
渠道：普船卡派
物流节点：周一起航
Shipping ID：FBA18YCL0JBL2
渠道：快船
状态：在途`}
          </pre>
          <TextArea
            rows={10}
            value={batchUpdateText}
            onChange={(e) => {
              setBatchUpdateText(e.target.value);
              setParsedBatchData(parseBatchUpdateText(e.target.value));
            }}
            placeholder="请输入要更新的数据..."
            style={{ marginTop: '16px' }}
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