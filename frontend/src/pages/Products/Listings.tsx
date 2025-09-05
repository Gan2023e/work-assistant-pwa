import React, { useState, useEffect, useCallback } from 'react';
import {
  Input,
  Select,
  Button,
  Pagination,
  message,
  Spin,
  Empty,
  Modal,
  Form,
  Tag,
  Tooltip,
  Popconfirm,
  Space,
  Table,
  Progress,
  Card,
  Statistic,
  Switch
} from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  DownOutlined,
  RightOutlined
} from '@ant-design/icons';
import { API_BASE_URL } from '../../config/api';
import BatchImportModal from '../../components/BatchImportModal';
import {
  ParentSkuData,
  ExpandedParentSkuData,
  ListingsResponse,
  ListingsStatistics,
  ListingsQueryParams,
  AddMappingForm,
  BatchMappingData,
  SkuMapping
} from '../../types/listings';
import './Listings.css';

const { Search } = Input;
const { Option } = Select;

// 扩展数据类型定义已移至types文件中

const Listings: React.FC = () => {
  // 状态管理
  const [listings, setListings] = useState<ParentSkuData[]>([]);
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<ListingsStatistics | null>(null);
  const [siteList, setSiteList] = useState<string[]>([]);
  const [countryList, setCountryList] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  
  // 查询参数
  const [queryParams, setQueryParams] = useState<ListingsQueryParams>({
    page: 1,
    limit: 50, // 默认每页50条
    search: '',
    site: 'all',
    status: 'all',
    sort_by: 'parent_sku',
    sort_order: 'ASC'
  });

  // 选中状态管理
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<ParentSkuData[]>([]);

  // 展开状态管理
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  // 产品状态筛选
  const [productStatusFilter, setProductStatusFilter] = useState<string>('all');
  const [productStatusOptions, setProductStatusOptions] = useState<string[]>([]);
  
  // 数据一致性检查状态
  const [consistencyCheckVisible, setConsistencyCheckVisible] = useState(false);
  const [consistencyData, setConsistencyData] = useState<any>(null);
  const [consistencyLoading, setConsistencyLoading] = useState(false);
  
  // 数据一致性检查中的复选框状态
  const [selectedOrphanRows, setSelectedOrphanRows] = useState<string[]>([]);
  
  // 弹窗状态
  const [addMappingVisible, setAddMappingVisible] = useState(false);
  const [batchImportVisible, setBatchImportVisible] = useState(false);
  const [skuDetailVisible, setSkuDetailVisible] = useState(false);
  const [selectedSku, setSelectedSku] = useState<ParentSkuData | null>(null);
  const [skuMappings, setSkuMappings] = useState<SkuMapping[]>([]);
  
  // 表单实例
  const [addForm] = Form.useForm();

  // 获取Listings数据
  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== '' && value !== 'all') {
          params.append(key, String(value));
        }
      });
      
      const response = await fetch(`${API_BASE_URL}/api/listings?${params}`);
      const result: ListingsResponse = await response.json();
      
      if (result.code === 0) {
        setListings(result.data.records);
        setTotal(result.data.total); // 使用后端返回的母SKU总数
        
        setSiteList(result.data.siteList);
        setCountryList(result.data.countryList || []);
        
        // 动态提取所有非重复的产品状态
        const statusList = result.data.records
          .map((record: ParentSkuData) => record.product_status)
          .filter((status: string | undefined): status is string => 
            status !== undefined && status.trim() !== ''
          );
        const uniqueStatuses = Array.from(new Set(statusList)).sort();
        
        // 设置产品状态选项（移除"无SKU数据"）
        setProductStatusOptions(uniqueStatuses);
      } else {
        message.error(result.message || '获取数据失败');
      }
    } catch (error) {
      console.error('获取Listings数据失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [queryParams]);
  
  // 获取统计数据
  const fetchStatistics = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/listings/statistics`);
      const result = await response.json();
      
      if (result.code === 0) {
        setStatistics(result.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  }, []);
  
  // 获取SKU详细映射信息
  const fetchSkuMappings = async (childSku: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/listings/${childSku}/mappings`);
      const result = await response.json();
      
      if (result.code === 0) {
        setSkuMappings(result.data.mappings);
      } else {
        message.error(result.message || '获取映射详情失败');
      }
    } catch (error) {
      console.error('获取SKU映射详情失败:', error);
      message.error('获取映射详情失败');
    }
  };
  
  // 添加SKU映射
  const handleAddMapping = async (values: AddMappingForm) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/listings/mappings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success('映射添加成功');
        setAddMappingVisible(false);
        addForm.resetFields();
        fetchListings();
        fetchStatistics();
      } else {
        message.error(result.message || '添加映射失败');
      }
    } catch (error) {
      console.error('添加映射失败:', error);
      message.error('添加映射失败');
    }
  };
  
  // 删除SKU映射
  const handleDeleteMapping = async (amzSku: string, site: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/listings/mappings/${encodeURIComponent(amzSku)}/${encodeURIComponent(site)}`,
        { method: 'DELETE' }
      );
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success('映射删除成功');
        fetchListings();
        fetchStatistics();
        if (selectedSku && selectedSku.child_sku) {
          fetchSkuMappings(selectedSku.child_sku);
        }
      } else {
        message.error(result.message || '删除映射失败');
      }
    } catch (error) {
      console.error('删除映射失败:', error);
      message.error('删除映射失败');
    }
  };
  
  // 批量导入处理
  const handleBatchImport = async (mappings: BatchMappingData[]) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/listings/mappings/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mappings }),
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        message.success(`批量导入完成: 成功${result.data.successCount}条, 失败${result.data.failureCount}条`);
        setBatchImportVisible(false);
        fetchListings();
        fetchStatistics();
      } else {
        message.error(result.message || '批量导入失败');
      }
    } catch (error) {
      console.error('批量导入失败:', error);
      message.error('批量导入失败');
    }
  };
  
  // 导出数据
  const handleExport = () => {
    const mainCountries = ['美国', '加拿大', '英国', '澳大利亚', '阿联酋'];
    
    const csvData = listings.map(sku => {
      const baseData = {
        母SKU: sku.parent_sku,
        状态: sku.product_status || '',
        产品链接: sku.weblink || '',
        子SKU: sku.child_sku,
        颜色: sku.sellercolorname || '',
        尺寸: sku.sellersizename || '',
        装箱数量: sku.qty_per_box || '',
      };
      
      // 添加每个国家的Amazon SKU信息
      const countryData: any = {};
      mainCountries.forEach(country => {
        const status = sku.countryStatus[country];
        if (status?.isListed && status.mappings.length > 0) {
          countryData[country] = status.mappings.map(m => m.amzSku).join(';');
        } else {
          countryData[country] = '';
        }
      });
      
      return {
        ...baseData,
        ...countryData,
        上架状态: sku.listingStatus === 'listed' ? '全部上架' : 
                  sku.listingStatus === 'partial' ? '部分上架' : '未上架',
        上架率: `${sku.listingRate}%`,
        上架国家数: `${sku.listedCount}/${sku.totalCountries}`
      };
    });
    
    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `listings_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 批量删除SKU记录
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的记录');
      return;
    }

    let deleteParentSku = true; // 默认开启删除母SKU

    const modalContent = (
      <div>
        <p style={{ marginBottom: 16 }}>确定要删除选中的 {selectedRowKeys.length} 条记录吗？此操作不可恢复。</p>
        <div style={{ padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '6px', border: '1px solid #e8e8e8' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>同时删除母SKU在product_weblink表中的记录</span>
            <Switch
              defaultChecked={true}
              onChange={(checked) => { deleteParentSku = checked; }}
            />
          </div>
          <div style={{ fontSize: 12, color: '#666', lineHeight: 1.4 }}>
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: '#52c41a' }}>• 开启：</span>同时删除SKU记录和对应的母SKU记录
            </div>
            <div>
              <span style={{ color: '#faad14' }}>• 关闭：</span>仅删除选中的SKU记录，保留母SKU记录
            </div>
          </div>
        </div>
      </div>
    );

    Modal.confirm({
      title: '确认删除',
      content: modalContent,
      okType: 'danger',
      width: 480,
      onOk: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/listings/batch-delete`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              skuids: selectedRowKeys.filter(key => !key.startsWith('parent-')),
              deleteParentSku: deleteParentSku 
            }),
          });

          const result = await response.json();

          if (result.code === 0) {
            message.success(result.message);
            setSelectedRowKeys([]);
            setSelectedRows([]);
            fetchListings();
            fetchStatistics();
          } else {
            message.error(result.message || '删除失败');
          }
        } catch (error) {
          console.error('批量删除失败:', error);
          message.error('删除失败');
        }
      }
    });
  };

  // 处理行选择
  const handleRowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: any[], newSelectedRows: any[]) => {
      // 只保留子SKU的keys，过滤掉parent-开头的keys
      const childKeys = newSelectedRowKeys.filter(key => !key.startsWith('parent-'));
      const childRows = newSelectedRows.filter(row => row && !row.isParentRow);
      
      setSelectedRowKeys(childKeys);
      setSelectedRows(childRows);
    },
    onSelect: (record: ExpandedParentSkuData, selected: boolean) => {
      const key = record.key!;
      
      if (record.isParentRow) {
        // 选择母SKU时，选择/取消选择所有子SKU
        const childKeys = record.childSkus?.map(child => child.skuid || `child-${child.child_sku}`).filter(Boolean) || [];
        
        if (selected) {
          // 添加所有子SKU到选择列表
          const newKeys = Array.from(new Set([...selectedRowKeys, ...childKeys]));
          const newRows = [...selectedRows];
          
          // 确保添加所有子SKU记录
          record.childSkus?.forEach(childSku => {
            const childKey = childSku.skuid || `child-${childSku.child_sku}`;
            if (!newRows.some(row => (row.skuid || `child-${row.child_sku}`) === childKey)) {
              newRows.push(childSku);
            }
          });
          
          setSelectedRowKeys(newKeys);
          setSelectedRows(newRows);
        } else {
          // 移除所有子SKU
          const newKeys = selectedRowKeys.filter(k => !childKeys.includes(k));
          const newRows = selectedRows.filter(row => {
            const rowKey = row.skuid || `child-${row.child_sku}`;
            return !childKeys.includes(rowKey);
          });
          setSelectedRowKeys(newKeys);
          setSelectedRows(newRows);
        }
      } else {
        // 选择子SKU
        if (selected) {
          setSelectedRowKeys([...selectedRowKeys, key]);
          setSelectedRows([...selectedRows, record]);
        } else {
          setSelectedRowKeys(selectedRowKeys.filter(k => k !== key));
          setSelectedRows(selectedRows.filter(row => (row.skuid || `child-${row.child_sku}`) !== key));
        }
      }
    },
    getCheckboxProps: (record: ExpandedParentSkuData) => {
      if (record.isParentRow) {
        // 母SKU复选框状态
        const childKeys = record.childSkus?.map(child => child.skuid || `child-${child.child_sku}`).filter(Boolean) || [];
        const selectedChildKeys = selectedRowKeys.filter(key => childKeys.includes(key));
        
        if (selectedChildKeys.length === 0) {
          // 没有子SKU被选中
          return { checked: false, indeterminate: false };
        } else if (selectedChildKeys.length === childKeys.length) {
          // 所有子SKU都被选中
          return { checked: true, indeterminate: false };
        } else {
          // 部分子SKU被选中
          return { checked: false, indeterminate: true };
        }
      }
      return {};
    },
  };

  // 数据一致性检查
  const handleConsistencyCheck = async () => {
    setConsistencyLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/listings/data-consistency-check`);
      const result = await response.json();
      
      if (result.code === 0) {
        setConsistencyData(result.data);
        setConsistencyCheckVisible(true);
        message.success('数据一致性检查完成');
      } else {
        message.error(result.message || '检查失败');
      }
    } catch (error) {
      console.error('一致性检查失败:', error);
      message.error('检查失败');
    } finally {
      setConsistencyLoading(false);
    }
  };

  // 数据同步
  const handleDataSync = async (action: string, parentSkus: string[]) => {
    if (parentSkus.length === 0) {
      message.warning('请选择要同步的记录');
      return;
    }

    Modal.confirm({
      title: '确认数据同步',
      content: `确定要${action === 'create_weblink' ? '创建产品链接记录' : `删除选中的 ${parentSkus.length} 条孤立记录`}吗？`,
      onOk: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/listings/sync-data`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action, parentSkus }),
          });

          const result = await response.json();

          if (result.code === 0) {
            message.success(`数据同步完成: ${result.data.created || result.data.deleted} 条记录`);
            fetchListings();
            fetchStatistics();
            handleConsistencyCheck(); // 重新检查一致性
            if (action === 'delete_orphan') {
              setSelectedOrphanRows([]); // 清空选择
            }
          } else {
            message.error(result.message || '同步失败');
          }
        } catch (error) {
          console.error('数据同步失败:', error);
          message.error('同步失败');
        }
      }
    });
  };

  // 批量打开链接
  const handleBatchOpenLinks = (records: any[]) => {
    const linksToOpen = records
      .filter(record => record.weblink && record.weblink.trim() !== '')
      .map(record => record.weblink);
    
    if (linksToOpen.length === 0) {
      message.warning('没有可打开的链接');
      return;
    }

    if (linksToOpen.length > 10) {
      Modal.confirm({
        title: '批量打开链接',
        content: `即将打开 ${linksToOpen.length} 个链接，可能会被浏览器拦截。是否继续？`,
        onOk: () => {
          linksToOpen.forEach(link => {
            window.open(link, '_blank');
          });
          message.success(`已尝试打开 ${linksToOpen.length} 个链接`);
        }
      });
    } else {
      linksToOpen.forEach(link => {
        window.open(link, '_blank');
      });
      message.success(`已打开 ${linksToOpen.length} 个链接`);
    }
  };
  
  // 查看SKU详情
  const handleViewSkuDetail = (sku: ParentSkuData) => {
    setSelectedSku(sku);
    setSkuDetailVisible(true);
    if (sku.child_sku) {
      fetchSkuMappings(sku.child_sku);
    }
  };
  
  // 更新查询参数
  const updateQueryParams = (newParams: Partial<ListingsQueryParams>) => {
    setQueryParams(prev => ({ ...prev, ...newParams, page: 1 }));
  };
  
  // 分页处理
  const handlePageChange = (page: number, pageSize?: number) => {
    setQueryParams(prev => ({ ...prev, page, limit: pageSize || prev.limit }));
  };
  
  // 获取上架率样式类名
  const getListingRateClass = (rate: number) => {
    if (rate >= 80) return 'high';
    if (rate >= 40) return 'medium';
    return 'low';
  };

  // 计算母SKU的汇总数据
  const calculateParentSkuSummary = (parentSku: string, childSkus: ParentSkuData[]) => {
    const colors = new Set(childSkus.map(sku => sku.sellercolorname).filter(Boolean));
    const sizes = new Set(childSkus.map(sku => sku.sellersizename).filter(Boolean));
    
    let totalListedCount = 0;
    let totalCountries = 0;
    let totalSkuCount = childSkus.length;
    
    // 汇总各国上架情况
    const countrySummary: Record<string, { listedCount: number, totalCount: number }> = {};
    const mainCountries = ['美国', '加拿大', '英国', '澳大利亚', '阿联酋'];
    
    mainCountries.forEach(country => {
      countrySummary[country] = { listedCount: 0, totalCount: totalSkuCount };
    });
    
    childSkus.forEach(sku => {
      totalListedCount += sku.listedCount;
      totalCountries = Math.max(totalCountries, sku.totalCountries);
      
      mainCountries.forEach(country => {
        const status = sku.countryStatus[country];
        if (status?.isListed && status.mappings.length > 0) {
          countrySummary[country].listedCount++;
        }
      });
    });

    // 计算总上架进度
    const averageListingRate = Math.round((totalListedCount / (childSkus.length * totalCountries)) * 100);

    return {
      colorCount: colors.size,
      sizeCount: sizes.size,
      totalListedCount,
      totalCountries,
      totalSkuCount,
      countrySummary,
      averageListingRate
    };
  };

  // 获取层级化数据
  const getHierarchicalData = (): ExpandedParentSkuData[] => {
    // 先应用产品状态筛选
    let filteredListings = listings;
    if (productStatusFilter && productStatusFilter !== 'all') {
      filteredListings = listings.filter(item => item.product_status === productStatusFilter);
    }

    const groupedData = new Map<string, ParentSkuData[]>();
    
    // 按母SKU分组
    filteredListings.forEach(item => {
      const parentSku = item.parent_sku;
      if (!groupedData.has(parentSku)) {
        groupedData.set(parentSku, []);
      }
      groupedData.get(parentSku)!.push(item);
    });

    const hierarchicalData: ExpandedParentSkuData[] = [];

    // 为每个母SKU创建层级结构
    groupedData.forEach((childSkus, parentSku) => {
      const firstChild = childSkus[0];
      const summary = calculateParentSkuSummary(parentSku, childSkus);

      // 创建母SKU行
      const parentRow: ExpandedParentSkuData = {
        ...firstChild,
        key: `parent-${parentSku}`,
        isParentRow: true,
        childSkus,
        colorCount: summary.colorCount,
        sizeCount: summary.sizeCount,
        totalListedCount: summary.totalListedCount,
        totalSkuCount: summary.totalSkuCount,
        listingRate: summary.averageListingRate,
        listedCount: summary.totalListedCount,
        countryStatus: {} // 母SKU行将特殊处理country status
      };

      // 为母SKU行设置国家状态汇总
      const mainCountries = ['美国', '加拿大', '英国', '澳大利亚', '阿联酋'];
      mainCountries.forEach(country => {
        const countrySummaryData = summary.countrySummary[country];
        parentRow.countryStatus[country] = {
          isListed: countrySummaryData.listedCount > 0,
          mappings: [{
            amzSku: `${countrySummaryData.listedCount}/${countrySummaryData.totalCount}`,
            site: 'summary',
            skuType: 'summary',
            updateTime: ''
          }]
        };
      });

      hierarchicalData.push(parentRow);

      // 如果该母SKU已展开，添加子SKU行
      if (expandedRowKeys.includes(`parent-${parentSku}`)) {
        childSkus.forEach(childSku => {
          hierarchicalData.push({
            ...childSku,
            key: childSku.skuid || `child-${childSku.child_sku}`
          });
        });
      }
    });

    return hierarchicalData;
  };

  // 处理行展开/收缩
  const handleExpand = (expanded: boolean, record: ExpandedParentSkuData) => {
    const key = record.key!;
    if (expanded) {
      setExpandedRowKeys([...expandedRowKeys, key]);
    } else {
      setExpandedRowKeys(expandedRowKeys.filter(k => k !== key));
    }
  };

  // 渲染国家状态内容
  const renderCountryStatus = (record: ExpandedParentSkuData, country: string) => {
    if (record.isParentRow) {
      // 母SKU行显示汇总信息
      const countryData = record.countryStatus[country];
      if (countryData && countryData.mappings.length > 0) {
        const summaryText = countryData.mappings[0].amzSku; // 格式：已上架/总数
        return (
          <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: '#1890ff' }}>
            {summaryText}
          </div>
        );
      }
      return <span style={{ color: '#ccc', fontSize: 12, textAlign: 'center', display: 'block' }}>0/{record.totalSkuCount}</span>;
    } else {
      // 子SKU行显示具体的Amazon SKU
      const countryStatus = record.countryStatus;
      if (!countryStatus) {
        return <span style={{ color: '#ccc', fontSize: 12, textAlign: 'center', display: 'block' }}>-</span>;
      }
      
      const status = countryStatus[country];
      
      if (!status?.isListed || !status.mappings || status.mappings.length === 0) {
        return <span style={{ color: '#ccc', fontSize: 12, textAlign: 'center', display: 'block' }}>-</span>;
      }

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
          {status.mappings.map((mapping: any, index: number) => (
            <Tooltip
              key={`${mapping.amzSku}-${index}`}
              title={`站点: ${mapping.site} | 类型: ${mapping.skuType} | 更新时间: ${mapping.updateTime ? new Date(mapping.updateTime).toLocaleDateString() : '-'}`}
            >
            <Tag
              color="blue"
              style={{ 
                fontSize: 11, 
                margin: 1,
                cursor: 'pointer'
              }}
              onClick={() => handleViewSkuDetail(record)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{mapping.amzSku}</span>
                {(mapping.quantity !== null && mapping.quantity !== undefined) && (
                  <span 
                    style={{ 
                      fontSize: 10, 
                      padding: '1px 4px',
                      background: mapping.isFbaSku ? '#e6f7ff' : '#fff7e6',
                      color: mapping.isFbaSku ? '#1890ff' : '#fa8c16',
                      borderRadius: 2,
                      fontWeight: 'bold'
                    }}
                    title={mapping.isFbaSku ? 'FBA库存 (AFN可售数量)' : 'Listing库存数量'}
                  >
                    {mapping.quantity}
                  </span>
                )}
              </div>
            </Tag>
            </Tooltip>
          ))}
        </div>
      );
    }
  };

  // 表格列配置
  const getColumns = () => {
    const mainCountries = ['美国', '加拿大', '英国', '澳大利亚', '阿联酋'];
    
    const baseColumns = [
      {
        title: <div style={{ textAlign: 'center' }}>SKU</div>,
        dataIndex: 'sku',
        key: 'sku',
        width: 150,
        fixed: 'left' as const,
        align: 'center' as const,
        render: (text: any, record: ExpandedParentSkuData) => {
          if (record.isParentRow) {
            // 母SKU行
            return (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Button
                  type="text"
                  size="small"
                  icon={expandedRowKeys.includes(record.key!) ? <DownOutlined /> : <RightOutlined />}
                  onClick={() => handleExpand(!expandedRowKeys.includes(record.key!), record)}
                  style={{ padding: 0, minWidth: 16, height: 16 }}
                />
                <span
                  style={{ 
                    color: record.weblink ? '#1890ff' : 'inherit',
                    cursor: record.weblink ? 'pointer' : 'default',
                    textDecoration: record.weblink ? 'underline' : 'none',
                    fontWeight: 'bold'
                  }}
                  onClick={() => {
                    if (record.weblink) {
                      window.open(record.weblink, '_blank');
                    }
                  }}
                  title={record.weblink ? '点击打开产品链接' : '无产品链接'}
                >
                  {record.parent_sku}
                </span>
              </div>
            );
          } else {
            // 子SKU行
            return (
              <div style={{ textAlign: 'center', fontSize: 12, color: '#666' }}>
                {record.child_sku}
              </div>
            );
          }
        },
      },
      {
        title: <div style={{ textAlign: 'center' }}>状态</div>,
        dataIndex: 'listingStatus',
        key: 'listingStatus',
        width: 120,
        align: 'center' as const,
        render: (status: string, record: ExpandedParentSkuData) => {
          if (!record.isParentRow) {
            // 子SKU行显示具体上架状态
            const statusMap = {
              'listed': { color: 'success', text: '全部上架' },
              'partial': { color: 'warning', text: '部分上架' },
              'unlisted': { color: 'default', text: '未上架' }
            };
            const config = statusMap[status as keyof typeof statusMap];
            return <Tag color={config.color} style={{ fontSize: 11 }}>{config.text}</Tag>;
          } else {
            // 母SKU行显示产品状态和上架状态汇总
            const listedCount = record.childSkus?.filter(child => child.listingStatus === 'listed').length || 0;
            const partialCount = record.childSkus?.filter(child => child.listingStatus === 'partial').length || 0;
            const totalCount = record.totalSkuCount || 0;
            
            // 产品状态
            const productStatus = record.product_status;
            let productStatusElement = null;
            
            if (productStatus) {
              const statusConfig = {
                '待审核': { color: 'orange', text: '待审核' },
                '审核通过': { color: 'green', text: '审核通过' },
                '审核拒绝': { color: 'red', text: '审核拒绝' },
                '待处理': { color: 'blue', text: '待处理' },
                '已处理': { color: 'success', text: '已处理' },
                '暂停': { color: 'default', text: '暂停' }
              };
              
              const config = statusConfig[productStatus as keyof typeof statusConfig];
              productStatusElement = config ? 
                <Tag color={config.color} style={{ marginBottom: 4 }}>{config.text}</Tag> : 
                <Tag style={{ marginBottom: 4 }}>{productStatus}</Tag>;
            }
            
            return (
              <div style={{ fontSize: 12, textAlign: 'center' }}>
                {productStatusElement}
                <div style={{ color: '#52c41a' }}>全部上架: {listedCount}</div>
                <div style={{ color: '#faad14' }}>部分上架: {partialCount}</div>
                <div style={{ color: '#999' }}>未上架: {totalCount - listedCount - partialCount}</div>
                <div style={{ fontWeight: 'bold', marginTop: 2 }}>总计: {totalCount}</div>
              </div>
            );
          }
        },
      },
      {
        title: <div style={{ textAlign: 'center' }}>上架进度</div>,
        key: 'listingProgress',
        width: 150,
        align: 'center' as const,
        render: (text: any, record: ExpandedParentSkuData) => {
          if (!record.isParentRow) {
            // 子SKU行显示具体进度
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Progress
                  percent={record.listingRate}
                  size="small"
                  strokeColor={{
                    '0%': '#f5222d',
                    '50%': '#faad14',
                    '100%': '#52c41a'
                  }}
                  showInfo={false}
                  style={{ flex: 1, minWidth: 40 }}
                />
                <span style={{ fontSize: 11, minWidth: 40 }}>
                  {record.listedCount}/{record.totalCountries}
                </span>
              </div>
            );
          } else {
            // 母SKU行显示总体进度
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Progress
                  percent={record.listingRate}
                  size="small"
                  strokeColor={{
                    '0%': '#f5222d',
                    '50%': '#faad14',
                    '100%': '#52c41a'
                  }}
                  showInfo={false}
                  style={{ flex: 1, minWidth: 60 }}
                />
                <span style={{ fontSize: 12, minWidth: 60, fontWeight: 'bold' }}>
                  {record.listingRate}%
                </span>
              </div>
            );
          }
        },
      },
      {
        title: <div style={{ textAlign: 'center' }}>颜色</div>,
        dataIndex: 'sellercolorname',
        key: 'sellercolorname',
        width: 80,
        align: 'center' as const,
        render: (text: string, record: ExpandedParentSkuData) => {
          if (record.isParentRow) {
            return <div style={{ fontSize: 12, fontWeight: 'bold', color: '#1890ff' }}>
              {record.colorCount} 种颜色
            </div>;
          }
          return <span style={{ fontSize: 11 }}>{text || '-'}</span>;
        },
      },
      {
        title: <div style={{ textAlign: 'center' }}>尺寸</div>,
        dataIndex: 'sellersizename', 
        key: 'sellersizename',
        width: 80,
        align: 'center' as const,
        render: (text: string, record: ExpandedParentSkuData) => {
          if (record.isParentRow) {
            return <div style={{ fontSize: 12, fontWeight: 'bold', color: '#1890ff' }}>
              {record.sizeCount} 种尺寸
            </div>;
          }
          return <span style={{ fontSize: 11 }}>{text || '-'}</span>;
        },
      }
    ];

    // 固定生成5个主要国家列
    const countryColumns = mainCountries.map(country => ({
      title: <div style={{ textAlign: 'center' }}>{country}</div>,
      key: `country-${country}`,
      width: 120,
      align: 'center' as const,
      render: (text: any, record: ExpandedParentSkuData) => {
        return renderCountryStatus(record, country);
      },
    }));

    // 移除操作列，只返回基础列和国家列
    return [...baseColumns, ...countryColumns];
  };
  
  // 表格变化处理
  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    const { field, order } = sorter;
    if (field && order) {
      setQueryParams(prev => ({
        ...prev,
        sort_by: field,
        sort_order: order === 'ascend' ? 'ASC' : 'DESC',
        page: 1
      }));
    }
  };

  // 组件加载时获取数据
  useEffect(() => {
    fetchListings();
    fetchStatistics();
  }, [fetchListings, fetchStatistics]);

  // 监听产品状态筛选变化，自动刷新显示
  useEffect(() => {
    // 产品状态筛选变化时不需要重新请求数据，只是重新处理显示
  }, [productStatusFilter]);

  return (
    <div className="listings-page">
      {/* 页面头部 */}
      <div className="listings-header">
        <h1 className="listings-title">在线Listings管理</h1>
        
        <div className="listings-filters">
          <Search
            placeholder="搜索母SKU/子SKU/颜色/尺寸"
            value={queryParams.search}
            onChange={(e) => updateQueryParams({ search: e.target.value })}
            onSearch={() => fetchListings()}
            style={{ width: 300 }}
          />
          
          <Select
            value={productStatusFilter}
            onChange={(value) => setProductStatusFilter(value)}
            placeholder="产品状态筛选"
            style={{ width: 150 }}
          >
            <Option value="all">全部状态</Option>
            {productStatusOptions.map(status => (
              <Option key={status} value={status}>
                {status}
              </Option>
            ))}
          </Select>
          
          <Select
            value={queryParams.status}
            onChange={(value) => updateQueryParams({ status: value })}
            placeholder="上架状态筛选"
            style={{ width: 150 }}
          >
            <Option value="all">全部上架状态</Option>
            <Option value="listed">全部上架</Option>
            <Option value="partial">部分上架</Option>
            <Option value="unlisted">未上架</Option>
          </Select>
          
          <div className="batch-actions">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddMappingVisible(true)}
            >
              添加映射
            </Button>
            
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleBatchDelete}
              disabled={selectedRowKeys.length === 0}
            >
              批量删除 {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
            </Button>
            
            <Button
              icon={<UploadOutlined />}
              onClick={() => setBatchImportVisible(true)}
            >
              批量导入
            </Button>
            
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
            >
              导出数据
            </Button>
            
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                fetchListings();
                fetchStatistics();
              }}
            />
            
            <Button
              icon={<CheckOutlined />}
              loading={consistencyLoading}
              onClick={handleConsistencyCheck}
            >
              数据一致性检查
            </Button>
          </div>
        </div>
      </div>
      
      {/* 统计数据 */}
      {statistics && (
        <Card className="listings-stats">
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{statistics.totalSkus}</span>
              <span className="stat-label">总SKU数</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{statistics.mappedSkus}</span>
              <span className="stat-label">已映射SKU</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{statistics.unmappedSkus}</span>
              <span className="stat-label">未映射SKU</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{statistics.mappingRate}%</span>
              <span className="stat-label">映射率</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{statistics.totalMappings}</span>
              <span className="stat-label">总映射数</span>
            </div>
          </div>
        </Card>
      )}
      
      {/* 表格内容 */}
      <Card>
        <Table
          columns={getColumns()}
          dataSource={getHierarchicalData()}
          loading={loading}
          pagination={false}
          scroll={{ x: 1450 }}
          rowKey="key"
          rowSelection={handleRowSelection}
          onChange={handleTableChange}
          sticky={{ offsetHeader: 64 }}
          locale={{
            emptyText: <Empty description="暂无数据" />
          }}
          rowClassName={(record: ExpandedParentSkuData) => 
            record.isParentRow ? 'parent-row' : 'child-row'
          }
        />
        
        {/* 分页器 */}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Pagination
            current={queryParams.page}
            pageSize={queryParams.limit}
            total={total}
            showSizeChanger
            showQuickJumper
            showTotal={(total, range) =>
              `第 ${range[0]}-${range[1]} 个母SKU，共 ${total} 个母SKU`
            }
            pageSizeOptions={['20', '50', '100', '500']}
            defaultPageSize={50}
            onChange={handlePageChange}
          />
        </div>
      </Card>

      {/* 添加映射弹窗 */}
      <Modal
        title="添加SKU映射"
        open={addMappingVisible}
        onCancel={() => {
          setAddMappingVisible(false);
          addForm.resetFields();
          setSelectedSku(null);
        }}
        footer={null}
        width={600}
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={handleAddMapping}
        >
          <Form.Item
            label="本地SKU"
            name="local_sku"
            rules={[{ required: true, message: '请输入本地SKU' }]}
          >
            <Input placeholder="请输入本地SKU" />
          </Form.Item>
          
          <Form.Item
            label="Amazon SKU"
            name="amz_sku"
            rules={[{ required: true, message: '请输入Amazon SKU' }]}
          >
            <Input placeholder="请输入Amazon SKU" />
          </Form.Item>
          
          <Form.Item
            label="站点"
            name="site"
            rules={[{ required: true, message: '请选择站点' }]}
          >
            <Select placeholder="请选择站点">
              {siteList.map(site => (
                <Option key={site} value={site}>
                  {site}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            label="国家"
            name="country"
            rules={[{ required: true, message: '请选择国家' }]}
          >
            <Select placeholder="请选择国家">
              {['美国', '加拿大', '英国', '澳大利亚', '阿联酋'].map(country => (
                <Option key={country} value={country}>
                  {country}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            label="SKU类型"
            name="sku_type"
          >
            <Select placeholder="请选择SKU类型" defaultValue="FBA SKU">
              <Option value="FBA SKU">FBA SKU</Option>
              <Option value="Local SKU">Local SKU</Option>
            </Select>
          </Form.Item>
          
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => {
                setAddMappingVisible(false);
                addForm.resetFields();
                setSelectedSku(null);
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                添加
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      
      {/* SKU详情弹窗 */}
      <Modal
        title={`SKU详情 - ${selectedSku?.child_sku}`}
        open={skuDetailVisible}
        onCancel={() => {
          setSkuDetailVisible(false);
          setSelectedSku(null);
          setSkuMappings([]);
        }}
        footer={null}
        width={800}
      >
        {selectedSku && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <p><strong>母SKU:</strong> {selectedSku.parent_sku}</p>
              <p><strong>子SKU:</strong> {selectedSku.child_sku}</p>
              {selectedSku.sellercolorname && (
                <p><strong>颜色:</strong> {selectedSku.sellercolorname}</p>
              )}
              {selectedSku.sellersizename && (
                <p><strong>尺寸:</strong> {selectedSku.sellersizename}</p>
              )}
              {selectedSku.qty_per_box && (
                <p><strong>装箱数量:</strong> {selectedSku.qty_per_box}个</p>
              )}
            </div>
            
            <h3>站点映射详情:</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {skuMappings.map(mapping => (
                <div
                  key={`${mapping.amz_sku}-${mapping.site}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px'
                  }}
                >
                  <div>
                    <Tag color="blue">{mapping.site}</Tag>
                    <span style={{ marginRight: 8 }}>
                      <strong>Amazon SKU:</strong> {mapping.amz_sku}
                    </span>
                    <span style={{ marginRight: 8 }}>
                      <strong>国家:</strong> {mapping.country}
                    </span>
                    <span>
                      <strong>类型:</strong> {mapping.sku_type}
                    </span>
                  </div>
                  <Popconfirm
                    title="确定要删除这个映射吗？"
                    onConfirm={() => handleDeleteMapping(mapping.amz_sku, mapping.site)}
                  >
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      danger
                    />
                  </Popconfirm>
                </div>
              ))}
              {skuMappings.length === 0 && (
                <Empty description="暂无映射记录" />
              )}
            </div>
          </div>
        )}
      </Modal>
      
      {/* 批量导入弹窗 */}
      <BatchImportModal
        visible={batchImportVisible}
        onCancel={() => setBatchImportVisible(false)}
        onConfirm={handleBatchImport}
        siteList={siteList}
      />

      {/* 数据一致性检查结果弹窗 */}
      <Modal
        title="数据一致性检查结果"
        open={consistencyCheckVisible}
        onCancel={() => {
          setConsistencyCheckVisible(false);
          setSelectedOrphanRows([]); // 关闭弹窗时清空选择
        }}
        footer={null}
        width={1200}
      >
        {consistencyData && (
          <div>
            {/* 统计信息 */}
            <Card title="数据统计" size="small" style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <div>
                  <Statistic title="总SKU记录" value={consistencyData.statistics.totalSkuRecords} />
                </div>
                <div>
                  <Statistic title="总产品链接记录" value={consistencyData.statistics.totalWeblinkRecords} />
                </div>
                <div>
                  <Statistic title="一致性记录" value={consistencyData.statistics.consistentRecords} />
                </div>
                <div>
                  <Statistic title="缺少产品链接" value={consistencyData.statistics.missingWeblinkRecords} valueStyle={{ color: '#cf1322' }} />
                </div>
                <div>
                  <Statistic title="孤立产品链接" value={consistencyData.statistics.missingSkuRecords} valueStyle={{ color: '#cf1322' }} />
                </div>
                <div>
                  <Statistic title="一致性率" value={consistencyData.statistics.consistencyRate} suffix="%" valueStyle={{ color: consistencyData.statistics.consistencyRate > 80 ? '#3f8600' : '#cf1322' }} />
                </div>
              </div>
            </Card>

            {/* 缺少产品链接的SKU */}
            {consistencyData.inconsistentData.missingWeblink.length > 0 && (
              <Card title={`缺少产品链接的SKU (${consistencyData.inconsistentData.missingWeblink.length}条)`} size="small" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span>这些SKU存在于库存表中，但没有对应的产品链接</span>
                  <Button 
                    size="small" 
                    type="primary"
                    onClick={() => handleDataSync('create_weblink', consistencyData.inconsistentData.missingWeblink.map((item: any) => item.parent_sku))}
                  >
                    为所有SKU创建默认产品链接
                  </Button>
                </div>
                <Table
                  size="small"
                  dataSource={consistencyData.inconsistentData.missingWeblink}
                  rowKey="parent_sku"
                  pagination={{ pageSize: 50 }}
                  columns={[
                    { title: '母SKU', dataIndex: 'parent_sku', key: 'parent_sku' },
                    { title: '子SKU数量', dataIndex: 'sku_count', key: 'sku_count' }
                  ]}
                />
              </Card>
            )}

            {/* 孤立的产品链接 */}
            {consistencyData.inconsistentData.missingSku.length > 0 && (
              <Card title={`孤立的产品链接 (${consistencyData.inconsistentData.missingSku.length}条)`} size="small">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span>这些产品链接没有对应的SKU记录</span>
                  <Space>
                    <Button 
                      size="small" 
                      type="primary"
                      disabled={selectedOrphanRows.length === 0}
                      onClick={() => {
                        const selectedRecords = consistencyData.inconsistentData.missingSku
                          .filter((item: any) => selectedOrphanRows.includes(item.parent_sku));
                        handleBatchOpenLinks(selectedRecords);
                      }}
                    >
                      批量打开链接 ({selectedOrphanRows.length})
                    </Button>
                    <Button 
                      size="small" 
                      danger
                      disabled={selectedOrphanRows.length === 0}
                      onClick={() => handleDataSync('delete_orphan', selectedOrphanRows)}
                    >
                      删除勾选记录 ({selectedOrphanRows.length})
                    </Button>
                  </Space>
                </div>
                <Table
                  size="small"
                  dataSource={consistencyData.inconsistentData.missingSku}
                  rowKey="parent_sku"
                  pagination={{ pageSize: 50 }}
                  rowSelection={{
                    selectedRowKeys: selectedOrphanRows,
                    onChange: (selectedRowKeys: React.Key[]) => {
                      setSelectedOrphanRows(selectedRowKeys as string[]);
                    },
                  }}
                  columns={[
                    { title: '母SKU', dataIndex: 'parent_sku', key: 'parent_sku', width: 120 },
                    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (status: string) => <Tag>{status}</Tag> },
                    { 
                      title: '产品链接', 
                      dataIndex: 'weblink', 
                      key: 'weblink',
                      width: 300,
                      render: (weblink: string) => weblink ? (
                        <a href={weblink} target="_blank" rel="noopener noreferrer">
                          {weblink.length > 60 ? `${weblink.substring(0, 60)}...` : weblink}
                        </a>
                      ) : '-'
                    },
                    {
                      title: '备注',
                      dataIndex: 'notice',
                      key: 'notice',
                      width: 200,
                      render: (notice: string) => notice || '-'
                    }
                  ]}
                />
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Listings; 