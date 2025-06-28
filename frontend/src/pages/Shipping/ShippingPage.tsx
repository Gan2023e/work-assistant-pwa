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
  Steps,
  Alert,
  Upload,
  Descriptions,
  Layout,
  Menu
} from 'antd';
import { 
  PlusOutlined,
  CheckOutlined,
  CloseOutlined,
  SendOutlined,
  ExportOutlined,
  GlobalOutlined,
  SettingOutlined,
  UploadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  BarChartOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  HistoryOutlined,
  UnorderedListOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import OrderManagementPage from './OrderManagementPage';

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
const { Sider, Content } = Layout;



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

interface CountryInventory {
  country: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  mixed_box_count: number;
  total_quantity: number;
}

interface AmazonTemplateConfig {
  hasTemplate: boolean;
  templates?: Record<string, CountryTemplateConfig>;
  countries?: string[];
  filename?: string;
  originalName?: string;
  filePath?: string;
  uploadTime?: string;
  sheetName?: string;
  merchantSkuColumn?: string;
  quantityColumn?: string;
  startRow?: number;
  sheetNames?: string[];
  country?: string;
  countryName?: string;
  message?: string;
}

interface CountryTemplateConfig {
  filename: string;
  originalName: string;
  filePath: string;
  uploadTime: string;
  sheetName: string;
  merchantSkuColumn: string;
  quantityColumn: string;
  startRow: number;
  sheetNames: string[];
  country: string;
  countryName: string;
}

interface PackingListItem {
  box_num: string;
  sku: string;
  quantity: number;
}

interface BoxInfo {
  box_num: string;
  weight?: number;
  width?: number;
  length?: number;
  height?: number;
}

interface PackingListConfig {
  filename: string;
  originalName: string;
  uploadTime: string;
  sheetName: string;
  skuStartRow: number; // SKU开始行
  headerRow: number; // 标题行
  boxColumns: string[]; // 所有箱子列，如['L', 'M', 'N', 'O', 'P']
  boxNumbers: string[]; // 箱子编号，如['1', '2', '3', '4', '5']
  sheetNames: string[];
  items: PackingListItem[];
  boxes: BoxInfo[];
}

const ShippingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mergedData, setMergedData] = useState<MergedShippingData[]>([]);
  const [mergedLoading, setMergedLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addForm] = Form.useForm();

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

  const [nextBoxNumber, setNextBoxNumber] = useState(1);
  // 存储确认的发货数据，用于最终的出库记录
  const [confirmedMixedBoxes, setConfirmedMixedBoxes] = useState<MixedBoxItem[]>([]);
  const [confirmedWholeBoxes, setConfirmedWholeBoxes] = useState<WholeBoxConfirmData[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false); // 新增：发货加载状态
  
  // 未映射库存相关状态
  const [unmappedInventory, setUnmappedInventory] = useState<UnmappedInventoryItem[]>([]);
  const [mappingModalVisible, setMappingModalVisible] = useState(false);
  const [mappingForm] = Form.useForm();
  
  // 国家库存相关状态
  const [countryInventory, setCountryInventory] = useState<CountryInventory[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>(''); // 选中的国家

  // 亚马逊模板相关状态
  const [amazonTemplateConfig, setAmazonTemplateConfig] = useState<AmazonTemplateConfig>({ hasTemplate: false });
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [templateForm] = Form.useForm();
  const [uploadLoading, setUploadLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [selectedTemplateCountry, setSelectedTemplateCountry] = useState<string>('');
  
  // 装箱表相关状态
  const [packingListConfig, setPackingListConfig] = useState<PackingListConfig | null>(null);
  const [packingListModalVisible, setPackingListModalVisible] = useState(false);
  const [packingListForm] = Form.useForm();
  const [packingListLoading, setPackingListLoading] = useState(false);
  
  // 删除确认对话框状态
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteTargetCountry, setDeleteTargetCountry] = useState<string>('');
  const [deleteTargetTemplate, setDeleteTargetTemplate] = useState<any>(null);

  // 国家选项配置
  const countryTemplateOptions = [
    { value: '美国', label: '美国 (US)', site: 'amazon.com' },
    { value: '英国', label: '英国 (UK)', site: 'amazon.co.uk' },
    { value: '德国', label: '德国 (DE)', site: 'amazon.de' },
    { value: '法国', label: '法国 (FR)', site: 'amazon.fr' },
    { value: '意大利', label: '意大利 (IT)', site: 'amazon.it' },
    { value: '西班牙', label: '西班牙 (ES)', site: 'amazon.es' },
    { value: '加拿大', label: '加拿大 (CA)', site: 'amazon.ca' },
    { value: '日本', label: '日本 (JP)', site: 'amazon.co.jp' },
    { value: '澳大利亚', label: '澳大利亚 (AU)', site: 'amazon.com.au' },
    { value: '新加坡', label: '新加坡 (SG)', site: 'amazon.sg' },
    { value: '阿联酋', label: '阿联酋 (AE)', site: 'amazon.ae' },
  ];

  // 1. 顶部state
  const [logisticsProvider, setLogisticsProvider] = useState<string>('裕盛泰');
  const logisticsProviderOptions = [
    { label: '裕盛泰', value: '裕盛泰' },
    { label: '东方瑞达', value: '东方瑞达' },
  ];

  // 侧边栏子功能key
  const [sideKey, setSideKey] = useState('shipping-ops');

  // 侧边栏菜单项
  const sideMenuItems = [
    { key: 'shipping-ops', icon: <AppstoreOutlined />, label: '发货操作' },
    { key: 'order-mgmt', icon: <UnorderedListOutlined />, label: '需求单管理' },
    { key: 'shipping-history', icon: <HistoryOutlined />, label: '发货历史' },
    { key: 'template-mgmt', icon: <SettingOutlined />, label: '模板管理' },
    { key: 'packing-list', icon: <FileExcelOutlined />, label: '装箱表管理' },
  ];

  // 获取亚马逊模板配置
  const fetchAmazonTemplateConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/amazon-template/config`);
      const result = await response.json();
      
      if (result.success) {
        setAmazonTemplateConfig(result.data);
      } else {
        console.error('获取模板配置失败:', result.message);
      }
    } catch (error) {
      console.error('获取模板配置失败:', error);
    }
  };

  // 上传亚马逊模板
  const handleUploadTemplate = async (values: any) => {
    console.log('🔍 开始上传模板，提交的values:', values);
    setUploadLoading(true);
    try {
      // 检查文件是否存在
      if (!values.template || values.template.length === 0) {
        console.error('❌ 文件检查失败:', values.template);
        message.error('请选择要上传的模板文件');
        setUploadLoading(false);
        return;
      }

      const file = values.template[0].originFileObj;
      if (!file) {
        console.error('❌ 文件对象获取失败:', values.template[0]);
        message.error('文件获取失败，请重新选择');
        setUploadLoading(false);
        return;
      }

      console.log('📁 获取到文件:', { name: file.name, size: file.size, type: file.type });

      const formData = new FormData();
      formData.append('template', file);
      formData.append('sheetName', values.sheetName);
      formData.append('merchantSkuColumn', values.merchantSkuColumn);
      formData.append('quantityColumn', values.quantityColumn);
      formData.append('startRow', values.startRow.toString());
      formData.append('country', values.country);
      
      // 找到对应的国家名称
      const countryOption = countryTemplateOptions.find(opt => opt.value === values.country);
      if (countryOption) {
        formData.append('countryName', countryOption.label);
      }

      console.log('🚀 发送上传请求到:', `${API_BASE_URL}/api/shipping/amazon-template/upload`);
      
      const response = await fetch(`${API_BASE_URL}/api/shipping/amazon-template/upload`, {
        method: 'POST',
        body: formData,
      });

      console.log('📡 服务器响应状态:', response.status);
      
      const result = await response.json();
      console.log('📊 服务器响应结果:', result);
      
      if (result.success) {
        message.success(`${result.data.countryName || result.data.country} 模板上传成功！`);
        
        // 重新获取所有模板配置
        await fetchAmazonTemplateConfig();
        setTemplateModalVisible(false);
        templateForm.resetFields();
        setSelectedTemplateCountry('');
      } else {
        console.error('❌ 服务器返回错误:', result.message);
        message.error(result.message || '上传失败');
      }
    } catch (error) {
      console.error('❌ 上传模板失败:', error);
      message.error('网络错误或服务器异常');
    } finally {
      setUploadLoading(false);
    }
  };

  // 生成亚马逊发货文件
  const generateAmazonFile = async () => {
    if (!amazonTemplateConfig.hasTemplate) {
      message.warning('请先上传亚马逊模板');
      return;
    }

    // 使用已确认的发货数据，如果没有则使用所有待发货的数据
    let dataToGenerate = [];
    
    if (shippingData && shippingData.length > 0) {
      // 使用已确认的发货数据，需要补充country信息
      dataToGenerate = shippingData.map(item => {
        // 从selectedRows中找到对应的国家信息
        const selectedRecord = selectedRows.find(row => row.amz_sku === item.amz_sku);
        return {
          ...item,
          country: selectedRecord?.country || '默认'
        };
      });
    } else {
      // 将mergedData转换为发货数据格式
      dataToGenerate = mergedData
        .filter(item => item.status === '待发货' && item.amz_sku)
        .map(item => ({
          box_num: `AUTO-${item.record_num}`,
          amz_sku: item.amz_sku,
          quantity: item.quantity,
          country: item.country
        }));
    }
    
    if (dataToGenerate.length === 0) {
      message.warning('没有可用的发货数据，请确保有待发货的商品且已映射Amazon SKU');
      return;
    }

    

    setGenerateLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/amazon-template/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shippingData: dataToGenerate
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        const data = result.data;
        message.success(
          `亚马逊发货文件生成成功！生成了 ${data.totalCountries} 个国家的文件，包含 ${data.totalItems} 个SKU，总数量 ${data.totalQuantity}`
        );
        
        // 自动下载所有文件
        data.files.forEach((file: any, index: number) => {
          setTimeout(async () => {
            try {
              const downloadUrl = `${API_BASE_URL}${file.downloadUrl}`;
    
              
              // 先检查文件是否存在
              const checkResponse = await fetch(downloadUrl, { method: 'HEAD' });
              if (!checkResponse.ok) {
                console.error(`❌ 文件不存在或无法访问: ${file.filename}`);
                message.error(`文件 ${file.filename} 下载失败：文件不存在`);
                return;
              }
              
              // 创建下载链接
              const link = document.createElement('a');
              link.href = downloadUrl;
              link.download = file.filename;
              link.target = '_blank'; // 在新标签页打开，如果直接下载失败
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              

            } catch (error) {
              console.error(`❌ 文件下载失败: ${file.filename}`, error);
              message.error(`文件 ${file.filename} 下载失败`);
            }
          }, index * 1500); // 增加间隔到1.5秒，避免浏览器阻止
        });
      } else {
        message.error(result.message || '生成失败');
      }
    } catch (error) {
      console.error('生成亚马逊文件失败:', error);
      message.error('生成失败');
    } finally {
      setGenerateLoading(false);
    }
  };

    // 删除模板配置
  const deleteTemplateConfig = async (country?: string) => {
    try {
      const url = country 
        ? `${API_BASE_URL}/api/shipping/amazon-template/config?country=${encodeURIComponent(country)}`
        : `${API_BASE_URL}/api/shipping/amazon-template/config`;
        
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
      });

      const result = await response.json();
      
      if (result.success) {
        message.success(result.message || '模板配置已删除');
        
        // 重新获取模板配置
        await fetchAmazonTemplateConfig();
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除模板配置失败:', error);
      message.error('删除失败');
    }
  };

  // 获取装箱表配置
  const fetchPackingListConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/packing-list/config`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setPackingListConfig(result.data);
      }
    } catch (error) {
      console.error('获取装箱表配置失败:', error);
    }
  };

  // 上传装箱表
  const handleUploadPackingList = async (values: any) => {
    setPackingListLoading(true);
    try {
      // 检查文件是否存在
      if (!values.packingList || !values.packingList.fileList || values.packingList.fileList.length === 0) {
        message.error('请选择要上传的装箱表文件');
        setPackingListLoading(false);
        return;
      }

      const file = values.packingList.fileList[0].originFileObj;
      if (!file) {
        message.error('文件获取失败，请重新选择');
        setPackingListLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('packingList', file);
      formData.append('sheetName', values.sheetName);
      formData.append('headerRow', values.headerRow.toString());
      formData.append('skuStartRow', values.skuStartRow.toString());
      formData.append('boxStartColumn', values.boxStartColumn);
      formData.append('boxCount', values.boxCount.toString());

      const response = await fetch(`${API_BASE_URL}/api/shipping/packing-list/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        message.success('装箱表上传成功！');
        setPackingListConfig(result.data);
        setPackingListModalVisible(false);
        packingListForm.resetFields();
      } else {
        message.error(result.message || '上传失败');
      }
    } catch (error) {
      console.error('上传装箱表失败:', error);
      message.error('上传失败');
    } finally {
      setPackingListLoading(false);
    }
  };

  // 应用装箱表数据到发货清单
  const applyPackingListToShipping = () => {
    if (!packingListConfig || !packingListConfig.items) {
      message.warning('没有可用的装箱表数据');
      return;
    }

    // 将装箱表数据转换为发货数据格式
    const newShippingData = packingListConfig.items.map(item => ({
      box_num: item.box_num,
      amz_sku: item.sku, // 这里使用装箱表中的SKU作为Amazon SKU
      quantity: item.quantity
    }));

    setShippingData(newShippingData);
    message.success(`已应用装箱表数据，共 ${newShippingData.length} 条记录`);
  };



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
    fetchMergedData(); // 默认获取待发货数据
    fetchCountryInventory(); // 同时获取国家库存数据
    fetchAmazonTemplateConfig(); // 获取亚马逊模板配置
    fetchPackingListConfig(); // 获取装箱表配置
  }, []);

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
      render: (needNum: string) => (
        needNum ? (
          <Button 
            type="link" 
            style={{ padding: 0, height: 'auto', fontSize: 'inherit' }}
            onClick={() => {
              setOrderModalNeedNum(needNum);
              setOrderModalVisible(true);
            }}
          >
            {needNum}
          </Button>
        ) : '-'
      ),
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
  const recordOutbound = async (items: MixedBoxItem[] | WholeBoxConfirmData[], isMixedBox: boolean = false, logisticsProvider?: string) => {
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
            original_mix_box_num: mixedItem.box_num, // 传递原始混合箱单号
            // 新增：需求单相关信息
            order_item_id: selectedRecord?.record_num,
            need_num: selectedRecord?.need_num
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
            is_mixed_box: false,
            // 新增：需求单相关信息
            order_item_id: selectedRecord?.record_num,
            need_num: selectedRecord?.need_num
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
          operator: '申报出库',
          shipping_method: selectedRows[0]?.shipping_method || '', // 传递运输方式
          logistics_provider: logisticsProvider || '', // 新增物流商字段
          remark: `批量发货 - ${new Date().toLocaleString('zh-CN')}` // 添加备注
        }),
      });

      const result = await response.json();
      
      if (result.code === 0) {

        if (result.data.shipment_number) {
          message.success(`出库记录创建成功，发货单号: ${result.data.shipment_number}`);
        }
      } else {
        console.error('❌ 出库记录失败:', result.message);
        message.error(`出库记录失败: ${result.message}`);
      }
    } catch (error) {
      console.error('❌ 出库记录异常:', error);
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
        setNextBoxNumber(1);
        setConfirmedMixedBoxes([]);
        setConfirmedWholeBoxes([]);
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
    // 防止重复提交
    if (shippingLoading) return;
    setShippingLoading(true);
    
    try {
      // 检查当前混合箱是否已经确认过（通过箱号检查）
      const currentBoxNumber = String(nextBoxNumber);
      const isAlreadyConfirmed = shippingData.some(item => item.box_num === currentBoxNumber);
      
      if (!isAlreadyConfirmed) {
        const newShippingData: ShippingConfirmData[] = boxData.map(item => ({
          box_num: currentBoxNumber,
          amz_sku: item.amz_sku,
          quantity: item.quantity
        }));
        
        setShippingData([...shippingData, ...newShippingData]);
        setNextBoxNumber(nextBoxNumber + 1); // 递增箱号
        
        // 保存混合箱数据用于最终出库记录
        setConfirmedMixedBoxes([...confirmedMixedBoxes, ...boxData]);
      }
      
      if (currentMixedBoxIndex < uniqueMixedBoxNums.length - 1) {
        setCurrentMixedBoxIndex(currentMixedBoxIndex + 1);
      } else {
        // 混合箱处理完成，进入整箱确认
        setCurrentStep(1);
      }
    } finally {
      setShippingLoading(false);
    }
  };

  // 确认整箱发货
  const confirmWholeBox = async (confirmedData: WholeBoxConfirmData[]) => {
    // 防止重复提交
    if (shippingLoading) return;
    setShippingLoading(true);
    
    try {
      // 检查是否已经到第2步（避免重复确认）
      if (currentStep >= 2) return;
      
      const newShippingData: ShippingConfirmData[] = [];
      let currentBoxNum = nextBoxNumber;
      
      confirmedData.forEach(item => {
        for (let i = 0; i < item.confirm_boxes; i++) {
          // 检查箱号是否已存在，避免重复
          const boxNumber = String(currentBoxNum);
          const existsInShippingData = shippingData.some(existingItem => existingItem.box_num === boxNumber);
          
          if (!existsInShippingData) {
            newShippingData.push({
              box_num: boxNumber,
              amz_sku: item.amz_sku,
              quantity: Math.floor(item.confirm_quantity / item.confirm_boxes)
            });
          }
          currentBoxNum++;
        }
      });
      
      if (newShippingData.length > 0) {
        setShippingData([...shippingData, ...newShippingData]);
        setNextBoxNumber(currentBoxNum); // 更新下一个箱号
        
        // 保存整箱数据用于最终出库记录
        setConfirmedWholeBoxes([...confirmedWholeBoxes, ...confirmedData]);
      }
      
      setCurrentStep(2);
    } finally {
      setShippingLoading(false);
    }
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
        fetchMergedData();
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
        fetchMergedData();
      } else {
        message.error(result.message || '添加失败');
      }
    } catch (error) {
      console.error('添加失败:', error);
      message.error(`添加失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 需求单管理弹窗相关state
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [orderModalNeedNum, setOrderModalNeedNum] = useState<string | null>(null);

  // 主内容区渲染
  const renderMainContent = () => {
    switch (sideKey) {
      case 'shipping-ops':
        return (
          // ...原发货操作主内容（原return内容）...
          <>{/* 这里插入原有的发货操作主内容 */}</>
        );
      case 'order-mgmt':
        return <OrderManagementPage />;
      case 'shipping-history':
        return <div>发货历史（可集成ShipmentHistoryPage）</div>;
      case 'template-mgmt':
        return <div>模板管理（可集成模板相关内容）</div>;
      case 'packing-list':
        return <div>装箱表管理（可集成装箱表相关内容）</div>;
      default:
        return null;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
        <Menu
          mode="inline"
          selectedKeys={[sideKey]}
          onClick={({ key }) => setSideKey(key as string)}
          style={{ height: '100%', borderRight: 0 }}
          items={sideMenuItems}
        />
      </Sider>
      <Layout>
        <Content style={{ padding: 24, minHeight: 280 }}>
          {renderMainContent()}
        </Content>
      </Layout>
    </Layout>
  );
};

export default ShippingPage; 