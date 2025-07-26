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
  Descriptions
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
  BoxPlotOutlined,
  EditOutlined,
  HistoryOutlined,
  SearchOutlined,
  EyeOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import OrderManagementPage from './OrderManagementPage';
import WarehouseManagement from '../Logistics/WarehouseManagement';
import HsCodeManagement from '../Logistics/HsCodeManagement';
import ShipmentHistoryPage from './ShipmentHistoryPage';

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
  .mixed-box-row {
    background-color: #fff7e6 !important;
  }
  .mixed-box-row:hover {
    background-color: #ffe7ba !important;
  }
  .shipped-row {
    background-color: #f6ffed !important;
    opacity: 0.7;
  }
  .shipped-row:hover {
    background-color: #e6f7ff !important;
  }
  .cancelled-row {
    background-color: #fff1f0 !important;
    opacity: 0.7;
  }
  .cancelled-row:hover {
    background-color: #ffe4e6 !important;
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
  amazon_sku?: string; // 新的Amazon SKU字段
  local_sku: string;
  site?: string; // Amazon站点字段
  fulfillment_channel?: string; // 履行渠道字段
  quantity: number;
  shipping_method?: string;
  marketplace: string;
  country: string;
  status: '待发货' | '已发货' | '已取消' | '有库存无需求' | '库存未映射';
  created_at: string;
  mapping_method?: string; // 映射方法标记
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  total_available: number;
  shortage: number;
  // 新增库存状态相关字段
  inventory_status?: '待出库' | '已出库' | '已取消';
  box_type?: '整箱' | '混合箱';
  last_updated_at?: string;
  shipped_at?: string;
  inventory_remark?: string;
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
  filledDownloadUrl?: string; // 已填写装箱表的下载链接
  filledFileName?: string; // 已填写装箱表的文件名
}

// 物流商发票模板接口
interface LogisticsInvoiceTemplate {
  filename: string;
  originalName: string;
  filePath: string;
  uploadTime: string;
  sheetName: string;
  logisticsProvider: string; // 物流商
  country: string; // 国家
  countryName: string; // 国家显示名
  templateFields: {
    [key: string]: string; // 模板字段映射
  };
  sheetNames: string[];
}

interface LogisticsInvoiceConfig {
  hasTemplate: boolean;
  templates?: Record<string, Record<string, LogisticsInvoiceTemplate>>; // 按物流商和国家分组
  logisticsProviders?: string[];
  countries?: string[];
}

// 新增：出库记录项接口
interface OutboundItem {
  sku: string;
  total_quantity: number;
  total_boxes?: number;
  country: string;
  marketplace: string;
  is_mixed_box: boolean;
  original_mix_box_num?: string;
  order_item_id?: number;
  need_num?: string;
}

// 新增：本地库存汇总接口（参考库存管理页面）
interface LocalInventorySummary {
  sku: string; // 本地SKU
  country: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  mixed_box_count: number;
  total_quantity: number;
  earliest_inbound: string;
  latest_update: string;
  pending_outbound_quantity: number; // 待出库数量
  pending_outbound_boxes: number; // 待出库箱数
  // 新增Amazon SKU映射相关字段
  amz_sku?: string; // 对应的Amazon SKU
  mapping_status?: '已映射' | '未映射' | '待确认'; // 映射状态
  site?: string; // Amazon站点
}

// 新增：待出库记录接口
interface PendingOutboundRecord {
  记录号: string;
  sku: string; // 本地SKU
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
  pre_type?: '旺季备货' | '平时备货';
  // 新增Amazon SKU映射相关字段
  amz_sku?: string; // 对应的Amazon SKU
  mapping_status?: '已映射' | '未映射' | '待确认'; // 映射状态
  site?: string; // Amazon站点
}

const ShippingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mergedData, setMergedData] = useState<MergedShippingData[]>([]);
  const [mergedLoading, setMergedLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addForm] = Form.useForm();

  // 新增：本地库存汇总相关状态
  const [localInventorySummary, setLocalInventorySummary] = useState<LocalInventorySummary[]>([]);
  const [pendingOutboundRecords, setPendingOutboundRecords] = useState<PendingOutboundRecord[]>([]);
  const [currentView, setCurrentView] = useState<'summary' | 'records'>('summary');

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
  const [shippingRemark, setShippingRemark] = useState(''); // 新增：发货备注
  
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
  
  // 物流商发票管理相关状态
  const [logisticsInvoiceConfig, setLogisticsInvoiceConfig] = useState<LogisticsInvoiceConfig>({ hasTemplate: false });
  const [invoiceTemplateModalVisible, setInvoiceTemplateModalVisible] = useState(false);
  const [invoiceTemplateForm] = Form.useForm();
  const [invoiceUploadLoading, setInvoiceUploadLoading] = useState(false);
  const [selectedInvoiceProvider, setSelectedInvoiceProvider] = useState<string>('');
  const [selectedInvoiceCountry, setSelectedInvoiceCountry] = useState<string>('');
  const [generateInvoiceLoading, setGenerateInvoiceLoading] = useState(false);
  
  // 删除确认对话框状态
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteTargetCountry, setDeleteTargetCountry] = useState<string>('');
  const [deleteTargetTemplate, setDeleteTargetTemplate] = useState<any>(null);
  
  // Sheet页选择相关状态
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);

  // 仓库管理和HSCODE管理相关状态
  const [warehouseModalVisible, setWarehouseModalVisible] = useState(false);
  const [hsCodeModalVisible, setHsCodeModalVisible] = useState(false);
  const [shipmentHistoryModalVisible, setShipmentHistoryModalVisible] = useState(false);
  
  // 筛选相关状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<string>('');
  const [boxTypeFilter, setBoxTypeFilter] = useState<string>('');

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
      // 检查文件是否存在 - 改进文件检查逻辑
      if (!values.template) {
        console.error('❌ 未选择文件:', values.template);
        message.error('请选择要上传的模板文件');
        setUploadLoading(false);
        return;
      }

      let file = null;
      
      // 处理不同的文件对象结构
      if (Array.isArray(values.template)) {
        // 如果是数组形式
        if (values.template.length === 0) {
          console.error('❌ 文件数组为空:', values.template);
          message.error('请选择要上传的模板文件');
          setUploadLoading(false);
          return;
        }
        
        // 尝试不同的文件获取路径
        const fileItem = values.template[0];
        file = fileItem.originFileObj || fileItem.file || fileItem;
      } else if (values.template.fileList && values.template.fileList.length > 0) {
        // 如果是fileList形式
        const fileItem = values.template.fileList[0];
        file = fileItem.originFileObj || fileItem.file || fileItem;
      } else {
        // 直接是文件对象
        file = values.template;
      }

      if (!file || !file.name) {
        console.error('❌ 文件对象获取失败，values.template结构:', values.template);
        message.error('文件获取失败，请重新选择文件');
        setUploadLoading(false);
        return;
      }

      // 验证文件类型
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel' // .xls
      ];
      
      if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
        console.error('❌ 文件类型不支持:', { type: file.type, name: file.name });
        message.error('只支持Excel文件格式(.xlsx, .xls)');
        setUploadLoading(false);
        return;
      }

      console.log('📁 获取到文件:', { name: file.name, size: file.size, type: file.type });

      // 验证必填字段
      if (!values.sheetName || !values.merchantSkuColumn || !values.quantityColumn || !values.startRow || !values.country) {
        console.error('❌ 必填字段缺失:', {
          sheetName: values.sheetName,
          merchantSkuColumn: values.merchantSkuColumn,
          quantityColumn: values.quantityColumn,
          startRow: values.startRow,
          country: values.country
        });
        message.error('请填写完整的配置信息');
        setUploadLoading(false);
        return;
      }

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
      console.log('📋 FormData内容已准备就绪，包含文件和配置信息');
      
      const response = await fetch(`${API_BASE_URL}/api/shipping/amazon-template/upload`, {
        method: 'POST',
        body: formData,
        // 注意：不要设置Content-Type header，让浏览器自动设置multipart/form-data边界
      });

      console.log('📡 服务器响应状态:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP错误:', { status: response.status, statusText: response.statusText, body: errorText });
        throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ' - ' + errorText : ''}`);
      }
      
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
        
        // 如果是Sheet页不存在的错误，提供可选的Sheet页
        if (result.data && result.data.availableSheets) {
          setAvailableSheets(result.data.availableSheets);
          message.error(
            `Sheet页"${result.data.requestedSheet}"不存在。请从以下可用页面中选择：${result.data.availableSheets.join('、')}`
          );
        } else {
          message.error(result.message || '上传失败');
        }
      }
    } catch (error) {
      console.error('❌ 上传模板失败:', error);
      message.error(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
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
      dataToGenerate = shippingData.map((item: any) => {
        // 从selectedRows中找到对应的国家信息
        const selectedRecord = selectedRows.find((row: MergedShippingData) => row.amz_sku === item.amz_sku);
        return {
          ...item,
          country: selectedRecord?.country || '默认'
        };
      });
    } else {
      // 将mergedData转换为发货数据格式
      dataToGenerate = mergedData
        .filter((item: MergedShippingData) => item.status === '待发货' && item.amz_sku)
        .map((item: MergedShippingData) => ({
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

    // 查看模板文件
  const handleViewTemplate = (country: string) => {
    try {
      const url = `${API_BASE_URL}/api/shipping/amazon-template/download-original/${encodeURIComponent(country)}`;
      window.open(url, '_blank');
    } catch (error) {
      console.error('打开模板文件失败:', error);
      message.error('无法打开模板文件');
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

  // 获取物流商发票模板配置
  const fetchLogisticsInvoiceConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/logistics-invoice/config`);
      const result = await response.json();
      
      if (result.success) {
        setLogisticsInvoiceConfig(result.data);
      } else {
        console.error('获取发票模板配置失败:', result.message);
      }
    } catch (error) {
      console.error('获取发票模板配置失败:', error);
    }
  };

  // 上传物流商发票模板
  const handleUploadInvoiceTemplate = async (values: any) => {
    setInvoiceUploadLoading(true);
    try {
      // 获取文件对象
      let file = null;
      if (Array.isArray(values.template)) {
        const fileItem = values.template[0];
        file = fileItem.originFileObj || fileItem.file || fileItem;
      } else if (values.template.fileList && values.template.fileList.length > 0) {
        const fileItem = values.template.fileList[0];
        file = fileItem.originFileObj || fileItem.file || fileItem;
      } else {
        file = values.template;
      }

      if (!file || !file.name) {
        message.error('文件获取失败，请重新选择文件');
        setInvoiceUploadLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('template', file);
      formData.append('sheetName', values.sheetName);
      formData.append('logisticsProvider', values.logisticsProvider);
      formData.append('country', values.country);
      
      // 找到对应的国家名称
      const countryOption = countryTemplateOptions.find(opt => opt.value === values.country);
      if (countryOption) {
        formData.append('countryName', countryOption.label);
      }

      const response = await fetch(`${API_BASE_URL}/api/shipping/logistics-invoice/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        message.success(`${values.logisticsProvider} - ${countryOption?.label || values.country} 发票模板上传成功！`);
        await fetchLogisticsInvoiceConfig();
        setInvoiceTemplateModalVisible(false);
        invoiceTemplateForm.resetFields();
        setSelectedInvoiceProvider('');
        setSelectedInvoiceCountry('');
      } else {
        message.error(result.message || '上传失败');
      }
    } catch (error) {
      console.error('上传发票模板失败:', error);
      message.error(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setInvoiceUploadLoading(false);
    }
  };

  // 删除物流商发票模板配置
  const deleteInvoiceTemplateConfig = async (logisticsProvider?: string, country?: string) => {
    try {
      const queryParams = new URLSearchParams();
      if (logisticsProvider) queryParams.append('logisticsProvider', logisticsProvider);
      if (country) queryParams.append('country', country);
      
      const url = `${API_BASE_URL}/api/shipping/logistics-invoice/config?${queryParams.toString()}`;
        
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
      });

      const result = await response.json();
      
      if (result.success) {
        message.success(result.message || '发票模板配置已删除');
        await fetchLogisticsInvoiceConfig();
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除发票模板配置失败:', error);
      message.error('删除失败');
    }
  };

  // 生成发票
  const generateInvoice = async () => {
    if (!logisticsInvoiceConfig.hasTemplate) {
      message.warning('请先上传物流商发票模板');
      return;
    }

    if (shippingData.length === 0) {
      message.warning('没有可用的发货数据，请确保已生成发货清单');
      return;
    }

    setGenerateInvoiceLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/logistics-invoice/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shippingData: shippingData.map((item: any) => {
            const selectedRecord = selectedRows.find((row: MergedShippingData) => row.amz_sku === item.amz_sku);
            return {
              ...item,
              country: selectedRecord?.country || '默认',
              logisticsProvider: logisticsProvider
            };
          })
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        message.success('发票生成成功！');
        
        // 自动下载发票文件
        result.data.files?.forEach((file: any, index: number) => {
          setTimeout(async () => {
            try {
              const downloadUrl = `${API_BASE_URL}${file.downloadUrl}`;
              const link = document.createElement('a');
              link.href = downloadUrl;
              link.download = file.filename;
              link.target = '_blank';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            } catch (error) {
              console.error(`发票文件下载失败: ${file.filename}`, error);
              message.error(`文件 ${file.filename} 下载失败`);
            }
          }, index * 1000);
        });
      } else {
        message.error(result.message || '生成失败');
      }
    } catch (error) {
      console.error('生成发票失败:', error);
      message.error('生成失败');
    } finally {
      setGenerateInvoiceLoading(false);
    }
  };

  // 上传装箱表（自动分析）
  const handleUploadPackingList = async (values: any) => {
    setPackingListLoading(true);
    try {
      // 检查文件是否存在 - 改进文件检查逻辑
      if (!values.packingList) {
        console.error('❌ values.packingList为空:', values.packingList);
        message.error('请选择要上传的装箱表文件');
        setPackingListLoading(false);
        return;
      }

      let file = null;
      // 处理不同的文件对象结构
      if (Array.isArray(values.packingList)) {
        if (values.packingList.length === 0) {
          console.error('❌ 文件数组为空:', values.packingList);
          message.error('请选择要上传的装箱表文件');
          setPackingListLoading(false);
          return;
        }
        const fileItem = values.packingList[0];
        file = fileItem.originFileObj || fileItem.file || fileItem;
      } else if (values.packingList.fileList && values.packingList.fileList.length > 0) {
        const fileItem = values.packingList.fileList[0];
        file = fileItem.originFileObj || fileItem.file || fileItem;
      } else {
        file = values.packingList;
      }

      if (!file || !file.name) {
        console.error('❌ 文件对象获取失败，values.packingList结构:', values.packingList);
        message.error('文件获取失败，请重新选择文件');
        setPackingListLoading(false);
        return;
      }

      // 读取Excel文件，获取sheetNames，自动选择第二个sheet
      let sheetNameToUse = undefined;
      let boxCount = 0;
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        if (workbook.SheetNames && workbook.SheetNames.length > 1) {
          sheetNameToUse = workbook.SheetNames[1]; // 第二个sheet
        } else if (workbook.SheetNames && workbook.SheetNames.length > 0) {
          sheetNameToUse = workbook.SheetNames[0]; // 只有一个sheet时选第一个
        }
        
        // 直接获取M3单元格的值作为总箱数
        if (sheetNameToUse) {
          const ws = workbook.Sheets[sheetNameToUse];
          const sheetJson = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          const row3 = sheetJson[2] as any[] | undefined; // 第3行，索引为2
          if (row3 && row3.length > 12) { // M列索引为12
            boxCount = parseInt(String(row3[12])) || 0;
          }
        }
      } catch (e) {
        console.error('❌ 解析Excel文件获取Sheet页失败:', e);
      }

      const formData = new FormData();
      formData.append('packingList', file);
      if (sheetNameToUse) {
        formData.append('sheetName', sheetNameToUse);
      }
      // 传递新的处理参数
      formData.append('boxCount', boxCount.toString());
      formData.append('startColumn', 'M'); // 从M列开始
      formData.append('dataStartRow', '6'); // 从第6行开始填写数据

      const response = await fetch(`${API_BASE_URL}/api/shipping/packing-list/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        message.success('装箱表上传成功！');
        setPackingListConfig(result.data);
        packingListForm.resetFields();
        
        // 检查是否有发货数据，如果有则自动填写并下载
        if (shippingData && shippingData.length > 0) {
          message.loading('正在自动填写装箱表...', 0);
          
                       // 自动填写装箱表
             try {
               // 为发货数据添加国家信息
               const shippingDataWithCountry = shippingData.map((item: any) => {
                 const selectedRecord = selectedRows.find((row: MergedShippingData) => row.amz_sku === item.amz_sku);
                 return {
                   ...item,
                   country: selectedRecord?.country || '默认'
                 };
               });
               
               const fillResponse = await fetch(`${API_BASE_URL}/api/shipping/packing-list/fill`, {
                 method: 'POST',
                 headers: {
                   'Content-Type': 'application/json',
                   ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
                 },
                 body: JSON.stringify({ shippingData: shippingDataWithCountry }),
               });
            
            const fillResult = await fillResponse.json();
            
            if (fillResult.success) {
              message.destroy();
              message.success('装箱表已自动填写完成！');
              
              // 自动下载
              setTimeout(async () => {
                try {
                  const downloadResponse = await fetch(`${API_BASE_URL}${fillResult.data.downloadUrl}`);
                  if (downloadResponse.ok) {
                    const blob = await downloadResponse.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = fillResult.data.outputFileName;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    message.success(`装箱表已自动下载：${fillResult.data.outputFileName}`);
                  }
                } catch (error) {
                  console.error('自动下载失败:', error);
                  message.warning('自动下载失败');
                }
              }, 500);
              
              // 关闭对话框
              setPackingListModalVisible(false);
            } else {
              message.destroy();
              message.error('自动填写失败：' + fillResult.message);
            }
          } catch (error) {
            message.destroy();
            message.error('自动填写失败');
            console.error('自动填写失败:', error);
          }
        } else {
          // 没有发货数据时的简单提示
          message.success('装箱表已上传，请先确认发货清单后再来填写');
          setPackingListModalVisible(false);
        }
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





  // 获取本地库存汇总数据（待出库记录）
  const fetchLocalInventorySummary = async () => {
    setMergedLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCountry) params.append('country', selectedCountry);
      if (searchKeyword.trim()) params.append('sku', searchKeyword.trim());
      if (boxTypeFilter) params.append('box_type', boxTypeFilter);
      if (inventoryStatusFilter) params.append('status', inventoryStatusFilter);
      
      const response = await fetch(`${API_BASE_URL}/api/inventory/pending?${params.toString()}`, {
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
        setLocalInventorySummary(result.data.inventory || []);
        message.success(`加载了 ${result.data.inventory?.length || 0} 个SKU的库存汇总`);
      } else {
        message.error(result.message || '获取库存汇总失败');
      }
    } catch (error) {
      console.error('获取库存汇总失败:', error);
      message.error(`获取库存汇总失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setLocalInventorySummary([]);
    } finally {
      setMergedLoading(false);
    }
  };

  // 获取待出库记录详情
  const fetchPendingOutboundRecords = async () => {
    setMergedLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('status', '待出库'); // 只获取待出库状态的记录
      if (selectedCountry) params.append('country', selectedCountry);
      if (searchKeyword.trim()) params.append('sku', searchKeyword.trim());
      if (boxTypeFilter) params.append('box_type', boxTypeFilter);
      params.append('limit', '1000'); // 获取更多记录
      
      const response = await fetch(`${API_BASE_URL}/api/inventory/records?${params.toString()}`, {
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
        setPendingOutboundRecords(result.data.records || []);
        message.success(`加载了 ${result.data.records?.length || 0} 条待出库记录`);
      } else {
        message.error(result.message || '获取待出库记录失败');
      }
    } catch (error) {
      console.error('获取待出库记录失败:', error);
      message.error(`获取待出库记录失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setPendingOutboundRecords([]);
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
    if (currentView === 'summary') {
      fetchLocalInventorySummary(); // 获取库存汇总数据
    } else {
      fetchPendingOutboundRecords(); // 获取待出库记录详情
    }
    fetchCountryInventory(); // 同时获取国家库存数据
    fetchAmazonTemplateConfig(); // 获取亚马逊模板配置
    fetchPackingListConfig(); // 获取装箱表配置
    fetchLogisticsInvoiceConfig(); // 获取物流商发票模板配置
  }, [currentView, selectedCountry, searchKeyword, boxTypeFilter, inventoryStatusFilter]);

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

  // 库存汇总表格列定义（参考库存管理页面）
  const localInventorySummaryColumns: ColumnsType<LocalInventorySummary> = [
    {
      title: '本地SKU',
      dataIndex: 'sku',
      key: 'sku',
      fixed: 'left',
      width: 120,
      align: 'center',
      ellipsis: true
    },
    {
      title: 'Amazon SKU',
      key: 'amz_sku',
      width: 140,
      align: 'center',
      ellipsis: true,
      render: (_, record) => {
        if (!record.amz_sku) {
          return (
            <div>
              <Text type="secondary">未映射</Text>
              <div>
                <Tag color="orange">待创建映射</Tag>
              </div>
            </div>
          );
        }
        return (
          <div>
            <Text strong>{record.amz_sku}</Text>
            {record.mapping_status && (
              <div>
                <Tag 
                  color={record.mapping_status === '已映射' ? 'green' : record.mapping_status === '未映射' ? 'red' : 'orange'}
                >
                  {record.mapping_status}
                </Tag>
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: '国家/站点',
      key: 'country_site',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <div>
          <Text strong>{record.country}</Text>
          {record.site && (
            <div style={{ fontSize: '10px', color: '#666' }}>
              {record.site}
            </div>
          )}
        </div>
      )
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
          return <Text type="secondary">-</Text>;
        }
        
        return (
          <div>
            <div><Text strong>{quantity} 件</Text></div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              📦 {count} 箱
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
          return <Text type="secondary">-</Text>;
        }
        
        return (
          <div>
            <div><Text strong>{quantity} 件</Text></div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              📋 {count} 个混合箱
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
        
        return <Text strong style={{ color: '#52c41a' }}>{total} 件</Text>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'earliest_inbound',
      key: 'earliest_inbound',
      width: 120,
      align: 'center',
      render: (date) => date ? new Date(date).toLocaleString('zh-CN') : '-'
    },
    {
      title: '最后更新',
      dataIndex: 'latest_update',
      key: 'latest_update',
      width: 120,
      align: 'center',
      render: (date) => date ? new Date(date).toLocaleString('zh-CN') : '-'
    }
  ];

  // 待出库记录表格列定义
  const pendingOutboundColumns: ColumnsType<PendingOutboundRecord> = [
    {
      title: '箱型',
      dataIndex: 'box_type',
      key: 'box_type',
      fixed: 'left',
      width: 120,
      align: 'center',
      render: (type, record) => (
        <div>
          <Tag color={type === '整箱' ? 'blue' : 'orange'}>
            {type === '整箱' ? '📦' : '📋'} {type}
          </Tag>
          {record.mix_box_num && (
            <div style={{ 
              fontSize: '12px', 
              color: '#1890ff',
              fontWeight: 600,
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
      width: 120,
      align: 'center',
      ellipsis: true
    },
    {
      title: '本地SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      align: 'center',
      ellipsis: true
    },
    {
      title: 'Amazon SKU',
      key: 'amz_sku',
      width: 140,
      align: 'center',
      ellipsis: true,
      render: (_, record) => {
        if (!record.amz_sku) {
          return (
            <div>
              <Text type="secondary">-</Text>
              <div>
                <Tag color="orange">未映射</Tag>
              </div>
            </div>
          );
        }
        return (
          <div>
            <Text strong>{record.amz_sku}</Text>
            {record.mapping_status && (
              <div>
                <Tag 
                  color={record.mapping_status === '已映射' ? 'green' : record.mapping_status === '未映射' ? 'red' : 'orange'}
                >
                  {record.mapping_status}
                </Tag>
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: '数量/箱数',
      key: 'quantity',
      width: 100,
      align: 'center',
      render: (_, record) => {
        if (record.box_type === '混合箱') {
          return <Text strong>{record.total_quantity} 件</Text>;
        }
        return (
          <div>
            <Text strong>{record.total_quantity} 件</Text>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {record.total_boxes} 箱
            </div>
          </div>
        );
      }
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 80,
      align: 'center'
    },
    {
      title: '平台',
      dataIndex: 'marketPlace',
      key: 'marketPlace',
      width: 90,
      align: 'center'
    },
    {
      title: '库存状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      align: 'center',
      render: (status: string) => {
        const statusConfig: Record<string, { color: string; text: string }> = {
          '待出库': { color: 'blue', text: '待出库' },
          '已出库': { color: 'green', text: '已出库' },
          '已取消': { color: 'red', text: '已取消' }
        };
        const config = statusConfig[status] || statusConfig['待出库'];
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '备货类型',
      dataIndex: 'pre_type',
      key: 'pre_type',
      width: 90,
      align: 'center',
      render: (type: string) => (
        <Tag color={type === '旺季备货' ? 'red' : 'blue'}>
          {type || '平时备货'}
        </Tag>
      )
    },
    {
      title: '操作员',
      dataIndex: '操作员',
      key: '操作员',
      width: 80,
      align: 'center'
    },
    {
      title: '打包员',
      dataIndex: '打包员',
      key: '打包员',
      width: 80,
      align: 'center'
    },
    {
      title: '入库时间',
      dataIndex: 'time',
      key: 'time',
      width: 150,
      align: 'center',
      render: (date: string) => date ? new Date(date).toLocaleString('zh-CN') : '-'
    },
    {
      title: '最后更新',
      dataIndex: 'last_updated_at',
      key: 'last_updated_at',
      width: 150,
      align: 'center',
      render: (date: string) => date ? new Date(date).toLocaleString('zh-CN') : '-'
    },
    {
      title: '出库时间',
      dataIndex: 'shipped_at',
      key: 'shipped_at',
      width: 150,
      align: 'center',
      render: (date: string) => date ? new Date(date).toLocaleString('zh-CN') : '-'
    }
  ];

  // 原有的合并数据表格列定义（保留用于兼容）
  const mergedColumns: ColumnsType<MergedShippingData> = [
    {
      title: '需求单号',
      dataIndex: 'need_num',
      key: 'need_num',
      width: 130,
      ellipsis: true,
      sorter: (a: MergedShippingData, b: MergedShippingData) => {
        const aValue = a.need_num || '';
        const bValue = b.need_num || '';
        return aValue.localeCompare(bValue);
      },
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
      sorter: (a: MergedShippingData, b: MergedShippingData) => {
        const statusOrder = { '待发货': 1, '已发货': 2, '已取消': 3, '有库存无需求': 4, '库存未映射': 5 };
        return statusOrder[a.status] - statusOrder[b.status];
      },
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: '库存状态',
      dataIndex: 'inventory_status',
      key: 'inventory_status',
      width: 90,
      align: 'center',
      sorter: (a: MergedShippingData, b: MergedShippingData) => {
        const statusOrder = { '待出库': 1, '已出库': 2, '已取消': 3 };
        const aStatus = a.inventory_status || '待出库';
        const bStatus = b.inventory_status || '待出库';
        return statusOrder[aStatus] - statusOrder[bStatus];
      },
             render: (status: string) => {
         const statusConfig: Record<string, { color: string; text: string }> = {
           '待出库': { color: 'blue', text: '待出库' },
           '已出库': { color: 'green', text: '已出库' },
           '已取消': { color: 'red', text: '已取消' }
         };
         const config = statusConfig[status] || statusConfig['待出库'];
         return <Tag color={config.color}>{config.text}</Tag>;
       },
    },
    {
      title: '箱型',
      dataIndex: 'box_type',
      key: 'box_type',
      width: 80,
      align: 'center',
      sorter: (a: MergedShippingData, b: MergedShippingData) => {
        const typeOrder = { '整箱': 1, '混合箱': 2 };
        const aType = a.box_type || '整箱';
        const bType = b.box_type || '整箱';
        return typeOrder[aType] - typeOrder[bType];
      },
             render: (type: string) => {
         const typeConfig: Record<string, { color: string; icon: string }> = {
           '整箱': { color: 'blue', icon: '📦' },
           '混合箱': { color: 'orange', icon: '📋' }
         };
         const config = typeConfig[type] || typeConfig['整箱'];
         return (
           <Tag color={config.color}>
             {config.icon} {type || '整箱'}
           </Tag>
         );
       },
    },
    {
      title: 'Amazon SKU',
      dataIndex: 'amz_sku',
      key: 'amz_sku',
      width: 130,
      ellipsis: true,
      sorter: (a: MergedShippingData, b: MergedShippingData) => {
        const aValue = a.amz_sku || '';
        const bValue = b.amz_sku || '';
        return aValue.localeCompare(bValue);
      },
      render: (amzSku: string, record: MergedShippingData) => (
        <div>
          <div>{amzSku}</div>
          {record.amazon_sku && record.amazon_sku !== amzSku && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              新映射: {record.amazon_sku}
            </div>
          )}
          {record.mapping_method === 'new_amazon_listings' && (
            <Tag color="green">新映射</Tag>
          )}
        </div>
      ),
    },
    {
      title: '需求数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 90,
      align: 'center',
      sorter: (a: MergedShippingData, b: MergedShippingData) => a.quantity - b.quantity,
      render: (value: number) => <Text strong>{value}</Text>,
    },
    {
      title: '缺货数量',
      dataIndex: 'shortage',
      key: 'shortage',
      width: 90,
      align: 'center',
      sorter: (a: MergedShippingData, b: MergedShippingData) => a.shortage - b.shortage,
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
      sorter: (a: MergedShippingData, b: MergedShippingData) => a.total_available - b.total_available,
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
      sorter: (a: MergedShippingData, b: MergedShippingData) => a.whole_box_quantity - b.whole_box_quantity,
      render: (value: number) => value || '-',
    },
    {
      title: '混合箱数量',
      dataIndex: 'mixed_box_quantity',
      key: 'mixed_box_quantity',
      width: 90,
      align: 'center',
      sorter: (a: MergedShippingData, b: MergedShippingData) => a.mixed_box_quantity - b.mixed_box_quantity,
      render: (value: number) => value || '-',
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 70,
      align: 'center',
      sorter: (a: MergedShippingData, b: MergedShippingData) => {
        const aValue = a.country || '';
        const bValue = b.country || '';
        return aValue.localeCompare(bValue);
      },
    },
    {
      title: '运输方式',
      dataIndex: 'shipping_method',
      key: 'shipping_method',
      width: 100,
      sorter: (a: MergedShippingData, b: MergedShippingData) => {
        const aValue = a.shipping_method || '';
        const bValue = b.shipping_method || '';
        return aValue.localeCompare(bValue);
      },
      render: (value: string) => value || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      sorter: (a: MergedShippingData, b: MergedShippingData) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return aTime - bTime;
      },
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '最后更新',
      dataIndex: 'last_updated_at',
      key: 'last_updated_at',
      width: 150,
      sorter: (a: MergedShippingData, b: MergedShippingData) => {
        const aTime = a.last_updated_at ? new Date(a.last_updated_at).getTime() : 0;
        const bTime = b.last_updated_at ? new Date(b.last_updated_at).getTime() : 0;
        return aTime - bTime;
      },
      render: (date: string) => date ? new Date(date).toLocaleString('zh-CN') : '-',
    },
    {
      title: '出库时间',
      dataIndex: 'shipped_at',
      key: 'shipped_at',
      width: 150,
      sorter: (a: MergedShippingData, b: MergedShippingData) => {
        const aTime = a.shipped_at ? new Date(a.shipped_at).getTime() : 0;
        const bTime = b.shipped_at ? new Date(b.shipped_at).getTime() : 0;
        return aTime - bTime;
      },
      render: (date: string, record: MergedShippingData) => {
        if (!date) return '-';
        return (
          <div>
            <div>{new Date(date).toLocaleString('zh-CN')}</div>
                         {record.inventory_status === '已出库' && (
               <Tag color="green">已出库</Tag>
             )}
          </div>
        );
      },
    },
  ];

  // 记录出库信息
  const recordOutbound = async (items: MixedBoxItem[] | WholeBoxConfirmData[], isMixedBox: boolean = false, logisticsProvider?: string) => {
    console.log(`🚀 开始记录${isMixedBox ? '混合箱' : '整箱'}出库信息, 项目数量: ${items.length}`);
    console.log('📋 传入的items数据:', items);
    console.log('📋 当前selectedRows:', selectedRows);
    
    try {
      const shipments = items.map(item => {
        if (isMixedBox) {
          // 混合箱出库
          const mixedItem = item as MixedBoxItem;
          // 从选中的记录中找到对应的国家和平台信息
          const selectedRecord = selectedRows.find((row: MergedShippingData) => row.amz_sku === mixedItem.amz_sku);
          
          console.log(`📦 处理混合箱SKU: ${mixedItem.amz_sku}, 找到的记录:`, selectedRecord);
          
          return {
            sku: selectedRecord?.local_sku || mixedItem.sku,
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
          const selectedRecord = selectedRows.find((row: MergedShippingData) => row.amz_sku === wholeItem.amz_sku);
          
          console.log(`📦 处理整箱SKU: ${wholeItem.amz_sku}, 找到的记录:`, selectedRecord);
          
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

      console.log('📋 准备发送到后端的shipments数据:', shipments);

      const requestBody = {
        shipments,
        operator: '申报出库',
        shipping_method: selectedRows[0]?.shipping_method || '', // 传递运输方式
        logistics_provider: logisticsProvider || '', // 新增物流商字段
        remark: `批量发货 - ${new Date().toLocaleString('zh-CN')}` // 添加备注
      };
      
      console.log('📋 完整的请求体:', requestBody);

      const response = await fetch(`${API_BASE_URL}/api/shipping/outbound-record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      console.log('📋 后端返回的结果:', result);
      
      if (result.code === 0) {
        console.log('✅ 出库记录创建成功:', result.data);

        // 修复：确保显示成功消息
        if (result.data && result.data.shipment_number) {
          message.success(`出库记录创建成功，发货单号: ${result.data.shipment_number}`);
        } else {
          message.success('出库记录创建成功！');
        }
      } else {
        console.error('❌ 出库记录失败:', result.message);
        message.error(`出库记录失败: ${result.message}`);
        // 抛出错误，以便上层捕获
        throw new Error(`出库记录失败: ${result.message}`);
      }
    } catch (error) {
      console.error('❌ 出库记录异常:', error);
      message.error(`出库记录异常: ${error instanceof Error ? error.message : '未知错误'}`);
      // 重新抛出错误，以便上层处理
      throw error;
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
          records: selectedRows.map((row: MergedShippingData) => ({
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
      const isAlreadyConfirmed = shippingData.some((item: any) => item.box_num === currentBoxNumber);
      
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
          const existsInShippingData = shippingData.some((existingItem: any) => existingItem.box_num === boxNumber);
          
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
      ...shippingData.map((item: any) => [item.box_num, item.amz_sku, item.quantity])
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
    const unmappedSelectedRows = selectedRows.filter((row: MergedShippingData) => row.status === '库存未映射');
    if (unmappedSelectedRows.length === 0) {
      message.warning('请先选择库存未映射的记录');
      return;
    }
    
    // 转换为UnmappedInventoryItem格式并自动生成Amazon SKU
    const mappingData = unmappedSelectedRows.map((row: MergedShippingData) => {
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
    mappingData.forEach((item: UnmappedInventoryItem) => {
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
      const mappings = unmappedInventory.map((item: UnmappedInventoryItem) => ({
        local_sku: item.local_sku,
        amz_sku: values[`amz_sku_${item.local_sku}_${item.country}`],
        country: item.country,
        site: item.site || getAmazonSite(item.country)
      })).filter((mapping: any) => mapping.amz_sku && mapping.amz_sku.trim() !== '');

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
        if (currentView === 'summary') {
          fetchLocalInventorySummary();
        } else {
          fetchPendingOutboundRecords();
        }
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
        if (currentView === 'summary') {
          fetchLocalInventorySummary();
        } else {
          fetchPendingOutboundRecords();
        }
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

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>发货操作</Title>
      
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Button.Group>
            <Button
              type={currentView === 'summary' ? 'primary' : 'default'}
              icon={<BarChartOutlined />}
              onClick={() => setCurrentView('summary')}
            >
              库存汇总
            </Button>
            <Button
              type={currentView === 'records' ? 'primary' : 'default'}
              icon={<BoxPlotOutlined />}
              onClick={() => setCurrentView('records')}
            >
              记录详情
            </Button>
          </Button.Group>
        </Col>
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
            disabled={selectedRowKeys.length === 0 || currentView !== 'records'}
            loading={shippingLoading}
          >
            批量发货 ({selectedRowKeys.length})
            {currentView === 'summary' && <Text style={{ marginLeft: 4, fontSize: '12px' }}>(请切换到记录详情)</Text>}
          </Button>
        </Col>
        <Col>
          <Button
            type="default"
            onClick={handleCreateMappingClick}
            disabled={selectedRows.filter((row: MergedShippingData) => row.status === '库存未映射').length === 0}
          >
            创建SKU映射 ({selectedRows.filter((row: MergedShippingData) => row.status === '库存未映射').length})
          </Button>
        </Col>
        <Col>
          <Button
            type="default"
            icon={<SettingOutlined />}
            onClick={() => setTemplateModalVisible(true)}
          >
            管理亚马逊发货上传模板
            {amazonTemplateConfig.hasTemplate && <Text type="success" style={{ marginLeft: 4 }}>✓</Text>}
          </Button>
        </Col>
        <Col>
          <Button
            type="default"
            icon={<SettingOutlined />}
            onClick={() => setInvoiceTemplateModalVisible(true)}
          >
            管理物流商发票模板
            {logisticsInvoiceConfig.hasTemplate && <Text type="success" style={{ marginLeft: 4 }}>✓</Text>}
          </Button>
        </Col>
        <Col>
          <Button
            type="default"
            icon={<BoxPlotOutlined />}
            onClick={() => setWarehouseModalVisible(true)}
          >
            亚马逊仓库管理
          </Button>
        </Col>
        <Col>
          <Button
            type="default"
            icon={<EditOutlined />}
            onClick={() => setHsCodeModalVisible(true)}
          >
            HSCODE编码管理
          </Button>
        </Col>
        <Col>
          <Button
            type="default"
            icon={<HistoryOutlined />}
            onClick={() => setShipmentHistoryModalVisible(true)}
          >
            发货历史
          </Button>
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
        {/* 各国家库存卡片 */}
            {countryInventory.map((country: CountryInventory) => (
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
                    // 如果点击的是当前选中的国家，则取消选中；否则选中该国家
                    const newSelectedCountry = selectedCountry === country.country ? '' : country.country;
                    setSelectedCountry(newSelectedCountry);
                    setFilterType(''); // 清除其他筛选
                  }}
                >
                  <Statistic
                    title={
                      <div>
                        <Text strong>{country.country}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '10px' }}>
                          整箱: {country.whole_box_count}箱 | 混合箱: {country.mixed_box_count}箱
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

          <Card 
            title={
              <span>
                <BarChartOutlined style={{ marginRight: 8 }} />
                待出库库存统计 
                {selectedCountry && (
                  <Text type="secondary" style={{ fontSize: '12px', marginLeft: 8 }}>
                    (当前国家: {selectedCountry})
                  </Text>
                )}
                {!selectedCountry && (
                  <Text type="secondary" style={{ fontSize: '12px', marginLeft: 8 }}>
                    (全部国家)
                  </Text>
                )}
              </span>
            }
            style={{ marginBottom: 16 }}
          >
            {(() => {
              // 根据当前视图和选中的国家筛选数据
              let filteredData;
              if (currentView === 'summary') {
                filteredData = selectedCountry 
                  ? localInventorySummary.filter((item: LocalInventorySummary) => item.country === selectedCountry)
                  : localInventorySummary;
              
              return (
                <Row gutter={16}>
                    <Col span={4}>
                    <div 
                      style={{ cursor: 'pointer' }} 
                      onClick={() => {
                          const newFilterType = filterType === 'sku-summary' ? '' : 'sku-summary';
                        setFilterType(newFilterType);
                      }}
                    >
                      <Statistic
                          title="待出库SKU数"
                          value={filteredData.length}
                        prefix={<PlusOutlined />}
                          valueStyle={{ color: filterType === 'sku-summary' ? '#1677ff' : '#3f8600' }}
                      />
                    </div>
                  </Col>
                    <Col span={4}>
                    <div 
                      style={{ cursor: 'pointer' }} 
                      onClick={() => {
                          const newFilterType = filterType === 'whole-box' ? '' : 'whole-box';
                        setFilterType(newFilterType);
                      }}
                    >
                      <Statistic
                          title="整箱库存"
                          value={filteredData.reduce((sum: number, item: LocalInventorySummary) => sum + item.whole_box_quantity, 0)}
                          suffix="件"
                          valueStyle={{ color: filterType === 'whole-box' ? '#1677ff' : '#1677ff' }}
                          prefix="📦"
                        />
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          共{filteredData.reduce((sum: number, item: LocalInventorySummary) => sum + item.whole_box_count, 0)}箱
                        </div>
                    </div>
                  </Col>
                    <Col span={4}>
                    <div 
                      style={{ cursor: 'pointer' }} 
                      onClick={() => {
                          const newFilterType = filterType === 'mixed-box' ? '' : 'mixed-box';
                        setFilterType(newFilterType);
                      }}
                    >
                      <Statistic
                          title="混合箱库存"
                          value={filteredData.reduce((sum: number, item: LocalInventorySummary) => sum + item.mixed_box_quantity, 0)}
                          suffix="件"
                          valueStyle={{ color: filterType === 'mixed-box' ? '#1677ff' : '#fa8c16' }}
                          prefix="📋"
                        />
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          共{filteredData.reduce((sum: number, item: LocalInventorySummary) => sum + item.mixed_box_count, 0)}个混合箱
                        </div>
                    </div>
                  </Col>
                    <Col span={4}>
                    <div 
                      style={{ cursor: 'pointer' }} 
                      onClick={() => {
                          const newFilterType = filterType === 'total-inventory' ? '' : 'total-inventory';
                        setFilterType(newFilterType);
                      }}
                    >
                      <Statistic
                          title="总库存"
                          value={filteredData.reduce((sum: number, item: LocalInventorySummary) => sum + item.total_quantity, 0)}
                          suffix="件"
                          valueStyle={{ color: filterType === 'total-inventory' ? '#1677ff' : '#52c41a' }}
                          prefix={<CheckOutlined />}
                      />
                    </div>
                  </Col>
                    <Col span={4}>
                    <div 
                      style={{ cursor: 'pointer' }} 
                      onClick={() => {
                          setCurrentView('records');
                      }}
                    >
                      <Statistic
                          title="查看详情"
                          value="点击查看"
                          valueStyle={{ color: '#722ed1', fontSize: '14px' }}
                          prefix={<EyeOutlined />}
                      />
                    </div>
                  </Col>
                    <Col span={4}>
                    <div 
                      style={{ cursor: 'pointer' }} 
                      onClick={() => {
                          setFilterType('');
                      }}
                    >
                      <Statistic
                          title="清除筛选"
                          value="全部显示"
                          valueStyle={{ color: filterType === '' ? '#1677ff' : '#666', fontSize: '14px' }}
                      />
                    </div>
                  </Col>
                  </Row>
                );
              } else {
                // 记录详情视图的统计
                const filteredRecords = selectedCountry 
                  ? pendingOutboundRecords.filter((item: PendingOutboundRecord) => item.country === selectedCountry)
                  : pendingOutboundRecords;
                
                return (
                  <Row gutter={16}>
                    <Col span={4}>
                      <Statistic
                        title="待出库记录"
                        value={filteredRecords.length}
                        prefix={<PlusOutlined />}
                        valueStyle={{ color: '#3f8600' }}
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic
                        title="整箱记录"
                        value={filteredRecords.filter((item: PendingOutboundRecord) => item.box_type === '整箱').length}
                        prefix="📦"
                        valueStyle={{ color: '#1677ff' }}
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic
                        title="混合箱记录"
                        value={filteredRecords.filter((item: PendingOutboundRecord) => item.box_type === '混合箱').length}
                        prefix="📋"
                        valueStyle={{ color: '#fa8c16' }}
                      />
                    </Col>
                    <Col span={4}>
                      <Statistic
                        title="总数量"
                        value={filteredRecords.reduce((sum: number, item: PendingOutboundRecord) => sum + item.total_quantity, 0)}
                        suffix="件"
                        valueStyle={{ color: '#52c41a' }}
                        prefix={<CheckOutlined />}
                      />
                    </Col>
                    <Col span={4}>
                    <div 
                      style={{ cursor: 'pointer' }} 
                      onClick={() => {
                          setCurrentView('summary');
                      }}
                    >
                      <Statistic
                          title="返回汇总"
                          value="点击返回"
                          valueStyle={{ color: '#722ed1', fontSize: '14px' }}
                          prefix={<BarChartOutlined />}
                      />
                    </div>
                  </Col>
                    <Col span={4}>
                    {/* 空列用于保持布局对称 */}
                  </Col>
                </Row>
              );
              }
            })()}
          </Card>

          <Card size="small" style={{ marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {currentView === 'summary' ? (
                <>
                  库存汇总视图：显示每个SKU的整箱和混合箱数量统计，数据来源于local_boxes表中状态为"待出库"的记录
                </>
              ) : (
                <>
              行颜色说明：
                  <Tag color="orange" style={{ marginLeft: 8 }}>橙色 - 混合箱记录</Tag>
                  <Tag color="green" style={{ marginLeft: 4 }}>绿色 - 已出库记录</Tag>
                  <Tag color="red" style={{ marginLeft: 4 }}>红色 - 已取消记录</Tag>
                  <Tag style={{ marginLeft: 4 }}>默认 - 待出库记录</Tag>
                </>
              )}
            </Text>
          </Card>

          {/* 筛选器栏 */}
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16} align="middle">
              <Col span={6}>
                <Input
                  placeholder="搜索 SKU、需求单号、国家等..."
                  prefix={<SearchOutlined />}
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  allowClear
                />
              </Col>
              <Col span={4}>
                <Select
                  placeholder="状态筛选"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  allowClear
                  style={{ width: '100%' }}
                >
                  <Option value="待发货">待发货</Option>
                  <Option value="已发货">已发货</Option>
                  <Option value="已取消">已取消</Option>
                  <Option value="有库存无需求">有库存无需求</Option>
                  <Option value="库存未映射">库存未映射</Option>
                </Select>
              </Col>
              <Col span={4}>
                <Select
                  placeholder="库存状态"
                  value={inventoryStatusFilter}
                  onChange={setInventoryStatusFilter}
                  allowClear
                  style={{ width: '100%' }}
                >
                  <Option value="待出库">待出库</Option>
                  <Option value="已出库">已出库</Option>
                  <Option value="已取消">已取消</Option>
                </Select>
              </Col>
              <Col span={3}>
                <Select
                  placeholder="箱型"
                  value={boxTypeFilter}
                  onChange={setBoxTypeFilter}
                  allowClear
                  style={{ width: '100%' }}
                >
                  <Option value="整箱">📦 整箱</Option>
                  <Option value="混合箱">📋 混合箱</Option>
                </Select>
              </Col>
              <Col span={4}>
                <Space>
                  <Button
                    onClick={() => {
                      setSearchKeyword('');
                      setStatusFilter('');
                      setInventoryStatusFilter('');
                      setBoxTypeFilter('');
                    }}
                  >
                    清除筛选
                  </Button>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {currentView === 'summary' ? (
                      <>共 {localInventorySummary.filter((item: LocalInventorySummary) => {
                      if (selectedCountry && selectedCountry !== '') {
                          if (item.country !== selectedCountry) return false;
                      }
                      if (searchKeyword.trim() !== '') {
                        const keyword = searchKeyword.toLowerCase();
                          if (!item.sku.toLowerCase().includes(keyword)) return false;
                        }
                        return true;
                      }).length} 个SKU</>
                    ) : (
                      <>共 {pendingOutboundRecords.filter((item: PendingOutboundRecord) => {
                        if (selectedCountry && selectedCountry !== '') {
                          if (item.country !== selectedCountry) return false;
                        }
                        if (searchKeyword.trim() !== '') {
                          const keyword = searchKeyword.toLowerCase();
                          if (!item.sku.toLowerCase().includes(keyword)) return false;
                        }
                        if (boxTypeFilter && item.box_type !== boxTypeFilter) return false;
                        return true;
                      }).length} 条记录</>
                    )}
                  </Text>
                </Space>
              </Col>
              <Col span={3}>
                {/* 占位列 */}
              </Col>
            </Row>
          </Card>

          {currentView === 'summary' ? (
          <Table
              title={() => (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    <BarChartOutlined style={{ marginRight: 8 }} />
                    库存汇总 - 按SKU统计待出库记录
                  </span>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    共 {localInventorySummary.filter((item: LocalInventorySummary) => {
              if (selectedCountry && selectedCountry !== '') {
                        if (item.country !== selectedCountry) return false;
                      }
                      if (searchKeyword.trim() !== '') {
                        const keyword = searchKeyword.toLowerCase();
                        if (!item.sku.toLowerCase().includes(keyword)) return false;
                      }
                      return true;
                    }).length} 个SKU
                  </Text>
                </div>
              )}
              columns={localInventorySummaryColumns}
              dataSource={localInventorySummary.filter((item: LocalInventorySummary) => {
                // 按国家筛选
                if (selectedCountry && selectedCountry !== '') {
                  if (item.country !== selectedCountry) return false;
              }
              
              // 关键词搜索筛选
              if (searchKeyword.trim() !== '') {
                const keyword = searchKeyword.toLowerCase();
                  if (!item.sku.toLowerCase().includes(keyword)) return false;
                }
                
                // 按筛选类型过滤
                switch (filterType) {
                  case 'whole-box':
                    return item.whole_box_quantity > 0;
                  case 'mixed-box':
                    return item.mixed_box_quantity > 0;
                  case 'total-inventory':
                    return item.total_quantity > 0;
                  default:
                    return true;
                }
              })}
              rowKey={(record) => `${record.sku}_${record.country}`}
              loading={mergedLoading}
              pagination={{ 
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`
              }}
              scroll={{ x: 1000 }}
              size="middle"
            />
          ) : (
            <Table
              title={() => (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    <BoxPlotOutlined style={{ marginRight: 8 }} />
                    待出库记录详情
                  </span>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    共 {pendingOutboundRecords.filter((item: PendingOutboundRecord) => {
                      if (selectedCountry && selectedCountry !== '') {
                        if (item.country !== selectedCountry) return false;
                      }
                      if (searchKeyword.trim() !== '') {
                        const keyword = searchKeyword.toLowerCase();
                        if (!item.sku.toLowerCase().includes(keyword)) return false;
                      }
                      if (boxTypeFilter && boxTypeFilter !== '') {
                        if (item.box_type !== boxTypeFilter) return false;
                      }
                      return true;
                    }).length} 条记录
                  </Text>
                </div>
              )}
              columns={pendingOutboundColumns}
              dataSource={pendingOutboundRecords.filter((item: PendingOutboundRecord) => {
                // 按国家筛选
                if (selectedCountry && selectedCountry !== '') {
                  if (item.country !== selectedCountry) return false;
                }
                
                // 关键词搜索筛选
                if (searchKeyword.trim() !== '') {
                  const keyword = searchKeyword.toLowerCase();
                  if (!item.sku.toLowerCase().includes(keyword)) return false;
              }
              
              // 箱型筛选
              if (boxTypeFilter && boxTypeFilter !== '') {
                  if (item.box_type !== boxTypeFilter) return false;
                }
                
                return true;
              })}
              rowKey="记录号"
            loading={mergedLoading}
              pagination={{ 
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`
              }}
              scroll={{ x: 1800 }}
              size="middle"
              rowSelection={currentView === 'records' ? {
              type: 'checkbox',
              selectedRowKeys,
              onChange: (newSelectedRowKeys, newSelectedRows) => {
                // 检查选中的记录是否都是同一个国家
                if (newSelectedRows.length > 1) {
                  const countries = Array.from(new Set(newSelectedRows.map(row => row.country)));
                  if (countries.length > 1) {
                    message.error(`只能选择同一国家的记录进行批量发货！当前选择了：${countries.join('、')}`);
                      return;
                  }
                }
                setSelectedRowKeys(newSelectedRowKeys);
                  setSelectedRows(newSelectedRows as any[]);
              },
              getCheckboxProps: (record) => ({
                  disabled: record.status !== '待出库',
                  name: record.记录号,
              }),
              } : undefined}
            rowClassName={(record) => {
                if (record.box_type === '混合箱') return 'mixed-box-row';
                if (record.status === '已出库') return 'shipped-row';
                if (record.status === '已取消') return 'cancelled-row';
              return '';
            }}
          />
          )}


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
                    setShippingRemark(''); // 清理备注
          setSelectedRowKeys([]);
          setSelectedRows([]);
          setShippingRemark(''); // 清理备注
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
                <Button 
                  onClick={() => {
                    if (currentMixedBoxIndex < uniqueMixedBoxNums.length - 1) {
                      setCurrentMixedBoxIndex(currentMixedBoxIndex + 1);
                    } else {
                      setCurrentStep(1);
                    }
                  }}
                  disabled={shippingLoading}
                >
                  跳过此箱
                </Button>
                <Button 
                  type="primary" 
                  onClick={() => {
                    const currentBoxData = mixedBoxes.filter(item => item.box_num === uniqueMixedBoxNums[currentMixedBoxIndex]);
                    confirmMixedBox(currentBoxData);
                  }}
                  loading={shippingLoading}
                  disabled={shippingLoading}
                >
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
            loading={shippingLoading}
          />
        )}

        {currentStep === 2 && (
          <div>
            <Alert message="发货清单已生成" type="success" style={{ marginBottom: 16 }} />
            
            {/* 亚马逊仓库管理和HSCODE编码管理按钮 */}
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Button 
                  icon={<BoxPlotOutlined />} 
                  onClick={() => setWarehouseModalVisible(true)}
                  type="default"
                >
                  亚马逊仓库管理
                </Button>
                <Button 
                  icon={<EditOutlined />} 
                  onClick={() => setHsCodeModalVisible(true)}
                  type="default"
                >
                  HSCODE编码管理
                </Button>
              </Space>
            </div>
            
            {/* 物流商选择和功能按钮 */}
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Text strong>物流商：</Text>
                <Select
                  style={{ width: 140 }}
                  value={logisticsProvider}
                  onChange={setLogisticsProvider}
                  options={logisticsProviderOptions}
                  placeholder="选择物流商"
                />
                <Button 
                  icon={<DownloadOutlined />} 
                  onClick={generateAmazonFile}
                  loading={generateLoading}
                  type="default"
                >
                  生成亚马逊发货文件
                </Button>
                <Button 
                  icon={<SettingOutlined />} 
                  onClick={() => setTemplateModalVisible(true)}
                  type="default"
                >
                  管理模板
                </Button>
                <Button 
                  icon={<DownloadOutlined />} 
                  onClick={generateInvoice}
                  loading={generateInvoiceLoading}
                  type="default"
                >
                  生成发票
                </Button>
                <Button 
                  icon={<SettingOutlined />} 
                  onClick={() => setInvoiceTemplateModalVisible(true)}
                  type="default"
                >
                  管理发票模板
                </Button>
                <Button 
                  icon={<FileExcelOutlined />} 
                  onClick={() => setPackingListModalVisible(true)}
                  type="default"
                >
                  上传装箱表
                </Button>
              </Space>
            </div>

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

            <div style={{ marginTop: 16 }}>
              <Form layout="vertical">
                <Form.Item label="发货备注" style={{ marginBottom: 16 }}>
                  <Input.TextArea
                    placeholder="请输入发货备注（可选）"
                    value={shippingRemark}
                    onChange={(e) => setShippingRemark(e.target.value)}
                    rows={3}
                    maxLength={500}
                    showCount
                  />
                </Form.Item>
              </Form>
            </div>

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Space>
                <Button icon={<ExportOutlined />} onClick={exportToExcel}>
                  导出Excel
                </Button>
                <Button type="primary" onClick={async () => {
                  console.log('🔄 开始执行批量发货完成操作');
                  
                  // 设置按钮加载状态
                  setShippingLoading(true);
                  
                  try {
                    console.log('📋 当前状态:', {
                      shippingDataLength: shippingData.length,
                      confirmedMixedBoxesLength: confirmedMixedBoxes.length,
                      confirmedWholeBoxesLength: confirmedWholeBoxes.length,
                      selectedRowsLength: selectedRows.length,
                      logisticsProvider
                    });
                    
                    // 检查是否有发货数据
                    if (shippingData.length === 0) {
                      message.warning('没有发货数据，无需记录出库信息');
                      return;
                    }
                    
                    // 第一步：记录出库信息（合并混合箱和整箱数据）
                    let stepMessage = message.loading('第1步：正在记录出库信息...', 0);
                    
                    // 准备合并的出库数据数组
                    const allOutboundItems: OutboundItem[] = [];
                    
                    // 处理混合箱数据
                    if (confirmedMixedBoxes.length > 0) {
                      console.log('📦 添加混合箱数据到出库记录:', confirmedMixedBoxes);
                      confirmedMixedBoxes.forEach(mixedItem => {
                        const selectedRecord = selectedRows.find(row => row.amz_sku === mixedItem.amz_sku);
                        allOutboundItems.push({
                          sku: selectedRecord?.local_sku || mixedItem.sku,
                          total_quantity: mixedItem.quantity,
                          country: selectedRecord?.country || '美国',
                          marketplace: selectedRecord?.marketplace === 'Amazon' ? '亚马逊' : selectedRecord?.marketplace || '亚马逊',
                          is_mixed_box: true,
                          original_mix_box_num: mixedItem.box_num,
                          order_item_id: selectedRecord?.record_num,
                          need_num: selectedRecord?.need_num
                        });
                      });
                    }
                    
                    // 处理整箱数据
                    if (confirmedWholeBoxes.length > 0) {
                      console.log('📦 添加整箱数据到出库记录:', confirmedWholeBoxes);
                      confirmedWholeBoxes.forEach(wholeItem => {
                        const selectedRecord = selectedRows.find(row => row.amz_sku === wholeItem.amz_sku);
                        allOutboundItems.push({
                          sku: selectedRecord?.local_sku || wholeItem.amz_sku,
                          total_quantity: wholeItem.confirm_quantity,
                          total_boxes: wholeItem.confirm_boxes,
                          country: selectedRecord?.country || '美国',
                          marketplace: selectedRecord?.marketplace === 'Amazon' ? '亚马逊' : selectedRecord?.marketplace || '亚马逊',
                          is_mixed_box: false,
                          order_item_id: selectedRecord?.record_num,
                          need_num: selectedRecord?.need_num
                        });
                      });
                    }
                    
                    // 如果没有确认的箱数据，使用发货数据
                    if (allOutboundItems.length === 0 && shippingData.length > 0) {
                      console.log('📦 使用发货数据进行出库记录:', shippingData);
                      shippingData.forEach(item => {
                        const selectedRecord = selectedRows.find(row => row.amz_sku === item.amz_sku);
                        allOutboundItems.push({
                          sku: selectedRecord?.local_sku || item.amz_sku,
                          total_quantity: item.quantity,
                          country: selectedRecord?.country || '美国',
                          marketplace: selectedRecord?.marketplace === 'Amazon' ? '亚马逊' : selectedRecord?.marketplace || '亚马逊',
                          is_mixed_box: true, // 默认按混合箱处理
                          original_mix_box_num: item.box_num,
                          order_item_id: selectedRecord?.record_num,
                          need_num: selectedRecord?.need_num
                        });
                      });
                    }
                    
                    if (allOutboundItems.length === 0) {
                      console.log('⚠️ 没有找到需要记录的出库数据');
                      message.warning('没有找到需要记录的出库数据');
                      return;
                    }
                    
                    // 一次性创建所有出库记录
                    console.log('📋 准备创建出库记录，总计:', allOutboundItems.length);
                    const requestBody = {
                      shipments: allOutboundItems,
                      operator: '申报出库',
                      shipping_method: selectedRows[0]?.shipping_method || '',
                      logistics_provider: logisticsProvider || '',
                      remark: shippingRemark.trim() || `批量发货 - ${new Date().toLocaleString('zh-CN')}`
                    };
                    
                    console.log('📋 完整的请求体:', requestBody);

                    const response = await fetch(`${API_BASE_URL}/api/shipping/outbound-record`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
                      },
                      body: JSON.stringify(requestBody),
                    });

                    const result = await response.json();
                    console.log('📋 后端返回的结果:', result);
                    
                    message.destroy();
                    
                    if (result.code === 0) {
                      console.log('✅ 出库记录创建成功:', result.data);
                      if (result.data && result.data.shipment_number) {
                        message.success(`✅ 发货完成！发货单号: ${result.data.shipment_number}`, 3);
                      } else {
                        message.success('✅ 发货完成！出库记录已成功创建', 3);
                      }
                    } else {
                      console.error('❌ 出库记录失败:', result.message);
                      message.error(`出库记录失败: ${result.message}`);
                      return;
                    }
                    
                    // 清理状态并关闭对话框
                    console.log('🔄 清理状态并关闭对话框');
                    setShippingModalVisible(false);
                    setSelectedRowKeys([]);
                    setSelectedRows([]);
                    setConfirmedMixedBoxes([]);
                    setConfirmedWholeBoxes([]);
                    setShippingData([]);
                    setCurrentStep(0);
                    setCurrentMixedBoxIndex(0);
                    setNextBoxNumber(1);
                    
                    // 延迟刷新数据，优化用户体验
                    setTimeout(async () => {
                      const refreshMessage = message.loading('正在刷新数据...', 0);
                      try {
                        await Promise.all([
                          currentView === 'summary' ? fetchLocalInventorySummary() : fetchPendingOutboundRecords(),
                          fetchCountryInventory()
                        ]);
                        message.destroy();
                        message.info('📊 数据已更新', 2);
                      } catch (refreshError) {
                        message.destroy();
                        console.error('数据刷新失败:', refreshError);
                        message.warning('数据刷新失败，请手动刷新页面');
                      }
                    }, 1000);
                    
                  } catch (error) {
                    message.destroy();
                    console.error('❌ 出库记录处理失败:', error);
                    message.error('操作失败，请检查后重试：' + (error instanceof Error ? error.message : '未知错误'));
                  } finally {
                    setShippingLoading(false);
                  }
                }} 
                loading={shippingLoading}
                disabled={shippingLoading}
                >
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

      {/* 亚马逊模板管理对话框 */}
      <Modal
        title="管理亚马逊发货上传模板"
        open={templateModalVisible}
        onCancel={() => {
          setTemplateModalVisible(false);
          setSelectedTemplateCountry('');
          setAvailableSheets([]); // 清空Sheet页选项
          templateForm.resetFields();
        }}
        footer={null}
        width={800}
        destroyOnClose
      >
        {amazonTemplateConfig.hasTemplate && amazonTemplateConfig.countries && amazonTemplateConfig.countries.length > 0 && (
          <div>
            {/* 已配置的模板列表 */}
            <Alert
              message={`已配置 ${amazonTemplateConfig.countries.length} 个国家的亚马逊模板`}
              description={`配置的国家：${amazonTemplateConfig.countries.join('、')}`}
              type="info"
              style={{ marginBottom: 16 }}
            />
            
            {/* 模板列表 */}
            <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: 16 }}>
              {amazonTemplateConfig.countries.map(country => {
                const template = amazonTemplateConfig.templates?.[country];
                if (!template) return null;
                
                return (
                  <Card key={country} size="small" style={{ marginBottom: 8 }}>
                    <Row>
                      <Col span={20}>
                        <Descriptions size="small" column={2}>
                          <Descriptions.Item label="国家">{template.countryName}</Descriptions.Item>
                          <Descriptions.Item label="文件名">{template.originalName}</Descriptions.Item>
                          <Descriptions.Item label="Sheet页">{template.sheetName}</Descriptions.Item>
                          <Descriptions.Item label="SKU列">{template.merchantSkuColumn}</Descriptions.Item>
                          <Descriptions.Item label="数量列">{template.quantityColumn}</Descriptions.Item>
                          <Descriptions.Item label="开始行">{template.startRow}</Descriptions.Item>
                          <Descriptions.Item label="上传时间" span={2}>
                            {new Date(template.uploadTime).toLocaleString('zh-CN')}
                          </Descriptions.Item>
                        </Descriptions>
                      </Col>
                      <Col span={4} style={{ textAlign: 'right' }}>
                        <Space direction="vertical" size="small">
                          <Button 
                            size="small"
                            type="default"
                            onClick={() => handleViewTemplate(country)}
                          >
                            查看
                          </Button>
                          <Button 
                            size="small"
                            onClick={() => setSelectedTemplateCountry(country)}
                          >
                            更新
                          </Button>
                          <Button 
                            size="small"
                            danger
                            onClick={() => {
                                setDeleteTargetCountry(country);
                                setDeleteTargetTemplate(template);
                                setDeleteConfirmVisible(true);
                              }}
                          >
                            删除
                          </Button>
                        </Space>
                      </Col>
                    </Row>
                  </Card>
                );
              })}
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <Button 
                type="primary" 
                icon={<UploadOutlined />} 
                onClick={() => setSelectedTemplateCountry('new')}
              >
                添加新国家模板
              </Button>
            </div>
          </div>
        )}

        {/* 上传/更新模板表单 */}
        {(selectedTemplateCountry === 'new' || (selectedTemplateCountry && selectedTemplateCountry !== '')) && (
          <div>
            <Alert
              message={selectedTemplateCountry === 'new' ? "添加新国家模板" : `更新 ${amazonTemplateConfig.templates?.[selectedTemplateCountry]?.countryName} 模板`}
              description={
                <div>
                  <p>请上传亚马逊的Excel模板文件，并配置以下信息：</p>
                  <ul>
                    <li><strong>适用国家：</strong>该模板适用的亚马逊站点国家</li>
                    <li><strong>Sheet页名称：</strong>需要填写数据的工作表名称（如：Create workflow – template）</li>
                    <li><strong>Merchant SKU列：</strong>Merchant SKU所在的列（如：A）</li>
                    <li><strong>Quantity列：</strong>Quantity所在的列（如：B）</li>
                    <li><strong>开始行：</strong>开始填写数据的行号（如：9）</li>
                  </ul>
                </div>
              }
              type="info"
              style={{ marginBottom: 16 }}
            />

            <Form
              form={templateForm}
              layout="vertical"
              onFinish={handleUploadTemplate}
              initialValues={selectedTemplateCountry !== 'new' && amazonTemplateConfig.templates?.[selectedTemplateCountry] ? {
                country: selectedTemplateCountry,
                sheetName: amazonTemplateConfig.templates[selectedTemplateCountry].sheetName,
                merchantSkuColumn: amazonTemplateConfig.templates[selectedTemplateCountry].merchantSkuColumn,
                quantityColumn: amazonTemplateConfig.templates[selectedTemplateCountry].quantityColumn,
                startRow: amazonTemplateConfig.templates[selectedTemplateCountry].startRow,
              } : {
                // 新建模板时的默认值
                sheetName: 'Create workflow – template',
                merchantSkuColumn: 'A',
                quantityColumn: 'B',
                startRow: 9,
              }}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="country"
                    label="适用国家"
                    rules={[{ required: true, message: '请选择适用国家' }]}
                  >
                    <Select 
                      placeholder="选择亚马逊站点国家"
                      disabled={selectedTemplateCountry !== 'new'}
                      showSearch
                      optionLabelProp="label"
                      filterOption={(input, option) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()) ||
                        String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                    >
                      {countryTemplateOptions.map(option => (
                        <Option 
                          key={option.value} 
                          value={option.value} 
                          label={option.label}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{option.label}</span>
                            <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>{option.site}</span>
                          </div>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="template"
                    label="Excel模板文件"
                    rules={[{ required: true, message: '请选择模板文件' }]}
                    getValueFromEvent={(e) => {
                      if (Array.isArray(e)) {
                        return e;
                      }
                      return e && e.fileList;
                    }}
                  >
                    <Upload
                      accept=".xlsx,.xls"
                      beforeUpload={() => false}
                      maxCount={1}
                      onChange={() => {
                        // 当用户重新选择文件时，清空Sheet页选项
                        setAvailableSheets([]);
                      }}
                    >
                      <Button icon={<UploadOutlined />}>选择Excel文件</Button>
                    </Upload>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="sheetName"
                    label="Sheet页名称"
                    rules={[{ required: true, message: '请选择或输入Sheet页名称' }]}
                  >
                    {availableSheets.length > 0 ? (
                      <div>
                        <Select placeholder="请选择Sheet页" allowClear showSearch style={{ width: '100%' }}>
                          {availableSheets.map(sheetName => (
                            <Option key={sheetName} value={sheetName}>
                              {sheetName}
                            </Option>
                          ))}
                        </Select>
                        <Text type="secondary" style={{ fontSize: '12px', marginTop: '4px', display: 'block' }}>
                          ✅ 已检测到Excel文件中的Sheet页，请选择一个
                        </Text>
                      </div>
                    ) : (
                      <Input placeholder="例如：Create workflow – template" />
                    )}
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    name="merchantSkuColumn"
                    label="Merchant SKU列"
                    rules={[{ required: true, message: '请输入列标识' }]}
                  >
                    <Input placeholder="例如：A" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    name="quantityColumn"
                    label="Quantity列"
                    rules={[{ required: true, message: '请输入列标识' }]}
                  >
                    <Input placeholder="例如：B" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item
                    name="startRow"
                    label="开始填写行号"
                    rules={[{ required: true, message: '请输入开始行号' }]}
                  >
                    <InputNumber min={1} placeholder="例如：9" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => {
                    setSelectedTemplateCountry('');
                    setAvailableSheets([]);
                    templateForm.resetFields();
                  }}>
                    取消
                  </Button>
                  <Button type="primary" htmlType="submit" loading={uploadLoading}>
                    {selectedTemplateCountry === 'new' ? '上传并配置' : '更新配置'}
                  </Button>
                </Space>
              </div>
            </Form>
          </div>
        )}

        {/* 没有配置任何模板时显示 */}
        {!amazonTemplateConfig.hasTemplate && selectedTemplateCountry === '' && (
          <div>
            <Alert
              message="尚未配置任何亚马逊模板"
              description="请添加至少一个国家的亚马逊批量上传产品表模板，以便在发货时自动生成对应文件。"
              type="warning"
              style={{ marginBottom: 16 }}
            />
            <Button 
              type="primary" 
              icon={<UploadOutlined />} 
              onClick={() => setSelectedTemplateCountry('new')}
            >
              添加第一个模板
            </Button>
          </div>
        )}
      </Modal>

      {/* 装箱表管理对话框 */}
      <Modal
        title="上传装箱表"
        open={packingListModalVisible}
        onCancel={() => {
          setPackingListModalVisible(false);
          packingListForm.resetFields();
          setPackingListConfig(null);
        }}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Alert
          message="智能装箱表处理"
          description={
            <div>
              <p><strong>🎨 保持原始格式：</strong>填写时完全保持原Excel文件的样式、公式、格式不变。</p>
              <p><strong>📋 智能解析：</strong>自动从M3获取箱数，从M列开始处理，第6行开始填写数据。</p>
              <p><strong>🚀 一键完成：</strong>上传后自动填写并下载，无需额外操作。</p>
            </div>
          }
          type="info"
          style={{ marginBottom: 16 }}
        />
        
        <Form
          form={packingListForm}
          layout="vertical"
          onFinish={handleUploadPackingList}
        >
          <Form.Item
            name="packingList"
            label="装箱表Excel文件"
            rules={[{ required: true, message: '请选择装箱表文件' }]}
            getValueFromEvent={(e) => {
              if (Array.isArray(e)) {
                return e;
              }
              return e && e.fileList;
            }}
          >
            <Upload
              beforeUpload={() => false}
              accept=".xlsx,.xls"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />} size="large" style={{ width: '100%', height: '60px' }}>
                <div>
                  <div>选择Excel文件</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {shippingData && shippingData.length > 0 
                      ? '上传后将自动填写并下载' 
                      : '请先确认发货清单'}
                  </div>
                </div>
              </Button>
            </Upload>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setPackingListModalVisible(false);
                packingListForm.resetFields();
                setPackingListConfig(null);
              }}>
                取消
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={packingListLoading}
                disabled={!shippingData || shippingData.length === 0}
              >
                {shippingData && shippingData.length > 0 ? '上传并自动填写' : '上传（需先确认发货）'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 删除确认对话框 */}
      <Modal
        title="确认删除"
        open={deleteConfirmVisible}
        onCancel={() => {
          setDeleteConfirmVisible(false);
          setDeleteTargetCountry('');
          setDeleteTargetTemplate(null);
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setDeleteConfirmVisible(false);
            setDeleteTargetCountry('');
            setDeleteTargetTemplate(null);
          }}>
            取消
          </Button>,
          <Button 
            key="confirm" 
            type="primary" 
            danger 
            onClick={async () => {
              setDeleteConfirmVisible(false);
              await deleteTemplateConfig(deleteTargetCountry);
              setDeleteTargetCountry('');
              setDeleteTargetTemplate(null);
            }}
          >
            确定删除
          </Button>
        ]}
        centered
        width={480}
      >
        <div>
          <p>确定要删除 <strong>{deleteTargetTemplate?.countryName}</strong> 的模板配置吗？</p>
          <p style={{ color: '#ff4d4f', fontSize: '14px' }}>
            ⚠️ 此操作不可恢复，删除后需要重新上传模板。
          </p>
          {deleteTargetTemplate && (
            <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 6 }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                <strong>模板信息：</strong><br/>
                文件名：{deleteTargetTemplate.originalName}<br/>
                Sheet页：{deleteTargetTemplate.sheetName}<br/>
                上传时间：{new Date(deleteTargetTemplate.uploadTime).toLocaleString('zh-CN')}
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* 物流商发票模板管理对话框 */}
      <Modal
        title="管理物流商发票模板"
        open={invoiceTemplateModalVisible}
        onCancel={() => {
          setInvoiceTemplateModalVisible(false);
          setSelectedInvoiceProvider('');
          setSelectedInvoiceCountry('');
          invoiceTemplateForm.resetFields();
        }}
        footer={null}
        width={800}
        destroyOnClose
      >
        {logisticsInvoiceConfig.hasTemplate && logisticsInvoiceConfig.logisticsProviders && logisticsInvoiceConfig.logisticsProviders.length > 0 && (
          <div>
            {/* 已配置的发票模板列表 */}
            <Alert
              message={`已配置 ${logisticsInvoiceConfig.logisticsProviders.length} 个物流商的发票模板`}
              description={`配置的物流商：${logisticsInvoiceConfig.logisticsProviders.join('、')}`}
              type="info"
              style={{ marginBottom: 16 }}
            />
            
            {/* 模板列表 */}
            <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: 16 }}>
              {logisticsInvoiceConfig.logisticsProviders.map(provider => {
                const providerTemplates = logisticsInvoiceConfig.templates?.[provider];
                if (!providerTemplates) return null;
                
                return (
                  <div key={provider} style={{ marginBottom: 16 }}>
                    <Text strong style={{ fontSize: '16px' }}>{provider}</Text>
                    {Object.entries(providerTemplates).map(([country, template]) => (
                      <Card key={`${provider}-${country}`} size="small" style={{ marginTop: 8, marginLeft: 16 }}>
                        <Row>
                          <Col span={20}>
                            <Descriptions size="small" column={2}>
                              <Descriptions.Item label="国家">{template.countryName}</Descriptions.Item>
                              <Descriptions.Item label="文件名">{template.originalName}</Descriptions.Item>
                              <Descriptions.Item label="Sheet页">{template.sheetName}</Descriptions.Item>
                              <Descriptions.Item label="上传时间" span={2}>
                                {new Date(template.uploadTime).toLocaleString('zh-CN')}
                              </Descriptions.Item>
                            </Descriptions>
                          </Col>
                          <Col span={4} style={{ textAlign: 'right' }}>
                            <Space direction="vertical" size="small">
                              <Button 
                                size="small"
                                onClick={() => {
                                  setSelectedInvoiceProvider(provider);
                                  setSelectedInvoiceCountry(country);
                                }}
                              >
                                更新
                              </Button>
                              <Button 
                                size="small"
                                danger
                                onClick={() => deleteInvoiceTemplateConfig(provider, country)}
                              >
                                删除
                              </Button>
                            </Space>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                  </div>
                );
              })}
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <Button 
                type="primary" 
                icon={<UploadOutlined />} 
                onClick={() => {
                  setSelectedInvoiceProvider('new');
                  setSelectedInvoiceCountry('new');
                }}
              >
                添加新物流商发票模板
              </Button>
            </div>
          </div>
        )}

        {/* 上传/更新发票模板表单 */}
        {((selectedInvoiceProvider === 'new' && selectedInvoiceCountry === 'new') || 
          (selectedInvoiceProvider && selectedInvoiceCountry && selectedInvoiceProvider !== '' && selectedInvoiceCountry !== '')) && (
          <div>
            <Alert
              message={selectedInvoiceProvider === 'new' ? "添加新物流商发票模板" : `更新 ${selectedInvoiceProvider} - ${logisticsInvoiceConfig.templates?.[selectedInvoiceProvider]?.[selectedInvoiceCountry]?.countryName} 发票模板`}
              description={
                <div>
                  <p>请上传物流商的Excel发票模板文件，并配置以下信息：</p>
                  <ul>
                    <li><strong>物流商：</strong>该模板适用的物流商</li>
                    <li><strong>适用国家：</strong>该模板适用的国家</li>
                    <li><strong>Sheet页名称：</strong>需要填写数据的工作表名称</li>
                  </ul>
                </div>
              }
              type="info"
              style={{ marginBottom: 16 }}
            />

            <Form
              form={invoiceTemplateForm}
              layout="vertical"
              onFinish={handleUploadInvoiceTemplate}
              initialValues={selectedInvoiceProvider !== 'new' && logisticsInvoiceConfig.templates?.[selectedInvoiceProvider]?.[selectedInvoiceCountry] ? {
                logisticsProvider: selectedInvoiceProvider,
                country: selectedInvoiceCountry,
                sheetName: logisticsInvoiceConfig.templates[selectedInvoiceProvider][selectedInvoiceCountry].sheetName,
              } : {
                // 新建模板时的默认值
                sheetName: 'Sheet1',
              }}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="logisticsProvider"
                    label="物流商"
                    rules={[{ required: true, message: '请选择物流商' }]}
                  >
                    <Select 
                      placeholder="选择物流商"
                      disabled={selectedInvoiceProvider !== 'new'}
                      options={logisticsProviderOptions}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="country"
                    label="适用国家"
                    rules={[{ required: true, message: '请选择适用国家' }]}
                  >
                    <Select 
                      placeholder="选择国家"
                      disabled={selectedInvoiceProvider !== 'new'}
                      showSearch
                      optionLabelProp="label"
                      filterOption={(input, option) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                    >
                      {countryTemplateOptions.map(option => (
                        <Option 
                          key={option.value} 
                          value={option.value} 
                          label={option.label}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{option.label}</span>
                            <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>{option.site}</span>
                          </div>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="template"
                    label="Excel发票模板文件"
                    rules={[{ required: true, message: '请选择模板文件' }]}
                    getValueFromEvent={(e) => {
                      if (Array.isArray(e)) {
                        return e;
                      }
                      return e && e.fileList;
                    }}
                  >
                    <Upload
                      accept=".xlsx,.xls"
                      beforeUpload={() => false}
                      maxCount={1}
                    >
                      <Button icon={<UploadOutlined />}>选择Excel文件</Button>
                    </Upload>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="sheetName"
                    label="Sheet页名称"
                    rules={[{ required: true, message: '请输入Sheet页名称' }]}
                  >
                    <Input placeholder="例如：Sheet1" />
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => {
                    setSelectedInvoiceProvider('');
                    setSelectedInvoiceCountry('');
                    invoiceTemplateForm.resetFields();
                  }}>
                    取消
                  </Button>
                  <Button type="primary" htmlType="submit" loading={invoiceUploadLoading}>
                    {selectedInvoiceProvider === 'new' ? '上传并配置' : '更新配置'}
                  </Button>
                </Space>
              </div>
            </Form>
          </div>
        )}

        {/* 没有配置任何发票模板时显示 */}
        {!logisticsInvoiceConfig.hasTemplate && selectedInvoiceProvider === '' && selectedInvoiceCountry === '' && (
          <div>
            <Alert
              message="尚未配置任何物流商发票模板"
              description="请添加至少一个物流商的发票模板，以便在发货时自动生成对应发票文件。"
              type="warning"
              style={{ marginBottom: 16 }}
            />
            <Button 
              type="primary" 
              icon={<UploadOutlined />} 
              onClick={() => {
                setSelectedInvoiceProvider('new');
                setSelectedInvoiceCountry('new');
              }}
            >
              添加第一个发票模板
            </Button>
          </div>
        )}
      </Modal>

      {/* 需求单管理弹窗 */}
      <Modal
        title={`需求单管理 - ${orderModalNeedNum || ''}`}
        open={orderModalVisible}
        onCancel={() => setOrderModalVisible(false)}
        footer={null}
        width={1100}
        destroyOnClose
      >
        {orderModalNeedNum && (
          <OrderManagementPage needNum={orderModalNeedNum} />
        )}
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

      {/* 发货历史模态框 */}
      <Modal
        title="发货历史"
        open={shipmentHistoryModalVisible}
        onCancel={() => setShipmentHistoryModalVisible(false)}
        width="95%"
        style={{ maxWidth: '1600px', top: 20 }}
        footer={null}
        destroyOnClose
      >
        <ShipmentHistoryPage />
      </Modal>

    </div>
  );
};

// 整箱确认表单组件
interface WholeBoxConfirmFormProps {
  data: WholeBoxConfirmData[];
  onConfirm: (data: WholeBoxConfirmData[]) => void;
  onSkip: () => void;
  loading?: boolean;
}

const WholeBoxConfirmForm: React.FC<WholeBoxConfirmFormProps> = ({ 
  data, 
  onConfirm, 
  onSkip, 
  loading = false 
}: WholeBoxConfirmFormProps) => {
  const [form] = Form.useForm();
  const [confirmData, setConfirmData] = useState<WholeBoxConfirmData[]>(
    data.map((item: WholeBoxConfirmData) => ({
      ...item,
      confirm_boxes: item.total_boxes,
      confirm_quantity: item.total_quantity
    }))
  );

  useEffect(() => {
    form.setFieldsValue(
      confirmData.reduce((acc: any, item: WholeBoxConfirmData, index: number) => {
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
          <Button onClick={onSkip} disabled={loading}>跳过整箱</Button>
          <Button 
            type="primary" 
            onClick={() => onConfirm(confirmData)} 
            loading={loading}
            disabled={loading}
          >
            确认发货
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default ShippingPage; 