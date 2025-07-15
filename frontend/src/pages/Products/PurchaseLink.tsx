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
  Checkbox
} from 'antd';
import { 
  UploadOutlined, 
  DeleteOutlined, 
  LinkOutlined,
  ReloadOutlined,
  SearchOutlined,
  CameraOutlined,
  CloudUploadOutlined,
  FilterOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ColumnsType, TableProps } from 'antd/es/table';
import { API_BASE_URL } from '../../config/api';
import ChildSkuGenerator from '../../components/ChildSkuGenerator';

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
  const [skuQueryModalVisible, setSkuQueryModalVisible] = useState(false);
  const [skuPrefix, setSkuPrefix] = useState('');
  const [latestSku, setLatestSku] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  // SKU查询功能
  const handleSkuQuery = async () => {
    if (!skuPrefix.trim()) {
      message.warning('请输入SKU前缀');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/latest-sku`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: skuPrefix.trim() }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      setLatestSku(result.latestSku || '未找到该前缀的SKU');
    } catch (e) {
      console.error('查询失败:', e);
      message.error('查询失败');
      setLatestSku('查询失败');
    }
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
      title: '型号', 
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
                  <Select
                    style={{ width: '100%' }}
                    placeholder="选择CPC提交情况"
                    value={filters.cpc_submit}
                    onChange={(value) => {
                      console.log('🔧 CPC提交情况筛选值改变:', value);
                      handleFilterChange('cpc_submit', value);
                    }}
                    allowClear
                    loading={!allDataStats.cpcSubmitStats || allDataStats.cpcSubmitStats.length === 0}
                    notFoundContent={allDataStats.cpcSubmitStats?.length === 0 ? "暂无CPC提交情况数据" : "暂无数据"}
                  >
                    {getUniqueCpcSubmits().length > 0 ? (
                      getUniqueCpcSubmits().map(submitItem => (
                        <Option key={submitItem.value} value={submitItem.value}>
                          {submitItem.value} ({submitItem.count})
                        </Option>
                      ))
                    ) : (
                      <Option disabled value="no-data">
                        暂无CPC提交情况数据
                      </Option>
                    )}
                  </Select>
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
                disabled={selectedRowKeys.length === 0}
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
                disabled={selectedRowKeys.length === 0}
              >
                批量打开链接
              </Button>

              {/* 发送CPC测试申请 */}
              <Button 
                type="primary"
                onClick={handleBatchSendCpcTest}
                disabled={selectedRowKeys.length === 0}
              >
                发送CPC测试申请
              </Button>

              {/* 标记CPC样品已发 */}
              <Button 
                type="primary"
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                onClick={handleBatchMarkCpcSampleSent}
                disabled={selectedRowKeys.length === 0}
              >
                标记CPC样品已发
              </Button>

              {/* 批量上传新品 */}
              <Button 
                icon={<UploadOutlined />}
                onClick={() => setUploadModalVisible(true)}
                loading={loading}
              >
                批量上传新品
              </Button>

              {/* SKU最新编号查询 */}
              <Button 
                icon={<SearchOutlined />}
                onClick={() => setSkuQueryModalVisible(true)}
              >
                SKU最新编号查询
              </Button>

              {/* 子SKU生成器 */}
              <ChildSkuGenerator onSuccess={fetchAllDataStatistics} />

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
              disabled={selectedRowKeys.length === 0}
            >
              <Button 
                danger
                icon={<DeleteOutlined />}
                disabled={selectedRowKeys.length === 0}
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
            label={`编辑 ${editingCell?.field}`}
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
              <Select placeholder="请选择CPC提交情况">
                <Option key="" value="">清空</Option>
                {getUniqueCpcSubmits().length > 0 ? (
                  getUniqueCpcSubmits().map(submitItem => (
                    <Option key={submitItem.value} value={submitItem.value}>
                      {submitItem.value} ({submitItem.count})
                    </Option>
                  ))
                ) : (
                  <Option disabled value="no-data">
                    暂无CPC提交情况数据
                  </Option>
                )}
              </Select>
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

      {/* SKU查询对话框 */}
      <Modal
        title="SKU最新编号查询"
        open={skuQueryModalVisible}
        onOk={handleSkuQuery}
        onCancel={() => {
          setSkuQueryModalVisible(false);
          setSkuPrefix('');
          setLatestSku('');
        }}
        okText="查询"
        cancelText="取消"
        width={400}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text>请输入SKU前缀：</Text>
            <Input
              value={skuPrefix}
              onChange={e => setSkuPrefix(e.target.value)}
              placeholder="例如：XBC"
              style={{ marginTop: '8px' }}
            />
          </div>
          
          {latestSku && (
            <div style={{ marginTop: '16px' }}>
              <Text strong>最新SKU：</Text>
              <div style={{ 
                padding: '8px 12px', 
                backgroundColor: '#f5f5f5', 
                borderRadius: '4px',
                marginTop: '8px',
                fontFamily: 'monospace',
                fontSize: '14px'
              }}>
                {latestSku}
              </div>
            </div>
          )}
        </Space>
      </Modal>

    </div>
  );
};

export default Purchase; 