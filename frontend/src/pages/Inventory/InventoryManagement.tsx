import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Input, Select, Modal, Form, message, Tag, Space, Popconfirm, DatePicker, Tooltip, Row, Col, Statistic, Typography } from 'antd';
import { SearchOutlined, EditOutlined, DeleteOutlined, PrinterOutlined, ReloadOutlined, PlusOutlined, HistoryOutlined, GlobalOutlined, EyeOutlined } from '@ant-design/icons';
import { printManager, LabelData } from '../../utils/printManager';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { API_BASE_URL } from '../../config/api';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text } = Typography;

interface InventoryRecord {
  记录号: string;
  sku: string;
  total_quantity: number;
  total_boxes: number;
  country: string;
  操作员: string;
  打包员: string;
  mix_box_num?: string;
  marketPlace: string;
  status: '待出库' | '已出库' | '已取消';
  box_type: '整箱' | '混合箱';
  time: string;
  last_updated_at: string;
  shipped_at?: string;
  shipment_id?: number;
  remark?: string;
}

interface InventorySummary {
  sku: string;
  country: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  mixed_box_count: number;
  earliest_inbound: string;
  latest_update: string;
}

// 国家库存汇总接口
interface CountryInventory {
  country: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  mixed_box_count: number;
  total_quantity: number;
}

// 混合箱悬停样式
const mixedBoxStyles = `
  .mixed-box-hover {
    background-color: #e6f7ff !important;
    transition: background-color 0.3s ease;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.2) !important;
  }
  .mixed-box-hover td {
    background-color: #e6f7ff !important;
    border-color: #91d5ff !important;
  }
  .mixed-box-hover:hover {
    background-color: #bae7ff !important;
  }
  .mixed-box-hover:hover td {
    background-color: #bae7ff !important;
  }
  .inventory-table-container {
    width: 100% !important;
    overflow-x: auto;
  }
  .inventory-table-container .ant-table {
    width: 100% !important;
    min-width: 100% !important;
  }
  .inventory-table-container .ant-table-wrapper {
    width: 100% !important;
  }
  .inventory-table-container .ant-table-container {
    width: 100% !important;
  }
  .inventory-table-container .ant-table-content {
    width: 100% !important;
  }
  .inventory-table-container .ant-table-body {
    width: 100% !important;
  }
  .inventory-table-container .ant-table-thead > tr,
  .inventory-table-container .ant-table-tbody > tr {
    width: 100% !important;
  }
  .ant-table-tbody > tr.mixed-box-hover {
    border: 1px solid #40a9ff;
  }
  /* 强制表格列平均分配宽度 */
  .inventory-table-container .ant-table-thead > tr > th,
  .inventory-table-container .ant-table-tbody > tr > td {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const InventoryManagement: React.FC = () => {
  const [summaryData, setSummaryData] = useState<InventorySummary[]>([]);
  const [recordsData, setRecordsData] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [currentView, setCurrentView] = useState<'summary' | 'records'>('summary');
  
  // 国家库存汇总相关状态
  const [countryInventory, setCountryInventory] = useState<CountryInventory[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  
  // 筛选条件
  const [filters, setFilters] = useState({
    sku: '',
    country: '',
    box_type: '',
    status: '',
    dateRange: null as [dayjs.Dayjs, dayjs.Dayjs] | null
  });

  // 分页
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  // 编辑模态框
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<InventoryRecord | null>(null);
  const [editForm] = Form.useForm();

  // 混合箱批量编辑
  const [mixedBoxEditVisible, setMixedBoxEditVisible] = useState(false);
  const [editingMixedBoxRecords, setEditingMixedBoxRecords] = useState<InventoryRecord[]>([]);
  const [mixedBoxEditForm] = Form.useForm();

  // 混合箱悬停高亮
  const [hoveredMixedBox, setHoveredMixedBox] = useState<string | null>(null);

  // 查看SKU详情的状态
  const [viewingSkuDetails, setViewingSkuDetails] = useState<{sku: string, country: string} | null>(null);

  // 打印状态
  const [printServiceAvailable, setPrintServiceAvailable] = useState(false);

  useEffect(() => {
    loadSummaryData();
    checkPrintService();
  }, []);

  useEffect(() => {
    if (currentView === 'summary') {
      loadSummaryData();
    } else {
      loadRecordsData();
    }
    fetchCountryInventory();
  }, [currentView, filters, pagination.current, pagination.pageSize, viewingSkuDetails]);

  // 检查打印服务
  const checkPrintService = async () => {
    try {
      const available = await printManager.checkPrintService();
      setPrintServiceAvailable(available);
    } catch (error) {
      setPrintServiceAvailable(false);
    }
  };

  // 加载库存汇总数据
  const loadSummaryData = async () => {
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.sku) params.append('sku', filters.sku);
      if (filters.country) params.append('country', filters.country);
      if (filters.box_type) params.append('box_type', filters.box_type);
      
      const response = await fetch(`/api/inventory/pending?${params.toString()}`);
      const data = await response.json();
      
      if (data.code === 0) {
        setSummaryData(data.data.inventory);
        setPagination(prev => ({
          ...prev,
          total: data.data.total
        }));
      } else {
        message.error(data.message);
      }
    } catch (error) {
      message.error('加载库存汇总失败');
      console.error(error);
    } finally {
      setSummaryLoading(false);
    }
  };

  // 获取国家库存汇总数据
  const fetchCountryInventory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/inventory-by-country`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.code === 0) {
        setCountryInventory(result.data || []);
      } else {
        console.error('获取国家库存数据失败:', result.message);
      }
    } catch (error) {
      console.error('获取国家库存数据失败:', error);
    }
  };

  // 加载SKU相关混合箱的完整记录
  const loadSkuRelatedRecords = async (sku: string, country: string) => {
    setLoading(true);
    try {
      console.log('🔍 开始查询SKU相关记录:', { sku, country });
      
      // 第一步：查询该SKU的所有记录，获取相关的混合箱号
      const skuParams = new URLSearchParams();
      skuParams.append('sku', sku);
      skuParams.append('country', country);
      skuParams.append('limit', '1000'); // 获取所有记录
      
      console.log('📡 第一步查询参数:', skuParams.toString());
      const skuResponse = await fetch(`/api/inventory/records?${skuParams.toString()}`);
      const skuData = await skuResponse.json();
      
      console.log('📋 第一步查询结果:', skuData);
      
      if (skuData.code !== 0) {
        message.error('查询SKU记录失败');
        return;
      }
      
      // 提取该SKU所在的混合箱号
      const mixedBoxNumbers = new Set<string>();
      const wholeBoxRecords: any[] = [];
      
      skuData.data.records.forEach((record: any) => {
        console.log('🔍 分析记录:', { 
          id: record.id, 
          sku: record.sku, 
          box_type: record.box_type, 
          mix_box_num: record.mix_box_num 
        });
        
        if (record.mix_box_num) {
          mixedBoxNumbers.add(record.mix_box_num);
          console.log('📦 找到混合箱号:', record.mix_box_num);
        } else {
          wholeBoxRecords.push(record);
          console.log('📋 找到整箱记录:', record.id);
        }
      });
      
      console.log('📦 所有混合箱号:', Array.from(mixedBoxNumbers));
      console.log('📋 整箱记录数量:', wholeBoxRecords.length);
      
      // 第二步：如果有混合箱，查询这些混合箱的完整记录
      let mixedBoxRecords: any[] = [];
      if (mixedBoxNumbers.size > 0) {
        const mixedBoxPromises = Array.from(mixedBoxNumbers).map(async (boxNum) => {
          const boxParams = new URLSearchParams();
          boxParams.append('mix_box_num', boxNum);
          // 移除country限制，因为混合箱号应该是全局唯一的
          boxParams.append('limit', '1000');
          
          console.log(`🔍 查询混合箱 ${boxNum} 的完整记录:`, boxParams.toString());
          const boxResponse = await fetch(`/api/inventory/records?${boxParams.toString()}`);
          const boxData = await boxResponse.json();
          
          console.log(`📦 混合箱 ${boxNum} 的记录:`, boxData);
          
          if (boxData.code === 0) {
            // 过滤出指定国家的记录
            const countryRecords = boxData.data.records.filter((record: any) => record.country === country);
            console.log(`📦 混合箱 ${boxNum} 在${country}的记录数量:`, countryRecords.length);
            return countryRecords;
          }
          return [];
        });
        
        const mixedBoxResults = await Promise.all(mixedBoxPromises);
        mixedBoxRecords = mixedBoxResults.flat();
        console.log('📦 所有混合箱记录数量:', mixedBoxRecords.length);
      }
      
      // 合并整箱记录和混合箱记录
      const allRecords = [...wholeBoxRecords, ...mixedBoxRecords];
      console.log('🔗 合并后记录数量:', allRecords.length);
      
      // 去重（防止重复记录）
      const uniqueRecords = allRecords.filter((record, index, arr) => 
        arr.findIndex(r => r.id === record.id) === index
      );
      
      console.log('✅ 最终显示记录数量:', uniqueRecords.length);
      console.log('📋 最终记录列表:', uniqueRecords.map(r => ({ id: r.id, sku: r.sku, mix_box_num: r.mix_box_num })));
      
      setRecordsData(uniqueRecords);
      setPagination(prev => ({
        ...prev,
        total: uniqueRecords.length,
        current: 1
      }));
      
    } catch (error) {
      message.error('加载相关记录失败');
      console.error('❌ 查询失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载库存记录数据
  const loadRecordsData = async () => {
    setLoading(true);
    try {
      // 如果在查看SKU详情模式，加载相关混合箱的完整记录
      if (viewingSkuDetails) {
        await loadSkuRelatedRecords(viewingSkuDetails.sku, viewingSkuDetails.country);
        return;
      }
      
      // 否则使用正常的筛选条件
      const params = new URLSearchParams();
      if (filters.sku) params.append('sku', filters.sku);
      if (filters.country) params.append('country', filters.country);
      if (filters.box_type) params.append('box_type', filters.box_type);
      if (filters.status) params.append('status', filters.status);
      
      params.append('page', pagination.current.toString());
      params.append('limit', pagination.pageSize.toString());
      
      const response = await fetch(`/api/inventory/records?${params.toString()}`);
      const data = await response.json();
      
      if (data.code === 0) {
        setRecordsData(data.data.records);
        setPagination(prev => ({
          ...prev,
          total: data.data.total
        }));
      } else {
        message.error(data.message);
      }
    } catch (error) {
      message.error('加载库存记录失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 编辑记录
  const handleEdit = (record: InventoryRecord) => {
    setEditingRecord(record);
    editForm.setFieldsValue({
      sku: record.sku,
      total_quantity: record.total_quantity,
      total_boxes: record.total_boxes,
      country: record.country,
      打包员: record.打包员,
      marketPlace: record.marketPlace
    });
    setEditModalVisible(true);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields();
      const response = await fetch(`/api/inventory/edit/${editingRecord?.记录号}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateData: values,
          changeNote: '手动编辑'
        })
      });

      const data = await response.json();
      if (data.code === 0) {
        message.success('编辑成功');
        setEditModalVisible(false);
        if (currentView === 'summary') {
          loadSummaryData();
        } else {
          loadRecordsData();
        }
      } else {
        message.error(data.message);
      }
    } catch (error) {
      message.error('编辑失败');
      console.error(error);
    }
  };

  // 删除记录
  const handleDelete = async (recordId: string) => {
    try {
      const response = await fetch(`/api/inventory/delete/${recordId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: '用户删除' })
      });

      const data = await response.json();
      if (data.code === 0) {
        message.success('删除成功');
        if (currentView === 'summary') {
          loadSummaryData();
        } else {
          loadRecordsData();
        }
      } else {
        message.error(data.message);
      }
    } catch (error) {
      message.error('删除失败');
      console.error(error);
    }
  };

  // 打印标签
  const handlePrint = async (record: InventoryRecord) => {
    try {
      const labelData: LabelData = {
        recordId: record.记录号,
        sku: record.sku,
        quantity: record.total_quantity,
        boxes: record.total_boxes,
        country: record.country,
        operator: record.操作员,
        packer: record.打包员,
        boxType: record.box_type,
        mixBoxNum: record.mix_box_num,
        createTime: record.time,
        barcode: record.记录号
      };

      await printManager.printLabel(labelData);
      message.success('打印任务已发送');
    } catch (error) {
      message.error('打印失败');
      console.error(error);
    }
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusConfig = {
      '待出库': { color: 'blue', text: '待出库' },
      '已出库': { color: 'green', text: '已出库' },
      '已取消': { color: 'red', text: '已取消' }
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 处理混合箱数据分组，用于行合并
  const getRowSpanMap = (data: InventoryRecord[]) => {
    const mixedBoxGroups: { [key: string]: number } = {};
    const rowSpanMap: { [key: number]: number } = {};
    
    // 统计每个混合箱的记录数量
    data.forEach(record => {
      if (record.mix_box_num) {
        mixedBoxGroups[record.mix_box_num] = (mixedBoxGroups[record.mix_box_num] || 0) + 1;
      }
    });

    // 计算每行的rowSpan
    let currentMixedBox = '';
    let mixedBoxFirstRowIndex = -1;
    
    data.forEach((record, index) => {
      if (record.mix_box_num) {
        if (record.mix_box_num !== currentMixedBox) {
          // 新的混合箱开始
          currentMixedBox = record.mix_box_num;
          mixedBoxFirstRowIndex = index;
          rowSpanMap[index] = mixedBoxGroups[record.mix_box_num];
        } else {
          // 同一混合箱的后续记录，不显示操作按钮
          rowSpanMap[index] = 0;
        }
      } else {
        // 整箱记录，单独一行
        rowSpanMap[index] = 1;
      }
    });

    return rowSpanMap;
  };

  // 处理混合箱批量编辑
  const handleMixedBoxEdit = (mixBoxNum: string) => {
    const mixedBoxRecords = recordsData.filter(record => record.mix_box_num === mixBoxNum);
    setEditingMixedBoxRecords(mixedBoxRecords);
    
    // 设置表单初始值
    const formData = mixedBoxRecords.map(record => ({
      recordId: record.记录号,
      sku: record.sku,
      total_quantity: record.total_quantity,
      country: record.country,
      打包员: record.打包员,
      marketPlace: record.marketPlace
    }));
    
    mixedBoxEditForm.setFieldsValue({
      mixBoxNum: mixBoxNum,
      records: formData
    });
    
    setMixedBoxEditVisible(true);
  };

  // 保存混合箱批量编辑
  const handleSaveMixedBoxEdit = async () => {
    try {
      const values = await mixedBoxEditForm.validateFields();
      const { records } = values;
      
      // 批量更新记录
      for (const record of records) {
        await fetch(`/api/inventory/edit/${record.recordId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updateData: {
              sku: record.sku,
              total_quantity: record.total_quantity,
              country: record.country,
              打包员: record.打包员,
              marketPlace: record.marketPlace
            },
            changeNote: '混合箱批量编辑'
          })
        });
      }

      message.success('批量编辑成功');
      setMixedBoxEditVisible(false);
      loadRecordsData();
    } catch (error) {
      message.error('批量编辑失败');
      console.error(error);
    }
  };

  // 处理混合箱批量删除
  const handleMixedBoxDelete = async (mixBoxNum: string) => {
    try {
      const mixedBoxRecords = recordsData.filter(record => record.mix_box_num === mixBoxNum);
      
      for (const record of mixedBoxRecords) {
        await fetch(`/api/inventory/delete/${record.记录号}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: `删除混合箱 ${mixBoxNum}` })
        });
      }

      message.success(`混合箱 ${mixBoxNum} 删除成功`);
      loadRecordsData();
    } catch (error) {
      message.error('删除失败');
      console.error(error);
    }
  };

  // 处理混合箱批量打印
  const handleMixedBoxPrint = async (mixBoxNum: string) => {
    try {
      const mixedBoxRecords = recordsData.filter(record => record.mix_box_num === mixBoxNum);
      
      // 为混合箱创建LabelData，使用第一个记录的基本信息
      const firstRecord = mixedBoxRecords[0];
      const totalQuantity = mixedBoxRecords.reduce((sum, record) => sum + record.total_quantity, 0);
      
      const labelData: LabelData = {
        recordId: mixBoxNum,
        sku: `混合箱-${mixBoxNum}`,
        quantity: totalQuantity,
        boxes: 1,
        country: firstRecord?.country || '',
        operator: firstRecord?.操作员 || '',
        packer: firstRecord?.打包员 || '',
        boxType: '混合箱' as const,
        mixBoxNum: mixBoxNum,
        createTime: firstRecord?.time || '',
        barcode: mixBoxNum,
        qrData: JSON.stringify({
          mixBoxNum: mixBoxNum,
          skus: mixedBoxRecords.map(record => ({
            sku: record.sku,
            quantity: record.total_quantity
          })),
          country: firstRecord?.country
        })
      };

      await printManager.printLabel(labelData);
      message.success('打印任务已发送');
    } catch (error) {
      message.error('打印失败');
      console.error(error);
    }
  };

  // 库存汇总表格列
  const summaryColumns: ColumnsType<InventorySummary> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      fixed: 'left',
      width: 150,
      align: 'center'
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 80,
      align: 'center'
    },
    {
      title: '整箱库存',
      key: 'whole_box',
      width: 120,
      align: 'center',
      render: (_, record) => {
        const quantity = Number(record.whole_box_quantity) || 0;
        const count = Number(record.whole_box_count) || 0;
        
        if (quantity === 0 && count === 0) {
          return null;
        }
        
        return (
        <div>
            <div>{quantity} 件</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
              {count} 箱
          </div>
        </div>
        );
      }
    },
    {
      title: '混合箱库存',
      key: 'mixed_box',
      width: 120,
      align: 'center',
      render: (_, record) => {
        const quantity = Number(record.mixed_box_quantity) || 0;
        const count = Number(record.mixed_box_count) || 0;
        
        if (quantity === 0 && count === 0) {
          return null;
        }
        
        return (
        <div>
            <div>{quantity} 件</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
              {count} 个混合箱
          </div>
        </div>
        );
      }
    },
    {
      title: '总库存',
      key: 'total',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const wholeBoxQty = Number(record.whole_box_quantity) || 0;
        const mixedBoxQty = Number(record.mixed_box_quantity) || 0;
        const total = wholeBoxQty + mixedBoxQty;
        
        return <strong>{total} 件</strong>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'earliest_inbound',
      key: 'earliest_inbound',
      width: 120,
      align: 'center',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '最后更新',
      dataIndex: 'latest_update',
      key: 'latest_update',
      width: 120,
      align: 'center',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => {
                // 设置查看SKU详情状态，这样不会影响搜索框显示
                setViewingSkuDetails({
                  sku: record.sku,
                  country: record.country
                });
                setCurrentView('records');
              }}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  // 库存记录表格列
  const recordsColumns: ColumnsType<InventoryRecord> = [
    {
      title: '箱型',
      dataIndex: 'box_type',
      key: 'box_type',
      fixed: 'left',
      width: '15%',
      align: 'center',
      render: (type, record) => (
        <div>
          <Tag color={type === '整箱' ? 'blue' : 'orange'}>{type}</Tag>
          {record.mix_box_num && (
            <div style={{ 
              fontSize: '14px', 
              color: '#1890ff',
              fontWeight: 700,
              marginTop: '4px'
            }}>
              {record.mix_box_num}
            </div>
          )}
        </div>
      )
    },
    {
      title: '记录号',
      dataIndex: '记录号',
      key: '记录号',
      width: '12%',
      align: 'center'
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: '10%',
      align: 'center'
    },
    {
      title: '数量',
      key: 'quantity',
      width: '8%',
      align: 'center',
      render: (_, record) => {
        if (record.box_type === '混合箱') {
          return `${record.total_quantity}件`;
        }
        return `${record.total_quantity}件/${record.total_boxes}箱`;
      }
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: '6%',
      align: 'center'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: '8%',
      align: 'center',
      render: (status) => getStatusTag(status)
    },
    {
      title: '操作员',
      dataIndex: '操作员',
      key: '操作员',
      width: '8%',
      align: 'center'
    },
    {
      title: '打包员',
      dataIndex: '打包员',
      key: '打包员',
      width: '8%',
      align: 'center'
    },
    {
      title: '入库时间',
      dataIndex: 'time',
      key: 'time',
      width: '12%',
      align: 'center',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: '13%',
      align: 'center',
      render: (_, record, index) => {
        const rowSpanMap = getRowSpanMap(recordsData);
        const rowSpan = rowSpanMap[index];
        
        // 如果rowSpan为0，表示这是同一混合箱的后续记录，不显示操作按钮
        if (rowSpan === 0) {
          return null;
        }

        // 混合箱的操作
        if (record.mix_box_num && rowSpan > 1) {
          return {
            children: (
              <Space>
                {record.status === '待出库' && (
                  <>
                    <Tooltip title="编辑混合箱">
                      <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleMixedBoxEdit(record.mix_box_num!)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title={`确定要删除混合箱 ${record.mix_box_num} 的所有记录吗？`}
                      onConfirm={() => handleMixedBoxDelete(record.mix_box_num!)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Tooltip title="删除混合箱">
                        <Button
                          type="link"
                          danger
                          icon={<DeleteOutlined />}
                        />
                      </Tooltip>
                    </Popconfirm>
                  </>
                )}
                <Tooltip title="打印混合箱标签">
                  <Button
                    type="link"
                    icon={<PrinterOutlined />}
                    onClick={() => handleMixedBoxPrint(record.mix_box_num!)}
                  />
                </Tooltip>
              </Space>
            ),
            props: {
              rowSpan: rowSpan
            }
          };
        }

        // 整箱的操作
        return (
        <Space>
          {record.status === '待出库' && (
            <>
              <Tooltip title="编辑">
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(record)}
                />
              </Tooltip>
              <Popconfirm
                title="确定要删除这条记录吗？"
                onConfirm={() => handleDelete(record.记录号)}
                okText="确定"
                cancelText="取消"
              >
                <Tooltip title="删除">
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
          <Tooltip title="打印标签">
            <Button
              type="link"
              icon={<PrinterOutlined />}
              onClick={() => handlePrint(record)}
            />
          </Tooltip>
        </Space>
        );
      }
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <style>{mixedBoxStyles}</style>
      {/* 国家库存统计卡片 */}
      <Card 
        title={
          <span>
            <GlobalOutlined style={{ marginRight: 8 }} />
            按国家库存汇总
            <Text type="secondary" style={{ fontSize: '12px', marginLeft: 8 }}>
              (不含已发货记录，点击卡片筛选对应国家数据)
            </Text>
          </span>
        } 
        size="small" 
        style={{ 
          marginBottom: 16,
          width: '100%',
          maxWidth: 'none'
        }}
        bodyStyle={{
          padding: '16px 24px',
          width: '100%'
        }}
      >
        <Row gutter={[16, 16]}>
          {countryInventory.map(item => (
            <Col key={item.country}>
              <div 
                style={{ 
                  cursor: 'pointer',
                  padding: '8px 16px',
                  border: `2px solid ${selectedCountry === item.country ? '#1677ff' : '#d9d9d9'}`,
                  borderRadius: '6px',
                  backgroundColor: selectedCountry === item.country ? '#f0f6ff' : '#fff',
                  transition: 'all 0.3s',
                  minWidth: '120px'
                }} 
                onClick={() => {
                  const newCountry = selectedCountry === item.country ? '' : item.country;
                  setSelectedCountry(newCountry);
                  setFilters(prev => ({ ...prev, country: newCountry }));
                }}
              >
                <Statistic
                  title={
                    <div>
                      <Text strong>{item.country}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: '10px' }}>
                        整箱: {item.whole_box_count}箱 | 混合箱: {item.mixed_box_count}箱
                      </Text>
                    </div>
                  }
                  value={item.total_quantity}
                  valueStyle={{ 
                    color: selectedCountry === item.country ? '#1677ff' : '#666',
                    fontSize: '18px'
                  }}
                  suffix="件"
                />
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      <Card 
        title="本地库存管理" 
        style={{ 
          marginBottom: '16px',
          width: '100%',
          maxWidth: 'none'
        }}
        bodyStyle={{
          padding: '24px',
          width: '100%'
        }}
      >
        {/* 筛选区域 */}
        <div style={{ marginBottom: '16px' }}>
          <Space wrap>
            <Input
              placeholder="搜索SKU"
              prefix={<SearchOutlined />}
              value={filters.sku}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, sku: e.target.value }));
                setViewingSkuDetails(null); // 清除查看详情状态
              }}
              style={{ width: 200 }}
            />
            <Select
              placeholder="选择国家"
              value={filters.country}
              onChange={(value) => {
                setFilters(prev => ({ ...prev, country: value }));
                setViewingSkuDetails(null); // 清除查看详情状态
              }}
              style={{ width: 120 }}
              allowClear
            >
              <Option value="US">美国</Option>
              <Option value="CA">加拿大</Option>
              <Option value="UK">英国</Option>
              <Option value="DE">德国</Option>
              <Option value="FR">法国</Option>
              <Option value="IT">意大利</Option>
              <Option value="ES">西班牙</Option>
              <Option value="JP">日本</Option>
            </Select>
            <Select
              placeholder="箱型"
              value={filters.box_type}
              onChange={(value) => {
                setFilters(prev => ({ ...prev, box_type: value }));
                setViewingSkuDetails(null); // 清除查看详情状态
              }}
              style={{ width: 120 }}
              allowClear
            >
              <Option value="整箱">整箱</Option>
              <Option value="混合箱">混合箱</Option>
            </Select>
            {currentView === 'records' && (
              <Select
                placeholder="状态"
                value={filters.status}
                onChange={(value) => {
                  setFilters(prev => ({ ...prev, status: value }));
                  setViewingSkuDetails(null); // 清除查看详情状态
                }}
                style={{ width: 120 }}
                allowClear
              >
                <Option value="待出库">待出库</Option>
                <Option value="已出库">已出库</Option>
                <Option value="已取消">已取消</Option>
              </Select>
            )}
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => {
                if (currentView === 'summary') {
                  loadSummaryData();
                } else {
                  loadRecordsData();
                }
                fetchCountryInventory();
              }}
            >
              搜索
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setFilters({ sku: '', country: '', box_type: '', status: '', dateRange: null });
                setPagination(prev => ({ ...prev, current: 1 }));
                setViewingSkuDetails(null); // 清除查看详情状态
              }}
            >
              重置
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                // 跳转到入库页面
                window.location.href = '/inventory/create';
              }}
            >
              新增库存
            </Button>
          </Space>
        </div>

        {/* 视图切换和操作按钮 */}
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Button.Group>
              <Button
                type={currentView === 'summary' ? 'primary' : 'default'}
                onClick={() => setCurrentView('summary')}
              >
                库存汇总
              </Button>
              <Button
                type={currentView === 'records' ? 'primary' : 'default'}
                onClick={() => setCurrentView('records')}
              >
                库存记录
              </Button>
            </Button.Group>
          </Space>
          <div></div>
        </div>

        {/* SKU详情查看提示 */}
        {currentView === 'records' && viewingSkuDetails && (
          <Card size="small" style={{ marginBottom: '16px', backgroundColor: '#f6ffed', border: '1px solid #b7eb8f' }}>
          <Space>
              <EyeOutlined style={{ color: '#52c41a' }} />
              <span>正在查看 <strong>{viewingSkuDetails.sku}</strong> 在 <strong>{viewingSkuDetails.country}</strong> 相关混合箱的完整记录（包括整箱记录和混合箱中的所有SKU）</span>
            <Button
                size="small" 
              onClick={() => {
                  setViewingSkuDetails(null);
                  setCurrentView('summary');
                }}
              >
                返回汇总
              </Button>
                            <Button 
                size="small" 
                type="primary"
                onClick={async () => {
                  // 临时测试：直接查询混合箱1752666330的记录（更新为正确的混合箱号）
                  try {
                    const response = await fetch('/api/inventory/records?mix_box_num=1752666330&limit=1000');
                    const data = await response.json();
                    console.log('🧪 直接查询混合箱1752666330的结果:', data);
                    if (data.code === 0) {
                      // 过滤美国的记录
                      const countryRecords = data.data.records.filter((record: any) => record.country === viewingSkuDetails?.country);
                      setRecordsData(countryRecords);
                      message.success(`找到${countryRecords.length}条记录`);
                    }
                  } catch (error) {
                    console.error('🧪 直接查询失败:', error);
                  }
                }}
              >
                测试直接查询
              </Button>
          </Space>
          </Card>
        )}

        {/* 表格 */}
        <div className="inventory-table-container">
        {currentView === 'summary' ? (
          <Table
            columns={summaryColumns}
            dataSource={summaryData}
            loading={summaryLoading}
            rowKey={(record) => `${record.sku}_${record.country}`}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
            }}
            scroll={{ x: 1000 }}
          />
        ) : (
          <Table
            columns={recordsColumns}
            dataSource={recordsData}
            loading={loading}
            rowKey="记录号"
              tableLayout="fixed"
              size="middle"
              rowClassName={(record) => {
                if (record.mix_box_num && hoveredMixedBox === record.mix_box_num) {
                  return 'mixed-box-hover';
                }
                return '';
              }}
              onRow={(record) => ({
                onMouseEnter: () => {
                  if (record.mix_box_num) {
                    setHoveredMixedBox(record.mix_box_num);
                  }
                },
                onMouseLeave: () => {
                  setHoveredMixedBox(null);
                }
              })}
              pagination={viewingSkuDetails ? false : {
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
              onChange: (page, pageSize) => {
                setPagination(prev => ({ ...prev, current: page, pageSize: pageSize || 20 }));
              }
            }}
              scroll={{ x: 'max-content' }}
              style={{ width: '100%' }}
          />
        )}
        </div>
      </Card>

      {/* 编辑模态框 */}
      <Modal
        title="编辑库存记录"
        visible={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => setEditModalVisible(false)}
        width={600}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            label="SKU"
            name="sku"
            rules={[{ required: true, message: '请输入SKU' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="数量"
            name="total_quantity"
            rules={[{ required: true, message: '请输入数量' }]}
          >
            <Input type="number" min={1} />
          </Form.Item>
          <Form.Item
            label="箱数"
            name="total_boxes"
            rules={[{ required: true, message: '请输入箱数' }]}
          >
            <Input type="number" min={1} />
          </Form.Item>
          <Form.Item
            label="国家"
            name="country"
            rules={[{ required: true, message: '请选择国家' }]}
          >
            <Select>
              <Option value="US">美国</Option>
              <Option value="CA">加拿大</Option>
              <Option value="UK">英国</Option>
              <Option value="DE">德国</Option>
              <Option value="FR">法国</Option>
              <Option value="IT">意大利</Option>
              <Option value="ES">西班牙</Option>
              <Option value="JP">日本</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="打包员"
            name="打包员"
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="市场"
            name="marketPlace"
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* 混合箱批量编辑模态框 */}
      <Modal
        title={`编辑混合箱 ${editingMixedBoxRecords[0]?.mix_box_num || ''}`}
        visible={mixedBoxEditVisible}
        onOk={handleSaveMixedBoxEdit}
        onCancel={() => setMixedBoxEditVisible(false)}
        width={800}
        bodyStyle={{ maxHeight: '60vh', overflowY: 'auto' }}
      >
        <Form form={mixedBoxEditForm} layout="vertical">
          <Form.Item label="混合箱编号" name="mixBoxNum">
            <Input disabled />
          </Form.Item>
          
          <Form.List name="records">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card key={key} size="small" style={{ marginBottom: 16 }}>
                    <Row gutter={16}>
                      <Col span={6}>
                        <Form.Item
                          {...restField}
                          label="SKU"
                          name={[name, 'sku']}
                          rules={[{ required: true, message: '请输入SKU' }]}
                        >
                          <Input />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          {...restField}
                          label="数量"
                          name={[name, 'total_quantity']}
                          rules={[{ required: true, message: '请输入数量' }]}
                        >
                          <Input type="number" min={1} />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          {...restField}
                          label="国家"
                          name={[name, 'country']}
                          rules={[{ required: true, message: '请选择国家' }]}
                        >
                          <Select>
                            <Option value="US">美国</Option>
                            <Option value="CA">加拿大</Option>
                            <Option value="UK">英国</Option>
                            <Option value="DE">德国</Option>
                            <Option value="FR">法国</Option>
                            <Option value="IT">意大利</Option>
                            <Option value="ES">西班牙</Option>
                            <Option value="JP">日本</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          {...restField}
                          label="打包员"
                          name={[name, '打包员']}
                        >
                          <Input />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item
                      {...restField}
                      name={[name, 'recordId']}
                      hidden
                    >
                      <Input />
                    </Form.Item>
                  </Card>
                ))}
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
};

export default InventoryManagement; 