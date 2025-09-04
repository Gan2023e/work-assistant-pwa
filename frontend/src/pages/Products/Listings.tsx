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
  CloseOutlined
} from '@ant-design/icons';
import { API_BASE_URL } from '../../config/api';
import BatchImportModal from '../../components/BatchImportModal';
import {
  ParentSkuData,
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
    limit: 100, // 默认每页100条
    search: '',
    site: 'all',
    status: 'all',
    sort_by: 'parent_sku',
    sort_order: 'ASC'
  });

  // 选中状态管理
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<ParentSkuData[]>([]);

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
        setTotal(result.data.total);
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
              skuids: selectedRowKeys,
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
    onChange: (newSelectedRowKeys: any[], newSelectedRows: ParentSkuData[]) => {
      // 获取当前处理后的数据（与表格数据源一致）
      const currentData = getProcessedData();
      
      // 检测新勾选的记录（相对于之前的选择）
      const previousKeys = new Set(selectedRowKeys);
      const newKeys = new Set(newSelectedRowKeys);
      
      // 找出这次新增选中的记录
      const addedKeys = newSelectedRowKeys.filter(key => !previousKeys.has(key));
      
      if (addedKeys.length > 0) {
        // 如果有新增选中的记录，需要自动选中同一母SKU下的所有记录
        let finalSelectedKeys = [...newSelectedRowKeys];
        
        addedKeys.forEach(addedKey => {
          // 找到被选中的记录
          const selectedRecord = currentData.find(record => record.skuid === addedKey);
          if (selectedRecord) {
            // 找到同一母SKU下的所有记录
            const siblingRecords = currentData.filter(record => 
              record.parent_sku === selectedRecord.parent_sku
            );
            
            // 将同一母SKU下的所有记录的skuid添加到选择列表中
            siblingRecords.forEach(sibling => {
              if (sibling.skuid !== null && sibling.skuid !== undefined && !finalSelectedKeys.includes(sibling.skuid)) {
                finalSelectedKeys.push(sibling.skuid);
              }
            });
          }
        });
        
        // 去重并更新选择状态
        const uniqueKeys = Array.from(new Set(finalSelectedKeys));
        const correspondingRows = currentData.filter(record => 
          record.skuid !== null && record.skuid !== undefined && uniqueKeys.includes(record.skuid)
        );
        
        setSelectedRowKeys(uniqueKeys);
        setSelectedRows(correspondingRows);
      } else {
        // 如果没有新增选中的记录（取消选择的情况），直接使用新的选择状态
        setSelectedRowKeys(newSelectedRowKeys);
        setSelectedRows(newSelectedRows);
      }
    },
    onSelect: (record: ParentSkuData, selected: boolean) => {
      if (selected) {
        // 当选中一个记录时，自动选中同一母SKU下的所有记录
        const currentData = getProcessedData();
        const siblingRecords = currentData.filter(item => 
          item.parent_sku === record.parent_sku
        );
        
        // 收集同一母SKU下所有记录的skuid
        const siblingKeys = siblingRecords
          .map(sibling => sibling.skuid)
          .filter((skuid): skuid is string => skuid !== null && skuid !== undefined);
        
        // 合并到现有选择中
        const newSelectedKeys = Array.from(new Set([...selectedRowKeys, ...siblingKeys]));
        const newSelectedRows = getProcessedData().filter(item => 
          item.skuid !== null && item.skuid !== undefined && newSelectedKeys.includes(item.skuid)
        );
        
        setSelectedRowKeys(newSelectedKeys);
        setSelectedRows(newSelectedRows);
      } else {
        // 取消选择时，只移除当前记录
        const newSelectedKeys = selectedRowKeys.filter(key => key !== record.skuid);
        const newSelectedRows = selectedRows.filter(row => row.skuid !== record.skuid);
        
        setSelectedRowKeys(newSelectedKeys);
        setSelectedRows(newSelectedRows);
      }
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

  // 渲染国家状态内容
  const renderCountryStatus = (countryStatus: Record<string, any>, childSku: string, country: string) => {
    // 安全检查：确保 countryStatus 存在
    if (!countryStatus) {
      return <span style={{ color: '#ccc', fontSize: 12 }}>-</span>;
    }
    
    const status = countryStatus[country];
    
    if (!status?.isListed || !status.mappings || status.mappings.length === 0) {
      return (
        <Button
          type="text"
          size="small"
          style={{ color: '#999', fontSize: 12 }}
          onClick={() => {
            const skuData = listings.find(sku => sku.child_sku === childSku);
            if (skuData) {
              setSelectedSku(skuData);
              addForm.setFieldsValue({
                local_sku: childSku,
                country: country
              });
              setAddMappingVisible(true);
            }
          }}
        >
          + 添加
        </Button>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {status.mappings.map((mapping: any, index: number) => {
          // 调试日志：检查mapping对象的结构
          if (index === 0) { // 只打印第一个mapping避免日志过多
            console.log('🔍 前端mapping对象结构:', {
              amzSku: mapping.amzSku,
              quantity: mapping.quantity,
              isFbaSku: mapping.isFbaSku,
              fulfillmentChannel: mapping.fulfillmentChannel,
              country: country
            });
          }
          
          return (
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
              onClick={() => {
                const targetSku = listings.find(sku => sku.child_sku === childSku);
                if (targetSku) {
                  handleViewSkuDetail(targetSku);
                }
              }}
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
          );
        })}
      </div>
    );
  };

  // 数据分组处理 - 计算母SKU的rowSpan
  const getProcessedData = () => {
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

    // 为每个记录添加rowSpan信息
    const processedData: (ParentSkuData & { 
      parentSkuRowSpan?: number;
      productStatusRowSpan?: number;
      listingStatusRowSpan?: number;
      listingProgressRowSpan?: number;
    })[] = [];
    
    groupedData.forEach((items, parentSku) => {
      items.forEach((item, index) => {
        processedData.push({
          ...item,
          // 只有第一行显示合并单元格
          parentSkuRowSpan: index === 0 ? items.length : 0,
          productStatusRowSpan: index === 0 ? items.length : 0,
          listingStatusRowSpan: index === 0 ? items.length : 0,
          listingProgressRowSpan: index === 0 ? items.length : 0,
        });
      });
    });

    return processedData;
  };

  // 表格列配置 - 固定5个主要国家列
  const getColumns = () => {
    // 定义5个主要国家
    const mainCountries = ['美国', '加拿大', '英国', '澳大利亚', '阿联酋'];
    
    const baseColumns = [
      {
        title: <div style={{ textAlign: 'center' }}>母SKU</div>,
        dataIndex: 'parent_sku',
        key: 'parent_sku',
        width: 120,
        fixed: 'left' as const,
        sorter: true,
        align: 'center' as const,
        render: (text: string, record: any) => {
          const obj: any = {
            children: (
              <span
                style={{ 
                  color: record.weblink ? '#1890ff' : 'inherit',
                  cursor: record.weblink ? 'pointer' : 'default',
                  textDecoration: record.weblink ? 'underline' : 'none'
                }}
                onClick={() => {
                  if (record.weblink) {
                    window.open(record.weblink, '_blank');
                  }
                }}
                title={record.weblink ? '点击打开产品链接' : '无产品链接'}
              >
                {text}
              </span>
            ),
            props: {} as any,
          };
          
          // 设置rowSpan
          if (record.parentSkuRowSpan !== undefined) {
            obj.props.rowSpan = record.parentSkuRowSpan;
          }
          
          return obj;
        },
      },
      {
        title: <div style={{ textAlign: 'center' }}>状态</div>,
        dataIndex: 'product_status',
        key: 'product_status',
        width: 100,
        align: 'center' as const,
        render: (status: string, record: any) => {
          const obj: any = {
            children: null,
            props: {} as any,
          };

          if (!status) {
            obj.children = <span style={{ color: '#999' }}>-</span>;
          } else {
            const statusConfig = {
              '待审核': { color: 'orange', text: '待审核' },
              '审核通过': { color: 'green', text: '审核通过' },
              '审核拒绝': { color: 'red', text: '审核拒绝' },
              '待处理': { color: 'blue', text: '待处理' },
              '已处理': { color: 'success', text: '已处理' },
              '暂停': { color: 'default', text: '暂停' }
            };
            
            const config = statusConfig[status as keyof typeof statusConfig];
            obj.children = config ? 
              <Tag color={config.color}>{config.text}</Tag> : 
              <Tag>{status}</Tag>;
          }
          
          // 设置rowSpan
          if (record.productStatusRowSpan !== undefined) {
            obj.props.rowSpan = record.productStatusRowSpan;
          }
          
          return obj;
        },
      },
      {
        title: <div style={{ textAlign: 'center' }}>上架状态</div>,
        dataIndex: 'listingStatus',
        key: 'listingStatus',
        width: 100,
        align: 'center' as const,
        render: (status: string, record: any) => {
          const obj: any = {
            children: null,
            props: {} as any,
          };

          const statusMap = {
            'listed': { color: 'success', text: '全部上架' },
            'partial': { color: 'warning', text: '部分上架' },
            'unlisted': { color: 'default', text: '未上架' }
          };
          const config = statusMap[status as keyof typeof statusMap];
          obj.children = <Tag color={config.color}>{config.text}</Tag>;
          
          // 设置rowSpan
          if (record.listingStatusRowSpan !== undefined) {
            obj.props.rowSpan = record.listingStatusRowSpan;
          }
          
          return obj;
        },
      },
      {
        title: <div style={{ textAlign: 'center' }}>子SKU</div>,
        dataIndex: 'child_sku',
        key: 'child_sku',
        width: 120,
        fixed: 'left' as const,
        align: 'center' as const,
      },
      {
        title: <div style={{ textAlign: 'center' }}>颜色</div>,
        dataIndex: 'sellercolorname',
        key: 'sellercolorname',
        width: 80,
        align: 'center' as const,
        render: (text: string) => text || '-',
      },
      {
        title: <div style={{ textAlign: 'center' }}>尺寸</div>,
        dataIndex: 'sellersizename', 
        key: 'sellersizename',
        width: 80,
        align: 'center' as const,
        render: (text: string) => text || '-',
      }
    ];

    // 固定生成5个主要国家列
    const countryColumns = mainCountries.map(country => ({
      title: <div style={{ textAlign: 'center' }}>{country}</div>,
      key: `country-${country}`,
      width: 120,
      align: 'center' as const,
      render: (text: any, record: ParentSkuData) => {
        // 双重安全检查
        if (!record || !record.countryStatus) {
          return <span style={{ color: '#ccc', fontSize: 12 }}>-</span>;
        }
        return renderCountryStatus(record.countryStatus, record.child_sku || '', country);
      },
    }));

    const endColumns = [
      {
        title: <div style={{ textAlign: 'center' }}>上架进度</div>,
        key: 'listingProgress',
        width: 150,
        align: 'center' as const,
        render: (text: any, record: any) => {
          const obj: any = {
            children: (
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
                <span style={{ fontSize: 12, minWidth: 60 }}>
                  {record.listedCount}/{record.totalCountries} ({record.listingRate}%)
                </span>
              </div>
            ),
            props: {} as any,
          };
          
          // 设置rowSpan
          if (record.listingProgressRowSpan !== undefined) {
            obj.props.rowSpan = record.listingProgressRowSpan;
          }
          
          return obj;
        },
      },
      {
        title: <div style={{ textAlign: 'center' }}>操作</div>,
        key: 'actions',
        width: 120,
        fixed: 'right' as const,
        align: 'center' as const,
        render: (text: any, record: ParentSkuData) => (
          <Space size="small">
            <Tooltip title="查看详情">
              <Button
                type="text"
                icon={<EyeOutlined />}
                onClick={() => handleViewSkuDetail(record)}
              />
            </Tooltip>
            <Tooltip title="添加映射">
              <Button
                type="text"
                icon={<PlusOutlined />}
                onClick={() => {
                  setSelectedSku(record);
                  addForm.setFieldsValue({ local_sku: record.child_sku });
                  setAddMappingVisible(true);
                }}
              />
            </Tooltip>
          </Space>
        ),
      },
    ];

    return [...baseColumns, ...countryColumns, ...endColumns];
  };
  
  // 组件加载时获取数据
  useEffect(() => {
    fetchListings();
    fetchStatistics();
  }, [fetchListings, fetchStatistics]);

  // 监听产品状态筛选变化，自动刷新显示
  useEffect(() => {
    // 产品状态筛选变化时不需要重新请求数据，只是重新处理显示
    // 因为getProcessedData()函数已经处理了筛选逻辑
  }, [productStatusFilter]);

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
          dataSource={getProcessedData()} // 使用处理后的数据支持合并单元格
          loading={loading}
          pagination={false}
          scroll={{ x: 1450 }}
          rowKey="skuid"
          rowSelection={handleRowSelection} // 添加行选择
          onChange={handleTableChange}
          sticky={{ offsetHeader: 64 }} // 固定表头
          locale={{
            emptyText: <Empty description="暂无数据" />
          }}
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
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
            }
            pageSizeOptions={['20', '50', '100', '500']}
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