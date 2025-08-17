import React, { useState, useRef } from 'react';
import { 
  Button, 
  Input, 
  Table, 
  message, 
  Space, 
  Select, 
  Modal, 
  Popconfirm,
  Form,
  FormInstance,
  Tooltip,
  Typography,
  Card,
  Row,
  Col,
  Statistic,
  DatePicker,
  Checkbox,
  AutoComplete,
  Upload,
  List,
  Badge,
  Tag,
  Progress,
  Tabs,
  Switch,
  Radio,
  Steps
} from 'antd';
import { useTaskContext } from '../../contexts/TaskContext';
import { 
  UploadOutlined, 
  DeleteOutlined, 
  LinkOutlined,
  ReloadOutlined,
  SearchOutlined,
  CameraOutlined,
  CloudUploadOutlined,
  FilterOutlined,
  FilePdfOutlined,
  EyeOutlined,
  PlusOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  FileExcelOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
  CloseCircleOutlined,
  GlobalOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ColumnsType, TableProps } from 'antd/es/table';
import { API_BASE_URL } from '../../config/api';


const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;
const { RangePicker } = DatePicker;

interface ProductRecord {
  id: number;
  parent_sku: string;
  weblink: string;
  update_time: string;
  check_time: string;
  status: string;
  notice: string;
  cpc_status: string;
  cpc_submit: string;
  model_number: string;
  recommend_age: string;
  ads_add: string;
  list_parent_sku: string;
  no_inventory_rate: string;
  sales_30days: string;
  seller_name: string;
  cpc_files?: string;
}

interface CpcFile {
  uid: string;
  name: string;
  url: string;
  objectName: string;
  size: number;
  uploadTime: string;
  extractedData?: {
    styleNumber: string;
    recommendAge: string;
  };
}

interface EditingCell {
  id: number;
  field: string;
  value: string;
}

// 注：状态、CPC测试情况、CPC提交情况选项现在都从数据库动态获取

const Purchase: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProductRecord[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editForm] = Form.useForm<any>();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  // 多站点模板文件管理
  const [allTemplateFiles, setAllTemplateFiles] = useState<Record<string, any[]>>({
    US: [],
    CA: [],
    UK: [],
    AE: [],
    AU: []
  });
  const [activeTabKey, setActiveTabKey] = useState<string>('US');
  const [templateLoading, setTemplateLoading] = useState<Record<string, boolean>>({
    US: false,
    CA: false,
    UK: false,
    AE: false,
    AU: false
  });
  const [globalTemplateLoading, setGlobalTemplateLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateFileInputRef = useRef<HTMLInputElement>(null);
  
  // CPC文件相关状态
  const [cpcModalVisible, setCpcModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<ProductRecord | null>(null);
  const [cpcFiles, setCpcFiles] = useState<CpcFile[]>([]);
  const [cpcUploading, setCpcUploading] = useState(false);
  
  // 自动识别结果状态
  const [extractedDataVisible, setExtractedDataVisible] = useState(false);
  const [pendingExtractedData, setPendingExtractedData] = useState<{
    styleNumber: string;
    recommendAge: string;
  } | null>(null);
  
  // 搜索相关状态
  const [searchType, setSearchType] = useState<'sku' | 'weblink'>('sku');
  const [isFuzzySearch, setIsFuzzySearch] = useState(false);
  
  // 上传结果对话框状态
  const [uploadResultVisible, setUploadResultVisible] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    successCount: number;
    skippedCount: number;
    totalRows: number;
    skippedRecords: Array<{
      row: number;
      sku: string;
      link: string;
      reason: string;
    }>;
    errorMessages: string[];
  } | null>(null);
  
  // 筛选相关状态
  const [filters, setFilters] = useState({
    status: '',
    cpc_status: '',
    cpc_submit: '',
    seller_name: '',
    dateRange: null as [string, string] | null
  });
  const [filteredData, setFilteredData] = useState<ProductRecord[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [originalData, setOriginalData] = useState<ProductRecord[]>([]);
  
  // 统计数据（基于全库数据）
  const [statistics, setStatistics] = useState({
    waitingPImage: 0,
    waitingUpload: 0,
    cpcTestPending: 0,
    cpcTesting: 0,
    cpcSampleSent: 0,
    cpcPendingListing: 0
  });
  
  // 生成其他站点资料表相关状态
  const [otherSiteModalVisible, setOtherSiteModalVisible] = useState(false);
  const [uploadedExcelFiles, setUploadedExcelFiles] = useState<Record<string, File | null>>({
    US: null,
    CA: null,
    UK: null,
    AE: null,
    AU: null
  });
  const [activeSiteTabKey, setActiveSiteTabKey] = useState<string>('US');
  const [otherSiteLoading, setOtherSiteLoading] = useState<Record<string, boolean>>({
    US: false,
    CA: false,
    UK: false,
    AE: false,
    AU: false
  });
  const [missingColumnsModalVisible, setMissingColumnsModalVisible] = useState(false);
  const [missingColumnsInfo, setMissingColumnsInfo] = useState<any>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, { blob: Blob; fileName: string } | null>>({
    US: null,
    CA: null,
    UK: null,
    AE: null,
    AU: null
  });
  const [batchProgress, setBatchProgress] = useState<Record<string, 'pending' | 'processing' | 'completed' | 'failed'>>({
    US: 'pending',
    CA: 'pending',
    UK: 'pending',
    AE: 'pending',
    AU: 'pending'
  });

  // 新增：3步流程相关状态
  const [currentStep, setCurrentStep] = useState(0); // 当前步骤：0=上传源数据，1=选择目标站点，2=下载管理
  const [sourceCountry, setSourceCountry] = useState<string>(''); // 源站点
  const [sourceFile, setSourceFile] = useState<File | null>(null); // 源文件
  const [sourceDataUploaded, setSourceDataUploaded] = useState(false); // 源数据是否已上传到数据库
  const [selectedTargetCountries, setSelectedTargetCountries] = useState<string[]>([]); // 选择的目标站点
  const [generationInProgress, setGenerationInProgress] = useState(false); // 是否正在生成
  const [completedCountries, setCompletedCountries] = useState<string[]>([]); // 已完成生成的站点
  const [downloadHistory, setDownloadHistory] = useState<Record<string, { blob: Blob; fileName: string; generatedAt: string }>>({});

  // 全库统计数据
  const [allDataStats, setAllDataStats] = useState({
    statusStats: [] as { value: string; count: number }[],
    cpcStatusStats: [] as { value: string; count: number }[],
    cpcSubmitStats: [] as { value: string; count: number }[],
    supplierStats: [] as { value: string; count: number }[]
  });

  // 使用全局任务上下文
  const { tasks: backgroundTasks, addTask, updateTask, removeTask, hasRunningTasks } = useTaskContext();

  // 添加钉钉推送开关状态
  const [enableDingTalkNotification, setEnableDingTalkNotification] = useState(true);

  // 获取全库统计数据
  const fetchAllDataStatistics = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/statistics`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const result = await res.json();
      console.log('🔍 获取到的统计数据:', result);
      
      setStatistics(result.statistics);
      setAllDataStats({
        statusStats: result.statusStats || [],
        cpcStatusStats: result.cpcStatusStats || [],
        cpcSubmitStats: result.cpcSubmitStats || [],
        supplierStats: result.supplierStats || []
      });
      
      // 添加调试日志
      console.log('📊 CPC提交情况统计数据:', result.cpcSubmitStats);
      if (result.cpcSubmitStats && result.cpcSubmitStats.length > 0) {
        console.log('✅ CPC提交情况数据加载成功，共', result.cpcSubmitStats.length, '种状态');
      } else {
        console.warn('⚠️  CPC提交情况数据为空');
      }
    } catch (e) {
      console.error('获取统计数据失败:', e);
    }
  };

  // 页面加载时获取统计数据
  React.useEffect(() => {
    fetchAllDataStatistics();
  }, []);



  // 搜索功能
  const handleSearch = async () => {
    const keywords = input
      .split('\n')
      .map(i => i.trim())
      .filter(Boolean);
    if (keywords.length === 0) {
      const searchTypeName = searchType === 'sku' ? 'SKU' : '产品链接/ID';
      message.warning(`请输入${searchTypeName}`);
      return;
    }
    
    setLoading(true);
    try {
      const requestPayload = { 
        keywords,
        searchType,
        isFuzzy: searchType === 'weblink' ? true : isFuzzySearch // 产品链接搜索强制模糊搜索
      };
      
      console.log('🔍 搜索请求参数:', requestPayload);
      
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const result = await res.json();
      const searchData = result.data || [];
      setData(searchData);
      setOriginalData(searchData);
      setFilteredData(searchData);
      
      if (!searchData || searchData.length === 0) {
        message.info('未找到匹配的产品信息');
      } else {
        const searchTypeName = searchType === 'sku' ? 'SKU' : '产品链接/ID';
        const searchModeName = searchType === 'weblink' ? '模糊' : (isFuzzySearch ? '模糊' : '精确');
        message.success(`通过${searchModeName}搜索${searchTypeName}，找到 ${searchData.length} 条产品信息`);
      }
    } catch (e) {
      console.error('搜索失败:', e);
      message.error(`查询失败: ${e instanceof Error ? e.message : '未知错误'}`);
    }
    setLoading(false);
  };

  // 筛选功能 - 从全库数据中筛选
  const applyFilters = async (currentFilters: any) => {
    try {
      // 构建查询条件
      const conditions: any = {};
      if (currentFilters.status) {
        conditions.status = currentFilters.status;
      }
      if (currentFilters.cpc_status) {
        conditions.cpc_status = currentFilters.cpc_status;
      }
      if (currentFilters.cpc_submit !== undefined && currentFilters.cpc_submit !== '') {
        conditions.cpc_submit = currentFilters.cpc_submit;
      }
      if (currentFilters.seller_name) {
        conditions.seller_name = currentFilters.seller_name;
      }
      if (currentFilters.dateRange) {
        conditions.dateRange = currentFilters.dateRange;
      }

      // 如果没有筛选条件，清空数据
      if (Object.keys(conditions).length === 0) {
        setFilteredData([]);
        setData([]);
        setOriginalData([]);
        return;
      }

      // 调用后端API获取筛选数据
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/filter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conditions),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      const filteredData = result.data || [];
      
      setData(filteredData);
      setOriginalData(filteredData);
      setFilteredData(filteredData);
      
      message.success(`筛选完成，找到 ${filteredData.length} 条符合条件的记录`);
    } catch (e) {
      console.error('筛选失败:', e);
      message.error('筛选失败');
    }
  };

  // 处理筛选变化
  const handleFilterChange = (filterType: string, value: string | [string, string] | null) => {
    const newFilters = { ...filters, [filterType]: value };
    setFilters(newFilters);
    applyFilters(newFilters);
  };



  // 点击卡片显示对应状态数据
  const handleCardClick = (status: string, type: 'status' | 'cpc_status' = 'status') => {
    const cardFilters = { ...filters, [type]: status };
    setFilters(cardFilters);
    applyFilters(cardFilters);
  };

  // 点击CPC待上架产品数卡片的特殊处理
  const handleCpcPendingListingClick = async () => {
    try {
      // 构建特殊查询条件：测试完成且CPC提交情况为空
      const conditions = {
        cpc_status: '测试完成',
        cpc_submit_empty: true // 特殊标识，后端会处理
      };

      // 调用后端API获取筛选数据
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/filter-cpc-pending-listing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conditions),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      const filteredData = result.data || [];
      
      setData(filteredData);
      setOriginalData(filteredData);
      setFilteredData(filteredData);
      
      // 更新筛选状态以反映当前筛选条件
      setFilters({ 
        ...filters, 
        cpc_status: '测试完成',
        cpc_submit: '' // 显示为空的提交情况
      });
      
      message.success(`筛选完成，找到 ${filteredData.length} 条CPC待上架产品记录`);
    } catch (e) {
      console.error('筛选CPC待上架产品失败:', e);
      message.error('筛选CPC待上架产品失败');
    }
  };

  // 获取唯一的CPC状态选项（基于全库数据）
  const getUniqueCpcStatuses = () => {
    return allDataStats.cpcStatusStats
      .sort((a, b) => a.value.localeCompare(b.value));
  };

  // 获取唯一的CPC提交情况选项（基于全库数据）
  const getUniqueCpcSubmits = () => {
    if (!allDataStats.cpcSubmitStats || !Array.isArray(allDataStats.cpcSubmitStats)) {
      console.warn('CPC提交情况统计数据为空或格式错误:', allDataStats.cpcSubmitStats);
      return [];
    }
    return allDataStats.cpcSubmitStats
      .filter(item => item && item.value && item.count > 0) // 过滤无效数据
      .sort((a: { value: string; count: number }, b: { value: string; count: number }) => a.value.localeCompare(b.value));
  };

  // 获取唯一的供应商选项（基于全库数据）
  const getUniqueSuppliers = () => {
    return allDataStats.supplierStats
      .sort((a, b) => a.value.localeCompare(b.value));
  };

  // 获取唯一的状态选项（基于全库数据）
  const getUniqueStatuses = () => {
    return allDataStats.statusStats
      .sort((a, b) => a.value.localeCompare(b.value));
  };

  // CPC文件管理相关函数
  const handleCpcFileManage = async (record: ProductRecord) => {
    setCurrentRecord(record);
    setCpcModalVisible(true);
    setExtractedDataVisible(false);
    setPendingExtractedData(null);
    await loadCpcFiles(record.id);
  };

  const loadCpcFiles = async (recordId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/cpc-files/${recordId}`);
      if (res.ok) {
        const result = await res.json();
        setCpcFiles(result.data || []);
      }
    } catch (error) {
      console.error('加载CPC文件失败:', error);
    }
  };

  // 单文件上传处理逻辑
  const handleSingleFileUpload = async (file: File) => {
    if (!currentRecord) return null;

    try {
      const formData = new FormData();
      formData.append('cpcFile', file);

      const res = await fetch(`${API_BASE_URL}/api/product_weblink/upload-cpc-file/${currentRecord.id}`, {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();
      
      if (result.code === 0) {
        await loadCpcFiles(currentRecord.id);
        return result;
      } else {
        console.error(`文件 ${file.name} 上传失败:`, result.message);
        return null;
      }
    } catch (error) {
      console.error(`文件 ${file.name} 上传失败:`, error);
      return null;
    }
  };

  // 多文件批量上传处理
  const handleMultipleFileUpload = async (files: File[]) => {
    if (!currentRecord || files.length === 0) return;

    setCpcUploading(true);
    const uploadResults = [];
    let cpcCertificateExtracted = false;
    let extractedInfo: any = null;

    try {
      const loadingMessage = message.loading(`正在批量上传 ${files.length} 个文件...`, 0);

      // 筛选PDF文件
      const pdfFiles = files.filter(file => file.type === 'application/pdf');
      const skippedFiles = files.length - pdfFiles.length;

      if (skippedFiles > 0) {
        message.warning(`跳过 ${skippedFiles} 个非PDF文件`);
      }

      // 逐个上传PDF文件
      for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i];
        const result = await handleSingleFileUpload(file);
        
        if (result) {
          uploadResults.push({
            file: file.name,
            success: true,
            result: result
          });

          // 检查是否为CPC证书文件且是第一个提取到信息的文件
          if (!cpcCertificateExtracted && result.data.extractedData && 
              (result.data.extractedData.styleNumber || result.data.extractedData.recommendAge)) {
            cpcCertificateExtracted = true;
            extractedInfo = result.data.extractedData;
          }
        } else {
          uploadResults.push({
            file: file.name,
            success: false
          });
        }
      }

      loadingMessage(); // 关闭loading消息

      // 生成批量上传结果提示
      const successCount = uploadResults.filter(r => r.success).length;
      const totalPdfCount = pdfFiles.length;
      
      const notifications = [];
      
      if (successCount > 0) {
        if (totalPdfCount === successCount) {
          notifications.push(`成功上传 ${successCount} 个PDF文件`);
        } else {
          notifications.push(`成功上传 ${successCount}/${totalPdfCount} 个PDF文件`);
        }
        
                          if (cpcCertificateExtracted && extractedInfo) {
           // 显示提取结果确认对话框
           setPendingExtractedData(extractedInfo);
           setExtractedDataVisible(true);
           
           const extractedDetails = [];
           if (extractedInfo.styleNumber) {
             extractedDetails.push(`Style Number: ${extractedInfo.styleNumber}`);
           }
           if (extractedInfo.recommendAge) {
             extractedDetails.push(`推荐年龄: ${extractedInfo.recommendAge}`);
           }
           notifications.push(`已从CPC证书文件中自动识别信息：${extractedDetails.join(', ')}，请确认是否应用`);
          } else {
           // 检查是否有CPC证书文件但已经提取过信息
           const hasCpcButAlreadyExtracted = uploadResults.some(r => 
             r.success && r.result?.data?.hasExistingData && 
             r.result?.data?.extractedData && 
             (r.result.data.extractedData.styleNumber || r.result.data.extractedData.recommendAge)
           );
           
           if (hasCpcButAlreadyExtracted) {
             notifications.push('检测到CPC证书文件，但信息已从之前的文件中提取过，跳过重复提取');
           } else if (successCount > 0) {
             notifications.push('未检测到CHILDREN\'S PRODUCT CERTIFICATE文件，无法自动提取信息');
           }
         }

        // 检查是否更新了CPC测试状态
        const latestResult = uploadResults.find(r => r.success && r.result?.data?.cpcStatusUpdated)?.result;
        if (latestResult?.data?.cpcStatusUpdated) {
          notifications.push(`CPC文件数量已达到${latestResult.data.totalFileCount}个，已自动更新CPC测试情况为"已测试"`);
        }

        message.success(notifications.join('；'));
        await loadCpcFiles(currentRecord.id); // 刷新CPC文件列表
        
        // 只有在有搜索条件或筛选条件时才刷新表格数据
        const hasSearchInput = input.trim().length > 0;
        const hasFilters = filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange;
        
        if (hasSearchInput) {
          handleSearch();
        } else if (hasFilters) {
          applyFilters(filters);
        }
      } else {
        message.error('所有文件上传失败');
      }

    } catch (error) {
      message.error('批量上传失败');
    } finally {
      setCpcUploading(false);
    }
  };

  // 兼容原有的单文件上传接口
  const handleCpcFileUpload = async (file: File) => {
    if (!currentRecord) return false;

    setCpcUploading(true);
    
    try {
      const result = await handleSingleFileUpload(file);
      
      if (result) {
        // 显示单文件上传的详细提示
        const notifications = [];
        
                 if (result.data.isFirstExtraction) {
           // 显示提取结果确认对话框
           setPendingExtractedData(result.data.extractedData);
           setExtractedDataVisible(true);
           
           const extractedInfo = [];
           if (result.data.extractedData.styleNumber) {
             extractedInfo.push(`Style Number: ${result.data.extractedData.styleNumber}`);
           }
           if (result.data.extractedData.recommendAge) {
             extractedInfo.push(`推荐年龄: ${result.data.extractedData.recommendAge}`);
           }
           notifications.push(`已自动识别信息：${extractedInfo.join(', ')}，请确认是否应用`);
         } else if (result.data.hasExistingData && 
                   result.data.extractedData && 
                   (result.data.extractedData.styleNumber || result.data.extractedData.recommendAge)) {
           notifications.push("检测到CPC证书文件，但信息已从之前的文件中提取过，跳过重复提取");
         } else if (result.data.extractedData && 
                  !result.data.extractedData.styleNumber && 
                  !result.data.extractedData.recommendAge) {
           notifications.push("文件上传成功，但未能提取信息（请确保上传的是CHILDREN'S PRODUCT CERTIFICATE文件）");
         }
        
        if (result.data.cpcStatusUpdated) {
          notifications.push(`CPC文件数量已达到${result.data.totalFileCount}个，已自动更新CPC测试情况为"已测试"`);
        }
        
        if (notifications.length > 0) {
          message.success(`文件上传成功；${notifications.join('；')}`);
        } else {
          message.success('文件上传成功');
        }
        
        // 刷新表格数据
        if (result.data.cpcStatusUpdated || 
            (result.data.extractedData && (result.data.extractedData.styleNumber || result.data.extractedData.recommendAge))) {
          
          const hasSearchInput = input.trim().length > 0;
          const hasFilters = filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange;
          
          if (hasSearchInput) {
            handleSearch();
          } else if (hasFilters) {
            applyFilters(filters);
          }
        }
      } else {
        message.error('上传失败');
      }
    } catch (error) {
      message.error('上传失败');
    } finally {
      setCpcUploading(false);
    }
    
    return false; // 阻止默认上传
  };

  const handleCpcFileDelete = async (fileUid: string) => {
    if (!currentRecord) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/cpc-file/${currentRecord.id}/${fileUid}`, {
        method: 'DELETE',
      });

      const result = await res.json();
      
      if (result.code === 0) {
        await loadCpcFiles(currentRecord.id);
        
        // 显示删除成功消息和当前文件状态
        const remainingCount = cpcFiles.length - 1;
        let deleteMessage = result.message;
        if (remainingCount === 0) {
          deleteMessage += '，当前无CPC文件';
        } else if (remainingCount === 1) {
          deleteMessage += `，当前还有${remainingCount}个CPC文件`;
        } else {
          deleteMessage += `，当前还有${remainingCount}个CPC文件（已达到测试要求）`;
        }
        
        message.success(deleteMessage);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const getCpcFileCount = (record: ProductRecord) => {
    if (!record.cpc_files) return 0;
    try {
      const files = JSON.parse(record.cpc_files);
      return Array.isArray(files) ? files.length : 0;
    } catch {
      return 0;
    }
  };

  // 确认应用提取的信息
  const handleConfirmExtractedData = async () => {
    if (!currentRecord || !pendingExtractedData) return;

    try {
      const updateData: any = {};
      if (pendingExtractedData.styleNumber) {
        updateData.model_number = pendingExtractedData.styleNumber;
      }
      if (pendingExtractedData.recommendAge) {
        updateData.recommend_age = pendingExtractedData.recommendAge;
      }

      const res = await fetch(`${API_BASE_URL}/api/product_weblink/update/${currentRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        message.success('信息应用成功');
        setExtractedDataVisible(false);
        setPendingExtractedData(null);
        
        // 刷新表格数据
        const hasSearchInput = input.trim().length > 0;
        const hasFilters = filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange;
        
        if (hasSearchInput) {
          handleSearch();
        } else if (hasFilters) {
          applyFilters(filters);
        }
      } else {
        message.error('信息应用失败');
      }
    } catch (error) {
      message.error('信息应用失败');
    }
  };

  // 取消应用提取的信息
  const handleCancelExtractedData = () => {
    setExtractedDataVisible(false);
    setPendingExtractedData(null);
    message.info('已取消应用提取的信息');
  };

  // 批量更新状态
  const handleBatchUpdateStatus = async (status: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要更新的记录');
      return;
    }

    try {
      // 确保传递给后端的ID是数字类型
      const ids = selectedRowKeys.map(key => Number(key));
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      message.success('批量更新成功');
      setSelectedRowKeys([]);
      
      // 更新本地数据
      setData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, status }
            : item
        )
      );
      
      setOriginalData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, status }
            : item
        )
      );
      
      setFilteredData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, status }
            : item
        )
      );
      
      // 刷新统计信息
      fetchAllDataStatistics();

      // 新增：批量更新后自动刷新数据
      if (
        filters.status ||
        filters.cpc_status ||
        filters.cpc_submit ||
        filters.seller_name ||
        filters.dateRange
      ) {
        // 有筛选条件，重新筛选
        applyFilters(filters);
      } else {
        // 无筛选，只有在有搜索输入时才重新搜索
        const hasSearchInput = input.trim().length > 0;
        if (hasSearchInput) {
          handleSearch();
        }
      }
    } catch (e) {
      console.error('批量更新失败:', e);
      message.error('批量更新失败');
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的记录');
      return;
    }

    try {
      // 确保传递给后端的ID是数字类型
      const ids = selectedRowKeys.map(key => Number(key));
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      message.success('批量删除成功');
      setSelectedRowKeys([]);
      
      // 从本地数据中移除已删除的记录
      setData(prevData => 
        prevData.filter(item => !selectedRowKeys.includes(item.id))
      );
      
      setOriginalData(prevData => 
        prevData.filter(item => !selectedRowKeys.includes(item.id))
      );
      
      setFilteredData(prevData => 
        prevData.filter(item => !selectedRowKeys.includes(item.id))
      );
      
      // 刷新统计信息
      fetchAllDataStatistics();
    } catch (e) {
      console.error('批量删除失败:', e);
      message.error('批量删除失败');
    }
  };

  // 批量发送CPC测试申请
  const handleBatchSendCpcTest = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要申请测试的记录');
      return;
    }

    try {
      // 确保传递给后端的ID是数字类型
      const ids = selectedRowKeys.map(key => Number(key));
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-send-cpc-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      message.success(result.message);
      setSelectedRowKeys([]);
      
      // 更新本地数据中的CPC状态
      setData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, cpc_status: '申请测试' }
            : item
        )
      );
      
      setOriginalData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, cpc_status: '申请测试' }
            : item
        )
      );
      
      setFilteredData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, cpc_status: '申请测试' }
            : item
        )
      );
      
      // 刷新统计信息
      fetchAllDataStatistics();
    } catch (e) {
      console.error('发送CPC测试申请失败:', e);
      message.error('发送CPC测试申请失败');
    }
  };

  // 批量标记CPC样品已发
  const handleBatchMarkCpcSampleSent = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要标记的记录');
      return;
    }

    try {
      // 确保传递给后端的ID是数字类型
      const ids = selectedRowKeys.map(key => Number(key));
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-mark-cpc-sample-sent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      message.success(result.message);
      setSelectedRowKeys([]);
      
      // 更新本地数据中的CPC状态
      setData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, cpc_status: '样品已发' }
            : item
        )
      );
      
      setOriginalData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, cpc_status: '样品已发' }
            : item
        )
      );
      
      setFilteredData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, cpc_status: '样品已发' }
            : item
        )
      );
      
      // 刷新统计信息
      fetchAllDataStatistics();
    } catch (e) {
      console.error('标记CPC样品已发失败:', e);
      message.error('标记CPC样品已发失败');
    }
  };

  // 修复全选后批量打开链接的问题
  const handleBatchOpenLinks = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要打开的记录');
      return;
    }

    // 确保类型匹配：将selectedRowKeys中的值转换为数字进行比较
    const currentData = filteredData.length > 0 || filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange ? filteredData : data;
    const selectedRecords = currentData.filter(record => 
      selectedRowKeys.some(key => Number(key) === record.id)
    );
    
    const validLinks = selectedRecords.filter(record => record.weblink && record.weblink.trim() !== '');

    if (validLinks.length === 0) {
      message.warning('所选记录中没有有效的产品链接');
      return;
    }

    // 直接打开链接，提供更好的用户反馈
    const openLinks = async () => {
      let successCount = 0;
      let blockedCount = 0;
      
      message.loading('正在打开产品链接...', 1);
      
      for (let i = 0; i < validLinks.length; i++) {
        const record = validLinks[i];
        try {
          const opened = window.open(record.weblink, '_blank', 'noopener,noreferrer');
          if (opened && !opened.closed) {
            successCount++;
          } else {
            blockedCount++;
          }
          
          // 短暂延时，避免浏览器认为是垃圾邮件
          if (i < validLinks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (error) {
          blockedCount++;
          console.error('Error opening link:', record.weblink, error);
        }
      }
      
      // 详细的反馈信息
      if (successCount === validLinks.length) {
        message.success(`成功打开 ${successCount} 个产品链接`);
      } else if (successCount > 0) {
        message.warning(`成功打开 ${successCount} 个链接，${blockedCount} 个链接可能被浏览器阻止`);
      } else {
        message.error('所有链接都被浏览器阻止。请检查浏览器设置，允许此网站打开弹出窗口。');
      }
    };

    if (validLinks.length > 10) {
      Modal.confirm({
        title: '确认打开链接',
        content: `您将要打开 ${validLinks.length} 个链接，这可能会影响浏览器性能。是否继续？`,
        onOk: openLinks,
      });
    } else {
      openLinks();
    }
  };

  // 字段名称映射
  const getFieldDisplayName = (field: string) => {
    const fieldNameMap: { [key: string]: string } = {
      'parent_sku': '母SKU',
      'weblink': '产品链接',
      'status': '产品状态',
      'notice': '备注',
      'cpc_status': 'CPC测试情况',
      'cpc_submit': 'CPC提交情况',
      'model_number': 'Style Number',
      'recommend_age': '推荐年龄',
      'ads_add': '广告是否创建',
      'list_parent_sku': '上架母SKU',
      'no_inventory_rate': '缺货率',
      'sales_30days': '30天销量',
      'seller_name': '供应商'
    };
    return fieldNameMap[field] || field;
  };

  // 双击编辑处理
  const handleCellDoubleClick = (record: ProductRecord, field: string) => {
    setEditingCell({
      id: record.id,
      field,
      value: record[field as keyof ProductRecord]?.toString() || ''
    });
    setEditModalVisible(true);
    (editForm as any).setFieldsValue({ value: record[field as keyof ProductRecord] || '' });
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingCell) return;

    try {
      const values = await (editForm as any).validateFields();
      const updateData = { [editingCell.field]: values.value };

      const res = await fetch(`${API_BASE_URL}/api/product_weblink/update/${editingCell.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      message.success('更新成功');
      setEditModalVisible(false);
      setEditingCell(null);
      (editForm as any).resetFields();
      
      // 更新本地数据
      setData(prevData => 
        prevData.map(item => 
          item.id === editingCell.id 
            ? { ...item, [editingCell.field]: values.value }
            : item
        )
      );
      
      setOriginalData(prevData => 
        prevData.map(item => 
          item.id === editingCell.id 
            ? { ...item, [editingCell.field]: values.value }
            : item
        )
      );
      
      setFilteredData(prevData => 
        prevData.map(item => 
          item.id === editingCell.id 
            ? { ...item, [editingCell.field]: values.value }
            : item
        )
      );
      
      // 刷新统计信息
      fetchAllDataStatistics();
    } catch (e) {
      console.error('更新失败:', e);
      message.error('更新失败');
    }
  };

  // 新的Excel上传处理（支持SKU, 链接, 备注）
  const handleExcelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('enableDingTalkNotification', enableDingTalkNotification.toString());



    setLoading(true);
    fetch(`${API_BASE_URL}/api/product_weblink/upload-excel-new`, {
      method: 'POST',
      body: formData,
    })
      .then(async res => {
        const contentType = res.headers.get('content-type');
        let responseData = null;
        
        try {
          if (contentType && contentType.includes('application/json')) {
            responseData = await res.json();
          }
        } catch (parseError) {
          // 解析失败时设为null
        }
        
        if (!res.ok) {
          // 如果是错误响应但包含data，显示详细对话框
          if (responseData && responseData.data) {
            setUploadModalVisible(false);
            setEnableDingTalkNotification(true);
            setUploadResult(responseData.data);
            setUploadResultVisible(true);
            return; // 直接返回，不抛出错误
          }
          
          // 其他错误情况
          const errorMessage = responseData?.message || `服务器错误 (${res.status}): ${res.statusText}`;
          throw new Error(errorMessage);
        }
        
        return responseData;
      })
      .then(result => {
        // 只有在result存在时才处理
        if (result) {
          setUploadModalVisible(false);
          // 重置钉钉推送开关为默认开启状态
          setEnableDingTalkNotification(true);
          
          // 设置上传结果并显示详细对话框
          if (result.data) {
            setUploadResult(result.data);
            setUploadResultVisible(true);
            
            // 如果有成功上传的记录，刷新数据
            if (result.data.successCount > 0) {
              // 刷新统计信息
              fetchAllDataStatistics();
              
              // 只有在有搜索条件或筛选条件时才刷新搜索结果
              const hasSearchInput = input.trim().length > 0;
              const hasFilters = filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange;
              
              if (hasSearchInput) {
                handleSearch();
              } else if (hasFilters) {
                applyFilters(filters);
              }
            }
          } else {
            // 兼容旧格式
            message.success(result.message);
          }
        }
      })
      .catch(e => {
        // 确保错误信息正确显示
        let errorMessage = '上传失败';
        if (e.message) {
          // 如果错误信息已经包含"上传失败"，就不重复添加
          errorMessage = e.message.includes('上传失败') ? e.message : `上传失败: ${e.message}`;
        }
        
        message.error(errorMessage);
      })
      .finally(() => {
        setLoading(false);
        // 清空文件选择
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      });
  };





  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  // 表格排序处理
  const handleTableChange: TableProps<ProductRecord>['onChange'] = (pagination, filters, sorter) => {
    // 这里可以实现服务端排序，或者让antd Table自动处理客户端排序
  };

  // 表格列配置（添加排序功能）
  const columns: ColumnsType<ProductRecord> = [
    { 
      title: '母SKU', 
      dataIndex: 'parent_sku', 
      key: 'parent_sku', 
      align: 'center',
      width: 120,
      sorter: (a, b) => a.parent_sku.localeCompare(b.parent_sku),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'parent_sku'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '产品链接', 
      dataIndex: 'weblink', 
      key: 'weblink', 
      align: 'center',
      width: 200,
      render: (text: string) => text ? (
        <Tooltip title={text}>
          <a href={text} target="_blank" rel="noopener noreferrer" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
            {text}
          </a>
        </Tooltip>
      ) : '',
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'weblink'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '上传时间', 
      dataIndex: 'update_time', 
      key: 'update_time', 
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '', 
      align: 'center',
      width: 160,
      sorter: (a, b) => dayjs(a.update_time).unix() - dayjs(b.update_time).unix(),
    },
    { 
      title: '检查时间', 
      dataIndex: 'check_time', 
      key: 'check_time', 
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '', 
      align: 'center',
      width: 160,
      sorter: (a, b) => dayjs(a.check_time || 0).unix() - dayjs(b.check_time || 0).unix(),
    },
    { 
      title: '产品状态', 
      dataIndex: 'status', 
      key: 'status', 
      align: 'center',
      width: 100,
      sorter: (a, b) => (a.status || '').localeCompare(b.status || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'status'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '备注', 
      dataIndex: 'notice', 
      key: 'notice', 
      align: 'center',
      width: 120,
      sorter: (a, b) => (a.notice || '').localeCompare(b.notice || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'notice'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: 'CPC文件', 
      dataIndex: 'cpc_files', 
      key: 'cpc_files', 
      align: 'center',
      width: 120,
      render: (text: string, record: ProductRecord) => {
        const fileCount = getCpcFileCount(record);
        return (
          <Space>
            <Badge count={fileCount} overflowCount={99} size="small">
              <Button
                type="primary"
                size="small"
                icon={<FilePdfOutlined />}
                onClick={() => handleCpcFileManage(record)}
              >
                CPC文件
              </Button>
            </Badge>
          </Space>
        );
      }
    },
    { 
      title: 'CPC测试情况', 
      dataIndex: 'cpc_status', 
      key: 'cpc_status', 
      align: 'center',
      width: 120,
      sorter: (a, b) => (a.cpc_status || '').localeCompare(b.cpc_status || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'cpc_status'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: 'CPC提交情况', 
      dataIndex: 'cpc_submit', 
      key: 'cpc_submit', 
      align: 'center',
      width: 120,
      sorter: (a, b) => (a.cpc_submit || '').localeCompare(b.cpc_submit || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'cpc_submit'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: 'Style Number', 
      dataIndex: 'model_number', 
      key: 'model_number', 
      align: 'center',
      width: 120,
      sorter: (a, b) => (a.model_number || '').localeCompare(b.model_number || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'model_number'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '推荐年龄', 
      dataIndex: 'recommend_age', 
      key: 'recommend_age', 
      align: 'center',
      width: 100,
      sorter: (a, b) => (a.recommend_age || '').localeCompare(b.recommend_age || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'recommend_age'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '广告是否创建', 
      dataIndex: 'ads_add', 
      key: 'ads_add', 
      align: 'center',
      width: 120,
      sorter: (a, b) => (a.ads_add || '').localeCompare(b.ads_add || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'ads_add'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '上架母SKU', 
      dataIndex: 'list_parent_sku', 
      key: 'list_parent_sku', 
      align: 'center',
      width: 120,
      sorter: (a, b) => (a.list_parent_sku || '').localeCompare(b.list_parent_sku || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'list_parent_sku'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '缺货率', 
      dataIndex: 'no_inventory_rate', 
      key: 'no_inventory_rate', 
      align: 'center',
      width: 100,
      sorter: (a, b) => (parseFloat(a.no_inventory_rate) || 0) - (parseFloat(b.no_inventory_rate) || 0),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'no_inventory_rate'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '30天销量', 
      dataIndex: 'sales_30days', 
      key: 'sales_30days', 
      align: 'center',
      width: 100,
      sorter: (a, b) => (parseInt(a.sales_30days) || 0) - (parseInt(b.sales_30days) || 0),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'sales_30days'),
        style: { cursor: 'pointer' }
      })
    },
    { 
      title: '供应商', 
      dataIndex: 'seller_name', 
      key: 'seller_name', 
      align: 'center',
      width: 120,
      sorter: (a, b) => (a.seller_name || '').localeCompare(b.seller_name || ''),
      onCell: (record) => ({
        onDoubleClick: () => handleCellDoubleClick(record, 'seller_name'),
        style: { cursor: 'pointer' }
      })
    },
  ];

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    onSelectAll: (selected: boolean, selectedRows: ProductRecord[], changeRows: ProductRecord[]) => {
      if (selected) {
        // 全选时，确保选择所有当前页面的记录
        const allKeys = data.map(record => record.id);
        setSelectedRowKeys(allKeys);
      } else {
        // 取消全选
        setSelectedRowKeys([]);
      }
    },
    onSelect: (record: ProductRecord, selected: boolean) => {
      if (selected) {
        // 添加选择的记录
        setSelectedRowKeys(prev => [...prev, record.id]);
      } else {
        // 移除取消选择的记录
        setSelectedRowKeys(prev => prev.filter(key => Number(key) !== record.id));
      }
    },
    getCheckboxProps: (record: ProductRecord) => ({
      disabled: false,
      name: record.parent_sku,
    }),
  };

  // 亚马逊模板管理相关函数
  const fetchTemplateFiles = async (country: string) => {
    try {
      setTemplateLoading(prev => ({ ...prev, [country]: true }));
      console.log(`📥 获取${country}站点模板列表...`);
      
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/amazon-templates?country=${country}`);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const result = await res.json();
      console.log(`✅ ${country}站点模板列表获取成功:`, result.data?.length || 0, '个文件');
      
      setAllTemplateFiles(prev => ({
        ...prev,
        [country]: result.data || []
      }));
    } catch (error) {
      console.error(`❌ 获取${country}站点模板列表失败:`, error);
      // 不显示太多错误消息，避免刷屏
      if (globalTemplateLoading) {
        console.warn(`${country}站点数据加载失败，将在模态框中显示空列表`);
      }
    } finally {
      setTemplateLoading(prev => ({ ...prev, [country]: false }));
    }
  };

  // 批量获取所有站点的模板文件
  const fetchAllTemplateFiles = async () => {
    const countries = ['US', 'CA', 'UK', 'AE', 'AU'];
    
    try {
      setGlobalTemplateLoading(true);
      console.log('🚀 开始批量加载所有站点模板数据...');
      
      const promises = countries.map(country => fetchTemplateFiles(country));
      await Promise.all(promises);
      
      console.log('✅ 所有站点模板数据加载完成');
    } catch (error) {
      console.error('❌ 批量加载模板数据时发生错误:', error);
      message.error('加载模板数据失败，请重试');
    } finally {
      setGlobalTemplateLoading(false);
    }
  };

  const handleTemplateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 在上传前确保localStorage中没有损坏的数据
    try {
      const { cleanStorageForTemplateUpload } = await import('../../utils/storageUtils');
      const cleanResult = cleanStorageForTemplateUpload();
      if (cleanResult.success && cleanResult.cleanedKeys > 0) {
        console.log('🔧 模板上传前清理了存储问题:', cleanResult.message);
      }
    } catch (storageError) {
      console.warn('⚠️ localStorage诊断失败，继续上传流程:', storageError);
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('country', activeTabKey);
    formData.append('originalFileName', file.name);

    try {
      setTemplateLoading(prev => ({ ...prev, [activeTabKey]: true }));
      
      // 添加更详细的上传日志
      console.log('📤 开始上传亚马逊模板:', {
        fileName: file.name,
        fileSize: file.size,
        country: activeTabKey
      });
      
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/amazon-templates/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('上传请求失败:', { status: res.status, statusText: res.statusText, errorText });
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      console.log('✅ 模板上传成功:', result);
      message.success(result.message);
      
      // 重新获取模板列表
      await fetchTemplateFiles(activeTabKey);
      
    } catch (error) {
      console.error('上传模板失败:', error);
      
      // 根据错误类型提供更具体的错误信息
      let errorMessage = '上传模板失败';
      if (error instanceof Error) {
        if (error.message.includes('JSON')) {
          errorMessage = '数据格式错误，请刷新页面后重试';
        } else if (error.message.includes('Network')) {
          errorMessage = '网络连接失败，请检查网络后重试';
        } else if (error.message.includes('413')) {
          errorMessage = '文件太大，请选择较小的文件';
        } else if (error.message.includes('400')) {
          errorMessage = '文件格式不正确，请上传有效的Excel文件';
        }
      }
      
      message.error(errorMessage);
    } finally {
      setTemplateLoading(prev => ({ ...prev, [activeTabKey]: false }));
      // 清空文件选择
      if (templateFileInputRef.current) {
        templateFileInputRef.current.value = '';
      }
    }
  };

  const handleTemplateDelete = async (objectName: string) => {
    try {
      setTemplateLoading(prev => ({ ...prev, [activeTabKey]: true }));
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/amazon-templates/${encodeURIComponent(objectName)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      message.success(result.message);
      
      // 重新获取模板列表
      await fetchTemplateFiles(activeTabKey);
      
    } catch (error) {
      console.error('删除模板失败:', error);
      message.error('删除模板失败');
    } finally {
      setTemplateLoading(prev => ({ ...prev, [activeTabKey]: false }));
    }
  };

  const handleTemplateDownload = (objectName: string, fileName: string) => {
    const downloadUrl = `${API_BASE_URL}/api/product_weblink/amazon-templates/download/${encodeURIComponent(objectName)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenTemplateModal = () => {
    setTemplateModalVisible(true);
    fetchAllTemplateFiles();
  };

  const handleTabChange = (key: string) => {
    setActiveTabKey(key);
  };

  // 渲染每个站点的标签页内容
  const renderTabContent = (countryCode: string, countryName: string) => {
    const currentFiles = allTemplateFiles[countryCode] || [];
    const isLoading = templateLoading[countryCode] || false;

    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* 文件上传区域 */}
        <div style={{ marginBottom: '16px', padding: '16px', background: '#f8f9fa', borderRadius: '6px' }}>
          <Text strong style={{ color: '#1677ff' }}>上传 {countryName} 站点模板：</Text>
          <div style={{ marginTop: '12px' }}>
            <input
              ref={templateFileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleTemplateUpload}
              style={{ display: 'none' }}
            />
            <Button 
              icon={<UploadOutlined />}
              onClick={() => templateFileInputRef.current?.click()}
              loading={isLoading}
              type="primary"
              size="large"
            >
              选择Excel文件上传
            </Button>
            <Text type="secondary" style={{ marginLeft: '12px' }}>
              仅支持 .xlsx 格式
            </Text>
          </div>
        </div>

        {/* 模板文件列表 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <Text strong>{countryName} 站点模板列表：</Text>
            <Text type="secondary">共 {currentFiles.length} 个文件</Text>
          </div>
          
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Text>加载中...</Text>
            </div>
          ) : (
            <List
              size="small"
              style={{ maxHeight: '400px', overflow: 'auto' }}
              dataSource={currentFiles}
              renderItem={(file: any) => (
                <List.Item
                  style={{
                    padding: '12px 16px',
                    border: '1px solid #f0f0f0',
                    borderRadius: '6px',
                    marginBottom: '8px'
                  }}
                  actions={[
                    <Button
                      type="link"
                      icon={<DownloadOutlined />}
                      onClick={() => handleTemplateDownload(file.name, file.fileName)}
                      style={{ color: '#1677ff' }}
                    >
                      下载
                    </Button>,
                    <Popconfirm
                      title="确定要删除这个模板吗？"
                      onConfirm={() => handleTemplateDelete(file.name)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  ]}
                >
                  <List.Item.Meta
                    title={<Text strong>{file.fileName}</Text>}
                    description={
                      <Text type="secondary">
                        大小: {(file.size / 1024).toFixed(1)} KB | 上传时间: {new Date(file.lastModified).toLocaleString()}
                      </Text>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: `暂无${countryName}站点模板文件` }}
            />
          )}
        </div>
      </Space>
    );
  };

  // 生成英国资料表处理函数
  const handleGenerateUkDataSheet = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要生成资料表的记录');
      return;
    }

    // 创建后台任务
    const taskId = addTask({
      title: `生成英国资料表 (${selectedRowKeys.length}个SKU)`,
      progress: 0,
      currentStep: '正在准备生成英国资料表...',
      status: 'running'
    });

    // 开始后台执行生成任务
    generateUkDataSheetInBackground(taskId);
    
    // 提示用户任务已开始
    message.info('英国资料表生成任务已在后台开始，您可以继续进行其他操作');
  };

  // 后台执行生成英国资料表
  const generateUkDataSheetInBackground = async (taskId: string) => {
    try {
      // 步骤1: 验证英国模板存在
      updateTask(taskId, {
        progress: 10,
        currentStep: '检查英国模板文件...'
      });
      
      const templateCheckRes = await fetch(`${API_BASE_URL}/api/product_weblink/amazon-templates?country=UK`);
      const templateCheckResult = await templateCheckRes.json();
      
      if (!templateCheckResult.data || templateCheckResult.data.length === 0) {
        throw new Error('未找到英国站点的资料模板，请先上传英国模板文件');
      }

      // 步骤2: 获取选中的记录信息
      updateTask(taskId, {
        progress: 20,
        currentStep: '获取选中记录的母SKU信息...'
      });
      
      const selectedRecords = data.filter(record => 
        selectedRowKeys.some(key => Number(key) === record.id)
      );
      const parentSkus = selectedRecords.map(record => record.parent_sku);

      // 步骤3: 调用后端API生成资料表
      updateTask(taskId, {
        progress: 30,
        currentStep: '查询子SKU信息...'
      });

      const generateRes = await fetch(`${API_BASE_URL}/api/product_weblink/generate-uk-data-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentSkus }),
      });

      if (!generateRes.ok) {
        throw new Error(`生成失败: ${generateRes.status} ${generateRes.statusText}`);
      }

      // 步骤4: 处理进度更新
      updateTask(taskId, {
        progress: 60,
        currentStep: '复制模板文件并填写数据...'
      });

      // 等待一段时间模拟处理
      await new Promise(resolve => setTimeout(resolve, 1000));

      updateTask(taskId, {
        progress: 80,
        currentStep: '准备下载文件...'
      });

      // 步骤5: 下载文件
      updateTask(taskId, {
        progress: 90,
        currentStep: '正在下载生成的资料表...'
      });

      const blob = await generateRes.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // 检查后端是否设置了文件名
      const contentDisposition = generateRes.headers.get('Content-Disposition');
      console.log('🔍 后端Content-Disposition:', contentDisposition);
      
      let fileName = `UK_${parentSkus.join('_')}.xlsx`;
      
      // 如果后端没有设置文件名，则使用前端设置
      if (!contentDisposition || !contentDisposition.includes('filename')) {
        link.download = fileName;
        console.log('📁 使用前端设置的文件名:', fileName);
      } else {
        console.log('📁 使用后端设置的文件名');
        // 尝试从Content-Disposition中提取文件名
        const matches = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (matches && matches[1]) {
          fileName = matches[1].replace(/['"]/g, '');
          link.download = fileName;
        }
      }
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 完成
      updateTask(taskId, {
        progress: 100,
        currentStep: '生成完成！文件已下载到本地',
        status: 'completed',
        resultData: {
          downloadUrl: url,
          fileName: fileName
        }
      });
      
      message.success(`成功生成英国资料表，包含 ${parentSkus.length} 个母SKU 的产品信息`);
      
      // 延迟清理URL对象
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 5000);

    } catch (error: any) {
      console.error('生成英国资料表失败:', error);
      updateTask(taskId, {
        progress: 0,
        currentStep: '生成失败',
        status: 'error',
        errorMessage: error.message
      });
      message.error('生成失败: ' + error.message);
    }
  };

  // 生成其他站点资料表处理函数
  const handleGenerateOtherSiteDataSheet = () => {
    setOtherSiteModalVisible(true);
    setActiveSiteTabKey('US');
  };

  // 处理其他站点弹窗确认
  const handleOtherSiteModalOk = async () => {
    const currentFile = uploadedExcelFiles[activeSiteTabKey];
    if (!activeSiteTabKey || !currentFile) {
      message.warning('请上传Excel文件');
      return;
    }

    setOtherSiteLoading(prev => ({ ...prev, [activeSiteTabKey]: true }));
    try {
      // 先检查列差异
      await checkTemplateColumnDifferences();
    } catch (error: any) {
      console.error('检查模板列差异失败:', error);
      message.error('检查模板失败: ' + error.message);
      setOtherSiteLoading(prev => ({ ...prev, [activeSiteTabKey]: false }));
    }
  };

  // 检查模板列差异
  const checkTemplateColumnDifferences = async () => {
    const currentFile = uploadedExcelFiles[activeSiteTabKey];
    const formData = new FormData();
    formData.append('file', currentFile!);
    formData.append('country', activeSiteTabKey);

    const response = await fetch(`${API_BASE_URL}/api/product_weblink/check-other-site-template`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorResult = await response.json();
      throw new Error(errorResult.message || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.hasMissingColumns) {
      // 有缺失列，显示确认对话框
      setMissingColumnsInfo({
        missingColumns: result.missingColumns,
        uploadedColumns: result.uploadedColumns,
        templateColumns: result.templateColumns
      });
      setMissingColumnsModalVisible(true);
      setOtherSiteLoading(prev => ({ ...prev, [activeSiteTabKey]: false }));
    } else {
      // 没有缺失列，直接生成
      await generateOtherSiteDataSheet();
    }
  };

  // 实际生成其他站点资料表
  const generateOtherSiteDataSheet = async () => {
    const currentFile = uploadedExcelFiles[activeSiteTabKey];
    try {
      const formData = new FormData();
      formData.append('file', currentFile!);
      formData.append('country', activeSiteTabKey);

      // 调用后端API处理上传和生成
      const response = await fetch(`${API_BASE_URL}/api/product_weblink/generate-other-site-datasheet`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        // 尝试解析错误信息
        try {
          const errorResult = await response.json();
          throw new Error(errorResult.message || `HTTP error! status: ${response.status}`);
        } catch {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }

      // 检查响应是否是文件流
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        // 直接处理文件下载
        const blob = await response.blob();
        
        // 从响应头获取文件名
        const contentDisposition = response.headers.get('content-disposition');
        let fileName = `${activeSiteTabKey}_data_sheet.xlsx`; // 默认文件名
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
          if (filenameMatch) {
            fileName = filenameMatch[1];
          }
        }
        
        // 创建下载链接
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 清理URL对象
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 5000);
        
        message.success('成功生成其他站点资料表');
        setOtherSiteModalVisible(false);
        setUploadedExcelFiles(prev => ({ ...prev, [activeSiteTabKey]: null }));
      } else {
        // 如果不是文件流，尝试解析JSON
        const result = await response.json();
        throw new Error(result.message || '生成失败');
      }
    } catch (error: any) {
      console.error('生成其他站点资料表失败:', error);
      message.error('生成失败: ' + error.message);
    } finally {
      setOtherSiteLoading(prev => ({ ...prev, [activeSiteTabKey]: false }));
    }
  };

  // 确认继续生成（即使有缺失列）
  const handleContinueGenerate = async () => {
    setMissingColumnsModalVisible(false);
    await generateOtherSiteDataSheet();
  };

  // 新增：步骤1 - 上传源数据到数据库
  const handleUploadSourceData = async (file?: File) => {
    const fileToUpload = file || sourceFile;
    if (!fileToUpload || !sourceCountry) {
      message.warning('请选择源站点并上传Excel文件');
      return;
    }

    try {
      setOtherSiteLoading(prev => ({ ...prev, [sourceCountry]: true }));
      
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('site', sourceCountry);

      const response = await fetch(`${API_BASE_URL}/api/product_weblink/upload-source-data`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '上传失败');
      }

      const result = await response.json();
      
      setSourceDataUploaded(true);
      setCurrentStep(1); // 进入步骤2
      message.success(`成功上传${result.recordCount}条记录到数据库`);
      
    } catch (error: any) {
      console.error('上传源数据失败:', error);
      message.error('上传失败: ' + error.message);
    } finally {
      setOtherSiteLoading(prev => ({ ...prev, [sourceCountry]: false }));
    }
  };

  // 新增：步骤2 - 开始生成选定的目标站点资料
  const handleStartGeneration = async () => {
    if (selectedTargetCountries.length === 0) {
      message.warning('请至少选择一个目标站点');
      return;
    }

    setGenerationInProgress(true);
    setCurrentStep(2); // 进入步骤3
    setCompletedCountries([]);
    
    const newDownloadHistory: Record<string, { blob: Blob; fileName: string; generatedAt: string }> = {};

    try {
      // 逐个生成每个目标站点的资料表
      for (const targetCountry of selectedTargetCountries) {
        try {
          setBatchProgress(prev => ({ ...prev, [targetCountry]: 'processing' }));
          
          const formData = new FormData();
          formData.append('file', sourceFile!);
          formData.append('sourceCountry', sourceCountry);
          formData.append('targetCountry', targetCountry);

          const response = await fetch(`${API_BASE_URL}/api/product_weblink/generate-other-site-datasheet`, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`生成${targetCountry}站点资料表失败: ${response.statusText}`);
          }

          const blob = await response.blob();
          
          // 从响应头获取文件名
          const contentDisposition = response.headers.get('content-disposition');
          let fileName = `${targetCountry}_data_sheet.xlsx`; // 默认文件名
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
            if (filenameMatch) {
              fileName = filenameMatch[1];
            }
          }
          
          newDownloadHistory[targetCountry] = {
            blob,
            fileName,
            generatedAt: new Date().toISOString()
          };

          setBatchProgress(prev => ({ ...prev, [targetCountry]: 'completed' }));
          setCompletedCountries(prev => [...prev, targetCountry]);
          
        } catch (error: any) {
          console.error(`生成${targetCountry}站点资料表失败:`, error);
          setBatchProgress(prev => ({ ...prev, [targetCountry]: 'failed' }));
          message.error(`生成${targetCountry}站点失败: ${error.message}`);
        }
      }
      
      setDownloadHistory(newDownloadHistory);
      
      // 自动下载所有成功生成的文件
      setTimeout(() => {
        Object.entries(newDownloadHistory).forEach(([country, fileData], index) => {
          setTimeout(() => {
            const url = window.URL.createObjectURL(fileData.blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileData.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => {
              window.URL.revokeObjectURL(url);
            }, 5000);
          }, index * 200); // 错开下载时间
        });
        
        if (Object.keys(newDownloadHistory).length > 0) {
          message.success(`已自动下载${Object.keys(newDownloadHistory).length}个文件`);
        }
      }, 500);
      
    } catch (error: any) {
      console.error('批量生成失败:', error);
      message.error('批量生成失败: ' + error.message);
    } finally {
      setGenerationInProgress(false);
    }
  };

  // 新增：重新下载指定站点的文件
  const handleRedownload = (country: string) => {
    const fileData = downloadHistory[country];
    if (!fileData) {
      message.warning('文件不存在');
      return;
    }

    const url = window.URL.createObjectURL(fileData.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileData.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 5000);
    
    message.success(`正在下载${country}站点资料表`);
  };

  // 新增：批量重新下载所有文件
  const handleBatchRedownload = () => {
    const availableFiles = Object.entries(downloadHistory);
    
    if (availableFiles.length === 0) {
      message.warning('没有可下载的文件');
      return;
    }

    availableFiles.forEach(([country, fileData], index) => {
      setTimeout(() => {
        const url = window.URL.createObjectURL(fileData.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileData.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 5000);
      }, index * 200);
    });
    
    message.success(`开始下载${availableFiles.length}个文件`);
  };

  // 新增：重置3步流程状态
  const resetThreeStepFlow = () => {
    setCurrentStep(0);
    setSourceCountry('');
    setSourceFile(null);
    setSourceDataUploaded(false);
    setSelectedTargetCountries([]);
    setGenerationInProgress(false);
    setCompletedCountries([]);
    setDownloadHistory({});
    setBatchProgress({
      US: 'pending',
      CA: 'pending',
      UK: 'pending',
      AE: 'pending',
      AU: 'pending'
    });
  };

  // 批量生成其他站点资料表
  const handleBatchGenerateOtherSites = async () => {
    const sourceCountry = activeSiteTabKey;
    const sourceFile = uploadedExcelFiles[sourceCountry];
    
    if (!sourceFile) {
      message.warning('请先上传源站点的Excel文件');
      return;
    }

    setBatchGenerating(true);
    setGeneratedFiles({
      US: null,
      CA: null,
      UK: null,
      AE: null,
      AU: null
    });
    
    // 获取其他站点（除了当前选择的站点）
    const allCountries = ['US', 'CA', 'UK', 'AE', 'AU'];
    const otherCountries = allCountries.filter(country => country !== sourceCountry);
    
    // 重置进度状态
    const initialProgress: Record<string, 'pending' | 'processing' | 'completed' | 'failed'> = {};
    allCountries.forEach(country => {
      initialProgress[country] = country === sourceCountry ? 'completed' : 'pending';
    });
    setBatchProgress(initialProgress);

    let successCount = 0;
    const results: Record<string, { blob: Blob; fileName: string } | null> = {
      US: null, CA: null, UK: null, AE: null, AU: null
    };

    try {
      // 串行生成每个站点的资料表
      for (const targetCountry of otherCountries) {
        try {
          // 更新进度状态
          setBatchProgress(prev => ({ ...prev, [targetCountry]: 'processing' }));
          
          const formData = new FormData();
          formData.append('file', sourceFile);
          formData.append('sourceCountry', sourceCountry);
          formData.append('targetCountry', targetCountry);

          const response = await fetch(`${API_BASE_URL}/api/product_weblink/generate-batch-other-site-datasheet`, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`生成${targetCountry}站点资料表失败: ${response.statusText}`);
          }

          const blob = await response.blob();
          
          // 从响应头获取文件名
          const contentDisposition = response.headers.get('content-disposition');
          let fileName = `${targetCountry}_data_sheet.xlsx`; // 默认文件名
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
            if (filenameMatch) {
              fileName = filenameMatch[1];
            }
          }
          
          results[targetCountry] = { blob, fileName };
          setBatchProgress(prev => ({ ...prev, [targetCountry]: 'completed' }));
          successCount++;
          
        } catch (error: any) {
          console.error(`生成${targetCountry}站点资料表失败:`, error);
          setBatchProgress(prev => ({ ...prev, [targetCountry]: 'failed' }));
          message.error(`生成${targetCountry}站点资料表失败: ${error.message}`);
        }
      }

      setGeneratedFiles(results);
      
      if (successCount > 0) {
        message.success(`成功生成${successCount}个站点的资料表`);
      } else {
        message.error('所有站点资料表生成失败');
      }
      
    } catch (error: any) {
      console.error('批量生成失败:', error);
      message.error('批量生成失败: ' + error.message);
    } finally {
      setBatchGenerating(false);
    }
  };

  // 下载单个生成的文件
  const downloadGeneratedFile = (country: string) => {
    const fileData = generatedFiles[country];
    if (!fileData) {
      message.warning('该文件尚未生成');
      return;
    }

    const url = window.URL.createObjectURL(fileData.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileData.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 5000);
  };

  // 批量下载所有生成的文件
  const downloadAllGeneratedFiles = () => {
    const availableFiles = Object.entries(generatedFiles).filter(([_, fileData]) => fileData !== null);
    
    if (availableFiles.length === 0) {
      message.warning('没有可下载的文件');
      return;
    }

    availableFiles.forEach(([country, fileData]) => {
      if (fileData) {
        setTimeout(() => downloadGeneratedFile(country), 100); // 稍微错开下载时间
      }
    });
    
    message.success(`开始下载${availableFiles.length}个文件`);
  };

  // 处理Excel文件上传
  const handleExcelFileChange = (file: File) => {
    setUploadedExcelFiles(prev => ({ ...prev, [activeSiteTabKey]: file }));
    return false; // 阻止自动上传
  };

  // 站点标签页切换处理
  const handleSiteTabChange = (key: string) => {
    setActiveSiteTabKey(key);
  };

  // 渲染每个站点的标签页内容
  const renderSiteTabContent = (countryCode: string, countryName: string) => {
    const currentFile = uploadedExcelFiles[countryCode];
    const isLoading = otherSiteLoading[countryCode] || false;
    const progress = batchProgress[countryCode];

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 文件上传区域 */}
        <div style={{ marginBottom: '16px', padding: '16px', background: '#f8f9fa', borderRadius: '6px' }}>
          <Text strong style={{ color: '#1677ff' }}>上传 {countryName} 站点Excel文件：</Text>
          <div style={{ marginTop: '12px' }}>
            <Upload
              accept=".xlsx,.xls"
              beforeUpload={(file) => {
                setUploadedExcelFiles(prev => ({ ...prev, [countryCode]: file }));
                return false; // 阻止自动上传
              }}
              fileList={currentFile ? [{
                uid: '1',
                name: currentFile.name,
                status: 'done' as const,
                size: currentFile.size
              }] : []}
              onRemove={() => setUploadedExcelFiles(prev => ({ ...prev, [countryCode]: null }))}
              style={{ width: '100%' }}
            >
              <Button icon={<UploadOutlined />} block size="large">
                选择Excel文件
              </Button>
            </Upload>
            <Text type="secondary" style={{ marginTop: '8px', display: 'block' }}>
              支持 .xlsx 和 .xls 格式
            </Text>
          </div>
        </div>

        {/* 文件信息显示 */}
        {currentFile && (
          <div style={{ padding: '12px', backgroundColor: '#f6f6f6', borderRadius: '6px' }}>
            <Text strong>已选择文件：</Text>
            <br />
            <Text type="secondary">
              文件名: {currentFile.name}
            </Text>
            <br />
            <Text type="secondary">
              大小: {(currentFile.size / 1024).toFixed(1)} KB
            </Text>
          </div>
        )}

        {/* 批量生成提示和按钮 */}
        {currentFile && (
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#e6f7ff', 
            borderRadius: '6px',
            border: '1px solid #91d5ff'
          }}>
            <Text strong style={{ color: '#0958d9' }}>
              一键生成其他站点资料表
            </Text>
            <br />
            <Text type="secondary" style={{ marginTop: '8px', display: 'block' }}>
              上传 {countryName} 站点的数据后，可以一键生成其他4个站点的资料表
            </Text>
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <Button
                type="primary"
                size="large"
                icon={<CloudUploadOutlined />}
                loading={batchGenerating}
                disabled={!currentFile || batchGenerating}
                onClick={handleBatchGenerateOtherSites}
                style={{ minWidth: '300px' }}
              >
                {batchGenerating ? '正在生成其他站点资料表...' : '一键生成其他4个站点资料表'}
              </Button>
            </div>
          </div>
        )}

        {/* 批量生成进度显示 */}
        {batchGenerating && (
          <div style={{ padding: '16px', backgroundColor: '#fff2e8', borderRadius: '6px' }}>
            <Text strong>生成进度：</Text>
            <div style={{ marginTop: '12px' }}>
              {['US', 'CA', 'UK', 'AE', 'AU'].map(country => {
                const countryNames = { US: '美国', CA: '加拿大', UK: '英国', AE: '阿联酋', AU: '澳大利亚' };
                const status = batchProgress[country];
                const isSource = country === countryCode;
                
                let statusIcon = <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
                let statusColor = '#d9d9d9';
                let statusText = '等待中';
                
                if (isSource) {
                  statusIcon = <CheckCircleOutlined style={{ color: '#52c41a' }} />;
                  statusColor = '#52c41a';
                  statusText = '源文件';
                } else if (status === 'processing') {
                  statusIcon = <LoadingOutlined style={{ color: '#1890ff' }} />;
                  statusColor = '#1890ff';
                  statusText = '生成中...';
                } else if (status === 'completed') {
                  statusIcon = <CheckCircleOutlined style={{ color: '#52c41a' }} />;
                  statusColor = '#52c41a';
                  statusText = '已完成';
                } else if (status === 'failed') {
                  statusIcon = <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
                  statusColor = '#ff4d4f';
                  statusText = '失败';
                }
                
                return (
                  <div key={country} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #f0f0f0'
                  }}>
                    <Space>
                      {statusIcon}
                      <Text>{countryNames[country as keyof typeof countryNames]} ({country})</Text>
                    </Space>
                    <Text style={{ color: statusColor }}>{statusText}</Text>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 下载区域 */}
        {Object.values(generatedFiles).some(file => file !== null) && (
          <div style={{ padding: '16px', backgroundColor: '#f6ffed', borderRadius: '6px' }}>
            <Text strong style={{ color: '#389e0d' }}>📥 生成完成，可以下载文件：</Text>
            <div style={{ marginTop: '12px' }}>
              {['US', 'CA', 'UK', 'AE', 'AU'].map(country => {
                const countryNames = { US: '美国', CA: '加拿大', UK: '英国', AE: '阿联酋', AU: '澳大利亚' };
                const fileData = generatedFiles[country];
                const isSource = country === countryCode;
                
                if (isSource || !fileData) return null;
                
                return (
                  <div key={country} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #f0f0f0'
                  }}>
                    <Text>{countryNames[country as keyof typeof countryNames]} ({country}) 资料表</Text>
                    <Button 
                      type="link" 
                      icon={<DownloadOutlined />}
                      onClick={() => downloadGeneratedFile(country)}
                    >
                      下载
                    </Button>
                  </div>
                );
              })}
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <Button 
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={downloadAllGeneratedFiles}
                >
                  批量下载所有文件
                </Button>
              </div>
            </div>
          </div>
        )}


      </Space>
    );
  };

  return (
    <div style={{ padding: '16px' }}>
            {/* 统计卡片区域 */}
      <div style={{ marginBottom: '12px' }}>
        <Row gutter={8} style={{ marginBottom: '8px' }}>
          <Col span={4}>
            <Card 
              size="small"
              hoverable 
              onClick={() => handleCardClick('待P图')}
              style={{ cursor: 'pointer', minHeight: '80px' }}
            >
              <Statistic
                title="待P图"
                value={statistics.waitingPImage}
                prefix={<CameraOutlined />}
                valueStyle={{ color: '#cf1322', fontSize: '18px' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card 
              size="small"
              hoverable 
              onClick={() => handleCardClick('待上传')}
              style={{ cursor: 'pointer', minHeight: '80px' }}
            >
              <Statistic
                title="待上传"
                value={statistics.waitingUpload}
                prefix={<CloudUploadOutlined />}
                valueStyle={{ color: '#1890ff', fontSize: '18px' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card 
              size="small"
              hoverable 
              onClick={() => handleCardClick('申请测试', 'cpc_status')}
              style={{ cursor: 'pointer', minHeight: '80px' }}
            >
              <Statistic
                title="CPC测试待审核"
                value={statistics.cpcTestPending}
                prefix={<SearchOutlined />}
                valueStyle={{ color: '#fa8c16', fontSize: '18px' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card 
              size="small"
              hoverable 
              onClick={() => handleCardClick('测试中', 'cpc_status')}
              style={{ cursor: 'pointer', minHeight: '80px' }}
            >
              <Statistic
                title="CPC检测中"
                value={statistics.cpcTesting}
                prefix={<SearchOutlined />}
                valueStyle={{ color: '#13c2c2', fontSize: '18px' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card 
              size="small"
              hoverable 
              onClick={() => handleCardClick('样品已发', 'cpc_status')}
              style={{ cursor: 'pointer', minHeight: '80px' }}
            >
              <Statistic
                title="CPC已发样品"
                value={statistics.cpcSampleSent}
                prefix={<SearchOutlined />}
                valueStyle={{ color: '#52c41a', fontSize: '18px' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card 
              size="small"
              hoverable 
              onClick={handleCpcPendingListingClick}
              style={{ cursor: 'pointer', minHeight: '80px' }}
            >
              <Statistic
                title="CPC待上架产品"
                value={statistics.cpcPendingListing}
                prefix={<SearchOutlined />}
                valueStyle={{ color: '#722ed1', fontSize: '18px' }}
              />
            </Card>
          </Col>
        </Row>
      </div>

            <div style={{ marginBottom: '12px' }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          {/* 搜索和筛选区域 */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <TextArea
              rows={4}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                searchType === 'sku' 
                  ? `请输入SKU（每行一个，支持${isFuzzySearch ? '模糊' : '精确'}查询）`
                  : "请输入产品链接/ID（每行一个，支持模糊查询）"
              }
              style={{ width: 350 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Select
                  value={searchType}
                  onChange={(value) => {
                    setSearchType(value);
                    // 切换搜索类型时清空输入和结果
                    setInput('');
                    setData([]);
                    setOriginalData([]);
                    setFilteredData([]);
                    setSelectedRowKeys([]);
                  }}
                  style={{ width: 120 }}
                >
                  <Option value="sku">搜索SKU</Option>
                  <Option value="weblink">搜索产品链接/ID</Option>
                </Select>
                
                {searchType === 'sku' && (
                  <Checkbox
                    checked={isFuzzySearch}
                    onChange={e => setIsFuzzySearch(e.target.checked)}
                    style={{ fontSize: '12px' }}
                  >
                    模糊搜索
                  </Checkbox>
                )}
                
                <Button type="primary" onClick={handleSearch} loading={loading}>
                  搜索
                </Button>
              </div>
              
              <Button 
                icon={<ReloadOutlined />} 
                onClick={() => {
                  setInput('');
                  setData([]);
                  setOriginalData([]);
                  setFilteredData([]);
                  setSelectedRowKeys([]);
                  // 重置搜索相关状态
                  setSearchType('sku');
                  setIsFuzzySearch(true);
                  // 清空筛选条件
                  setFilters({ status: '', cpc_status: '', cpc_submit: '', seller_name: '', dateRange: null });
                  // 重新获取统计数据
                  fetchAllDataStatistics();
                }}
              >
                清空
              </Button>
            </div>
            
            {/* 筛选条件区域 */}
            <Card size="small" title={<><FilterOutlined /> 筛选条件</>} style={{ flex: 1 }} bodyStyle={{ paddingTop: '8px', paddingBottom: '8px' }}>
              <Row gutter={[12, 6]} align="middle">
                <Col span={4}>
                  <div style={{ marginBottom: '4px' }}>产品状态：</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="选择状态"
                    value={filters.status}
                    onChange={(value) => handleFilterChange('status', value)}
                    allowClear
                  >
                    {getUniqueStatuses().map(statusItem => (
                      <Option key={statusItem.value} value={statusItem.value}>
                        {statusItem.value} ({statusItem.count})
                      </Option>
                    ))}
                  </Select>
                </Col>
                <Col span={4}>
                  <div style={{ marginBottom: '4px' }}>CPC测试情况：</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="选择CPC状态"
                    value={filters.cpc_status}
                    onChange={(value) => handleFilterChange('cpc_status', value)}
                    allowClear
                  >
                    {getUniqueCpcStatuses().map(statusItem => (
                      <Option key={statusItem.value} value={statusItem.value}>
                        {statusItem.value} ({statusItem.count})
                      </Option>
                    ))}
                  </Select>
                </Col>
                <Col span={4}>
                  <div style={{ marginBottom: '4px' }}>CPC提交情况：</div>
                  <AutoComplete
                    style={{ width: '100%' }}
                    placeholder="选择或输入CPC提交情况"
                    value={filters.cpc_submit}
                    onChange={(value) => {
                      console.log('🔧 CPC提交情况筛选值改变:', value);
                      handleFilterChange('cpc_submit', value);
                    }}
                    allowClear
                    filterOption={(inputValue, option) =>
                      option?.value?.toLowerCase().indexOf(inputValue.toLowerCase()) !== -1
                    }
                    options={getUniqueCpcSubmits().length > 0 ? 
                      getUniqueCpcSubmits().map(submitItem => ({
                        value: submitItem.value,
                        label: `${submitItem.value} (${submitItem.count})`
                      })) : 
                      []
                    }
                    notFoundContent={allDataStats.cpcSubmitStats?.length === 0 ? "暂无CPC提交情况数据" : "暂无匹配数据"}
                  />
                </Col>
                <Col span={4}>
                  <div style={{ marginBottom: '4px' }}>供应商：</div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="选择供应商"
                    value={filters.seller_name}
                    onChange={(value) => handleFilterChange('seller_name', value)}
                    allowClear
                    showSearch
                    filterOption={(input, option) =>
                      (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    {getUniqueSuppliers().map(supplierItem => (
                      <Option key={supplierItem.value} value={supplierItem.value}>
                        {supplierItem.value} ({supplierItem.count})
                      </Option>
                    ))}
                  </Select>
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: '4px' }}>创建时间：</div>
                  <RangePicker
                    style={{ width: '100%' }}
                    placeholder={['开始日期', '结束日期']}
                    value={filters.dateRange ? [dayjs(filters.dateRange[0]), dayjs(filters.dateRange[1])] : null}
                    onChange={(dates) => {
                      const dateRange = dates && dates.length === 2 ? [dates[0]!.format('YYYY-MM-DD'), dates[1]!.format('YYYY-MM-DD')] as [string, string] : null;
                      handleFilterChange('dateRange', dateRange);
                    }}
                    allowClear
                  />
                </Col>
                {(filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange) && (
                  <Col span={24} style={{ textAlign: 'center', marginTop: '8px' }}>
                    <span style={{ color: '#1890ff' }}>
                      已筛选：显示 {(filteredData.length > 0 || filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange) ? filteredData.length : data.length} 条记录
                    </span>
                  </Col>
                )}
              </Row>
            </Card>
          </div>

          {/* 批量操作区域 */}
          <Card 
            size="small" 
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>批量操作</span>
                {selectedRowKeys.length > 0 && (
                  <span style={{ color: '#1890ff', fontSize: '14px', fontWeight: 'normal' }}>
                    已选择 {selectedRowKeys.length} 条记录
                  </span>
                )}
              </div>
            }
            style={{ marginBottom: '12px' }}
            bodyStyle={{ paddingTop: '8px', paddingBottom: '8px' }}
          >
            <Row gutter={[12, 8]}>
              {/* 数据管理 */}
              <Col span={8}>
                <div style={{ 
                  padding: '8px', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '6px',
                  border: '1px solid #e9ecef',
                  height: '100%'
                }}>
                  <div style={{ 
                    fontWeight: 'bold', 
                    marginBottom: '8px', 
                    color: '#495057',
                    fontSize: '13px'
                  }}>
                    📊 数据管理
                  </div>
                  <Space size="small" wrap>
                    <Select
                      placeholder="批量修改状态"
                      style={{ width: 140 }}
                      onSelect={(value) => handleBatchUpdateStatus(value)}
                      disabled={selectedRowKeys.length === 0}
                      size="small"
                    >
                      {getUniqueStatuses().map(statusItem => (
                        <Option key={statusItem.value} value={statusItem.value}>
                          {statusItem.value} ({statusItem.count})
                        </Option>
                      ))}
                    </Select>
                    
                    <Button 
                      icon={<UploadOutlined />}
                      onClick={() => setUploadModalVisible(true)}
                      loading={loading}
                      size="small"
                    >
                      批量上传新品
                    </Button>

                    <Popconfirm
                      title="确定要删除选中的记录吗？"
                      onConfirm={handleBatchDelete}
                      okText="确定"
                      cancelText="取消"
                      disabled={selectedRowKeys.length === 0}
                    >
                      <Button 
                        danger
                        icon={<DeleteOutlined />}
                        disabled={selectedRowKeys.length === 0}
                        size="small"
                      >
                        批量删除
                      </Button>
                    </Popconfirm>
                  </Space>
                </div>
              </Col>

              {/* CPC相关操作 */}
              <Col span={8}>
                <div style={{ 
                  padding: '8px', 
                  backgroundColor: '#fff7e6', 
                  borderRadius: '6px',
                  border: '1px solid #ffd591',
                  height: '100%'
                }}>
                  <div style={{ 
                    fontWeight: 'bold', 
                    marginBottom: '8px', 
                    color: '#d46b08',
                    fontSize: '13px'
                  }}>
                    🔬 CPC检测
                  </div>
                  <Space size="small" wrap>
                    <Button 
                      type="primary"
                      onClick={handleBatchSendCpcTest}
                      disabled={selectedRowKeys.length === 0}
                      size="small"
                    >
                      发送CPC测试申请
                    </Button>

                    <Button 
                      type="primary"
                      style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                      onClick={handleBatchMarkCpcSampleSent}
                      disabled={selectedRowKeys.length === 0}
                      size="small"
                    >
                      标记CPC样品已发
                    </Button>
                  </Space>
                </div>
              </Col>

              {/* 文档生成与管理 */}
              <Col span={8}>
                <div style={{ 
                  padding: '8px', 
                  backgroundColor: '#f0f5ff', 
                  borderRadius: '6px',
                  border: '1px solid #adc6ff',
                  height: '100%'
                }}>
                  <div style={{ 
                    fontWeight: 'bold', 
                    marginBottom: '8px', 
                    color: '#1d39c4',
                    fontSize: '13px'
                  }}>
                    📄 文档管理
                  </div>
                  <Space size="small" wrap>
                    <Button 
                      icon={<FileExcelOutlined />}
                      onClick={handleOpenTemplateModal}
                      loading={globalTemplateLoading}
                      size="small"
                    >
                      管理资料模板
                    </Button>

                    <Button 
                      type="primary"
                      icon={<FileExcelOutlined />}
                      onClick={handleGenerateUkDataSheet}
                      disabled={selectedRowKeys.length === 0}
                      style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                      size="small"
                    >
                      生成英国资料表
                    </Button>

                    <Button 
                      type="primary"
                      icon={<FileExcelOutlined />}
                      onClick={handleGenerateOtherSiteDataSheet}
                      style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                      size="small"
                    >
                      生成其他站点资料表
                    </Button>
                  </Space>
                </div>
              </Col>
            </Row>
          </Card>
        </Space>
      </div>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={filteredData.length > 0 || filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange ? filteredData : data}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        scroll={{ x: 'max-content' }}
        bordered
        onChange={handleTableChange}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
          pageSize: 50,
          pageSizeOptions: ['20', '50', '100', '200'],
        }}
        title={() => (
          <div style={{ textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontWeight: 'bold' }}>
                  采购链接管理 
                </span>
                <span style={{ marginLeft: '16px', color: '#666', fontSize: '12px' }}>
                  提示：双击单元格可编辑内容（除ID、时间字段外），点击列名可排序
                </span>
              </div>
              <Button 
                icon={<LinkOutlined />}
                onClick={handleBatchOpenLinks}
                disabled={selectedRowKeys.length === 0}
                type="primary"
              >
                批量打开链接
              </Button>
            </div>
          </div>
        )}
      />

      {/* 编辑对话框 */}
      <Modal
        title="编辑字段"
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingCell(null);
          (editForm as any).resetFields();
        }}
        okText="保存"
        cancelText="取消"
        width={400}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            label={`编辑 ${editingCell?.field ? getFieldDisplayName(editingCell.field) : ''}`}
            name="value"
            rules={[{ required: false }]}
          >
            {editingCell?.field === 'status' ? (
              <Select placeholder="请选择状态">
                {getUniqueStatuses().map(statusItem => (
                  <Option key={statusItem.value} value={statusItem.value}>
                    {statusItem.value} ({statusItem.count})
                  </Option>
                ))}
              </Select>
            ) : editingCell?.field === 'cpc_status' ? (
              <Select placeholder="请选择CPC测试情况">
                <Option key="" value="">清空</Option>
                {getUniqueCpcStatuses().map(statusItem => (
                  <Option key={statusItem.value} value={statusItem.value}>
                    {statusItem.value} ({statusItem.count})
                  </Option>
                ))}
              </Select>
            ) : editingCell?.field === 'cpc_submit' ? (
              <AutoComplete
                placeholder="选择或输入CPC提交情况"
                allowClear
                filterOption={(inputValue, option) =>
                  option?.value?.toLowerCase().indexOf(inputValue.toLowerCase()) !== -1
                }
                options={[
                  { value: '', label: '清空' },
                  ...getUniqueCpcSubmits().map(submitItem => ({
                    value: submitItem.value,
                    label: `${submitItem.value} (${submitItem.count})`
                  }))
                ]}
                notFoundContent={getUniqueCpcSubmits().length === 0 ? "暂无CPC提交情况数据" : "暂无匹配数据"}
              />
            ) : editingCell?.field === 'notice' ? (
              <TextArea rows={3} placeholder="请输入备注" />
            ) : editingCell?.field === 'weblink' ? (
              <Input placeholder="请输入产品链接" type="url" />
            ) : (
              <Input placeholder="请输入内容" />
            )}
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量上传新品对话框 */}
      <Modal
        title="批量上传新品"
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          setEnableDingTalkNotification(true);
        }}
        footer={null}
        width={500}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ marginBottom: '16px' }}>
            <Text strong>Excel表格要求：</Text>
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li>A列：SKU</li>
              <li>B列：产品链接</li>
              <li>C列：备注</li>
              <li>从第一行开始，无需表头</li>
            </ul>
          </div>
          
          {/* 钉钉推送开关 */}
          <div style={{ 
            marginBottom: '16px', 
            padding: '12px', 
            backgroundColor: '#f6f8fa', 
            borderRadius: '6px',
            border: '1px solid #e1e4e8'
          }}>
            <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
              <div>
                <Text strong style={{ color: '#1890ff' }}>
                  推送钉钉通知
                </Text>
                <div style={{ marginTop: '4px' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    上传新品成功后推送消息到钉钉群
                  </Text>
                </div>
              </div>
              <Switch
                checked={enableDingTalkNotification}
                onChange={setEnableDingTalkNotification}
                checkedChildren="开"
                unCheckedChildren="关"
                style={{ backgroundColor: enableDingTalkNotification ? '#52c41a' : '#d9d9d9' }}
              />
            </Space>
          </div>
          
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              style={{ display: 'none' }}
            />
            <Button 
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => fileInputRef.current?.click()}
              loading={loading}
              block
            >
              选择Excel文件上传
            </Button>
          </div>
        </Space>
      </Modal>



      {/* CPC文件管理对话框 */}
      <Modal
        title={`CPC文件管理 - ${currentRecord?.parent_sku || ''}`}
        open={cpcModalVisible}
        onCancel={() => {
          setCpcModalVisible(false);
          setCurrentRecord(null);
          setCpcFiles([]);
          setExtractedDataVisible(false);
          setPendingExtractedData(null);
        }}
        footer={null}
        width={800}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {/* 自动识别结果确认区域 */}
          {extractedDataVisible && pendingExtractedData && (
            <Card 
              style={{ 
                border: '2px solid #52c41a', 
                backgroundColor: '#f6ffed',
                marginBottom: '16px'
              }}
              title={
                <Space>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <span style={{ color: '#52c41a', fontWeight: 'bold' }}>自动识别结果</span>
                </Space>
              }
              extra={
                <Space>
                  <Button type="primary" size="small" onClick={handleConfirmExtractedData}>
                    确认应用
                  </Button>
                  <Button size="small" onClick={handleCancelExtractedData}>
                    取消
                  </Button>
                </Space>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  🔍 从CPC证书文件中识别到以下信息：
                </div>
                <div style={{ padding: '12px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #d9f7be' }}>
                  {pendingExtractedData.styleNumber && (
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold', color: '#262626' }}>Style Number: </span>
                      <span style={{ color: '#52c41a', fontWeight: 'bold', fontSize: '16px' }}>
                        {pendingExtractedData.styleNumber}
                      </span>
                    </div>
                  )}
                  {pendingExtractedData.recommendAge && (
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#262626' }}>推荐年龄: </span>
                      <span style={{ color: '#52c41a', fontWeight: 'bold', fontSize: '16px' }}>
                        {pendingExtractedData.recommendAge}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                  💡 点击"确认应用"将更新产品的Style Number和推荐年龄信息
                </div>
              </Space>
            </Card>
          )}

          <div style={{ marginBottom: '16px' }}>
            <Upload.Dragger
              beforeUpload={(file, fileList) => {
                // 如果是单文件，使用原有逻辑
                if (fileList.length === 1) {
                  return handleCpcFileUpload(file);
                }
                
                // 如果是多文件，使用批量上传逻辑
                const files = Array.from(fileList);
                handleMultipleFileUpload(files);
                return false; // 阻止默认上传
              }}
              multiple
              showUploadList={false}
              accept=".pdf"
              disabled={cpcUploading}
              style={{
                padding: '20px',
                backgroundColor: '#fafafa'
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <FilePdfOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                <div style={{ marginBottom: '8px' }}>
                  <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    loading={cpcUploading}
                    size="large"
                  >
                    {cpcUploading ? '上传中...' : '选择CPC文件'}
                  </Button>
                </div>
                <div style={{ color: '#666', fontSize: '14px', marginBottom: '4px' }}>
                  或将文件拖拽到此区域
                </div>
                <div style={{ color: '#999', fontSize: '12px' }}>
                  支持PDF格式，最大10MB，支持多文件批量上传
                </div>
                <div style={{ color: '#999', fontSize: '12px', marginTop: '4px' }}>
                  仅对CHILDREN'S PRODUCT CERTIFICATE文件自动提取Style Number和推荐年龄信息
                </div>
                <div style={{ color: '#52c41a', fontSize: '12px', marginTop: '8px', fontWeight: 'bold' }}>
                  💡 智能识别：系统会自动筛选CPC证书文件进行信息提取
                </div>
              </div>
            </Upload.Dragger>
          </div>

          <List
            dataSource={cpcFiles}
            renderItem={(file) => (
              <List.Item
                actions={[
                  <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => window.open(file.url, '_blank')}
                    title="在新标签页查看文件"
                  >
                    查看
                  </Button>,
                  <Button
                    type="link"
                    icon={<DownloadOutlined />}
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = file.url;
                      link.download = file.name;
                      link.target = '_blank';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    title="下载文件到本地"
                  >
                    下载
                  </Button>,
                  <Popconfirm
                    title="确定要删除这个文件吗？"
                    description="删除后将无法恢复，同时会从云存储中删除文件"
                    onConfirm={() => handleCpcFileDelete(file.uid)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button type="link" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                ]}
              >
                <List.Item.Meta
                  avatar={<FilePdfOutlined style={{ fontSize: '24px', color: '#ff4d4f' }} />}
                  title={
                    <Space>
                      <span style={{ fontWeight: 'bold' }}>{file.name}</span>
                      {file.extractedData && (file.extractedData.styleNumber || file.extractedData.recommendAge) ? (
                        <Tag color="green" icon={<CheckCircleOutlined />}>CPC证书已解析</Tag>
                      ) : (
                        <Tag color="default">其他文件</Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      <Text type="secondary">
                        大小: {(file.size / 1024 / 1024).toFixed(2)} MB
                      </Text>
                      <Text type="secondary">
                        上传时间: {dayjs(file.uploadTime).format('YYYY-MM-DD HH:mm:ss')}
                      </Text>
                      {file.extractedData && (file.extractedData.styleNumber || file.extractedData.recommendAge) && (
                        <div style={{ marginTop: '4px', padding: '4px 8px', backgroundColor: '#f0f9f0', borderRadius: '4px', border: '1px solid #d9f7be' }}>
                          <Text type="secondary" style={{ fontSize: '12px', fontWeight: 'bold', color: '#52c41a' }}>
                            📋 已提取信息：
                          </Text>
                          {file.extractedData.styleNumber && (
                            <Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>
                              Style Number: <span style={{ fontWeight: 'bold' }}>{file.extractedData.styleNumber}</span>
                            </Text>
                          )}
                          {file.extractedData.recommendAge && (
                            <Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>
                              推荐年龄: <span style={{ fontWeight: 'bold' }}>{file.extractedData.recommendAge}</span>
                            </Text>
                          )}
                        </div>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
            locale={{ emptyText: '暂无CPC文件' }}
          />
        </Space>
      </Modal>

             {/* 亚马逊模板管理对话框 */}
       <Modal
         title="亚马逊资料模板管理"
         open={templateModalVisible}
         onCancel={() => setTemplateModalVisible(false)}
         footer={null}
         width={1000}
       >
         <Tabs
           activeKey={activeTabKey}
           onChange={handleTabChange}
           type="card"
           items={[
             {
               key: 'US',
               label: '美国 (US)',
               children: renderTabContent('US', '美国')
             },
             {
               key: 'CA',
               label: '加拿大 (CA)',
               children: renderTabContent('CA', '加拿大')
             },
             {
               key: 'UK',
               label: '英国 (UK)',
               children: renderTabContent('UK', '英国')
             },
             {
               key: 'AE',
               label: '阿联酋 (AE)',
               children: renderTabContent('AE', '阿联酋')
             },
             {
               key: 'AU',
               label: '澳大利亚 (AU)',
               children: renderTabContent('AU', '澳大利亚')
             }
           ]}
         />
             </Modal>

      {/* 生成其他站点资料表弹窗 - 新3步流程 */}
      <Modal
        title="生成其他站点资料表"
        open={otherSiteModalVisible}
        onCancel={() => {
          setOtherSiteModalVisible(false);
          resetThreeStepFlow();
        }}
        footer={null}
        width={1200}
        destroyOnClose={true}
      >
        <div style={{ padding: '20px 0' }}>
          {/* 步骤指示器 */}
          <Steps
            current={currentStep}
            style={{ marginBottom: '32px' }}
            items={[
              {
                title: '上传源数据',
                description: '选择站点并上传Excel文件',
                icon: currentStep > 0 ? <CheckCircleOutlined /> : <UploadOutlined />
              },
              {
                title: '选择目标站点',
                description: '选择需要生成的站点',
                icon: currentStep > 1 ? <CheckCircleOutlined /> : <GlobalOutlined />
              },
              {
                title: '下载管理',
                description: '下载生成的资料表',
                icon: currentStep > 2 ? <CheckCircleOutlined /> : <DownloadOutlined />
              }
            ]}
          />

          {/* 步骤1：上传源数据 */}
          {currentStep === 0 && (
            <div style={{ minHeight: '400px' }}>
              <Card title="步骤1：选择源站点并上传资料表" style={{ marginBottom: '20px' }}>
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  {/* 站点选择 */}
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: '12px' }}>
                      选择源站点：
                    </Text>
                    <Radio.Group 
                      value={sourceCountry} 
                      onChange={(e) => setSourceCountry(e.target.value)}
                      size="large"
                    >
                      <Space direction="horizontal" wrap>
                        <Radio.Button value="US">🇺🇸 美国 (US)</Radio.Button>
                        <Radio.Button value="CA">🇨🇦 加拿大 (CA)</Radio.Button>
                        <Radio.Button value="UK">🇬🇧 英国 (UK)</Radio.Button>
                        <Radio.Button value="AE">🇦🇪 阿联酋 (AE)</Radio.Button>
                        <Radio.Button value="AU">🇦🇺 澳大利亚 (AU)</Radio.Button>
                      </Space>
                    </Radio.Group>
                  </div>

                  {/* 文件上传 */}
                  {sourceCountry && (
                    <div>
                      <Text strong style={{ display: 'block', marginBottom: '12px' }}>
                        上传{sourceCountry === 'US' ? '美国' : sourceCountry === 'CA' ? '加拿大' : sourceCountry === 'UK' ? '英国' : sourceCountry === 'AE' ? '阿联酋' : '澳大利亚'}站点的Excel资料表：
                      </Text>
                      <Upload
                        accept=".xlsx,.xls"
                        beforeUpload={(file) => {
                          setSourceFile(file);
                          // 选择文件后直接上传
                          setTimeout(() => {
                            handleUploadSourceData(file);
                          }, 100);
                          return false;
                        }}
                        fileList={sourceFile ? [{
                          uid: '1',
                          name: sourceFile.name,
                          status: otherSiteLoading[sourceCountry] ? 'uploading' : 'done',
                          size: sourceFile.size
                        }] : []}
                        onRemove={() => {
                          setSourceFile(null);
                          setSourceDataUploaded(false);
                        }}
                        style={{ width: '100%' }}
                      >
                        <Button 
                          icon={<UploadOutlined />} 
                          size="large" 
                          block
                          loading={otherSiteLoading[sourceCountry]}
                        >
                          {otherSiteLoading[sourceCountry] ? '正在上传...' : '选择Excel文件'}
                        </Button>
                      </Upload>
                      <Text type="secondary" style={{ marginTop: '8px', display: 'block' }}>
                        支持 .xlsx 和 .xls 格式，选择文件后将自动上传到数据库
                      </Text>
                    </div>
                  )}

                  {/* 文件信息 */}
                  {sourceFile && (
                    <div style={{ padding: '16px', backgroundColor: '#f6f6f6', borderRadius: '8px' }}>
                      <Text strong>
                        {otherSiteLoading[sourceCountry] ? '正在上传文件：' : sourceDataUploaded ? '已成功上传文件：' : '已选择文件：'}
                      </Text>
                      <br />
                      <Text type="secondary">文件名: {sourceFile.name}</Text>
                      <br />
                      <Text type="secondary">大小: {(sourceFile.size / 1024).toFixed(1)} KB</Text>
                      {sourceDataUploaded && (
                        <>
                          <br />
                          <Text type="success">✓ 数据已成功上传到数据库</Text>
                        </>
                      )}
                    </div>
                  )}
                </Space>
              </Card>
            </div>
          )}

          {/* 步骤2：选择目标站点 */}
          {currentStep === 1 && (
            <div style={{ minHeight: '400px' }}>
              <Card title="步骤2：选择需要生成资料的站点" style={{ marginBottom: '20px' }}>
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: '16px' }}>
                      源数据：{sourceCountry} 站点 ({sourceFile?.name})
                    </Text>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '24px' }}>
                      请选择需要生成资料表的目标站点（可多选）：
                    </Text>
                  </div>

                  <Checkbox.Group 
                    value={selectedTargetCountries} 
                    onChange={setSelectedTargetCountries}
                    style={{ width: '100%' }}
                  >
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      {['US', 'CA', 'UK', 'AE', 'AU']
                        .filter(country => country !== sourceCountry)
                        .map(country => {
                          const countryNames = { US: '美国', CA: '加拿大', UK: '英国', AE: '阿联酋', AU: '澳大利亚' };
                          const flags = { US: '🇺🇸', CA: '🇨🇦', UK: '🇬🇧', AE: '🇦🇪', AU: '🇦🇺' };
                          return (
                            <Card 
                              key={country}
                              size="small"
                              style={{ 
                                cursor: 'pointer',
                                backgroundColor: selectedTargetCountries.includes(country) ? '#e6f7ff' : '#fafafa'
                              }}
                              onClick={() => {
                                if (selectedTargetCountries.includes(country)) {
                                  setSelectedTargetCountries(prev => prev.filter(c => c !== country));
                                } else {
                                  setSelectedTargetCountries(prev => [...prev, country]);
                                }
                              }}
                            >
                              <Checkbox value={country} style={{ pointerEvents: 'none' }}>
                                <Text strong>{flags[country as keyof typeof flags]} {countryNames[country as keyof typeof countryNames]} ({country})</Text>
                              </Checkbox>
                            </Card>
                          );
                        })}
                    </Space>
                  </Checkbox.Group>

                  {selectedTargetCountries.length > 0 && (
                    <div style={{ padding: '16px', backgroundColor: '#f6ffed', borderRadius: '8px' }}>
                      <Text strong style={{ color: '#389e0d' }}>
                        已选择 {selectedTargetCountries.length} 个站点：
                      </Text>
                      <div style={{ marginTop: '8px' }}>
                        {selectedTargetCountries.map(country => {
                          const countryNames = { US: '美国', CA: '加拿大', UK: '英国', AE: '阿联酋', AU: '澳大利亚' };
                          return (
                            <Tag key={country} color="green" style={{ margin: '4px' }}>
                              {countryNames[country as keyof typeof countryNames]} ({country})
                            </Tag>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginTop: '24px' }}>
                    <Space>
                      <Button 
                        size="large"
                        onClick={() => setCurrentStep(0)}
                      >
                        返回上一步
                      </Button>
                      <Button
                        type="primary"
                        size="large"
                        icon={<PlayCircleOutlined />}
                        disabled={selectedTargetCountries.length === 0}
                        onClick={handleStartGeneration}
                        style={{ minWidth: '200px' }}
                      >
                        开始生成资料表
                      </Button>
                    </Space>
                  </div>
                </Space>
              </Card>
            </div>
          )}

          {/* 步骤3：下载管理 */}
          {currentStep === 2 && (
            <div style={{ minHeight: '400px' }}>
              <Card title="步骤3：生成进度与下载管理" style={{ marginBottom: '20px' }}>
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  {/* 生成进度 */}
                  {generationInProgress && (
                    <div style={{ padding: '16px', backgroundColor: '#fff2e8', borderRadius: '8px' }}>
                      <Text strong style={{ display: 'block', marginBottom: '16px' }}>
                        🔄 正在生成站点资料表...
                      </Text>
                      {selectedTargetCountries.map(country => {
                        const countryNames = { US: '美国', CA: '加拿大', UK: '英国', AE: '阿联酋', AU: '澳大利亚' };
                        const status = batchProgress[country];
                        
                        let statusIcon = <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
                        let statusColor = '#d9d9d9';
                        let statusText = '等待中';
                        
                        if (status === 'processing') {
                          statusIcon = <LoadingOutlined style={{ color: '#1890ff' }} />;
                          statusColor = '#1890ff';
                          statusText = '生成中...';
                        } else if (status === 'completed') {
                          statusIcon = <CheckCircleOutlined style={{ color: '#52c41a' }} />;
                          statusColor = '#52c41a';
                          statusText = '已完成';
                        } else if (status === 'failed') {
                          statusIcon = <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
                          statusColor = '#ff4d4f';
                          statusText = '生成失败';
                        }
                        
                        return (
                          <div key={country} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '12px 0',
                            borderBottom: '1px solid #f0f0f0'
                          }}>
                            <Space>
                              {statusIcon}
                              <Text>{countryNames[country as keyof typeof countryNames]} ({country})</Text>
                            </Space>
                            <Text style={{ color: statusColor }}>{statusText}</Text>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 下载历史 */}
                  {Object.keys(downloadHistory).length > 0 && (
                    <div style={{ padding: '16px', backgroundColor: '#f6ffed', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <Text strong style={{ color: '#389e0d' }}>
                          📥 已生成的资料表文件：
                        </Text>
                        <Button 
                          type="primary"
                          icon={<DownloadOutlined />}
                          onClick={handleBatchRedownload}
                        >
                          批量下载所有文件
                        </Button>
                      </div>
                      
                      {Object.entries(downloadHistory).map(([country, fileData]) => {
                        const countryNames = { US: '美国', CA: '加拿大', UK: '英国', AE: '阿联酋', AU: '澳大利亚' };
                        const generatedTime = new Date(fileData.generatedAt).toLocaleString('zh-CN');
                        
                        return (
                          <div key={country} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '12px 16px',
                            backgroundColor: '#fff',
                            borderRadius: '6px',
                            marginBottom: '8px',
                            border: '1px solid #d9d9d9'
                          }}>
                            <div>
                              <Text strong>{countryNames[country as keyof typeof countryNames]} ({country}) 资料表</Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                生成时间: {generatedTime} | 文件名: {fileData.fileName}
                              </Text>
                            </div>
                            <Button 
                              type="link" 
                              icon={<DownloadOutlined />}
                              onClick={() => handleRedownload(country)}
                            >
                              下载
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div style={{ textAlign: 'center', marginTop: '24px' }}>
                    <Space>
                      {!generationInProgress && (
                        <Button 
                          size="large"
                          onClick={() => setCurrentStep(1)}
                        >
                          返回上一步
                        </Button>
                      )}
                      <Button
                        size="large"
                        onClick={() => {
                          resetThreeStepFlow();
                        }}
                      >
                        开始新的生成流程
                      </Button>
                      <Button
                        type="primary"
                        size="large"
                        onClick={() => setOtherSiteModalVisible(false)}
                      >
                        完成
                      </Button>
                    </Space>
                  </div>
                </Space>
              </Card>
            </div>
          )}
        </div>
      </Modal>

      {/* 缺失列提示弹窗 */}
      <Modal
        title="列差异提示"
        open={missingColumnsModalVisible}
        onOk={handleContinueGenerate}
        onCancel={() => {
          setMissingColumnsModalVisible(false);
          setMissingColumnsInfo(null);
          setOtherSiteLoading(prev => ({ ...prev, [activeSiteTabKey]: false }));
        }}
        okText="确认继续"
        cancelText="取消"
        width={600}
      >
        {missingColumnsInfo && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Typography.Text strong style={{ color: '#faad14' }}>
                ⚠️ 检测到以下列在{activeSiteTabKey}模板中不存在：
              </Typography.Text>
              <div style={{ marginTop: 8, padding: 12, backgroundColor: '#fff7e6', borderRadius: 6 }}>
                {missingColumnsInfo.missingColumns.map((col: string, index: number) => (
                  <Tag key={index} color="orange" style={{ margin: '2px 4px' }}>
                    {col}
                  </Tag>
                ))}
              </div>
            </div>
            
            <div>
              <Typography.Text>
                这些列的数据将不会被填入{activeSiteTabKey}模板中。
              </Typography.Text>
            </div>
            
            <div>
              <Typography.Text strong>
                是否确认继续生成资料表？
              </Typography.Text>
            </div>
          </Space>
        )}
      </Modal>

      {/* 批量上传结果详情对话框 */}
      <Modal
        title="批量上传结果"
        open={uploadResultVisible}
        onOk={() => setUploadResultVisible(false)}
        onCancel={() => setUploadResultVisible(false)}
        okText="确定"
        cancelButtonProps={{ style: { display: 'none' } }}
        width={800}
      >
        {uploadResult && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* 总体统计 */}
            <div>
              <Row gutter={16}>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="总处理行数"
                      value={uploadResult.totalRows}
                      valueStyle={{ color: '#1890ff' }}
                      prefix={<FileExcelOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="成功上传"
                      value={uploadResult.successCount}
                      valueStyle={{ color: '#52c41a' }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="跳过记录"
                      value={uploadResult.skippedCount}
                      valueStyle={{ color: '#faad14' }}
                      prefix={<ClockCircleOutlined />}
                    />
                  </Card>
                </Col>
              </Row>
            </div>

            {/* 结果说明 */}
            <div>
              {uploadResult.successCount > 0 && (
                <Typography.Text type="success">
                  ✅ 成功上传 {uploadResult.successCount} 条新记录
                </Typography.Text>
              )}
              {uploadResult.skippedCount > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Typography.Text type="warning">
                    ⚠️ 跳过 {uploadResult.skippedCount} 条重复记录
                  </Typography.Text>
                </div>
              )}
            </div>

            {/* 跳过记录详情 */}
            {uploadResult.skippedRecords && uploadResult.skippedRecords.length > 0 && (
              <div>
                <Typography.Text strong>跳过记录详情：</Typography.Text>
                <Table
                  size="small"
                  dataSource={uploadResult.skippedRecords}
                  columns={[
                    {
                      title: '行号',
                      dataIndex: 'row',
                      key: 'row',
                      width: 80,
                    },
                    {
                      title: 'SKU',
                      dataIndex: 'sku',
                      key: 'sku',
                      width: 150,
                    },
                    {
                      title: '链接',
                      dataIndex: 'link',
                      key: 'link',
                      ellipsis: true,
                      render: (text: string) => (
                        <Tooltip title={text}>
                          {text ? (
                            <a href={text} target="_blank" rel="noopener noreferrer">
                              {text.length > 30 ? `${text.substring(0, 30)}...` : text}
                            </a>
                          ) : '-'}
                        </Tooltip>
                      ),
                    },
                    {
                      title: '跳过原因',
                      dataIndex: 'reason',
                      key: 'reason',
                      render: (text: string) => (
                        <Tag color="orange">{text}</Tag>
                      ),
                    },
                  ]}
                  pagination={false}
                  scroll={{ y: 300 }}
                  style={{ marginTop: 8 }}
                />
              </div>
            )}
          </Space>
        )}
      </Modal>

   </div>
  );
};

export default Purchase; 