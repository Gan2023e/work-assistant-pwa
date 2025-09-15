import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Table, 
  Select, 
  Button, 
  Input, 
  message,
  Typography,
  Tabs,
  Space,
  Progress,
  Modal,
  Form,
  DatePicker,
  InputNumber,
  Popconfirm,
  Tooltip
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { 
  BarChartOutlined, 
  DollarOutlined, 
  ShoppingCartOutlined,
  TruckOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExportOutlined,
  CalendarOutlined,
  TagsOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { API_BASE_URL } from '../../config/api';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

const { Option } = Select;
const { Title, Text } = Typography;

// 数据类型定义
interface YearlyStats {
  year: number;
  total_skus: number;
  total_prep_quantity: number;
  total_shipments: number;
  total_shipped_quantity: number;
  total_suppliers: number;
  total_payment_amount: number;
}

interface SkuDetail {
  local_sku: string;
  country: string;
  prep_quantity: number;
  upate_date: string;
  shipped_quantity: number;
  year: number;
}

// 修改供应商统计接口，保持原始数据结构但增加rowSpan和总额字段
interface SupplierStats {
  supplier: string;
  year: number;
  payment_count: number;
  total_payment_amount: number;
  payment_type: string;
  rowSpan?: number; // 用于表格合并行显示
  supplier_total?: number; // 供应商总付款金额
}

// 付款详细记录接口
interface PaymentDetail {
  id: number;
  supplier: string;
  payment_type: string;
  amount: number;
  payment_date: string;
  description?: string;
}

// 供应商发货记录接口
interface SupplierShipmentRecord {
  id: number;
  date: string;
  vendor_sku: string;
  color: string;
  quantity: number;
  create_date: string;
  parent_sku?: string;
  child_sku?: string;
  supplier_name?: string;
}

interface ShipmentSummaryData {
  child_sku: string;
  is_real_child_sku: boolean;
  is_data_missing: boolean;
  dates: { [date: string]: number };
  total: number;
}

const PeakSeasonSummary: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [yearlyStats, setYearlyStats] = useState<YearlyStats[]>([]);
  const [skuDetails, setSkuDetails] = useState<SkuDetail[]>([]);
  const [supplierStats, setSupplierStats] = useState<SupplierStats[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0
  });

  // 付款详细记录模态框状态
  const [paymentDetailVisible, setPaymentDetailVisible] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>([]);
  const [selectedPaymentInfo, setSelectedPaymentInfo] = useState<{
    supplier: string;
    paymentType: string;
    count: number;
  } | null>(null);

  // 供应商发货记录状态
  const [supplierShipments, setSupplierShipments] = useState<SupplierShipmentRecord[]>([]);
  const [shipmentPagination, setShipmentPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0
  });
  const [shipmentFilters, setShipmentFilters] = useState({
    year: undefined as number | undefined,
    supplierName: '',
    vendorSku: [] as string[],
    color: [] as string[]
  });

  // 筛选选项状态
  const [filterOptions, setFilterOptions] = useState({
    suppliers: [] as string[],
    years: [] as number[],
    vendorSkus: [] as string[],
    colors: [] as string[]
  });

  // 编辑相关状态
  const [editingRecord, setEditingRecord] = useState<SupplierShipmentRecord | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  
  // 行内编辑状态
  const [editingCell, setEditingCell] = useState<{recordId: number, field: string} | null>(null);
  const [editingValue, setEditingValue] = useState<any>('');

  // 供应商发货汇总状态
  const [shipmentSummary, setShipmentSummary] = useState<ShipmentSummaryData[]>([]);
  const [summaryDates, setSummaryDates] = useState<string[]>([]);
  const [summaryFilters, setSummaryFilters] = useState({
    year: 2025 as number | undefined
  });

  // 筛选条件
  const [filters, setFilters] = useState({
    year: 2025 as number | undefined, // 默认设置为2025年
    country: undefined as string | undefined,
    local_sku: ''
  });

  const [activeTab, setActiveTab] = useState('supplier-stats');

  // 付款类型优先级映射
  const getPaymentTypePriority = (paymentType: string): number => {
    if (paymentType?.includes('预付')) return 1;
    if (paymentType?.includes('阶段')) return 2;
    if (paymentType?.includes('尾款')) return 3;
    return 4; // 其他
  };

  // 获取年份列表
  const fetchYears = async () => {
    try {
      console.log('正在获取年份列表...');
      const response = await fetch(`${API_BASE_URL}/api/peak-season/years`);
      const data = await response.json();
      console.log('年份API响应:', data);
      if (data.code === 0) {
        setAvailableYears(data.data);
        console.log('设置可用年份:', data.data);
        // 如果没有设置年份，设置最新年份
        if (!filters.year && data.data.length > 0) {
          setFilters(prev => ({ ...prev, year: data.data[0] }));
          console.log('设置默认年份:', data.data[0]);
        }
      }
    } catch (error) {
      console.error('获取年份列表失败:', error);
    }
  };

  // 获取年度统计
  const fetchYearlyStats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.append('year', filters.year.toString());
      if (filters.country) params.append('country', filters.country);
      if (filters.local_sku) params.append('local_sku', filters.local_sku);

      console.log('正在获取年度统计，参数:', params.toString(), '当前筛选条件:', filters);
      const response = await fetch(`${API_BASE_URL}/api/peak-season/summary?${params}`);
      const data = await response.json();
      console.log('年度统计API响应:', data);
      if (data.code === 0) {
        setYearlyStats(data.data);
        console.log('设置年度统计数据:', data.data);
      } else {
        console.error('年度统计API返回错误:', data.message);
        message.error(data.message);
      }
    } catch (error) {
      console.error('获取年度统计失败:', error);
      message.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取SKU详细信息
  const fetchSkuDetails = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.append('year', filters.year.toString());
      if (filters.country) params.append('country', filters.country);
      if (filters.local_sku) params.append('local_sku', filters.local_sku);
      params.append('page', page.toString());
      params.append('limit', pagination.pageSize.toString());

      console.log('正在获取SKU详情，参数:', params.toString());
      const response = await fetch(`${API_BASE_URL}/api/peak-season/sku-details?${params}`);
      const data = await response.json();
      console.log('SKU详情API响应:', data);
      if (data.code === 0) {
        setSkuDetails(data.data.records);
        setPagination(prev => ({
          ...prev,
          current: data.data.pagination.current,
          total: data.data.pagination.total
        }));
        console.log('设置SKU详情数据:', data.data.records);
      } else {
        console.error('SKU详情API返回错误:', data.message);
        message.error(data.message);
      }
    } catch (error) {
      console.error('获取SKU详细信息失败:', error);
      message.error('获取SKU详细信息失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取供应商统计 - 修改为不合并数据，但计算rowSpan用于表格显示
  const fetchSupplierStats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.append('year', filters.year.toString());

      console.log('正在获取供应商统计，参数:', params.toString());
      const response = await fetch(`${API_BASE_URL}/api/peak-season/supplier-stats?${params}`);
      const data = await response.json();
      console.log('供应商统计API响应:', data);
      if (data.code === 0) {
        console.log('原始供应商数据:', data.data);
        // 处理数据，为表格合并行做准备
        const processedStats = processSupplierStatsForDisplay(data.data);
        setSupplierStats(processedStats);
        console.log('设置处理后的供应商统计数据:', processedStats);
        console.log('总计金额计算结果:', calculateGrandTotal());
      } else {
        console.error('供应商统计API返回错误:', data.message);
        message.error(data.message);
      }
    } catch (error) {
      console.error('获取供应商统计失败:', error);
      message.error('获取供应商统计失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取付款详细记录
  const fetchPaymentDetails = async (supplier: string, paymentType: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.append('year', filters.year.toString());
      params.append('supplier', supplier);
      params.append('payment_type', paymentType);

      console.log('正在获取付款详细记录，参数:', params.toString());
      const response = await fetch(`${API_BASE_URL}/api/peak-season/payment-details?${params}`);
      const data = await response.json();
      
      if (data.code === 0) {
        setPaymentDetails(data.data);
        console.log('设置付款详细记录:', data.data);
      } else {
        console.error('付款详细记录API返回错误:', data.message);
        message.error(data.message);
        setPaymentDetails([]);
      }
    } catch (error) {
      console.error('获取付款详细记录失败:', error);
      message.error('获取付款详细记录失败');
      setPaymentDetails([]);
    } finally {
      setLoading(false);
    }
  };

  // 获取筛选选项
  const fetchFilterOptions = async (supplierName?: string, vendorSku?: string[]) => {
    try {
      const params = new URLSearchParams();
      if (supplierName) params.append('supplierName', supplierName);
      if (vendorSku && vendorSku.length > 0) params.append('vendorSku', vendorSku.join(','));
      
      const response = await fetch(`${API_BASE_URL}/api/peak-season/supplier-shipments-filters?${params}`);
      const data = await response.json();
      
      if (data.code === 0) {
        setFilterOptions(data.data);
      }
    } catch (error) {
      console.error('获取筛选选项失败:', error);
    }
  };

  // 双击单元格编辑
  const handleCellDoubleClick = (record: SupplierShipmentRecord, field: string) => {
    // 允许编辑的字段
    const editableFields = ['date', 'vendor_sku', 'color', 'quantity', 'supplier_name', 'parent_sku', 'child_sku'];
    if (editableFields.includes(field)) {
      setEditingCell({ recordId: record.id, field });
      // 设置当前编辑值
      let currentValue = record[field as keyof SupplierShipmentRecord];
      if (field === 'date') {
        currentValue = currentValue ? new Date(currentValue as string).toISOString().split('T')[0] : '';
      }
      setEditingValue(currentValue || '');
    }
  };

  // 更新记录
  const handleUpdateRecord = async (values: any) => {
    if (!editingRecord) return;
    
    try {
      const updateData = {
        date: values.date.format('YYYY-MM-DD'),
        vendor_sku: values.vendor_sku,
        color: values.color,
        quantity: values.quantity
      };
      
      // 提示用户关于其他字段的修改
      const warnings = [];
      if (values.supplier_name && values.supplier_name !== editingRecord.supplier_name) {
        warnings.push('供应商信息');
      }
      if (values.parent_sku && values.parent_sku !== editingRecord.parent_sku) {
        warnings.push('Parent SKU');
      }
      if (values.child_sku && values.child_sku !== editingRecord.child_sku) {
        warnings.push('Child SKU');
      }
      
      if (warnings.length > 0) {
        message.warning(`注意：${warnings.join('、')} 的修改仅影响当前记录显示，建议到相关管理页面进行源数据维护`);
      }

      const response = await fetch(`${API_BASE_URL}/api/peak-season/supplier-shipments/${editingRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      const data = await response.json();
      
      if (data.code === 0) {
        message.success('基本信息更新成功（发货日期、卖家货号、颜色、数量）');
        setEditModalVisible(false);
        setEditingRecord(null);
        fetchSupplierShipments(shipmentPagination.current);
      } else {
        message.error(data.message);
      }
    } catch (error) {
      console.error('更新失败:', error);
      message.error('更新失败');
    }
  };

  // 删除记录
  const handleDeleteRecord = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/peak-season/supplier-shipments/${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.code === 0) {
        message.success('删除成功');
        fetchSupplierShipments(shipmentPagination.current);
      } else {
        message.error(data.message);
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 保存行内编辑
  const handleSaveInlineEdit = async () => {
    if (!editingCell) return;
    
    const record = supplierShipments.find(r => r.id === editingCell.recordId);
    if (!record) return;

    try {
      // 构建更新数据
      const updateData: any = {
        date: record.date,
        vendor_sku: record.vendor_sku,
        color: record.color,
        quantity: record.quantity
      };
      
      // 更新特定字段
      if (editingCell.field === 'date') {
        updateData.date = editingValue;
      } else if (editingCell.field === 'vendor_sku') {
        updateData.vendor_sku = editingValue;
      } else if (editingCell.field === 'color') {
        updateData.color = editingValue;
      } else if (editingCell.field === 'quantity') {
        updateData.quantity = parseInt(editingValue);
        if (isNaN(updateData.quantity) || updateData.quantity < 0) {
          message.error('数量必须为非负数字');
          return;
        }
      } else if (editingCell.field === 'supplier_name') {
        // 供应商字段比较特殊，需要通过parent_sku关联更新
        Modal.confirm({
          title: '修改供应商信息',
          content: (
            <div>
              <p>供应商信息是通过Parent SKU关联的产品链接表维护的。</p>
              <p>直接修改可能会影响使用相同Parent SKU的其他记录。</p>
              <p><strong>建议操作：</strong></p>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li>到"产品管理 → 产品链接"页面修改</li>
                <li>或者修改对应的Parent SKU信息</li>
              </ul>
              <p style={{ marginTop: '12px' }}>是否仍要继续修改当前显示的供应商名称？</p>
            </div>
          ),
          okText: '继续修改',
          cancelText: '取消',
          onOk: () => {
            // 如果用户确认要修改，给出更新说明
            message.info('注意：此修改仅影响当前记录的显示，不会更新产品链接表中的原始数据');
            // 这里可以添加实际的更新逻辑，但只更新显示
            setEditingCell(null);
            setEditingValue('');
          },
          onCancel: () => {
            setEditingCell(null);
            setEditingValue('');
          }
        });
        return;
      } else if (editingCell.field === 'parent_sku' || editingCell.field === 'child_sku') {
        // 这些字段在另外的表中，暂时不支持直接编辑
        Modal.info({
          title: '字段说明',
          content: (
            <div>
              <p><strong>{editingCell.field === 'parent_sku' ? 'Parent SKU' : 'Child SKU'}</strong> 在其他数据表中维护：</p>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li>{editingCell.field === 'parent_sku' ? 'Parent SKU：在"产品管理 → 产品链接"页面维护' : 'Child SKU：在"库存管理"相关页面维护'}</li>
                <li>修改后会自动关联到发货记录</li>
              </ul>
            </div>
          ),
          onOk: () => {
            setEditingCell(null);
            setEditingValue('');
          }
        });
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/peak-season/supplier-shipments/${editingCell.recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      const data = await response.json();
      
      if (data.code === 0) {
        message.success('更新成功');
        setEditingCell(null);
        setEditingValue('');
        fetchSupplierShipments(shipmentPagination.current);
      } else {
        message.error(data.message);
      }
    } catch (error) {
      console.error('更新失败:', error);
      message.error('更新失败');
    }
  };

  // 取消行内编辑
  const handleCancelInlineEdit = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  // 获取供应商发货记录
  const fetchSupplierShipments = async (page: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (shipmentFilters.year) params.append('year', shipmentFilters.year.toString());
      if (shipmentFilters.supplierName) params.append('supplierName', shipmentFilters.supplierName);
      if (shipmentFilters.vendorSku && shipmentFilters.vendorSku.length > 0) {
        params.append('vendorSku', shipmentFilters.vendorSku.join(','));
      }
      if (shipmentFilters.color && shipmentFilters.color.length > 0) {
        params.append('color', shipmentFilters.color.join(','));
      }
      params.append('page', page.toString());
      params.append('limit', shipmentPagination.pageSize.toString());

      console.log('正在获取供应商发货记录，参数:', params.toString());
      const response = await fetch(`${API_BASE_URL}/api/peak-season/supplier-shipments?${params}`);
      const data = await response.json();
      
      if (data.code === 0) {
        setSupplierShipments(data.data.records);
        setShipmentPagination(prev => ({
          ...prev,
          current: data.data.pagination.current,
          total: data.data.pagination.total
        }));
        console.log('设置供应商发货记录:', data.data);
      } else {
        console.error('供应商发货记录API返回错误:', data.message);
        message.error(data.message);
      }
    } catch (error) {
      console.error('获取供应商发货记录失败:', error);
      message.error('获取供应商发货记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取供应商发货汇总数据
  const fetchShipmentSummary = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (summaryFilters.year) params.append('year', summaryFilters.year.toString());

      console.log('正在获取供应商发货汇总数据，参数:', params.toString());
      const response = await fetch(`${API_BASE_URL}/api/peak-season/supplier-shipments-summary?${params}`);
      const data = await response.json();
      
      if (data.code === 0) {
        setShipmentSummary(data.data.summary);
        setSummaryDates(data.data.dates);
        console.log('设置供应商发货汇总数据:', data.data);
      } else {
        console.error('供应商发货汇总API返回错误:', data.message);
        message.error(data.message);
      }
    } catch (error) {
      console.error('获取供应商发货汇总失败:', error);
      message.error('获取供应商发货汇总失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理供应商统计数据，计算rowSpan用于表格合并显示，并按付款类型优先级排序
  const processSupplierStatsForDisplay = (rawData: any[]): SupplierStats[] => {
    // 先按供应商和年份分组
    const grouped = new Map<string, any[]>();
    rawData.forEach(item => {
      const key = `${item.supplier}-${item.year}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      // 确保金额是数值类型
      item.total_payment_amount = parseFloat(item.total_payment_amount) || 0;
      item.payment_count = parseInt(item.payment_count) || 0;
      grouped.get(key)!.push(item);
    });

    const result: SupplierStats[] = [];
    
    // 处理每个供应商组
    grouped.forEach((items, groupKey) => {
      // 计算供应商总付款金额 - 确保数值计算
      const supplierTotal = items.reduce((sum, item) => {
        const amount = parseFloat(item.total_payment_amount) || 0;
        return sum + amount;
      }, 0);
      
      // 按付款类型优先级排序：预付款 -> 阶段付款 -> 尾款 -> 其他
      items.sort((a, b) => {
        const priorityA = getPaymentTypePriority(a.payment_type);
        const priorityB = getPaymentTypePriority(b.payment_type);
        if (priorityA !== priorityB) {
          return priorityA - priorityB; // 优先级升序
        }
        // 如果优先级相同，按付款金额降序
        const amountA = parseFloat(a.total_payment_amount) || 0;
        const amountB = parseFloat(b.total_payment_amount) || 0;
        return amountB - amountA;
      });
      
      items.forEach((item, index) => {
        result.push({
          supplier: item.supplier,
          year: item.year,
          payment_count: parseInt(item.payment_count) || 0,
          total_payment_amount: parseFloat(item.total_payment_amount) || 0,
          payment_type: item.payment_type,
          rowSpan: index === 0 ? items.length : 0, // 第一行显示rowSpan，其他行为0
          supplier_total: supplierTotal // 每一行都保存供应商总额，但只在第一行显示
        });
      });
    });

    // 按供应商总付款金额降序排序
    const supplierTotals = new Map<string, number>();
    result.forEach(item => {
      const key = `${item.supplier}-${item.year}`;
      if (!supplierTotals.has(key)) {
        supplierTotals.set(key, item.supplier_total || 0);
      }
    });

    result.sort((a, b) => {
      const keyA = `${a.supplier}-${a.year}`;
      const keyB = `${b.supplier}-${b.year}`;
      const totalA = supplierTotals.get(keyA) || 0;
      const totalB = supplierTotals.get(keyB) || 0;
      if (totalA !== totalB) {
        return totalB - totalA; // 按总金额降序
      }
      // 如果是同一供应商，保持付款类型优先级顺序
      return 0;
    });

    return result;
  };

  // 修正总计计算 - 只计算每个供应商的总额一次
  const calculateGrandTotal = (): number => {
    const supplierTotals = new Map<string, number>();
    
    // 收集每个供应商的总额，避免重复计算
    supplierStats.forEach(item => {
      if (item.rowSpan && item.rowSpan > 0) { // 只计算每个供应商的第一行（有rowSpan的行）
        const key = `${item.supplier}-${item.year}`;
        const total = parseFloat(String(item.supplier_total)) || 0;
        supplierTotals.set(key, total);
      }
    });
    
    // 计算所有供应商的总额 - 确保数值相加
    return Array.from(supplierTotals.values()).reduce((total, amount) => {
      const numAmount = parseFloat(String(amount)) || 0;
      return total + numAmount;
    }, 0);
  };

  // 点击付款单数时显示详细记录
  const handleShowPaymentDetails = (supplier: string, paymentType: string, count: number) => {
    setSelectedPaymentInfo({ supplier, paymentType, count });
    fetchPaymentDetails(supplier, paymentType);
    setPaymentDetailVisible(true);
  };

  // 初始化数据
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    console.log('组件初始化，开始获取数据...');
    fetchYears();
    fetchFilterOptions(); // 获取筛选选项
    // 立即尝试获取统计数据
    fetchYearlyStats();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    console.log('筛选条件或标签页变化，重新获取数据...', { filters, activeTab });
    fetchYearlyStats();
    if (activeTab === 'sku-details') {
      fetchSkuDetails(1);
    } else if (activeTab === 'supplier-stats') {
      fetchSupplierStats();
    }
  }, [filters.year, filters.country, filters.local_sku, activeTab]);

  // Tab切换处理
  const handleTabChange = (key: string) => {
    console.log('切换标签页:', key);
    setActiveTab(key);
    if (key === 'sku-details') {
      fetchSkuDetails(1);
    } else if (key === 'supplier-stats') {
      fetchSupplierStats();
    } else if (key === 'supplier-shipments') {
      fetchFilterOptions(); // 获取筛选选项
      fetchSupplierShipments(1);
    } else if (key === 'supplier-shipments-summary') {
      fetchShipmentSummary();
    }
  };

  // 搜索处理
  const handleSearch = () => {
    console.log('执行搜索...');
    if (activeTab === 'sku-details') {
      fetchSkuDetails(1);
    } else if (activeTab === 'supplier-stats') {
      fetchSupplierStats();
    } else if (activeTab === 'supplier-shipments') {
      fetchSupplierShipments(1);
    } else if (activeTab === 'supplier-shipments-summary') {
      fetchShipmentSummary();
    }
  };

  // 重置筛选条件
  const handleReset = () => {
    console.log('重置筛选条件...');
    setFilters({
      year: availableYears[0] || 2025,
      country: undefined,
      local_sku: ''
    });
  };

  // 导出Excel
  const handleExport = () => {
    let dataToExport: any[] = [];
    let filename = '';

    if (activeTab === 'sku-details') {
      dataToExport = skuDetails.map(item => ({
        本地SKU: item.local_sku,
        国家: item.country,
        年份: item.year,
        备货数量: item.prep_quantity,
        更新日期: item.upate_date,
        已发货数量: item.shipped_quantity
      }));
      filename = `旺季备货SKU详情_${filters.year || '全部'}.xlsx`;
    } else if (activeTab === 'supplier-stats') {
      dataToExport = supplierStats.map(item => ({
        供应商: item.supplier,
        年份: item.year,
        付款类型: item.payment_type,
        付款单数: item.payment_count,
        付款金额: item.total_payment_amount,
        供应商总额: item.supplier_total
      }));
      filename = `旺季备货付款统计_${filters.year || '全部'}.xlsx`;
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, filename);
  };

  // SKU详情表格列
  const skuColumns: ColumnsType<SkuDetail> = [
    {
      title: '本地SKU',
      dataIndex: 'local_sku',
      key: 'local_sku',
      fixed: 'left',
      width: 120,
      align: 'center',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 100,
      align: 'center'
    },
    {
      title: '年份',
      dataIndex: 'year',
      key: 'year',
      width: 80,
      align: 'center'
    },
    {
      title: '备货数量',
      dataIndex: 'prep_quantity',
      key: 'prep_quantity',
      width: 100,
      align: 'center',
      render: (value) => value?.toLocaleString()
    },
    {
      title: '更新日期',
      dataIndex: 'upate_date',
      key: 'upate_date',
      width: 120,
      align: 'center',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-'
    },
    {
      title: '已发货数量',
      dataIndex: 'shipped_quantity',
      key: 'shipped_quantity',
      width: 120,
      align: 'center',
      render: (value) => value?.toLocaleString() || 0
    },
    {
      title: '发货完成率',
      key: 'completion_rate',
      width: 120,
      align: 'center',
      render: (_, record) => {
        const rate = record.prep_quantity > 0 ? 
          (record.shipped_quantity / record.prep_quantity * 100) : 0;
        return (
          <Progress 
            percent={Math.min(rate, 100)} 
            size="small" 
            format={() => `${rate.toFixed(1)}%`}
          />
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Button type="link" size="small">
          详情
        </Button>
      )
    }
  ];

  // 修改后的付款统计表格列 - 支持合并行显示同一供应商，增加总额列，付款单数可点击
  const supplierColumns: ColumnsType<SupplierStats> = [
    {
      title: '供应商',
      dataIndex: 'supplier',
      key: 'supplier',
      fixed: 'left',
      width: 150,
      align: 'center',
      render: (text, record) => {
        const obj = {
          children: <Text strong>{text}</Text>,
          props: {} as any,
        };
        if (record.rowSpan) {
          obj.props.rowSpan = record.rowSpan;
        } else {
          obj.props.rowSpan = 0;
        }
        return obj;
      }
    },
    {
      title: '年份',
      dataIndex: 'year',
      key: 'year',
      width: 80,
      align: 'center',
      render: (text, record) => {
        const obj = {
          children: text,
          props: {} as any,
        };
        if (record.rowSpan) {
          obj.props.rowSpan = record.rowSpan;
        } else {
          obj.props.rowSpan = 0;
        }
        return obj;
      }
    },
    {
      title: '付款类型',
      dataIndex: 'payment_type',
      key: 'payment_type',
      width: 150,
      align: 'center',
      render: (text) => {
        // 给不同付款类型添加颜色标识
        let color = '#108ee9';
        if (text?.includes('预付')) color = '#87d068';
        else if (text?.includes('尾款')) color = '#f50';
        else if (text?.includes('阶段')) color = '#2db7f5';
        
        return <Text style={{ color }}>{text}</Text>;
      }
    },
    {
      title: '付款单数',
      dataIndex: 'payment_count',
      key: 'payment_count',
      width: 100,
      align: 'center',
      render: (value, record) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />}
          onClick={() => handleShowPaymentDetails(record.supplier, record.payment_type, value)}
          style={{ padding: 0, color: '#1890ff' }}
        >
          {value?.toLocaleString()}
        </Button>
      )
    },
    {
      title: '付款金额',
      dataIndex: 'total_payment_amount',
      key: 'total_payment_amount',
      width: 140,
      align: 'right',
      render: (value) => value ? `¥${value.toLocaleString()}` : '-'
    },
    {
      title: '总额',
      dataIndex: 'supplier_total',
      key: 'supplier_total',
      width: 140,
      align: 'right',
      render: (value, record) => {
        const obj = {
          children: record.rowSpan ? (
            <Text strong style={{ color: '#1890ff' }}>
              ¥{value?.toLocaleString() || '-'}
            </Text>
          ) : null,
          props: {} as any,
        };
        if (record.rowSpan) {
          obj.props.rowSpan = record.rowSpan;
        } else {
          obj.props.rowSpan = 0;
        }
        return obj;
      }
    }
  ];

  // 供应商发货记录表格列
  const shipmentColumns: ColumnsType<SupplierShipmentRecord> = [
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 150,
      align: 'center',
      fixed: 'left',
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'supplier_name')
      }),
      render: (text, record) => {
        // 检查是否正在编辑这个单元格
        const isEditing = editingCell?.recordId === record.id && editingCell?.field === 'supplier_name';
        
        if (isEditing) {
          return (
            <Input
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onPressEnter={handleSaveInlineEdit}
              onBlur={handleSaveInlineEdit}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleCancelInlineEdit();
                }
              }}
              autoFocus
              size="small"
              style={{ width: '100%' }}
            />
          );
        }

        if (!text || text === '-') {
          return <Text type="secondary" style={{ cursor: 'pointer' }}>-</Text>;
        }
        const isNoSupplier = text === '无供应商信息';
        return (
          <Text 
            strong 
            style={{ 
              color: isNoSupplier ? '#faad14' : '#f50',
              cursor: 'pointer',
              backgroundColor: isNoSupplier ? '#fffbe6' : 'transparent',
              padding: isNoSupplier ? '2px 6px' : '0',
              borderRadius: isNoSupplier ? '4px' : '0'
            }}
          >
            {text}
          </Text>
        );
      }
    },
    {
      title: 'Parent SKU',
      dataIndex: 'parent_sku',
      key: 'parent_sku',
      width: 150,
      align: 'center',
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'parent_sku')
      }),
      render: (text, record) => {
        const isEditing = editingCell?.recordId === record.id && editingCell?.field === 'parent_sku';
        
        if (isEditing) {
          return (
            <Input
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onPressEnter={handleSaveInlineEdit}
              onBlur={handleSaveInlineEdit}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleCancelInlineEdit();
                }
              }}
              autoFocus
              size="small"
              style={{ width: '100%' }}
            />
          );
        }

        return text ? <Text style={{ color: '#1890ff', cursor: 'pointer' }}>{text}</Text> : <Text type="secondary" style={{ cursor: 'pointer' }}>-</Text>;
      }
    },
    {
      title: 'Child SKU',
      dataIndex: 'child_sku',
      key: 'child_sku',
      width: 150,
      align: 'center',
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'child_sku')
      }),
      render: (text, record) => {
        const isEditing = editingCell?.recordId === record.id && editingCell?.field === 'child_sku';
        
        if (isEditing) {
          return (
            <Input
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onPressEnter={handleSaveInlineEdit}
              onBlur={handleSaveInlineEdit}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleCancelInlineEdit();
                }
              }}
              autoFocus
              size="small"
              style={{ width: '100%' }}
            />
          );
        }

        return text ? <Text style={{ color: '#52c41a', cursor: 'pointer' }}>{text}</Text> : <Text type="secondary" style={{ cursor: 'pointer' }}>-</Text>;
      }
    },
    {
      title: '发货日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      align: 'center',
      sorter: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'date')
      }),
      render: (text, record) => {
        const isEditing = editingCell?.recordId === record.id && editingCell?.field === 'date';
        
        if (isEditing) {
          return (
            <Input
              type="date"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onPressEnter={handleSaveInlineEdit}
              onBlur={handleSaveInlineEdit}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleCancelInlineEdit();
                }
              }}
              autoFocus
              size="small"
              style={{ width: '100%' }}
            />
          );
        }

        return <Text style={{ cursor: 'pointer' }}>{text}</Text>;
      }
    },
    {
      title: '卖家货号',
      dataIndex: 'vendor_sku',
      key: 'vendor_sku',
      width: 150,
      align: 'center',
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'vendor_sku')
      }),
      render: (text, record) => {
        const isEditing = editingCell?.recordId === record.id && editingCell?.field === 'vendor_sku';
        
        if (isEditing) {
          return (
            <Input
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onPressEnter={handleSaveInlineEdit}
              onBlur={handleSaveInlineEdit}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleCancelInlineEdit();
                }
              }}
              autoFocus
              size="small"
              style={{ width: '100%' }}
            />
          );
        }

        return <Text strong style={{ cursor: 'pointer' }}>{text}</Text>;
      }
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      width: 120,
      align: 'center',
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'color')
      }),
      render: (text, record) => {
        const isEditing = editingCell?.recordId === record.id && editingCell?.field === 'color';
        
        if (isEditing) {
          return (
            <Input
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onPressEnter={handleSaveInlineEdit}
              onBlur={handleSaveInlineEdit}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleCancelInlineEdit();
                }
              }}
              autoFocus
              size="small"
              style={{ width: '100%' }}
            />
          );
        }

        return <Text style={{ cursor: 'pointer' }}>{text}</Text>;
      }
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.quantity - b.quantity,
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'quantity')
      }),
      render: (value, record) => {
        const isEditing = editingCell?.recordId === record.id && editingCell?.field === 'quantity';
        
        if (isEditing) {
          return (
            <InputNumber
              value={editingValue}
              onChange={(value) => setEditingValue(value)}
              onPressEnter={handleSaveInlineEdit}
              onBlur={handleSaveInlineEdit}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleCancelInlineEdit();
                }
              }}
              autoFocus
              size="small"
              min={0}
              style={{ width: '100%' }}
            />
          );
        }

        return <Text strong style={{ color: '#1890ff', cursor: 'pointer' }}>{value?.toLocaleString()}</Text>;
      }
    },
    {
      title: '录入时间',
      dataIndex: 'create_date',
      key: 'create_date',
      width: 150,
      align: 'center',
      render: (value) => value ? new Date(value).toLocaleString() : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingRecord(record);
              setEditModalVisible(true);
            }}
            title="编辑"
          />
          <Popconfirm
            title="确定要删除这条记录吗？"
            onConfirm={() => handleDeleteRecord(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              icon={<DeleteOutlined />}
              danger
              title="删除"
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 汇总表格列定义（动态生成）
  const createSummaryColumns = (): ColumnsType<ShipmentSummaryData> => {
    const columns: ColumnsType<ShipmentSummaryData> = [
      {
        title: 'Child SKU',
        dataIndex: 'child_sku',
        key: 'child_sku',
        width: 150,
        align: 'center',
        fixed: 'left',
        render: (text, record) => {
          if (record.is_real_child_sku) {
            // 真正的子SKU，显示为蓝色加粗
            return <Text strong style={{ color: '#1890ff' }}>{text}</Text>;
          } else if (record.is_data_missing) {
            // 数据缺失，显示为红色警告
            return <Text style={{ color: '#f5222d', fontWeight: 'bold' }}>{text}</Text>;
          } else {
            // Vendor SKU + 颜色组合，显示为橙色斜体
            return <Text style={{ color: '#fa8c16', fontStyle: 'italic' }}>{text}</Text>;
          }
        }
      }
    ];

    // 动态添加日期列
    summaryDates.forEach(date => {
      columns.push({
        title: date,
        key: date,
        width: 100,
        align: 'center',
        render: (_, record) => {
          const quantity = record.dates[date] || 0;
          return quantity > 0 ? (
            <Text style={{ color: '#52c41a', fontWeight: 'bold' }}>
              {quantity.toLocaleString()}
            </Text>
          ) : (
            <Text type="secondary">-</Text>
          );
        }
      });
    });

    // 添加合计列
    columns.push({
      title: '合计',
      dataIndex: 'total',
      key: 'total',
      width: 100,
      align: 'center',
      fixed: 'right',
      render: (value) => <Text strong style={{ color: '#f5222d' }}>{value.toLocaleString()}</Text>
    });

    return columns;
  };

  // 付款详细记录表格列
  const paymentDetailColumns: ColumnsType<PaymentDetail> = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_, record, index) => index + 1
    },
    {
      title: '付款金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right',
      render: (value) => `¥${value.toLocaleString()}`
    },
    {
      title: '付款日期',
      dataIndex: 'payment_date',
      key: 'payment_date',
      width: 120,
      align: 'center',
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: '备注',
      dataIndex: 'description',
      key: 'description',
      align: 'center',
      render: (text) => text || '-'
    }
  ];

  console.log('组件渲染，当前状态:', { yearlyStats, skuDetails, supplierStats, filters, loading });

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>
          <BarChartOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
          旺季备货汇总
        </Title>
        
        {/* 调试信息 */}
        <Card size="small" style={{ marginBottom: '16px', backgroundColor: '#f6f6f6' }}>
          <Text type="secondary">
            调试信息: 年度统计数据数量：{yearlyStats.length}，SKU详情数据数量：{skuDetails.length}，
            付款统计数据数量：{supplierStats.length}，当前年份：{filters.year}，加载状态：{loading ? '加载中' : '已完成'}
          </Text>
        </Card>
        
        {/* 筛选条件 */}
        <Card size="small" style={{ marginBottom: '16px' }}>
          <Row gutter={16} align="middle">
            <Col>
              <Space>
                <CalendarOutlined />
                <Text>年份:</Text>
                <Select
                  value={filters.year}
                  onChange={(value) => setFilters(prev => ({ ...prev, year: value }))}
                  style={{ width: 120 }}
                  placeholder="选择年份"
                >
                  <Option value={undefined}>全部</Option>
                  {availableYears.map(year => (
                    <Option key={year} value={year}>{year}</Option>
                  ))}
                </Select>
              </Space>
            </Col>
            <Col>
              <Space>
                <TagsOutlined />
                <Text>国家:</Text>
                <Input
                  value={filters.country}
                  onChange={(e) => setFilters(prev => ({ ...prev, country: e.target.value }))}
                  style={{ width: 120 }}
                  placeholder="输入国家"
                />
              </Space>
            </Col>
            {activeTab === 'sku-details' && (
              <Col>
                <Space>
                  <Text>SKU:</Text>
                  <Input
                    value={filters.local_sku}
                    onChange={(e) => setFilters(prev => ({ ...prev, local_sku: e.target.value }))}
                    placeholder="搜索本地SKU"
                    style={{ width: 200 }}
                    prefix={<SearchOutlined />}
                  />
                </Space>
              </Col>
            )}
            <Col>
              <Space>
                <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                  查询
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重置
                </Button>
                <Button icon={<ExportOutlined />} onClick={handleExport}>
                  导出Excel
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 年度统计概览 */}
        {yearlyStats.length > 0 ? (
          <Row gutter={16} style={{ marginBottom: '24px' }}>
            {yearlyStats.map((stats) => (
              <Col span={24} key={stats.year}>
                <Card title={`${stats.year}年度统计`} size="small">
                  <Row gutter={16}>
                    <Col span={4}>
                      <Statistic
                        title="备货SKU数"
                        value={stats.total_skus}
                        prefix={<TagsOutlined />}
                        suffix="个"
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic
                        title="备货总数量"
                        value={stats.total_prep_quantity}
                        prefix={<ShoppingCartOutlined />}
                        suffix="件"
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic
                        title="发货记录数"
                        value={stats.total_shipments}
                        prefix={<TruckOutlined />}
                        suffix="个"
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic
                        title="发货总数量"
                        value={stats.total_shipped_quantity || 0}
                        prefix={<ShoppingCartOutlined />}
                        suffix="件"
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic
                        title="供应商数"
                        value={stats.total_suppliers}
                        prefix={<TagsOutlined />}
                        suffix="家"
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic
                        title="付款总额"
                        value={stats.total_payment_amount}
                        prefix={<DollarOutlined />}
                        suffix="元"
                        precision={2}
                      />
                    </Col>
                  </Row>
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Card style={{ marginBottom: '24px', textAlign: 'center' }}>
            <Text type="secondary">暂无年度统计数据，正在加载中...</Text>
          </Card>
        )}
      </div>

      {/* 详细数据表格 - 调整tab顺序，付款统计放在第二位 */}
      <Card>
        <Tabs activeKey={activeTab} onChange={handleTabChange}>
          <Tabs.TabPane tab="付款统计" key="supplier-stats">
            <div>
              <Table
                columns={supplierColumns}
                dataSource={supplierStats}
                rowKey={(record, index) => `${record.supplier}-${record.year}-${record.payment_type}-${index}`}
                loading={loading}
                scroll={{ x: 700 }}
                pagination={false}
                size="small"
                bordered
                summary={() => (
                  <Table.Summary.Row style={{ backgroundColor: '#fafafa' }}>
                    <Table.Summary.Cell index={0} colSpan={5} align="center">
                      <Text strong style={{ fontSize: '16px' }}>全部供应商总计</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="center">
                      <Text strong style={{ fontSize: '16px', color: '#1890ff' }}>
                        ¥{calculateGrandTotal().toLocaleString()}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane tab="SKU详情" key="sku-details">
            <Table
              columns={skuColumns}
              dataSource={skuDetails}
              rowKey="local_sku"
              loading={loading}
              scroll={{ x: 800 }}
              pagination={{
                ...pagination,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
                onChange: fetchSkuDetails
              }}
              size="small"
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab="供应商发货记录" key="supplier-shipments">
            <div style={{ marginBottom: 16 }}>
              <Space wrap>
                <Select
                  placeholder="选择供应商"
                  value={shipmentFilters.supplierName || undefined}
                  onChange={(value) => {
                    setShipmentFilters(prev => ({ 
                      ...prev, 
                      supplierName: value || '',
                      vendorSku: [], // 清空卖家货号
                      color: [] // 清空颜色
                    }));
                    // 根据选择的供应商更新筛选选项
                    fetchFilterOptions(value);
                  }}
                  style={{ width: 150 }}
                  allowClear
                  showSearch
                  filterOption={(input, option) =>
                    (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {filterOptions.suppliers.map(supplier => (
                    <Option key={supplier} value={supplier}>{supplier}</Option>
                  ))}
                </Select>
                <Select
                  mode="multiple"
                  placeholder="选择卖家货号"
                  value={shipmentFilters.vendorSku}
                  onChange={(value) => {
                    setShipmentFilters(prev => ({ 
                      ...prev, 
                      vendorSku: value,
                      color: [] // 清空颜色
                    }));
                    // 根据选择的卖家货号更新颜色选项
                    fetchFilterOptions(shipmentFilters.supplierName || undefined, value);
                  }}
                  style={{ width: 200 }}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {filterOptions.vendorSkus.map(sku => (
                    <Option key={sku} value={sku}>{sku}</Option>
                  ))}
                </Select>
                <Select
                  mode="multiple"
                  placeholder="选择颜色"
                  value={shipmentFilters.color}
                  onChange={(value) => setShipmentFilters(prev => ({ ...prev, color: value }))}
                  style={{ width: 180 }}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {filterOptions.colors.map(color => (
                    <Option key={color} value={color}>{color}</Option>
                  ))}
                </Select>
                <Select
                  placeholder="选择年份"
                  value={shipmentFilters.year}
                  onChange={(value) => setShipmentFilters(prev => ({ ...prev, year: value }))}
                  style={{ width: 120 }}
                  allowClear
                >
                  {filterOptions.years.map(year => (
                    <Option key={year} value={year}>{year}年</Option>
                  ))}
                </Select>
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={() => fetchSupplierShipments(1)}
                >
                  搜索
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    // 重置筛选状态
                    setShipmentFilters({
                      year: undefined,
                      supplierName: '',
                      vendorSku: [],
                      color: []
                    });
                    // 重新获取筛选选项
                    fetchFilterOptions();
                    // 刷新数据
                    fetchSupplierShipments(1);
                  }}
                >
                  刷新
                </Button>
              </Space>
            </div>
            <Table
              columns={shipmentColumns}
              dataSource={supplierShipments}
              rowKey="id"
              loading={loading}
              scroll={{ x: 1000 }}
              pagination={{
                ...shipmentPagination,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
                onChange: fetchSupplierShipments
              }}
              size="small"
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab="供应商发货汇总" key="supplier-shipments-summary">
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Select
                  placeholder="选择年份"
                  value={summaryFilters.year}
                  onChange={(value) => setSummaryFilters(prev => ({ ...prev, year: value }))}
                  style={{ width: 120 }}
                  allowClear
                >
                  {availableYears.map(year => (
                    <Option key={year} value={year}>{year}年</Option>
                  ))}
                </Select>
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={fetchShipmentSummary}
                >
                  查询
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={fetchShipmentSummary}
                >
                  刷新
                </Button>
              </Space>
            </div>
            <div style={{ marginBottom: 12, padding: '8px 12px', backgroundColor: '#f6f8fa', borderRadius: '4px' }}>
              <Text style={{ fontSize: '12px', color: '#666' }}>
                说明：<Text strong style={{ color: '#1890ff' }}>蓝色加粗</Text> 为真实子SKU，
                <Text style={{ color: '#fa8c16', fontStyle: 'italic' }}>橙色斜体</Text> 为卖家货号-颜色组合，
                <Text strong style={{ color: '#f5222d' }}>红色加粗</Text> 为数据缺失记录
              </Text>
            </div>
            <Table
              columns={createSummaryColumns()}
              dataSource={shipmentSummary}
              rowKey="child_sku"
              loading={loading}
              scroll={{ x: Math.max(300 + summaryDates.length * 100, 800), y: 500 }}
              pagination={false}
              size="small"
              bordered
              sticky={{ offsetHeader: 64, offsetSummary: 0 }}
              summary={() => {
                // 计算每日总计和整体总计
                const dailyTotals: { [date: string]: number } = {};
                let grandTotal = 0;
                
                summaryDates.forEach(date => {
                  dailyTotals[date] = 0;
                });
                
                shipmentSummary.forEach(record => {
                  summaryDates.forEach(date => {
                    const qty = record.dates[date] || 0;
                    dailyTotals[date] += qty;
                  });
                  grandTotal += record.total;
                });
                
                return (
                  <Table.Summary.Row style={{ backgroundColor: '#fafafa', position: 'sticky', bottom: 0, zIndex: 1 }}>
                    <Table.Summary.Cell index={0}>
                      <Text strong style={{ fontSize: '14px' }}>日期合计</Text>
                    </Table.Summary.Cell>
                    {summaryDates.map((date, index) => (
                      <Table.Summary.Cell key={date} index={index + 1}>
                        <Text strong style={{ color: '#1890ff', fontSize: '14px' }}>
                          {dailyTotals[date].toLocaleString()}
                        </Text>
                      </Table.Summary.Cell>
                    ))}
                    <Table.Summary.Cell index={summaryDates.length + 1}>
                      <Text strong style={{ color: '#f5222d', fontSize: '14px' }}>
                        {grandTotal.toLocaleString()}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                );
              }}
            />
          </Tabs.TabPane>
        </Tabs>
      </Card>

      {/* 付款详细记录模态框 */}
      <Modal
        title={
          <div>
            <EyeOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
            付款详细记录
            {selectedPaymentInfo && (
              <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                供应商：{selectedPaymentInfo.supplier} | 
                付款类型：{selectedPaymentInfo.paymentType} | 
                总单数：{selectedPaymentInfo.count}
              </div>
            )}
          </div>
        }
        open={paymentDetailVisible}
        onCancel={() => setPaymentDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPaymentDetailVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <Table
          columns={paymentDetailColumns}
          dataSource={paymentDetails}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          bordered
          summary={() => (
            <Table.Summary.Row style={{ backgroundColor: '#fafafa' }}>
              <Table.Summary.Cell index={0} colSpan={1}>
                <Text strong>合计</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1}>
                <Text strong style={{ color: '#1890ff' }}>
                  ¥{paymentDetails.reduce((total, item) => total + Number(item.amount || 0), 0).toLocaleString()}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} colSpan={2}>
                <Text type="secondary">共 {paymentDetails.length} 条记录</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Modal>

      {/* 编辑记录模态框 */}
      <Modal
        title="编辑发货记录"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingRecord(null);
        }}
        footer={null}
        width={600}
      >
        {editingRecord && (
          <Form
            initialValues={{
              date: editingRecord.date ? dayjs(editingRecord.date) : undefined,
              vendor_sku: editingRecord.vendor_sku,
              color: editingRecord.color,
              quantity: editingRecord.quantity,
              supplier_name: editingRecord.supplier_name,
              parent_sku: editingRecord.parent_sku,
              child_sku: editingRecord.child_sku
            }}
            onFinish={handleUpdateRecord}
            layout="vertical"
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="date"
                  label="发货日期"
                  rules={[{ required: true, message: '请选择发货日期' }]}
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="quantity"
                  label="数量"
                  rules={[
                    { required: true, message: '请输入数量' },
                    { type: 'number', min: 0, message: '数量不能为负数' }
                  ]}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="vendor_sku"
                  label="卖家货号"
                  rules={[{ required: true, message: '请输入卖家货号' }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="color"
                  label="颜色"
                  rules={[{ required: true, message: '请输入颜色' }]}
                >
                  <Input />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="supplier_name"
              label="供应商"
              tooltip={{
                title: (
                  <div>
                    <div>供应商信息维护说明：</div>
                    <div>• 数据源：产品链接表(product_weblink)</div>
                    <div>• 关联字段：Parent SKU</div>
                    <div>• 建议操作：到"产品管理→产品链接"页面修改</div>
                    <div>• 此处修改仅影响当前记录显示</div>
                  </div>
                ),
                overlayStyle: { maxWidth: '300px' }
              }}
            >
              <Input 
                placeholder="供应商名称，留空则显示为'无供应商信息'" 
                suffix={
                  <Tooltip title="点击查看详细说明">
                    <Button 
                      type="link" 
                      size="small" 
                      icon={<EyeOutlined />}
                      onClick={() => {
                        Modal.info({
                          title: '供应商信息维护说明',
                          content: (
                            <div>
                              <p><strong>数据关联说明：</strong></p>
                              <ul style={{ paddingLeft: '20px' }}>
                                <li>供应商信息存储在产品链接表(product_weblink)中</li>
                                <li>通过Parent SKU字段进行关联</li>
                                <li>一个Parent SKU对应一个供应商</li>
                              </ul>
                              <p><strong>推荐修改方式：</strong></p>
                              <ol style={{ paddingLeft: '20px' }}>
                                <li>到"产品管理 → 产品链接"页面</li>
                                <li>找到对应的Parent SKU记录</li>
                                <li>修改seller_name字段</li>
                                <li>系统会自动同步到所有相关记录</li>
                              </ol>
                              <p><strong>注意：</strong>在此处修改仅影响当前记录的显示，不会更新源数据</p>
                            </div>
                          ),
                          width: 600
                        });
                      }}
                    />
                  </Tooltip>
                }
              />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="parent_sku"
                  label="Parent SKU"
                  tooltip="Parent SKU在产品链接表中维护，关联供应商信息"
                >
                  <Input 
                    suffix={
                      <Tooltip title="查看详细说明">
                        <Button 
                          type="link" 
                          size="small" 
                          icon={<EyeOutlined />}
                          onClick={() => {
                            Modal.info({
                              title: 'Parent SKU说明',
                              content: (
                                <div>
                                  <p><strong>字段说明：</strong></p>
                                  <ul style={{ paddingLeft: '20px' }}>
                                    <li>Parent SKU是产品的父级标识</li>
                                    <li>存储在产品链接表(product_weblink)中</li>
                                    <li>关联供应商信息(seller_name)</li>
                                  </ul>
                                  <p><strong>修改建议：</strong></p>
                                  <p>到"产品管理 → 产品链接"页面进行维护</p>
                                </div>
                              )
                            });
                          }}
                        />
                      </Tooltip>
                    }
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="child_sku"
                  label="Child SKU"
                  tooltip="Child SKU在库存表中维护，通过卖家货号+颜色关联"
                >
                  <Input 
                    suffix={
                      <Tooltip title="查看详细说明">
                        <Button 
                          type="link" 
                          size="small" 
                          icon={<EyeOutlined />}
                          onClick={() => {
                            Modal.info({
                              title: 'Child SKU说明',
                              content: (
                                <div>
                                  <p><strong>字段说明：</strong></p>
                                  <ul style={{ paddingLeft: '20px' }}>
                                    <li>Child SKU是产品的子级标识</li>
                                    <li>存储在库存表(sellerinventory_sku)中</li>
                                    <li>通过卖家货号+颜色进行关联</li>
                                  </ul>
                                  <p><strong>修改建议：</strong></p>
                                  <p>到"库存管理"相关页面进行维护</p>
                                </div>
                              )
                            });
                          }}
                        />
                      </Tooltip>
                    }
                  />
                </Form.Item>
              </Col>
            </Row>
            
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  保存
                </Button>
                <Button 
                  onClick={() => {
                    setEditModalVisible(false);
                    setEditingRecord(null);
                  }}
                >
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default PeakSeasonSummary; 