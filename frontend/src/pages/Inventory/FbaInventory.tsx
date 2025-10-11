import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, 
  Button, 
  Select, 
  message, 
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Form,
  Input,
  Tooltip,
  Badge,
  Modal,
  Space,
  Popconfirm,
  ColorPicker
} from 'antd';
import { 
  CopyOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
  ReloadOutlined,
  FileExcelOutlined,
  BarChartOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TagsOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';

const { Option } = Select;
const { Title, Text } = Typography;

// 根据实际数据库表结构定义接口
interface FbaInventoryRecord {
  sku: string;
  fnsku?: string;
  asin?: string;
  'product-name'?: string;
  condition?: string;
  'your-price'?: number;
  'mfn-listing-exists'?: string;
  'mfn-fulfillable-quantity'?: string;
  'afn-listing-exists'?: string;
  'afn-warehouse-quantity'?: number;
  'afn-fulfillable-quantity'?: number;
  'afn-unsellable-quantity'?: number;
  'afn-reserved-quantity'?: number;
  'afn-total-quantity'?: number;
  'per-unit-volume'?: number;
  'afn-inbound-working-quantity'?: number;
  'afn-inbound-shipped-quantity'?: number;
  'afn-inbound-receiving-quantity'?: number;
  'afn-researching-quantity'?: number;
  'afn-reserved-future-supply'?: number;
  'afn-future-supply-buyable'?: number;
  site: string;
  'afn-fulfillable-quantity-local'?: number;
  'afn-fulfillable-quantity-remote'?: number;
  store?: string;
}

interface FbaInventoryStats {
  total_skus: number;
  total_afn_fulfillable: number;
  total_afn_reserved: number;
  total_afn_inbound: number;
  by_site: Array<{
    site: string;
    sku_count: number;
    total_afn_fulfillable: number;
    total_afn_reserved: number;
    total_afn_inbound: number;
  }>;
  by_store: Array<{
    store: string;
    sku_count: number;
    total_afn_fulfillable: number;
    total_afn_reserved: number;
    total_afn_inbound: number;
  }>;
}

interface CustomCategory {
  id: number;
  name: string;
  description: string;
  color: string;
  sku_count: number;
  total_quantity: number;
  created_at: string;
  updated_at: string;
}

const FbaInventory: React.FC = () => {
  const [records, setRecords] = useState<FbaInventoryRecord[]>([]);
  const [stats, setStats] = useState<FbaInventoryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // 搜索和筛选状态
  const [searchFilters, setSearchFilters] = useState({
    sku: '',
    site: ''
  });

  // 分页状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  // 站点列表
  const [sites, setSites] = useState<string[]>([]);

  // 自定义类目相关状态
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CustomCategory | null>(null);
  const [categoryForm] = Form.useForm();
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [categorySkus, setCategorySkus] = useState<FbaInventoryRecord[]>([]);
  const [categorySkusLoading, setCategorySkusLoading] = useState(false);

  // 批量操作相关状态
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchCategoryModalVisible, setBatchCategoryModalVisible] = useState(false);
  const [batchCategoryForm] = Form.useForm();

  // 搜索表单状态
  const [searchType, setSearchType] = useState<string>('sku');
  const [searchSite, setSearchSite] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');

  // 加载数据
  const fetchData = useCallback(async (page: number = 1, pageSize: number = 20) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...searchFilters
      });

      console.log('发送搜索请求，参数:', Object.fromEntries(params));
      console.log('当前searchFilters:', searchFilters);

      const response = await fetch(`${API_BASE_URL}/api/fba-inventory?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        setRecords(result.data.records);
        setPagination({
          current: result.data.current,
          pageSize: result.data.pageSize,
          total: result.data.total
        });
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error('获取FBA库存数据失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [searchFilters]);

  // 使用指定搜索参数加载数据
  const fetchDataWithFilters = useCallback(async (page: number = 1, pageSize: number = 20, filters: any) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...filters
      });

      console.log('发送搜索请求，参数:', Object.fromEntries(params));
      console.log('使用filters:', filters);

      const response = await fetch(`${API_BASE_URL}/api/fba-inventory?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        setRecords(result.data.records);
        setPagination({
          current: result.data.current,
          pageSize: result.data.pageSize,
          total: result.data.total
        });
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error('获取FBA库存数据失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载统计数据
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/fba-inventory/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  }, []);

  // 加载站点列表
  const fetchSites = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/fba-inventory/sites-stores`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        setSites(result.data.sites || []);
      }
    } catch (error) {
      console.error('获取站点数据失败:', error);
    }
  }, []);

  // 加载自定义类目
  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/fba-inventory/categories/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        setCategories(result.data);
      }
    } catch (error) {
      console.error('获取自定义类目失败:', error);
    }
  }, []);

  // 创建或更新类目
  const handleCategorySubmit = async (values: any) => {
    try {
      const url = editingCategory 
        ? `${API_BASE_URL}/api/fba-inventory/categories/${editingCategory.id}`
        : `${API_BASE_URL}/api/fba-inventory/categories`;
      
      const method = editingCategory ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(values)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        message.success(editingCategory ? '更新成功' : '创建成功');
        setCategoryModalVisible(false);
        setEditingCategory(null);
        categoryForm.resetFields();
        fetchCategories();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error('保存类目失败:', error);
      message.error('保存失败');
    }
  };

  // 删除类目
  const handleDeleteCategory = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/fba-inventory/categories/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        message.success('删除成功');
        fetchCategories();
        if (selectedCategory === id) {
          setSelectedCategory(null);
          setCategorySkus([]);
        }
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error('删除类目失败:', error);
      message.error('删除失败');
    }
  };

  // 获取类目下的SKU列表
  const fetchCategorySkus = useCallback(async (categoryId: number) => {
    setCategorySkusLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/fba-inventory/categories/${categoryId}/skus`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        const skus = result.data.records.map((item: any) => item.fbaInventory).filter(Boolean);
        setCategorySkus(skus);
      }
    } catch (error) {
      console.error('获取类目SKU失败:', error);
      message.error('获取数据失败');
    } finally {
      setCategorySkusLoading(false);
    }
  }, []);

  // 点击类目卡片
  const handleCategoryClick = (category: CustomCategory) => {
    setSelectedCategory(category.id);
    fetchCategorySkus(category.id);
  };

  // 批量分配类目
  const handleBatchAssignCategory = async (values: any) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要分配类目的记录');
      return;
    }

    try {
      const { category_id } = values;
      const currentData = selectedCategory ? categorySkus : records;
      const selectedRecords = currentData.filter(record => 
        selectedRowKeys.includes(`${record.sku}-${record.site}`)
      );

      let successCount = 0;
      let errorCount = 0;

      for (const record of selectedRecords) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/fba-inventory/categories/assign`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              sku: record.sku,
              site: record.site,
              category_id: category_id
            })
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      if (successCount > 0) {
        message.success(`成功分配 ${successCount} 条记录到类目`);
        setSelectedRowKeys([]);
        setBatchCategoryModalVisible(false);
        batchCategoryForm.resetFields();
        fetchCategories(); // 刷新类目统计
        if (selectedCategory) {
          fetchCategorySkus(selectedCategory); // 刷新当前类目的SKU列表
        }
      }

      if (errorCount > 0) {
        message.warning(`${errorCount} 条记录分配失败`);
      }
    } catch (error) {
      console.error('批量分配类目失败:', error);
      message.error('批量分配失败');
    }
  };

  // 批量移除类目
  const handleBatchRemoveCategory = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要移除类目的记录');
      return;
    }

    try {
      const currentData = selectedCategory ? categorySkus : records;
      const selectedRecords = currentData.filter(record => 
        selectedRowKeys.includes(`${record.sku}-${record.site}`)
      );

      let successCount = 0;
      let errorCount = 0;

      for (const record of selectedRecords) {
        try {
          // 这里需要先获取记录当前的类目ID，然后移除
          // 由于当前API设计，我们需要先查询记录属于哪些类目
          const response = await fetch(`${API_BASE_URL}/api/fba-inventory/categories/assign?sku=${record.sku}&site=${record.site}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      if (successCount > 0) {
        message.success(`成功移除 ${successCount} 条记录的类目分配`);
        setSelectedRowKeys([]);
        fetchCategories(); // 刷新类目统计
        if (selectedCategory) {
          fetchCategorySkus(selectedCategory); // 刷新当前类目的SKU列表
        }
      }

      if (errorCount > 0) {
        message.warning(`${errorCount} 条记录移除失败`);
      }
    } catch (error) {
      console.error('批量移除类目失败:', error);
      message.error('批量移除失败');
    }
  };

  // 初始化加载
  useEffect(() => {
    fetchData();
    fetchStats();
    fetchSites();
    fetchCategories();
  }, [fetchData, fetchStats, fetchSites, fetchCategories]);

  // 表格列定义 - 删除商品状态和店铺列
  const columns: ColumnsType<FbaInventoryRecord> = [
    {
      title: (
        <input
          type="checkbox"
          checked={selectedRowKeys.length > 0 && selectedRowKeys.length === (selectedCategory ? categorySkus.length : records.length)}
          onChange={(e) => {
            const currentData = selectedCategory ? categorySkus : records;
            if (e.target.checked) {
              // 全选
              const allKeys = currentData.map(record => `${record.sku}-${record.site}`);
              setSelectedRowKeys(allKeys);
            } else {
              // 取消全选
              setSelectedRowKeys([]);
            }
          }}
        />
      ),
      key: 'selection',
      width: 50,
      fixed: 'left',
      render: (_, record) => (
        <input
          type="checkbox"
          checked={selectedRowKeys.includes(`${record.sku}-${record.site}`)}
          onChange={(e) => {
            const key = `${record.sku}-${record.site}`;
            if (e.target.checked) {
              setSelectedRowKeys([...selectedRowKeys, key]);
            } else {
              setSelectedRowKeys(selectedRowKeys.filter(k => k !== key));
            }
          }}
        />
      )
    },
    {
      title: '产品标识',
      key: 'product-identifiers',
      width: 100,
      fixed: 'left',
      render: (_, record) => {
        const sku = record.sku || '';
        const fnsku = record.fnsku || '';
        const asin = record.asin || '';
        
        return (
          <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
            {/* SKU */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '4px',
              padding: '2px 4px',
              backgroundColor: '#f0f8ff',
              borderRadius: '4px'
            }}>
              <span style={{ color: '#1890ff', fontWeight: 'bold', fontSize: '11px' }}>SKU:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontWeight: '500' }}>{sku || 'N/A'}</span>
                {sku && (
                  <Tooltip title="复制SKU">
                    <CopyOutlined 
                      style={{ 
                        color: '#1890ff', 
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                      onClick={() => copyToClipboard(sku, 'SKU')}
                    />
                  </Tooltip>
                )}
              </div>
            </div>
            
            {/* FNSKU */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '4px',
              padding: '2px 4px',
              backgroundColor: '#f6ffed',
              borderRadius: '4px'
            }}>
              <span style={{ color: '#52c41a', fontWeight: 'bold', fontSize: '11px' }}>FNSKU:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontWeight: '500' }}>{fnsku || 'N/A'}</span>
                {fnsku && (
                  <Tooltip title="复制FNSKU">
                    <CopyOutlined 
                      style={{ 
                        color: '#52c41a', 
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                      onClick={() => copyToClipboard(fnsku, 'FNSKU')}
                    />
                  </Tooltip>
                )}
              </div>
            </div>
            
            {/* ASIN */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '2px',
              padding: '2px 4px',
              backgroundColor: '#fff7e6',
              borderRadius: '4px'
            }}>
              <span style={{ color: '#faad14', fontWeight: 'bold', fontSize: '11px' }}>ASIN:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontWeight: '500' }}>{asin || 'N/A'}</span>
                {asin && (
                  <Tooltip title="复制ASIN">
                    <CopyOutlined 
                      style={{ 
                        color: '#faad14', 
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                      onClick={() => copyToClipboard(asin, 'ASIN')}
                    />
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        );
      }
    },
    {
      title: '产品名称',
      dataIndex: 'product-name',
      key: 'product-name',
      width: 120,
      align: 'center',
      ellipsis: {
        showTitle: false,
      },
      render: (text) => {
        if (!text) return '-';
        
        // 提取括号中的内容
        const bracketMatch = text.match(/\(([^)]+)\)/);
        const displayText = bracketMatch ? bracketMatch[1] : text;
        
        return (
          <Tooltip placement="topLeft" title={text}>
            <span style={{ 
              fontSize: '12px',
              fontWeight: '500',
              color: '#1890ff',
              cursor: 'pointer',
              textAlign: 'center',
              display: 'block'
            }}>
              {displayText}
            </span>
          </Tooltip>
        );
      }
    },
    {
      title: '售价',
      dataIndex: 'your-price',
      key: 'your-price',
      width: 80,
      align: 'right',
      render: (value) => value ? `$${Number(value).toFixed(2)}` : '-'
    },
    {
      title: '站点',
      dataIndex: 'site',
      key: 'site',
      width: 90,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: 'AFN库存详情',
      key: 'afn-details',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const fulfillable = record['afn-fulfillable-quantity'] || 0;
        const warehouse = record['afn-warehouse-quantity'] || 0;
        const reserved = record['afn-reserved-quantity'] || 0;
        const unsellable = record['afn-unsellable-quantity'] || 0;
        const total = record['afn-total-quantity'] || 0;
        
        return (
          <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: '#666' }}>可售:</span>
              <Badge 
                count={fulfillable} 
                overflowCount={9999}
                style={{ 
                  backgroundColor: fulfillable > 0 ? '#52c41a' : '#f5222d',
                  fontSize: '11px',
                  minWidth: '20px',
                  height: '16px',
                  lineHeight: '16px'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: '#666' }}>仓库:</span>
              <span style={{ fontWeight: '500' }}>{warehouse}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: '#666' }}>预留:</span>
              <span style={{ fontWeight: '500' }}>{reserved}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: '#666' }}>不可售:</span>
              <span style={{ fontWeight: '500', color: unsellable > 0 ? '#f5222d' : '#666' }}>{unsellable}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              borderTop: '1px solid #f0f0f0', 
              paddingTop: '2px',
              marginTop: '2px'
            }}>
              <span style={{ color: '#1890ff', fontWeight: 'bold' }}>总计:</span>
              <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{total}</span>
            </div>
          </div>
        );
      }
    },
    {
      title: '入库状态',
      key: 'inbound-status',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const working = record['afn-inbound-working-quantity'] || 0;
        const shipped = record['afn-inbound-shipped-quantity'] || 0;
        const receiving = record['afn-inbound-receiving-quantity'] || 0;
        
        return (
          <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: '#666' }}>处理中:</span>
              <span style={{ 
                fontWeight: '500', 
                color: working > 0 ? '#1890ff' : '#999' 
              }}>
                {working}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: '#666' }}>运输中:</span>
              <span style={{ 
                fontWeight: '500', 
                color: shipped > 0 ? '#faad14' : '#999' 
              }}>
                {shipped}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: '#666' }}>接收中:</span>
              <span style={{ 
                fontWeight: '500', 
                color: receiving > 0 ? '#52c41a' : '#999' 
              }}>
                {receiving}
              </span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              borderTop: '1px solid #f0f0f0', 
              paddingTop: '2px',
              marginTop: '2px'
            }}>
              <span style={{ color: '#1890ff', fontWeight: 'bold' }}>总计:</span>
              <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                {working + shipped + receiving}
              </span>
            </div>
          </div>
        );
      }
    },
    {
      title: '单位体积',
      dataIndex: 'per-unit-volume',
      key: 'per-unit-volume',
      width: 100,
      align: 'right',
      render: (value) => value ? `${Number(value).toFixed(2)}` : '-'
    },
    {
      title: 'Listing状态',
      key: 'listing-status',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const mfnStatus = record['mfn-listing-exists'];
        const afnStatus = record['afn-listing-exists'];
        
        const getMfnColor = (status: string | undefined) => {
          if (status === 'Yes') return 'green';
          if (status === 'No') return 'red';
          return 'default';
        };
        
        const getAfnColor = (status: string | undefined) => {
          if (status === 'Yes') return 'green';
          if (status === 'No') return 'red';
          return 'default';
        };
        
        return (
          <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#666', fontWeight: '500' }}>MFN:</span>
              <Tag color={getMfnColor(mfnStatus)} style={{ fontSize: '11px' }}>
                {mfnStatus || 'N/A'}
              </Tag>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: '#666', fontWeight: '500' }}>AFN:</span>
              <Tag color={getAfnColor(afnStatus)} style={{ fontSize: '11px' }}>
                {afnStatus || 'N/A'}
              </Tag>
            </div>
          </div>
        );
      }
    }
  ];

  // 分页处理
  const handleTableChange = (pag: any) => {
    fetchData(pag.current, pag.pageSize);
  };

  // 搜索处理
  const handleSearch = (changedValues: any) => {
    setSearchFilters(prev => ({ ...prev, ...changedValues }));
  };

  // 复制到剪贴板功能
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(`${label} 已复制到剪贴板`);
    } catch (err) {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      message.success(`${label} 已复制到剪贴板`);
    }
  };

  // 多行搜索功能
  const handleMultiSearch = () => {
    if (searchText && searchText.trim()) {
      // 按换行符分割搜索文本，过滤空行
      const searchLines = searchText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      if (searchLines.length === 0) {
        message.warning('请输入有效的搜索内容');
        return;
      }
      
      // 将多行文本重新组合，用换行符连接
      const searchValues = {
        [searchType]: searchLines.join('\n'),
        ...(searchSite && { site: searchSite })
      };
      
      console.log('搜索参数:', searchValues); // 调试日志
      
      // 更新搜索过滤器并立即使用新值进行搜索
      const newSearchFilters = { ...searchFilters, ...searchValues };
      setSearchFilters(newSearchFilters);
      
      // 重置到第一页并重新获取数据
      setPagination(prev => ({ ...prev, current: 1 }));
      
      // 直接使用新的搜索参数进行搜索
      fetchDataWithFilters(1, pagination.pageSize, newSearchFilters);
    } else {
      message.warning('请输入搜索内容');
    }
  };

  // 导出Excel
  const handleExport = () => {
    if (records.length === 0) {
      message.warning('没有数据可导出');
      return;
    }

    try {
      const exportData = records.map(record => ({
        'SKU': record.sku,
        'FNSKU': record.fnsku || '',
        'ASIN': record.asin || '',
        '产品名称': record['product-name'] || '',
        '售价': record['your-price'] || '',
        '站点': record.site,
        'AFN可售数量': record['afn-fulfillable-quantity'] || 0,
        'AFN仓库数量': record['afn-warehouse-quantity'] || 0,
        'AFN预留数量': record['afn-reserved-quantity'] || 0,
        'AFN不可售数量': record['afn-unsellable-quantity'] || 0,
        'AFN总数量': record['afn-total-quantity'] || 0,
        '入库处理中': record['afn-inbound-working-quantity'] || 0,
        '入库运输中': record['afn-inbound-shipped-quantity'] || 0,
        '入库接收中': record['afn-inbound-receiving-quantity'] || 0,
        '单位体积': record['per-unit-volume'] || '',
        'MFN Listing': record['mfn-listing-exists'] || '',
        'AFN Listing': record['afn-listing-exists'] || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'FBA库存');
      
      const fileName = `FBA库存_${new Date().toLocaleDateString()}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    }
  };

  // 生成SHEIN库存同步文件
  const handleGenerateSheinSync = async () => {
    // 创建一个可控制的加载提示
    const hideLoading = message.loading('正在查询SHEIN产品信息...', 0);
    
    try {
      // 设置超时控制器
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 120000); // 2分钟超时

      // 更新加载状态
      setTimeout(() => {
        hideLoading();
        message.loading('正在处理SKU映射关系...', 0);
      }, 1000);

      setTimeout(() => {
        message.destroy();
        message.loading('正在查询FBA库存数据...', 0);
      }, 3000);

      setTimeout(() => {
        message.destroy();
        message.loading('正在生成Excel文件...', 0);
      }, 5000);
      
      const response = await fetch(`${API_BASE_URL}/api/fba-inventory/generate-shein-sync`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      message.destroy();

      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.message || `HTTP ${response.status}`);
      }

      // 获取文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'SHEIN库存同步.xlsx';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
        }
      }

      // 下载文件
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      message.success('SHEIN库存同步文件生成并下载完成！');
    } catch (error) {
      message.destroy();
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          message.error('生成超时，请稍后重试。如果数据量很大，这个过程可能需要较长时间。');
        } else if (error.message.includes('fetch')) {
          message.error('网络连接错误，请检查网络后重试');
        } else {
          message.error(`生成失败: ${error.message}`);
        }
      } else {
        message.error('生成失败: 未知错误');
      }
      
      console.error('生成SHEIN库存同步文件失败:', error);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <BarChartOutlined /> FBA库存管理
      </Title>

      {/* 主要内容区域 - 使用左右布局 */}
      <Row gutter={24}>
        {/* 左侧：所有卡片区域 */}
        <Col span={4}>
          {/* 统计卡片 */}
          {stats && (
            <Card title="库存统计" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={4}>
                <Col span={12}>
                  <div style={{ textAlign: 'center', padding: '6px', backgroundColor: '#f5f5f5', borderRadius: '4px', marginBottom: '4px' }}>
                    <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>总SKU数量</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                      <FileExcelOutlined style={{ marginRight: '2px', fontSize: '12px' }} />
                      {stats.total_skus}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ textAlign: 'center', padding: '6px', backgroundColor: '#f6ffed', borderRadius: '4px', marginBottom: '4px' }}>
                    <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>可用库存</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#3f8600' }}>
                      {stats.total_afn_fulfillable}
                    </div>
                  </div>
                </Col>
              </Row>
              <Row gutter={4}>
                <Col span={12}>
                  <div style={{ textAlign: 'center', padding: '6px', backgroundColor: '#fff2f0', borderRadius: '4px' }}>
                    <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>预留库存</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#cf1322' }}>
                      {stats.total_afn_reserved}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ textAlign: 'center', padding: '6px', backgroundColor: '#e6f7ff', borderRadius: '4px' }}>
                    <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>入库中库存</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1890ff' }}>
                      {stats.total_afn_inbound}
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>
          )}

          {/* 自定义类目卡片栏 */}
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space size="small">
                  <TagsOutlined />
                  <span style={{ fontSize: '12px' }}>类目</span>
                </Space>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  size="small"
                  onClick={() => {
                    setEditingCategory(null);
                    categoryForm.resetFields();
                    setCategoryModalVisible(true);
                  }}
                >
                  新建
                </Button>
              </div>
            }
            size="small"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {categories.map(category => (
                <div
                  key={category.id}
                  style={{ 
                    border: selectedCategory === category.id ? `2px solid ${category.color}` : '1px solid #d9d9d9',
                    borderRadius: '6px',
                    padding: '8px',
                    cursor: 'pointer',
                    backgroundColor: selectedCategory === category.id ? '#f0f9ff' : '#fff',
                    position: 'relative'
                  }}
                  onClick={() => handleCategoryClick(category)}
                >
                  <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                    <div style={{ 
                      width: 24, 
                      height: 24, 
                      backgroundColor: category.color, 
                      borderRadius: '50%', 
                      margin: '0 auto 4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {category.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '2px' }}>
                      {category.name}
                    </div>
                    <div style={{ color: '#666', fontSize: '10px', marginBottom: '6px' }}>
                      {category.description || '暂无描述'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                      <span>SKU: {category.sku_count}</span>
                      <span style={{ color: category.color }}>库存: {category.total_quantity}</span>
                    </div>
                  </div>
                  
                  {/* 操作按钮 */}
                  <div style={{ 
                    position: 'absolute', 
                    top: '4px', 
                    right: '4px', 
                    display: 'flex', 
                    gap: '2px',
                    opacity: 0.7
                  }}>
                    <EditOutlined 
                      style={{ fontSize: '10px', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCategory(category);
                        categoryForm.setFieldsValue(category);
                        setCategoryModalVisible(true);
                      }}
                    />
                    <Popconfirm
                      title="确定要删除这个类目吗？"
                      onConfirm={(e) => {
                        e?.stopPropagation();
                        handleDeleteCategory(category.id);
                      }}
                    >
                      <DeleteOutlined 
                        style={{ fontSize: '10px', cursor: 'pointer' }}
                        onClick={(e) => e.stopPropagation()} 
                      />
                    </Popconfirm>
                  </div>
                </div>
              ))}
              
              {/* 当没有类目时显示提示 */}
              {categories.length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#999', 
                  padding: '16px 8px',
                  border: '1px dashed #d9d9d9',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}>
                  <TagsOutlined style={{ fontSize: '16px', marginBottom: '4px' }} />
                  <div>暂无类目</div>
                  <div style={{ fontSize: '10px' }}>点击新建按钮</div>
                </div>
              )}
            </div>
          </Card>
        </Col>

        {/* 右侧：主要内容区域 */}
        <Col span={20}>

          {/* 操作按钮 */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExport}
                disabled={records.length === 0}
              >
                导出Excel
              </Button>
            </Col>
            <Col>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  fetchData();
                  fetchStats();
                }}
              >
                刷新
              </Button>
            </Col>
            <Col>
              <Tooltip title="根据SHEIN产品信息与FBA库存进行同步，生成Excel文件。数据量大时可能需要1-2分钟处理时间。">
                <Button
                  type="primary"
                  icon={<FileExcelOutlined />}
                  onClick={handleGenerateSheinSync}
                  style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                >
                  生成SHEIN库存同步文件
                </Button>
              </Tooltip>
            </Col>
            {/* 批量操作按钮 */}
            {selectedRowKeys.length > 0 && (
              <>
                <Col>
                  <Button
                    icon={<TagsOutlined />}
                    onClick={() => setBatchCategoryModalVisible(true)}
                    style={{ backgroundColor: '#1890ff', borderColor: '#1890ff', color: 'white' }}
                  >
                    批量分配类目 ({selectedRowKeys.length})
                  </Button>
                </Col>
                <Col>
                  <Button
                    icon={<DeleteOutlined />}
                    onClick={handleBatchRemoveCategory}
                    danger
                  >
                    批量移除类目 ({selectedRowKeys.length})
                  </Button>
                </Col>
                <Col>
                  <Button
                    onClick={() => setSelectedRowKeys([])}
                  >
                    取消选择
                  </Button>
                </Col>
              </>
            )}
          </Row>

          {/* 搜索过滤器 */}
          <Card 
            style={{ marginBottom: 16 }}
            bodyStyle={{ padding: '20px' }}
          >
            <Row gutter={[16, 16]}>
              {/* 第一行：搜索类型和站点筛选 */}
              <Col span={24}>
                <Row gutter={16} align="middle">
                  <Col span={5}>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ 
                        display: 'block', 
                        fontWeight: '500', 
                        color: '#262626',
                        marginBottom: '4px'
                      }}>
                        搜索类型
                      </label>
                      <Select
                        value={searchType}
                        onChange={setSearchType}
                        style={{ width: '100%' }}
                        size="middle"
                      >
                        <Option value="sku">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ 
                              width: '8px', 
                              height: '8px', 
                              backgroundColor: '#1890ff', 
                              borderRadius: '50%' 
                            }} />
                            SKU
                          </div>
                        </Option>
                        <Option value="fnsku">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ 
                              width: '8px', 
                              height: '8px', 
                              backgroundColor: '#52c41a', 
                              borderRadius: '50%' 
                            }} />
                            FNSKU
                          </div>
                        </Option>
                        <Option value="asin">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ 
                              width: '8px', 
                              height: '8px', 
                              backgroundColor: '#faad14', 
                              borderRadius: '50%' 
                            }} />
                            ASIN
                          </div>
                        </Option>
                      </Select>
                    </div>
                  </Col>
                  <Col span={5}>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ 
                        display: 'block', 
                        fontWeight: '500', 
                        color: '#262626',
                        marginBottom: '4px'
                      }}>
                        站点筛选
                      </label>
                      <Select
                        value={searchSite}
                        onChange={setSearchSite}
                        placeholder="选择站点"
                        allowClear
                        style={{ width: '100%' }}
                        size="middle"
                      >
                        {sites.map(option => (
                          <Option key={option} value={option}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ 
                                width: '8px', 
                                height: '8px', 
                                backgroundColor: '#722ed1', 
                                borderRadius: '50%' 
                              }} />
                              {option}
                            </div>
                          </Option>
                        ))}
                      </Select>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ 
                        display: 'block', 
                        fontWeight: '500', 
                        color: '#262626',
                        marginBottom: '4px'
                      }}>
                        搜索内容
                      </label>
                      <Input.TextArea
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="每行一个搜索值，如：&#10;SKU001&#10;SKU002"
                        rows={2}
                        style={{ 
                          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                          fontSize: '12px',
                          lineHeight: '1.4',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                  </Col>
                  <Col span={3}>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ 
                        display: 'block', 
                        fontWeight: '500', 
                        color: '#262626',
                        marginBottom: '4px'
                      }}>
                        操作
                      </label>
                      <Button 
                        type="primary" 
                        icon={<SearchOutlined />}
                        onClick={handleMultiSearch}
                        style={{ width: '100%' }}
                        size="middle"
                      >
                        搜索
                      </Button>
                    </div>
                  </Col>
                  <Col span={3}>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ 
                        display: 'block', 
                        fontWeight: '500', 
                        color: '#262626',
                        marginBottom: '4px'
                      }}>
                        重置
                      </label>
                      <Button 
                        onClick={() => {
                          setSearchType('sku');
                          setSearchSite('');
                          setSearchText('');
                          setSearchFilters({ sku: '', site: '' });
                          fetchData(1, pagination.pageSize);
                        }}
                        style={{ width: '100%' }}
                        size="middle"
                      >
                        清空
                      </Button>
                    </div>
                  </Col>
                </Row>
              </Col>
              
              {/* 提示信息 */}
              <Col span={24}>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#8c8c8c',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '-8px'
                }}>
                  <InfoCircleOutlined />
                  <span>支持批量搜索，每行输入一个值，空行将被自动忽略</span>
                </div>
              </Col>
            </Row>
          </Card>

          {/* 数据表格 */}
          <Table
            columns={columns}
            dataSource={selectedCategory ? categorySkus : records}
            rowKey="sku"
            loading={selectedCategory ? categorySkusLoading : loading}
            pagination={selectedCategory ? false : {
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
            }}
            onChange={selectedCategory ? undefined : handleTableChange}
            scroll={{ x: 800 }}
            size="small"
            title={() => selectedCategory ? (
              <Space>
                <span>类目SKU列表</span>
                <Tag color={categories.find(c => c.id === selectedCategory)?.color}>
                  {categories.find(c => c.id === selectedCategory)?.name}
                </Tag>
                <Button 
                  size="small" 
                  onClick={() => {
                    setSelectedCategory(null);
                    setCategorySkus([]);
                  }}
                >
                  返回全部数据
                </Button>
              </Space>
            ) : undefined}
          />
        </Col>
      </Row>

      {/* 类目管理模态框 */}
      <Modal
        title={editingCategory ? '编辑类目' : '新建类目'}
        open={categoryModalVisible}
        onCancel={() => {
          setCategoryModalVisible(false);
          setEditingCategory(null);
          categoryForm.resetFields();
        }}
        onOk={() => categoryForm.submit()}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={categoryForm}
          layout="vertical"
          onFinish={handleCategorySubmit}
        >
          <Form.Item
            name="name"
            label="类目名称"
            rules={[{ required: true, message: '请输入类目名称' }]}
          >
            <Input placeholder="请输入类目名称" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="类目描述"
          >
            <Input.TextArea 
              placeholder="请输入类目描述（可选）" 
              rows={3}
            />
          </Form.Item>
          
          <Form.Item
            name="color"
            label="类目颜色"
            initialValue="#1890ff"
          >
            <ColorPicker 
              showText 
              format="hex"
              presets={[
                {
                  label: '推荐',
                  colors: ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa541c']
                }
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量分配类目模态框 */}
      <Modal
        title={`批量分配类目 (已选择 ${selectedRowKeys.length} 条记录)`}
        open={batchCategoryModalVisible}
        onCancel={() => {
          setBatchCategoryModalVisible(false);
          batchCategoryForm.resetFields();
        }}
        onOk={() => batchCategoryForm.submit()}
        okText="分配"
        cancelText="取消"
      >
        <Form
          form={batchCategoryForm}
          layout="vertical"
          onFinish={handleBatchAssignCategory}
        >
          <Form.Item
            name="category_id"
            label="选择类目"
            rules={[{ required: true, message: '请选择要分配的类目' }]}
          >
            <Select placeholder="请选择类目">
              {categories.map(category => (
                <Option key={category.id} value={category.id}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div 
                      style={{ 
                        width: 12, 
                        height: 12, 
                        backgroundColor: category.color, 
                        borderRadius: '50%', 
                        marginRight: 8 
                      }}
                    />
                    {category.name}
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>
          <div style={{ color: '#666', fontSize: '12px' }}>
            将为选中的 {selectedRowKeys.length} 条记录分配类目
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default FbaInventory; 