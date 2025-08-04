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
  Progress
} from 'antd';
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
  FileExcelOutlined
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
  const [editForm] = Form.useForm();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [templateFiles, setTemplateFiles] = useState<any[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('US');
  const [templateLoading, setTemplateLoading] = useState(false);
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
  
  // 全库统计数据
  const [allDataStats, setAllDataStats] = useState({
    statusStats: [] as { value: string; count: number }[],
    cpcStatusStats: [] as { value: string; count: number }[],
    cpcSubmitStats: [] as { value: string; count: number }[],
    supplierStats: [] as { value: string; count: number }[]
  });

  // 英国资料表生成相关状态
  const [ukGenerateModalVisible, setUkGenerateModalVisible] = useState(false);
  const [ukGenerateLoading, setUkGenerateLoading] = useState(false);
  const [ukGenerateProgress, setUkGenerateProgress] = useState(0);
  const [ukGenerateCurrentStep, setUkGenerateCurrentStep] = useState('');
  const [allButtonsDisabled, setAllButtonsDisabled] = useState(false);

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
        handleSearch(); // 刷新表格数据
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
          handleSearch();
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
        handleSearch(); // 刷新表格数据
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
        // 无筛选，重新拉取全部数据
        handleSearch();
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

  // 双击编辑单元格
  const handleCellDoubleClick = (record: ProductRecord, field: string) => {
    if (field === 'id' || field === 'update_time' || field === 'check_time') {
      return; // 这些字段不允许编辑
    }

    setEditingCell({
      id: record.id,
      field,
      value: record[field as keyof ProductRecord] as string || ''
    });
    setEditModalVisible(true);
    editForm.setFieldsValue({ value: record[field as keyof ProductRecord] || '' });
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingCell) return;

    try {
      const values = await editForm.validateFields();
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
      editForm.resetFields();
      
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

    setLoading(true);
    fetch(`${API_BASE_URL}/api/product_weblink/upload-excel-new`, {
      method: 'POST',
      body: formData,
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then(result => {
        message.success(result.message);
        setUploadModalVisible(false);
        if (result.count > 0) {
          // 刷新数据和统计信息
          handleSearch();
          fetchAllDataStatistics();
        }
      })
      .catch(e => {
        console.error('上传失败:', e);
        message.error('上传失败: ' + e.message);
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
  const fetchTemplateFiles = async (country?: string) => {
    try {
      setTemplateLoading(true);
      const queryParam = country ? `?country=${country}` : '';
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/amazon-templates${queryParam}`);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const result = await res.json();
      setTemplateFiles(result.data || []);
    } catch (error) {
      console.error('获取模板列表失败:', error);
      message.error('获取模板列表失败');
    } finally {
      setTemplateLoading(false);
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
    formData.append('country', selectedCountry);
    formData.append('originalFileName', file.name);

    try {
      setTemplateLoading(true);
      
      // 添加更详细的上传日志
      console.log('📤 开始上传亚马逊模板:', {
        fileName: file.name,
        fileSize: file.size,
        country: selectedCountry
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
      await fetchTemplateFiles(selectedCountry);
      
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
      setTemplateLoading(false);
      // 清空文件选择
      if (templateFileInputRef.current) {
        templateFileInputRef.current.value = '';
      }
    }
  };

  const handleTemplateDelete = async (objectName: string) => {
    try {
      setTemplateLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/amazon-templates/${encodeURIComponent(objectName)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      message.success(result.message);
      
      // 重新获取模板列表
      await fetchTemplateFiles(selectedCountry);
      
    } catch (error) {
      console.error('删除模板失败:', error);
      message.error('删除模板失败');
    } finally {
      setTemplateLoading(false);
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
    fetchTemplateFiles(selectedCountry);
  };

  const handleCountryChange = (country: string) => {
    setSelectedCountry(country);
    fetchTemplateFiles(country);
  };

  // 生成英国资料表处理函数
  const handleGenerateUkDataSheet = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要生成资料表的记录');
      return;
    }

    // 检查是否有英国模板
    setUkGenerateModalVisible(true);
    generateUkDataSheet();
  };

  // 执行生成英国资料表
  const generateUkDataSheet = async () => {
    try {
      setUkGenerateLoading(true);
      setAllButtonsDisabled(true);
      setUkGenerateProgress(0);
      setUkGenerateCurrentStep('正在准备生成英国资料表...');

      // 步骤1: 验证英国模板存在
      setUkGenerateProgress(10);
      setUkGenerateCurrentStep('检查英国模板文件...');
      
      const templateCheckRes = await fetch(`${API_BASE_URL}/api/product_weblink/amazon-templates?country=UK`);
      const templateCheckResult = await templateCheckRes.json();
      
      if (!templateCheckResult.data || templateCheckResult.data.length === 0) {
        throw new Error('未找到英国站点的资料模板，请先上传英国模板文件');
      }

      // 步骤2: 获取选中的记录信息
      setUkGenerateProgress(20);
      setUkGenerateCurrentStep('获取选中记录的母SKU信息...');
      
      const selectedRecords = data.filter(record => 
        selectedRowKeys.some(key => Number(key) === record.id)
      );
      const parentSkus = selectedRecords.map(record => record.parent_sku);

      // 步骤3: 调用后端API生成资料表
      setUkGenerateProgress(30);
      setUkGenerateCurrentStep('查询子SKU信息...');

      const generateRes = await fetch(`${API_BASE_URL}/api/product_weblink/generate-uk-data-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentSkus }),
      });

      if (!generateRes.ok) {
        throw new Error(`生成失败: ${generateRes.status} ${generateRes.statusText}`);
      }

      // 步骤4: 处理进度更新
      setUkGenerateProgress(60);
      setUkGenerateCurrentStep('复制模板文件并填写数据...');

      // 等待一段时间模拟处理
      await new Promise(resolve => setTimeout(resolve, 1000));

      setUkGenerateProgress(80);
      setUkGenerateCurrentStep('准备下载文件...');

      // 步骤5: 下载文件
      setUkGenerateProgress(90);
      setUkGenerateCurrentStep('正在下载生成的资料表...');

      const blob = await generateRes.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `UK_资料表_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // 完成
      setUkGenerateProgress(100);
      setUkGenerateCurrentStep('生成完成！文件已下载到本地');
      
      message.success(`成功生成英国资料表，包含 ${parentSkus.length} 个母SKU 的产品信息`);
      
      setTimeout(() => {
        setUkGenerateModalVisible(false);
        setUkGenerateProgress(0);
        setUkGenerateCurrentStep('');
      }, 2000);

    } catch (error: any) {
      console.error('生成英国资料表失败:', error);
      message.error('生成失败: ' + error.message);
      setUkGenerateModalVisible(false);
    } finally {
      setUkGenerateLoading(false);
      setAllButtonsDisabled(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
            {/* 统计卡片区域 */}
      <div style={{ marginBottom: '20px' }}>
        <Row gutter={12} style={{ marginBottom: '12px' }}>
          <Col span={4}>
            <Card 
              hoverable 
              onClick={() => handleCardClick('待P图')}
              style={{ cursor: 'pointer' }}
            >
              <Statistic
                title="待P图"
                value={statistics.waitingPImage}
                prefix={<CameraOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card 
              hoverable 
              onClick={() => handleCardClick('待上传')}
              style={{ cursor: 'pointer' }}
            >
              <Statistic
                title="待上传"
                value={statistics.waitingUpload}
                prefix={<CloudUploadOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card 
              hoverable 
              onClick={() => handleCardClick('申请测试', 'cpc_status')}
              style={{ cursor: 'pointer' }}
            >
              <Statistic
                title="CPC测试待审核"
                value={statistics.cpcTestPending}
                prefix={<SearchOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card 
              hoverable 
              onClick={() => handleCardClick('测试中', 'cpc_status')}
              style={{ cursor: 'pointer' }}
            >
              <Statistic
                title="CPC检测中"
                value={statistics.cpcTesting}
                prefix={<SearchOutlined />}
                valueStyle={{ color: '#13c2c2' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card 
              hoverable 
              onClick={() => handleCardClick('样品已发', 'cpc_status')}
              style={{ cursor: 'pointer' }}
            >
              <Statistic
                title="CPC已发样品"
                value={statistics.cpcSampleSent}
                prefix={<SearchOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card 
              hoverable 
              onClick={handleCpcPendingListingClick}
              style={{ cursor: 'pointer' }}
            >
              <Statistic
                title="CPC待上架产品"
                value={statistics.cpcPendingListing}
                prefix={<SearchOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>
      </div>

            <div style={{ marginBottom: '20px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {/* 搜索和筛选区域 */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <TextArea
              rows={6}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                searchType === 'sku' 
                  ? `请输入SKU（每行一个，支持${isFuzzySearch ? '模糊' : '精确'}查询）`
                  : "请输入产品链接/ID（每行一个，支持模糊查询）"
              }
              style={{ width: 400 }}
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
                disabled={allButtonsDisabled}
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
            <Card size="small" title={<><FilterOutlined /> 筛选条件</>} style={{ flex: 1 }}>
              <Row gutter={[16, 8]} align="middle">
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span>批量操作：</span>
              
              {/* 状态批量更新 */}
              <Select
                placeholder="批量修改状态"
                style={{ width: 140 }}
                onSelect={(value) => handleBatchUpdateStatus(value)}
                disabled={selectedRowKeys.length === 0 || allButtonsDisabled}
              >
                {getUniqueStatuses().map(statusItem => (
                  <Option key={statusItem.value} value={statusItem.value}>
                    {statusItem.value} ({statusItem.count})
                  </Option>
                ))}
              </Select>

              {/* 批量打开链接 */}
              <Button 
                icon={<LinkOutlined />}
                onClick={handleBatchOpenLinks}
                disabled={selectedRowKeys.length === 0 || allButtonsDisabled}
              >
                批量打开链接
              </Button>

              {/* 发送CPC测试申请 */}
              <Button 
                type="primary"
                onClick={handleBatchSendCpcTest}
                disabled={selectedRowKeys.length === 0 || allButtonsDisabled}
              >
                发送CPC测试申请
              </Button>

              {/* 标记CPC样品已发 */}
              <Button 
                type="primary"
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                onClick={handleBatchMarkCpcSampleSent}
                disabled={selectedRowKeys.length === 0 || allButtonsDisabled}
              >
                标记CPC样品已发
              </Button>

              {/* 批量上传新品 */}
              <Button 
                icon={<UploadOutlined />}
                onClick={() => setUploadModalVisible(true)}
                loading={loading}
                disabled={allButtonsDisabled}
              >
                批量上传新品
              </Button>

              {/* 管理亚马逊资料模板 */}
              <Button 
                icon={<FileExcelOutlined />}
                onClick={handleOpenTemplateModal}
                loading={templateLoading}
                disabled={allButtonsDisabled}
              >
                管理亚马逊资料模板
              </Button>

              {/* 生成英国资料表 */}
              <Button 
                type="primary"
                icon={<FileExcelOutlined />}
                onClick={handleGenerateUkDataSheet}
                loading={ukGenerateLoading}
                disabled={allButtonsDisabled || selectedRowKeys.length === 0}
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              >
                生成英国资料表
              </Button>



              {/* 选择状态提示 */}
              {selectedRowKeys.length > 0 && (
                <span style={{ color: '#1890ff', marginLeft: '16px' }}>
                  已选择 {selectedRowKeys.length} 条记录
                </span>
              )}
            </div>

            {/* 批量删除 - 放在最右边 */}
            <Popconfirm
              title="确定要删除选中的记录吗？"
              onConfirm={handleBatchDelete}
              okText="确定"
              cancelText="取消"
              disabled={selectedRowKeys.length === 0 || allButtonsDisabled}
            >
              <Button 
                danger
                icon={<DeleteOutlined />}
                disabled={selectedRowKeys.length === 0 || allButtonsDisabled}
              >
                批量删除
              </Button>
            </Popconfirm>
          </div>
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
            <span style={{ fontWeight: 'bold' }}>
              采购链接管理 
            </span>
            <span style={{ marginLeft: '16px', color: '#666', fontSize: '12px' }}>
              提示：双击单元格可编辑内容（除ID、时间字段外），点击列名可排序
            </span>
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
          editForm.resetFields();
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
        onCancel={() => setUploadModalVisible(false)}
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
         width={900}
       >
         <Space direction="vertical" style={{ width: '100%' }}>
           {/* 站点选择 */}
           <div style={{ marginBottom: '16px' }}>
             <Text strong>选择站点：</Text>
             <Select
               value={selectedCountry}
               onChange={handleCountryChange}
               style={{ width: 200, marginLeft: '8px' }}
               loading={templateLoading}
             >
               <Select.Option value="US">美国</Select.Option>
               <Select.Option value="UK">英国</Select.Option>
               <Select.Option value="DE">德国</Select.Option>
               <Select.Option value="FR">法国</Select.Option>
               <Select.Option value="IT">意大利</Select.Option>
               <Select.Option value="ES">西班牙</Select.Option>
               <Select.Option value="CA">加拿大</Select.Option>
               <Select.Option value="JP">日本</Select.Option>
             </Select>
           </div>

           {/* 文件上传 */}
           <div style={{ marginBottom: '16px' }}>
             <Text strong>上传新模板：</Text>
             <div style={{ marginTop: '8px' }}>
               <input
                 ref={templateFileInputRef}
                 type="file"
                 accept=".xlsx,.xls,.xlsm"
                 onChange={handleTemplateUpload}
                 style={{ display: 'none' }}
               />
               <Button 
                 icon={<UploadOutlined />}
                 onClick={() => templateFileInputRef.current?.click()}
                 loading={templateLoading}
               >
                 选择Excel文件上传
               </Button>
               <Text type="secondary" style={{ marginLeft: '8px' }}>
                 支持 .xlsx、.xls、.xlsm 格式
               </Text>
             </div>
           </div>

           {/* 模板列表 */}
           <div>
             <Text strong>当前模板列表 ({selectedCountry}站点)：</Text>
             {templateLoading ? (
               <div style={{ textAlign: 'center', padding: '20px' }}>
                 <Text>加载中...</Text>
               </div>
             ) : (
               <List
                 size="small"
                 style={{ marginTop: '8px', maxHeight: '300px', overflow: 'auto' }}
                 dataSource={templateFiles}
                 renderItem={(file: any) => (
                   <List.Item
                     actions={[
                       <Button
                         type="link"
                         icon={<DownloadOutlined />}
                         onClick={() => handleTemplateDownload(file.name, file.fileName)}
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
                       title={file.fileName}
                       description={`大小: ${(file.size / 1024).toFixed(1)} KB | 上传时间: ${new Date(file.lastModified).toLocaleString()}`}
                     />
                   </List.Item>
                 )}
                 locale={{ emptyText: '暂无模板文件' }}
               />
             )}
           </div>
         </Space>
       </Modal>

       {/* 英国资料表生成进度模态框 */}
       <Modal
         title="生成英国资料表"
         open={ukGenerateModalVisible}
         onCancel={() => {
           if (!ukGenerateLoading) {
             setUkGenerateModalVisible(false);
             setUkGenerateProgress(0);
             setUkGenerateCurrentStep('');
           }
         }}
         footer={ukGenerateProgress === 100 ? [
           <Button key="close" type="primary" onClick={() => {
             setUkGenerateModalVisible(false);
             setUkGenerateProgress(0);
             setUkGenerateCurrentStep('');
           }}>
             关闭
           </Button>
         ] : null}
         closable={!ukGenerateLoading}
         maskClosable={false}
         width={600}
       >
         <Space direction="vertical" style={{ width: '100%' }}>
           <div style={{ marginBottom: '16px' }}>
             <Text strong>当前步骤：</Text>
             <Text style={{ color: '#1890ff' }}>{ukGenerateCurrentStep}</Text>
           </div>
           
           <div style={{ marginBottom: '16px' }}>
             <Text strong>执行进度：</Text>
             <Progress 
               percent={ukGenerateProgress} 
               status={ukGenerateLoading ? 'active' : (ukGenerateProgress === 100 ? 'success' : 'normal')}
               strokeColor={{
                 '0%': '#108ee9',
                 '100%': '#87d068',
               }}
             />
           </div>

           {selectedRowKeys.length > 0 && (
             <div style={{ marginBottom: '16px' }}>
               <Text type="secondary">
                 本次将为 <Text strong style={{ color: '#1890ff' }}>{selectedRowKeys.length}</Text> 个母SKU生成英国资料表
               </Text>
             </div>
           )}

           {ukGenerateProgress === 100 && (
             <div style={{ 
               padding: '12px', 
               backgroundColor: '#f6ffed', 
               border: '1px solid #b7eb8f', 
               borderRadius: '6px',
               textAlign: 'center'
             }}>
               <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '20px', marginRight: '8px' }} />
               <Text style={{ color: '#52c41a', fontWeight: 'bold' }}>
                 英国资料表生成完成！文件已自动下载到本地
               </Text>
             </div>
           )}
         </Space>
       </Modal>

    </div>
  );
};

export default Purchase; 