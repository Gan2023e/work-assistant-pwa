import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
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
  Steps,
  Alert
} from 'antd';
import { 
  PlusOutlined,
  CheckOutlined,
  CloseOutlined,
  SendOutlined,
  ExportOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';

// 自定义样式
const customStyles = `
  .shortage-row {
    background-color: #fff2f0 !important;
  }
  .shortage-row:hover {
    background-color: #ffece6 !important;
  }
  .unmapped-row {
    background-color: #fffbe6 !important;
  }
  .unmapped-row:hover {
    background-color: #fff7e6 !important;
  }
  .inventory-only-row {
    background-color: #f0f9ff !important;
  }
  .inventory-only-row:hover {
    background-color: #e6f4ff !important;
  }
  .sufficient-row {
    background-color: #f6ffed !important;
  }
  .sufficient-row:hover {
    background-color: #f0f9ff !important;
  }
`;

// 注入样式
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = customStyles;
  if (!document.head.querySelector('style[data-shipping-styles]')) {
    styleElement.setAttribute('data-shipping-styles', 'true');
    document.head.appendChild(styleElement);
  }
}

const { Option } = Select;
const { Title, Text } = Typography;



interface MergedShippingData {
  record_num: number;
  need_num: string;
  amz_sku: string;
  local_sku: string;
  quantity: number;
  shipping_method?: string;
  marketplace: string;
  country: string;
  status: '待发货' | '已发货' | '已取消' | '有库存无需求' | '库存未映射';
  created_at: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  total_available: number;
  shortage: number;
}

interface AddNeedForm {
  sku: string;
  quantity: number;
  shipping_method?: string;
  marketplace: string;
  country: string;
  remark?: string;
}

interface MixedBoxItem {
  box_num: string;
  sku: string;
  amz_sku: string;
  quantity: number;
}

interface ShippingConfirmData {
  box_num: string;
  amz_sku: string;
  quantity: number;
}

interface WholeBoxConfirmData {
  amz_sku: string;
  total_quantity: number;
  total_boxes: number;
  confirm_boxes: number;
  confirm_quantity: number;
}

interface UnmappedInventoryItem {
  local_sku: string;
  country: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  total_available: number;
  auto_amz_sku?: string; // 自动生成的Amazon SKU
  site?: string; // Amazon站点URL
}

interface SkuMappingForm {
  local_sku: string;
  amz_sku: string;
  country: string;
  site?: string;
}

interface CountryInventory {
  country: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  total_quantity: number;
}

const ShippingPage: React.FC = () => {
  const { user } = useAuth();
  const [mergedData, setMergedData] = useState<MergedShippingData[]>([]);
  const [mergedLoading, setMergedLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addForm] = Form.useForm();
  const [statusFilter, setStatusFilter] = useState('待发货');
  const [filterType, setFilterType] = useState<string>(''); // 新增：卡片筛选类型
  
  // 新增：多选和发货相关状态
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<MergedShippingData[]>([]);
  const [shippingModalVisible, setShippingModalVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [mixedBoxes, setMixedBoxes] = useState<MixedBoxItem[]>([]);
  const [uniqueMixedBoxNums, setUniqueMixedBoxNums] = useState<string[]>([]);
  const [currentMixedBoxIndex, setCurrentMixedBoxIndex] = useState(0);
  const [wholeBoxData, setWholeBoxData] = useState<WholeBoxConfirmData[]>([]);
  const [shippingData, setShippingData] = useState<ShippingConfirmData[]>([]);
  const [boxCounter, setBoxCounter] = useState(1);
  const [nextBoxNumber, setNextBoxNumber] = useState(1);
  const [shippingLoading, setShippingLoading] = useState(false); // 新增：发货加载状态
  
  // 未映射库存相关状态
  const [unmappedInventory, setUnmappedInventory] = useState<UnmappedInventoryItem[]>([]);
  const [mappingModalVisible, setMappingModalVisible] = useState(false);
  const [mappingForm] = Form.useForm();
  
  // 国家库存相关状态
  const [countryInventory, setCountryInventory] = useState<CountryInventory[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>(''); // 选中的国家



  // 获取合并数据（全部显示，不分页）
  const fetchMergedData = async (status = '待发货') => {
    setMergedLoading(true);
    try {
      // 如果选择了特定的状态，获取所有数据然后在前端筛选
      // 如果选择的是空或者待发货，使用后端筛选优化性能
      const useBackendFilter = !status || status === '待发货';
      const queryParams = new URLSearchParams({
        ...(useBackendFilter && status && { status }),
        limit: '1000' // 设置较大的限制来获取所有数据
      });
      
      console.log('🔍 合并数据API调用:', `${API_BASE_URL}/api/shipping/merged-data?${queryParams}`);
      
      const response = await fetch(`${API_BASE_URL}/api/shipping/merged-data?${queryParams}`, {
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
      console.log('📊 合并数据API响应:', result);
      
      if (result.code === 0) {
        setMergedData(result.data.list || []);
        
        // 检查是否有未映射的库存
        const unmappedItems = result.data.unmapped_inventory || [];
        setUnmappedInventory(unmappedItems);
        
        message.success(`加载了 ${result.data.list?.length || 0} 条合并数据`);
      } else {
        message.error(result.message || '获取合并数据失败');
      }
    } catch (error) {
      console.error('获取合并数据失败:', error);
      message.error(`获取合并数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
      // 设置空数据以防止界面异常
      setMergedData([]);
    } finally {
      setMergedLoading(false);
    }
  };

  // 获取国家库存数据
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

  useEffect(() => {
    fetchMergedData(statusFilter);
    fetchCountryInventory(); // 同时获取国家库存数据
  }, [statusFilter]);

  // 状态颜色映射
  const getStatusColor = (status: string) => {
    switch (status) {
      case '待发货': return 'orange';
      case '已发货': return 'green';
      case '已取消': return 'red';
      case '有库存无需求': return 'blue';
      case '库存未映射': return 'purple';
      default: return 'default';
    }
  };

  // 平台选项
  const marketplaceOptions = [
    'Amazon',
    'eBay', 
    'AliExpress',
    'Walmart',
    'Shopify',
    'Lazada',
    'Shopee'
  ];

  // 国家选项
  const countryOptions = [
    'US', 'UK', 'DE', 'FR', 'IT', 'ES', 'CA', 'JP', 'AU', 'SG', 'MY', 'TH', 'PH', 'ID', 'VN'
  ];

  // 运输方式选项
  const shippingMethodOptions = [
    '空运',
    '海运',
    '快递',
    '陆运',
    '铁运'
  ];



  // 处理列排序
  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    // 排序处理逻辑可以在这里添加
    console.log('排序变更:', sorter);
  };

  // 合并数据表格列定义（重新排序）
  const mergedColumns: ColumnsType<MergedShippingData> = [
    {
      title: '需求单号',
      dataIndex: 'need_num',
      key: 'need_num',
      width: 130,
      ellipsis: true,
      sorter: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      sorter: true,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: 'Amazon SKU',
      dataIndex: 'amz_sku',
      key: 'amz_sku',
      width: 130,
      ellipsis: true,
      sorter: true,
    },
    {
      title: '需求数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 90,
      align: 'center',
      sorter: true,
      render: (value: number) => <Text strong>{value}</Text>,
    },
    {
      title: '缺货数量',
      dataIndex: 'shortage',
      key: 'shortage',
      width: 90,
      align: 'center',
      sorter: true,
      render: (value: number) => (
        value > 0 ? <Text type="danger">{value}</Text> : <Text type="success">充足</Text>
      ),
    },
    {
      title: '可用库存',
      dataIndex: 'total_available',
      key: 'total_available',
      width: 90,
      align: 'center',
      sorter: true,
      render: (value: number) => (
        <Text type={value > 0 ? 'success' : 'danger'}>
          {value}
        </Text>
      ),
    },
    {
      title: '整箱数量',
      dataIndex: 'whole_box_quantity',
      key: 'whole_box_quantity',
      width: 90,
      align: 'center',
      sorter: true,
      render: (value: number) => value || '-',
    },
    {
      title: '混合箱数量',
      dataIndex: 'mixed_box_quantity',
      key: 'mixed_box_quantity',
      width: 90,
      align: 'center',
      sorter: true,
      render: (value: number) => value || '-',
    },
    {
      title: '平台',
      dataIndex: 'marketplace',
      key: 'marketplace',
      width: 90,
      sorter: true,
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 70,
      align: 'center',
      sorter: true,
    },
    {
      title: '运输方式',
      dataIndex: 'shipping_method',
      key: 'shipping_method',
      width: 100,
      sorter: true,
      render: (value: string) => value || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      sorter: true,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
  ];

  // 记录出库信息
  const recordOutbound = async (items: MixedBoxItem[] | WholeBoxConfirmData[], isMixedBox: boolean = false) => {
    console.log(`🚀 开始记录${isMixedBox ? '混合箱' : '整箱'}出库信息, 项目数量: ${items.length}`);
    try {
      const shipments = items.map(item => {
        if (isMixedBox) {
          // 混合箱出库
          const mixedItem = item as MixedBoxItem;
          // 从选中的记录中找到对应的国家和平台信息
          const selectedRecord = selectedRows.find(row => row.amz_sku === mixedItem.amz_sku);
          return {
            sku: mixedItem.sku,
            total_quantity: mixedItem.quantity,
            country: selectedRecord?.country || '美国',
            marketplace: selectedRecord?.marketplace === 'Amazon' ? '亚马逊' : selectedRecord?.marketplace || '亚马逊',
            is_mixed_box: true,
            original_mix_box_num: mixedItem.box_num // 传递原始混合箱单号
          };
        } else {
          // 整箱出库
          const wholeItem = item as WholeBoxConfirmData;
          // 从选中的记录中找到对应的本地SKU、国家和平台信息
          const selectedRecord = selectedRows.find(row => row.amz_sku === wholeItem.amz_sku);
          return {
            sku: selectedRecord?.local_sku || wholeItem.amz_sku,
            total_quantity: wholeItem.confirm_quantity,
            total_boxes: wholeItem.confirm_boxes,
            country: selectedRecord?.country || '美国',
            marketplace: selectedRecord?.marketplace === 'Amazon' ? '亚马逊' : selectedRecord?.marketplace || '亚马逊',
            is_mixed_box: false
          };
        }
      });

      const response = await fetch(`${API_BASE_URL}/api/shipping/outbound-record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
        body: JSON.stringify({
          shipments,
          operator: '申报出库'
        }),
      });

      const result = await response.json();
      
      if (result.code === 0) {
        console.log('出库记录成功:', result.data);
      } else {
        console.error('出库记录失败:', result.message);
        message.error(`出库记录失败: ${result.message}`);
      }
    } catch (error) {
      console.error('出库记录异常:', error);
      message.error(`出库记录异常: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 开始发货流程
  const handleStartShipping = async () => {
    if (selectedRows.length === 0) {
      message.warning('请先选择需要发货的记录');
      return;
    }

    setShippingLoading(true); // 开始加载
    message.loading('正在获取混合箱数据，请稍候...', 0); // 显示加载提示
    
    // 获取混合箱数据
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/mixed-boxes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
        body: JSON.stringify({
          records: selectedRows.map(row => ({
            record_num: row.record_num,
            local_sku: row.local_sku,
            amz_sku: row.amz_sku,
            country: row.country
          }))
        }),
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        const mixedBoxData = result.data.mixed_boxes || [];
        const wholeBoxData = result.data.whole_boxes || [];
        
        // 获取所有唯一的混合箱号
        const uniqueBoxNums: string[] = Array.from(new Set(mixedBoxData.map((item: MixedBoxItem) => item.box_num)));
        
        setMixedBoxes(mixedBoxData);
        setUniqueMixedBoxNums(uniqueBoxNums);
        setWholeBoxData(wholeBoxData);
        setCurrentMixedBoxIndex(0);
        setCurrentStep(0);
        setShippingData([]);
        setBoxCounter(1);
        setNextBoxNumber(1);
        setShippingModalVisible(true);
        message.destroy(); // 关闭加载提示
      } else {
        message.destroy(); // 关闭加载提示
        message.error(result.message || '获取混合箱数据失败');
      }
    } catch (error) {
      console.error('获取混合箱数据失败:', error);
      message.destroy(); // 关闭加载提示
      message.error(`获取混合箱数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setShippingLoading(false); // 结束加载
    }
  };

  // 确认混合箱发货
  const confirmMixedBox = async (boxData: MixedBoxItem[]) => {
    const newShippingData: ShippingConfirmData[] = boxData.map(item => ({
      box_num: String(nextBoxNumber),
      amz_sku: item.amz_sku,
      quantity: item.quantity
    }));
    
    setShippingData([...shippingData, ...newShippingData]);
    setNextBoxNumber(nextBoxNumber + 1); // 递增箱号
    
    // 记录混合箱出库信息
    await recordOutbound(boxData, true);
    
    if (currentMixedBoxIndex < uniqueMixedBoxNums.length - 1) {
      setCurrentMixedBoxIndex(currentMixedBoxIndex + 1);
    } else {
      // 混合箱处理完成，进入整箱确认
      setCurrentStep(1);
    }
  };

  // 确认整箱发货
  const confirmWholeBox = async (confirmedData: WholeBoxConfirmData[]) => {
    const newShippingData: ShippingConfirmData[] = [];
    let currentBoxNum = nextBoxNumber;
    
    confirmedData.forEach(item => {
      for (let i = 0; i < item.confirm_boxes; i++) {
        newShippingData.push({
          box_num: String(currentBoxNum),
          amz_sku: item.amz_sku,
          quantity: Math.floor(item.confirm_quantity / item.confirm_boxes)
        });
        currentBoxNum++;
      }
    });
    
    setShippingData([...shippingData, ...newShippingData]);
    setNextBoxNumber(currentBoxNum); // 更新下一个箱号
    
    // 记录整箱出库信息
    await recordOutbound(confirmedData, false);
    
    setCurrentStep(2);
  };

  // 导出Excel
  const exportToExcel = () => {
    // 准备Excel数据
    const data = [
      ['箱号', 'Amazon SKU', '发货数量'],
      ...shippingData.map(item => [item.box_num, item.amz_sku, item.quantity])
    ];
    
    // 创建工作簿和工作表
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    // 设置列宽
    const columnWidths = [
      { wch: 10 }, // 箱号
      { wch: 20 }, // Amazon SKU
      { wch: 12 }  // 发货数量
    ];
    worksheet['!cols'] = columnWidths;
    
    // 将工作表添加到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, '发货清单');
    
    // 生成文件名
    const fileName = `发货清单_${new Date().toISOString().slice(0, 10)}.xlsx`;
    
    // 导出文件
    XLSX.writeFile(workbook, fileName);
  };

  // 获取Amazon站点URL
  const getAmazonSite = (country: string) => {
    switch (country) {
      case '英国': 
      case 'UK': return 'www.amazon.co.uk';
      case '美国': 
      case 'US': return 'www.amazon.com';
      case '阿联酋': 
      case 'AE': return 'www.amazon.ae';
      case '澳大利亚': 
      case 'AU': return 'www.amazon.com.au';
      case '加拿大': 
      case 'CA': return 'www.amazon.ca';
      default: return `www.amazon.${country.toLowerCase()}`;
    }
  };

  // 获取Amazon SKU前缀
  const getAmazonSkuPrefix = (country: string) => {
    switch (country) {
      case '美国':
      case 'US': return 'NA';
      case '英国':
      case 'UK': return 'SF';
      case '澳大利亚':
      case 'AU': return 'AU';
      case '阿联酋':
      case 'AE': return 'AE';
      case '加拿大':
      case 'CA': return 'CH';
      default: return '';
    }
  };

  // 点击创建映射按钮
  const handleCreateMappingClick = () => {
    const unmappedSelectedRows = selectedRows.filter(row => row.status === '库存未映射');
    if (unmappedSelectedRows.length === 0) {
      message.warning('请先选择库存未映射的记录');
      return;
    }
    
    // 转换为UnmappedInventoryItem格式并自动生成Amazon SKU
    const mappingData = unmappedSelectedRows.map(row => {
      const prefix = getAmazonSkuPrefix(row.country);
      const autoAmzSku = prefix ? `${prefix}${row.local_sku}` : '';
      return {
        local_sku: row.local_sku,
        country: row.country,
        whole_box_quantity: row.whole_box_quantity,
        whole_box_count: row.whole_box_count,
        mixed_box_quantity: row.mixed_box_quantity,
        total_available: row.total_available,
        auto_amz_sku: autoAmzSku, // 自动生成的Amazon SKU
        site: getAmazonSite(row.country) // 正确的站点URL
      };
    });
    
    setUnmappedInventory(mappingData);
    setMappingModalVisible(true);
    
    // 为所有有前缀的国家预填充表单
    const formValues: any = {};
    mappingData.forEach(item => {
      if (item.auto_amz_sku) {
        formValues[`amz_sku_${item.local_sku}_${item.country}`] = item.auto_amz_sku;
      }
    });
    // 使用setTimeout确保表单字段已经渲染完成后再设置值
    setTimeout(() => {
      mappingForm.setFieldsValue(formValues);
    }, 100);
  };

  // 创建SKU映射
  const handleCreateMapping = async (values: any) => {
    try {
      const mappings = unmappedInventory.map(item => ({
        local_sku: item.local_sku,
        amz_sku: values[`amz_sku_${item.local_sku}_${item.country}`],
        country: item.country,
        site: item.site || getAmazonSite(item.country)
      })).filter(mapping => mapping.amz_sku && mapping.amz_sku.trim() !== '');

      if (mappings.length === 0) {
        message.warning('请至少填写一个Amazon SKU映射');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/shipping/create-mapping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
        body: JSON.stringify({ mappings }),
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success(`成功创建 ${result.data.created} 个SKU映射`);
        setMappingModalVisible(false);
        mappingForm.resetFields();
        // 重新加载数据
        fetchMergedData(statusFilter);
      } else {
        message.error(result.message || '创建映射失败');
      }
    } catch (error) {
      console.error('创建映射失败:', error);
      message.error(`创建映射失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 添加需求
  const handleAdd = async (values: AddNeedForm[]) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/needs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
        body: JSON.stringify({
          needs: values,
          created_by: user?.username
        }),
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success('添加成功');
        setAddModalVisible(false);
        addForm.resetFields();
        fetchMergedData(statusFilter);
      } else {
        message.error(result.message || '添加失败');
      }
    } catch (error) {
      console.error('添加失败:', error);
      message.error(`添加失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>发货需求管理</Title>
      
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAddModalVisible(true)}
          >
            添加需求
          </Button>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleStartShipping}
            disabled={selectedRowKeys.length === 0}
            loading={shippingLoading}
          >
            批量发货 ({selectedRowKeys.length})
          </Button>
        </Col>
        <Col>
          <Button
            type="default"
            onClick={handleCreateMappingClick}
            disabled={selectedRows.filter(row => row.status === '库存未映射').length === 0}
          >
            创建SKU映射 ({selectedRows.filter(row => row.status === '库存未映射').length})
          </Button>
        </Col>
        <Col>
          <Select
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
            }}
            style={{ width: 150 }}
          >
            <Option value="">全部状态</Option>
            <Option value="待发货">待发货</Option>
            <Option value="已发货">已发货</Option>
            <Option value="已取消">已取消</Option>
            <Option value="有库存无需求">有库存无需求</Option>
            <Option value="库存未映射">库存未映射</Option>
          </Select>
        </Col>

      </Row>

      {/* 国家库存卡片栏 */}
      {countryInventory.length > 0 && (
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
          style={{ marginBottom: 16 }}
        >
          <Row gutter={[16, 16]}>
            {/* 全部国家按钮 */}
            <Col>
              <div
                style={{
                  cursor: 'pointer',
                  padding: '8px 16px',
                  border: `2px solid ${selectedCountry === '' ? '#1677ff' : '#d9d9d9'}`,
                  borderRadius: '6px',
                  backgroundColor: selectedCountry === '' ? '#f0f6ff' : '#fff',
                  transition: 'all 0.3s'
                }}
                onClick={() => {
                  setSelectedCountry('');
                  setFilterType(''); // 清除其他筛选
                }}
              >
                <Statistic
                  title="全部国家"
                  value={countryInventory.reduce((sum, item) => sum + item.total_quantity, 0)}
                  valueStyle={{ 
                    color: selectedCountry === '' ? '#1677ff' : '#666',
                    fontSize: '16px'
                  }}
                  suffix="件"
                />
              </div>
            </Col>
            
            {/* 各国家库存卡片 */}
            {countryInventory.map((country) => (
              <Col key={country.country}>
                <div
                  style={{
                    cursor: 'pointer',
                    padding: '8px 16px',
                    border: `2px solid ${selectedCountry === country.country ? '#1677ff' : '#d9d9d9'}`,
                    borderRadius: '6px',
                    backgroundColor: selectedCountry === country.country ? '#f0f6ff' : '#fff',
                    transition: 'all 0.3s',
                    minWidth: '120px'
                  }}
                  onClick={() => {
                    setSelectedCountry(selectedCountry === country.country ? '' : country.country);
                    setFilterType(''); // 清除其他筛选
                    setStatusFilter(''); // 清除状态筛选
                  }}
                >
                  <Statistic
                    title={
                      <div>
                        <Text strong>{country.country}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '10px' }}>
                          整箱: {country.whole_box_quantity} | 混合箱: {country.mixed_box_quantity}
                        </Text>
                      </div>
                    }
                    value={country.total_quantity}
                    valueStyle={{ 
                      color: selectedCountry === country.country ? '#1677ff' : '#666',
                      fontSize: '18px'
                    }}
                    suffix="件"
                  />
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}

          <Card style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={3}>
                <div 
                  style={{ cursor: 'pointer' }} 
                  onClick={() => {
                    const newFilterType = filterType === 'needs' ? '' : 'needs';
                    setFilterType(newFilterType);
                    if (newFilterType !== '') {
                      setStatusFilter(''); // 自动设置为全部状态
                    }
                  }}
                >
                  <Statistic
                    title="发货需求数"
                    value={mergedData.filter(item => item.quantity > 0).length}
                    prefix={<PlusOutlined />}
                    valueStyle={{ color: filterType === 'needs' ? '#1677ff' : undefined }}
                  />
                </div>
              </Col>
              <Col span={3}>
                <div 
                  style={{ cursor: 'pointer' }} 
                  onClick={() => {
                    const newFilterType = filterType === 'sufficient' ? '' : 'sufficient';
                    setFilterType(newFilterType);
                    if (newFilterType !== '') {
                      setStatusFilter(''); // 自动设置为全部状态
                    }
                  }}
                >
                  <Statistic
                    title="库存充足需求"
                    value={mergedData.filter(item => item.quantity > 0 && item.shortage === 0).length}
                    valueStyle={{ color: filterType === 'sufficient' ? '#1677ff' : '#3f8600' }}
                    prefix={<CheckOutlined />}
                  />
                </div>
              </Col>
              <Col span={3}>
                <div 
                  style={{ cursor: 'pointer' }} 
                  onClick={() => {
                    const newFilterType = filterType === 'shortage' ? '' : 'shortage';
                    setFilterType(newFilterType);
                    if (newFilterType !== '') {
                      setStatusFilter(''); // 自动设置为全部状态
                    }
                  }}
                >
                  <Statistic
                    title="库存不足需求"
                    value={mergedData.filter(item => item.quantity > 0 && item.shortage > 0).length}
                    valueStyle={{ color: filterType === 'shortage' ? '#1677ff' : '#cf1322' }}
                    prefix={<CloseOutlined />}
                  />
                </div>
              </Col>
              <Col span={3}>
                <div 
                  style={{ cursor: 'pointer' }} 
                  onClick={() => {
                    const newFilterType = filterType === 'shortage' ? '' : 'shortage';
                    setFilterType(newFilterType);
                    if (newFilterType !== '') {
                      setStatusFilter(''); // 自动设置为全部状态
                    }
                  }}
                >
                  <Statistic
                    title="缺货SKU"
                    value={mergedData.filter(item => item.quantity > 0 && item.shortage > 0).length}
                    valueStyle={{ color: filterType === 'shortage' ? '#1677ff' : '#fa8c16' }}
                  />
                </div>
              </Col>
              <Col span={3}>
                <div 
                  style={{ cursor: 'pointer' }} 
                  onClick={() => {
                    const newFilterType = filterType === 'inventory-only' ? '' : 'inventory-only';
                    setFilterType(newFilterType);
                    if (newFilterType !== '') {
                      setStatusFilter(''); // 自动设置为全部状态
                    }
                  }}
                >
                  <Statistic
                    title="有库存无需求"
                    value={mergedData.filter(item => item.quantity === 0 && item.total_available > 0).length}
                    valueStyle={{ color: filterType === 'inventory-only' ? '#1677ff' : '#1677ff' }}
                  />
                </div>
              </Col>
              <Col span={3}>
                <div 
                  style={{ cursor: 'pointer' }} 
                  onClick={() => {
                    const newFilterType = filterType === 'unmapped-inventory' ? '' : 'unmapped-inventory';
                    setFilterType(newFilterType);
                    if (newFilterType !== '') {
                      setStatusFilter(''); // 自动设置为全部状态
                    }
                  }}
                >
                  <Statistic
                    title="库存未映射"
                    value={mergedData.filter(item => item.status === '库存未映射').length}
                    valueStyle={{ color: filterType === 'unmapped-inventory' ? '#1677ff' : '#722ed1' }}
                  />
                </div>
              </Col>
              <Col span={3}>
                <div 
                  style={{ cursor: 'pointer' }} 
                  onClick={() => {
                    setFilterType('');
                    setStatusFilter(''); // 清除所有筛选时也设置为全部状态
                  }}
                >
                  <Statistic
                    title="总记录数"
                    value={mergedData.length}
                    valueStyle={{ color: filterType === '' ? '#1677ff' : '#666' }}
                  />
                </div>
              </Col>
              <Col span={3}>
                {/* 空列用于保持布局对称 */}
              </Col>
            </Row>
          </Card>

          <Card size="small" style={{ marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              行颜色说明：
              <Tag color="blue" style={{ marginLeft: 8 }}>蓝色 - 有库存无需求</Tag>
              <Tag color="red" style={{ marginLeft: 4 }}>红色 - 需求缺货</Tag>
              <Tag color="orange" style={{ marginLeft: 4 }}>橙色 - 需求未映射</Tag>
              <Tag color="green" style={{ marginLeft: 4 }}>绿色 - 需求库存充足</Tag>
            </Text>
          </Card>

          <Table
            columns={mergedColumns}
            dataSource={mergedData.filter(item => {
              // 首先按国家筛选（新增）
              if (selectedCountry && selectedCountry !== '') {
                if (item.country !== selectedCountry) {
                  return false;
                }
              }
              
              // 然后按状态筛选下拉菜单进行过滤
              if (statusFilter && statusFilter !== '') {
                if (item.status !== statusFilter) {
                  return false;
                }
              }
              
              // 最后按卡片筛选类型进行过滤
              switch (filterType) {
                case 'needs':
                  return item.quantity > 0;
                case 'sufficient':
                  return item.quantity > 0 && item.shortage === 0;
                case 'shortage':
                  return item.quantity > 0 && item.shortage > 0;
                case 'unmapped':
                  return item.quantity > 0 && !item.local_sku;
                case 'inventory-only':
                  return item.quantity === 0 && item.total_available > 0;
                case 'unmapped-inventory':
                  return item.status === '库存未映射';
                default:
                  return true; // 显示所有数据
              }
            })}
            rowKey="record_num"
            loading={mergedLoading}
            pagination={false}
            scroll={{ x: 1500 }}
            onChange={handleTableChange}
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys,
              onChange: (newSelectedRowKeys, newSelectedRows) => {
                // 检查选中的记录是否都是同一个国家
                if (newSelectedRows.length > 1) {
                  const countries = Array.from(new Set(newSelectedRows.map(row => row.country)));
                  if (countries.length > 1) {
                    message.error(`只能选择同一国家的记录进行批量发货！当前选择了：${countries.join('、')}`);
                    return; // 不更新选择状态
                  }
                }
                setSelectedRowKeys(newSelectedRowKeys);
                setSelectedRows(newSelectedRows);
              },
              getCheckboxProps: (record) => ({
                disabled: false, // 所有记录都可以选择
                name: record.amz_sku,
              }),
            }}
            rowClassName={(record) => {
              // 有库存无需求的记录
              if (record.quantity === 0 && record.total_available > 0) return 'inventory-only-row';
              // 有需求但缺货的记录
              if (record.quantity > 0 && record.shortage > 0) return 'shortage-row';
              // 有需求但未映射SKU的记录
              if (record.quantity > 0 && !record.local_sku) return 'unmapped-row';
              // 有需求且库存充足的记录
              if (record.quantity > 0 && record.shortage === 0 && record.local_sku) return 'sufficient-row';
              return '';
            }}
          />


      {/* 添加需求模态框 */}
      <Modal
        title="添加发货需求"
        open={addModalVisible}
        onCancel={() => {
          setAddModalVisible(false);
          addForm.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={(values) => {
            // 支持批量添加，表单数据转换为数组
            const needsArray = [{
              sku: values.sku,
              quantity: values.quantity,
              shipping_method: values.shipping_method,
              marketplace: values.marketplace,
              country: values.country,
              remark: values.remark
            }];
            handleAdd(needsArray);
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="SKU"
                name="sku"
                rules={[{ required: true, message: '请输入SKU' }]}
              >
                <Input placeholder="请输入SKU" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="数量"
                name="quantity"
                rules={[{ required: true, message: '请输入数量' }]}
              >
                <InputNumber
                  min={1}
                  placeholder="请输入数量"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="平台"
                name="marketplace"
                rules={[{ required: true, message: '请选择平台' }]}
              >
                <Select placeholder="请选择平台">
                  {marketplaceOptions.map(option => (
                    <Option key={option} value={option}>{option}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="国家"
                name="country"
                rules={[{ required: true, message: '请选择国家' }]}
              >
                <Select placeholder="请选择国家">
                  {countryOptions.map(option => (
                    <Option key={option} value={option}>{option}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="运输方式"
                name="shipping_method"
              >
                <Select placeholder="请选择运输方式">
                  {shippingMethodOptions.map(option => (
                    <Option key={option} value={option}>{option}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
              <Button onClick={() => {
                setAddModalVisible(false);
                addForm.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 发货确认模态框 */}
      <Modal
        title="批量发货确认"
        open={shippingModalVisible}
        onCancel={() => {
          setShippingModalVisible(false);
          setSelectedRowKeys([]);
          setSelectedRows([]);
        }}
        footer={null}
        width={1000}
        destroyOnClose
      >
        <Steps current={currentStep} style={{ marginBottom: 24 }}>
          <Steps.Step title="混合箱确认" description="确认混合箱发货" />
          <Steps.Step title="整箱确认" description="确认整箱发货" />
          <Steps.Step title="完成" description="生成发货清单" />
        </Steps>

        {currentStep === 0 && uniqueMixedBoxNums.length > 0 && (
          <div>
            <Alert
              message={`混合箱 ${currentMixedBoxIndex + 1}/${uniqueMixedBoxNums.length}: ${uniqueMixedBoxNums[currentMixedBoxIndex]}`}
              description="以下是该混合箱内的所有产品，请确认是否发出"
              type="info"
              style={{ marginBottom: 16 }}
            />
            <Table
              dataSource={mixedBoxes.filter(item => item.box_num === uniqueMixedBoxNums[currentMixedBoxIndex])}
              columns={[
                { title: '原始混合箱号', dataIndex: 'box_num', key: 'box_num', width: 120, align: 'center' },
                { title: '本地SKU', dataIndex: 'sku', key: 'sku', width: 120 },
                { title: 'Amazon SKU', dataIndex: 'amz_sku', key: 'amz_sku', width: 130 },
                { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80, align: 'center' },
              ]}
              pagination={false}
              size="small"
              rowKey={(record) => `${record.box_num}_${record.sku}`}
            />
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => {
                  if (currentMixedBoxIndex < uniqueMixedBoxNums.length - 1) {
                    setCurrentMixedBoxIndex(currentMixedBoxIndex + 1);
                  } else {
                    setCurrentStep(1);
                  }
                }}>
                  跳过此箱
                </Button>
                <Button type="primary" onClick={() => {
                  const currentBoxData = mixedBoxes.filter(item => item.box_num === uniqueMixedBoxNums[currentMixedBoxIndex]);
                  confirmMixedBox(currentBoxData);
                }}>
                  确认发出
                </Button>
              </Space>
            </div>
          </div>
        )}

        {currentStep === 0 && uniqueMixedBoxNums.length === 0 && (
          <div>
            <Alert message="没有混合箱需要处理" type="info" style={{ marginBottom: 16 }} />
            <Button type="primary" onClick={() => setCurrentStep(1)}>
              继续处理整箱
            </Button>
          </div>
        )}

        {currentStep === 1 && (
          <WholeBoxConfirmForm 
            data={wholeBoxData} 
            onConfirm={confirmWholeBox}
            onSkip={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 2 && (
          <div>
            <Alert message="发货清单已生成" type="success" style={{ marginBottom: 16 }} />
            <Table
              dataSource={shippingData}
              columns={[
                { title: '箱号', dataIndex: 'box_num', key: 'box_num' },
                { title: 'Amazon SKU', dataIndex: 'amz_sku', key: 'amz_sku' },
                { title: '发货数量', dataIndex: 'quantity', key: 'quantity' },
              ]}
              pagination={false}
              size="small"
              rowKey={(record) => `${record.box_num}_${record.amz_sku}`}
            />
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Space>
                <Button icon={<ExportOutlined />} onClick={exportToExcel}>
                  导出Excel
                </Button>
                <Button type="primary" onClick={async () => {
                  setShippingModalVisible(false);
                  setSelectedRowKeys([]);
                  setSelectedRows([]);
                  message.success('发货流程完成！');
                  // 刷新数据
                  message.loading('正在刷新发货需求数据...', 0);
                  try {
                    await Promise.all([
                      fetchMergedData(statusFilter),
                      fetchCountryInventory() // 同时刷新国家库存数据
                    ]);
                    message.destroy();
                    message.success('数据已刷新！');
                  } catch (error) {
                    message.destroy();
                    message.error('数据刷新失败，请手动刷新页面');
                  }
                }}>
                  完成
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Modal>

      {/* SKU映射对话框 */}
      <Modal
        title="创建SKU映射"
        open={mappingModalVisible}
        onCancel={() => {
          setMappingModalVisible(false);
          mappingForm.resetFields();
        }}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Alert
          message="创建SKU映射"
          description={`您选择了 ${unmappedInventory.length} 个未映射的库存记录，请确认或修改Amazon SKU映射关系。系统已根据国家自动生成Amazon SKU：美国(NA)、英国(SF)、澳大利亚(AU)、阿联酋(AE)、加拿大(CH)。`}
          type="info"
          style={{ marginBottom: 16 }}
        />
        
        <Form
          form={mappingForm}
          layout="vertical"
          onFinish={handleCreateMapping}
        >
          <Table
            dataSource={unmappedInventory}
            columns={[
              {
                title: '本地SKU',
                dataIndex: 'local_sku',
                key: 'local_sku',
                width: 120,
              },
              {
                title: '国家',
                dataIndex: 'country',
                key: 'country',
                width: 80,
                align: 'center',
              },
              {
                title: 'Site',
                key: 'site',
                width: 180,
                render: (_, record) => (
                  <Text>{record.site || getAmazonSite(record.country)}</Text>
                ),
              },
              {
                title: 'Amazon SKU',
                key: 'amz_sku',
                render: (_, record) => {
                  const prefix = getAmazonSkuPrefix(record.country);
                  const defaultValue = prefix ? `${prefix}${record.local_sku}` : '';
                  return (
                    <Form.Item
                      name={`amz_sku_${record.local_sku}_${record.country}`}
                      style={{ margin: 0 }}
                      initialValue={defaultValue}
                    >
                      <Input
                        placeholder={
                          prefix 
                            ? `${prefix}${record.local_sku}` 
                            : '请输入Amazon SKU'
                        }
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  );
                },
              },
            ]}
            pagination={false}
            size="small"
            rowKey={(record) => `${record.local_sku}_${record.country}`}
            scroll={{ y: 400 }}
          />
          
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setMappingModalVisible(false);
                mappingForm.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                创建映射
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>

    </div>
  );
};

// 整箱确认表单组件
const WholeBoxConfirmForm: React.FC<{
  data: WholeBoxConfirmData[];
  onConfirm: (data: WholeBoxConfirmData[]) => void;
  onSkip: () => void;
}> = ({ data, onConfirm, onSkip }) => {
  const [form] = Form.useForm();
  const [confirmData, setConfirmData] = useState<WholeBoxConfirmData[]>(
    data.map(item => ({
      ...item,
      confirm_boxes: item.total_boxes,
      confirm_quantity: item.total_quantity
    }))
  );

  useEffect(() => {
    form.setFieldsValue(
      confirmData.reduce((acc, item, index) => {
        acc[`confirm_boxes_${index}`] = item.confirm_boxes;
        acc[`confirm_quantity_${index}`] = item.confirm_quantity;
        return acc;
      }, {} as any)
    );
  }, [confirmData, form]);

  if (data.length === 0) {
    return (
      <div>
        <Alert message="没有整箱需要处理" type="info" style={{ marginBottom: 16 }} />
        <Button type="primary" onClick={onSkip}>
          继续
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Alert
        message="整箱发货确认"
        description="请确认各SKU的发货箱数和数量"
        type="info"
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical">
        <Table
          dataSource={confirmData}
          columns={[
            { title: 'Amazon SKU', dataIndex: 'amz_sku', key: 'amz_sku' },
            { title: '总数量', dataIndex: 'total_quantity', key: 'total_quantity' },
            { title: '总箱数', dataIndex: 'total_boxes', key: 'total_boxes' },
            {
              title: '确认箱数',
              key: 'confirm_boxes',
              render: (_, record, index) => (
                <InputNumber
                  min={0}
                  max={record.total_boxes}
                  value={record.confirm_boxes}
                  onChange={(value) => {
                    const newData = [...confirmData];
                    newData[index].confirm_boxes = value || 0;
                    newData[index].confirm_quantity = Math.min(
                      value || 0 * Math.floor(record.total_quantity / record.total_boxes),
                      record.total_quantity
                    );
                    setConfirmData(newData);
                  }}
                />
              )
            },
            {
              title: '确认数量',
              key: 'confirm_quantity',
              render: (_, record, index) => (
                <InputNumber
                  min={0}
                  max={record.total_quantity}
                  value={record.confirm_quantity}
                  onChange={(value) => {
                    const newData = [...confirmData];
                    newData[index].confirm_quantity = value || 0;
                    setConfirmData(newData);
                  }}
                />
              )
            },
          ]}
          pagination={false}
          size="small"
          rowKey="amz_sku"
        />
      </Form>
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Space>
          <Button onClick={onSkip}>跳过整箱</Button>
          <Button type="primary" onClick={() => onConfirm(confirmData)}>
            确认发货
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default ShippingPage; 