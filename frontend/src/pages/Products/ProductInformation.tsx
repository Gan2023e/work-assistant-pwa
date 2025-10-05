import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Table,
  Card,
  Input,
  Select,
  Button,
  Space,
  message,
  Modal,
  Form,
  Pagination,
  Popconfirm,
  Tag,
  Tooltip,
  Descriptions,
  Row,
  Col,
  Statistic,
  Empty,
  Upload,
  Badge,
  Divider
} from 'antd';
import {
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  ExportOutlined,
  UploadOutlined,
  DownOutlined,
  RightOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { API_BASE_URL } from '../../config/api';

const { Search } = Input;
const { Option } = Select;

interface ProductInformationData {
  site: string;
  item_sku: string;
  original_parent_sku: string;
  item_name: string;
  external_product_id: string;
  external_product_id_type: string;
  brand_name: string;
  product_description: string;
  bullet_point1: string;
  bullet_point2: string;
  bullet_point3: string;
  bullet_point4: string;
  bullet_point5: string;
  generic_keywords: string;
  main_image_url: string;
  swatch_image_url: string;
  other_image_url1: string;
  other_image_url2: string;
  other_image_url3: string;
  other_image_url4: string;
  other_image_url5: string;
  other_image_url6: string;
  other_image_url7: string;
  other_image_url8: string;
  parent_child: string;
  parent_sku: string;
  relationship_type: string;
  variation_theme: string;
  color_name: string;
  color_map: string;
  size_name: string;
  size_map: string;
  feed_product_type: string;
  item_type: string;
  model: string;
  manufacturer: string;
  standard_price: number;
  quantity: number;
  list_price: number;
  closure_type: string;
  outer_material_type1: string;
  care_instructions: string;
  age_range_description: string;
  target_gender: string;
  department_name: string;
  special_features: string;
  style_name: string;
  water_resistance_level: string;
  recommended_uses_for_product: string;
  seasons1: string;
  seasons2: string;
  seasons3: string;
  seasons4: string;
  material_type: string;
  lifestyle1: string;
  lining_description: string;
  strap_type: string;
  storage_volume_unit_of_measure: string;
  storage_volume: number;
  depth_front_to_back: number;
  depth_front_to_back_unit_of_measure: string;
  depth_width_side_to_side: number;
  depth_width_side_to_side_unit_of_measure: string;
  depth_height_floor_to_top: number;
  depth_height_floor_to_top_unit_of_measure: string;
  cpsia_cautionary_statement1: string;
  import_designation: string;
  country_of_origin: string;
}

// 分组后的数据结构
interface GroupedProductData {
  key: string;
  parent_sku: string;
  site: string;
  brand_name: string;
  manufacturer: string;
  total_quantity: number;
  children_count: number;
  children: ProductInformationData[];
  parent_record?: ProductInformationData; // 母SKU记录（如果存在）
  isParent: boolean;
}

// 表格显示的数据类型（包含父级和子级）
type TableRowData = GroupedProductData | ProductInformationData;

interface QueryParams {
  page: number;
  limit: number;
  search: string;
  site: string;
  sort_by: string;
  sort_order: 'ASC' | 'DESC';
}

interface Statistics {
  totalCount: number;
  parentSkuCount: number;
  siteStats: Array<{ site: string; count: number }>;
  brandStats: Array<{ brand_name: string; count: number }>;
}

const ProductInformation: React.FC = () => {
  // 状态管理
  const [data, setData] = useState<ProductInformationData[]>([]);
  const [groupedData, setGroupedData] = useState<GroupedProductData[]>([]);
  const [isGroupedView, setIsGroupedView] = useState(true); // 默认开启分组视图
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [siteList, setSiteList] = useState<string[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<ProductInformationData[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [asinData, setAsinData] = useState<{[key: string]: {asin1: string, site: string}}>({});

  // 引用
  const tableRef = useRef<HTMLDivElement>(null);

  // 查询参数
  const [queryParams, setQueryParams] = useState<QueryParams>({
    page: 1,
    limit: 50,
    search: '',
    site: 'all',
    sort_by: 'item_sku',
    sort_order: 'ASC'
  });

  // 分页信息
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
    pages: 0
  });

  // 弹窗状态
  const [detailVisible, setDetailVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<ProductInformationData | null>(null);
  const [form] = Form.useForm();
  
  // 导出相关状态
  const [exportLoading, setExportLoading] = useState(false);
  
  // 上传相关状态
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadCountry, setUploadCountry] = useState<string>('');
  const [fileList, setFileList] = useState<any[]>([]);



  // 获取当前视图的数据和分页信息
  const currentViewData = useMemo(() => {
    if (isGroupedView) {
      // 分组视图：直接显示后端返回的当前页分组数据
      const result: TableRowData[] = [];
      groupedData.forEach(group => {
        // 添加父级行
        result.push(group);
        // 如果该组已展开，添加所有子行
        if (expandedRowKeys.includes(`parent-${group.key}`)) {
          group.children.forEach(child => {
            result.push(child);
          });
        }
      });
      
      return result;
    } else {
      // 列表视图：显示原始数据（已经是分页的）
      return data;
    }
  }, [isGroupedView, groupedData, data, expandedRowKeys]);

  // 计算当前视图的分页信息
  const currentPagination = useMemo(() => {
    return {
      current: pagination.current,
      pageSize: pagination.pageSize,
      total: pagination.total
    };
  }, [pagination]);

  // 获取数据列表 - 统一的数据获取函数
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      // 添加搜索和筛选条件
      if (queryParams.search) {
        params.set('search', queryParams.search);
      }
      if (queryParams.site && queryParams.site !== 'all') {
        params.set('site', queryParams.site);
      }
      
      // 添加分页参数
      params.append('page', queryParams.page.toString());
      params.append('limit', queryParams.limit.toString());

      let apiUrl;
      if (isGroupedView) {
        // 分组视图：使用专门的分组API
        apiUrl = `${API_BASE_URL}/api/product-information/grouped-list?${params}`;
      } else {
        // 列表视图：使用标准API
        apiUrl = `${API_BASE_URL}/api/product-information/list?${params}`;
      }

      const response = await fetch(apiUrl, {
        signal: AbortSignal.timeout(30000) // 30秒超时
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();

      if (result.success) {
        if (isGroupedView) {
          // 分组视图：直接使用后端返回的分组数据
          setGroupedData(result.data.map((group: any) => ({
            key: group.parent_sku,
            parent_sku: group.parent_sku,
            site: group.site,
            brand_name: group.brand_name,
            manufacturer: group.manufacturer,
            total_quantity: group.total_quantity,
            children_count: group.children_count,
            children: group.children,
            parent_record: group.parent_record, // 母SKU记录
            isParent: true
          })));
          setData([]); // 清空原始数据
          
          // 获取ASIN信息（包括母SKU和子SKU）
          const allSellerSkus: string[] = [];
          const siteMap: {[key: string]: string} = {};
          
          result.data.forEach((group: any) => {
            // 添加母SKU
            if (group.parent_sku) {
              allSellerSkus.push(group.parent_sku);
              siteMap[group.parent_sku] = group.site;
            }
            
            // 添加子SKU
            group.children.forEach((child: any) => {
              if (child.item_sku) {
                allSellerSkus.push(child.item_sku);
                siteMap[child.item_sku] = child.site;
              }
            });
          });
          
          // 按站点分组获取ASIN信息
          const siteGroups: {[key: string]: string[]} = {};
          allSellerSkus.forEach(sku => {
            const site = siteMap[sku];
            if (!siteGroups[site]) {
              siteGroups[site] = [];
            }
            siteGroups[site].push(sku);
          });
          
          // 为每个站点获取ASIN信息
          Object.entries(siteGroups).forEach(([site, skus]) => {
            if (skus.length > 0) {
              fetchAsinData(skus, site);
            }
          });
        } else {
          // 列表视图：使用原始数据
          setData(result.data);
          setGroupedData([]); // 清空分组数据
        }
        
        // 使用后端返回的分页信息
        setPagination(result.pagination);
        setSiteList(result.siteList || []);
      } else {
        message.error(result.message || '获取数据失败');
      }
    } catch (error) {
      console.error('获取数据失败:', error);
      if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
          message.error('请求超时，请检查网络连接或稍后重试');
        } else if (error.name === 'AbortError') {
          message.error('请求被取消');
        } else {
          message.error('获取数据失败: ' + error.message);
        }
      } else {
        message.error('获取数据失败: ' + String(error));
      }
    } finally {
      setLoading(false);
    }
  }, [queryParams, isGroupedView]);

  // 监听查询参数和视图模式变化，自动触发数据获取
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 获取统计信息
  const fetchStatistics = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/product-information/statistics`);
      const result = await response.json();

      if (result.success) {
        setStatistics(result.data);
      }
    } catch (error) {
      console.error('获取统计信息失败:', error);
    }
  }, []);

  // 更新查询参数
  const updateQueryParams = (newParams: Partial<QueryParams>) => {
    setQueryParams(prev => ({
      ...prev,
      ...newParams,
      page: newParams.page || 1
    }));
  };

  // 查看详情
  const handleViewDetail = async (record: ProductInformationData) => {
    setCurrentRecord(record);
    setDetailVisible(true);
  };

  // 编辑记录
  const handleEdit = (record: ProductInformationData) => {
    setCurrentRecord(record);
    form.setFieldsValue(record);
    setEditVisible(true);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    try {
      const values = await form.validateFields();
      
      if (!currentRecord) {
        message.error('无法保存：缺少记录信息');
        return;
      }
      
      const url = `${API_BASE_URL}/api/product-information/${currentRecord.site}/${currentRecord.item_sku}`;
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (result.success) {
        message.success('保存成功');
        setEditVisible(false);
        fetchData();
      } else {
        message.error(result.message || '保存失败');
      }
    } catch (error) {
      message.error('保存失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // 删除记录
  const handleDelete = async (record: ProductInformationData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/product-information/${record.site}/${record.item_sku}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        message.success('删除成功');
        fetchData();
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRows.length === 0) {
      message.warning('请选择要删除的记录');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/product-information/batch-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: selectedRows.map(row => ({
            site: row.site,
            item_sku: row.item_sku
          }))
        }),
      });

      const result = await response.json();

      if (result.success) {
        message.success(result.message);
        setSelectedRowKeys([]);
        setSelectedRows([]);
        fetchData();
      } else {
        message.error(result.message || '批量删除失败');
      }
    } catch (error) {
      message.error('批量删除失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // 导出到模板
  const handleExportToTemplate = async () => {
    if (selectedRows.length === 0) {
      message.error('请选择要导出的记录');
      return;
    }

    // 根据选中的记录自动确定目标国家
    const countries = Array.from(new Set(selectedRows.map(record => record.site)));
    if (countries.length === 0) {
      message.error('选中的记录中没有有效的站点信息');
      return;
    }

    // 如果选中记录来自多个国家，按国家分组处理
    if (countries.length > 1) {
      message.warning(`选中的记录来自多个国家（${countries.join(', ')}），将分别按国家导出`);
      
      // 按国家分组记录
      const recordsByCountry = countries.reduce((acc, country) => {
        acc[country] = selectedRows.filter(record => record.site === country);
        return acc;
      }, {} as Record<string, typeof selectedRows>);

      setExportLoading(true);
      try {
        // 为每个国家分别导出
        for (const [country, records] of Object.entries(recordsByCountry)) {
          const response = await fetch(`${API_BASE_URL}/api/product-information/export-to-template`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              selectedRecords: records,
              targetCountry: country
            }),
          });

          if (response.ok) {
            // 下载文件
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // 从响应头获取文件名
            const contentDisposition = response.headers.get('content-disposition');
            let fileName = `产品资料_${country}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            if (contentDisposition) {
              const fileNameMatch = contentDisposition.match(/filename\*?=['"]?([^'";]+)/);
              if (fileNameMatch) {
                fileName = decodeURIComponent(fileNameMatch[1]);
              }
            }
            
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          } else {
            const errorResult = await response.json();
            message.error(`${country} 导出失败: ${errorResult.message || '导出失败'}`);
          }
        }
        
        message.success(`多站点导出完成！共导出 ${selectedRows.length} 条记录`);
        setSelectedRowKeys([]);
        setSelectedRows([]);
      } catch (error) {
        message.error('导出失败: ' + (error instanceof Error ? error.message : String(error)));
      } finally {
        setExportLoading(false);
      }
    } else {
      // 单站点导出
      const targetCountry = countries[0];
      setExportLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/product-information/export-to-template`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            selectedRecords: selectedRows,
            targetCountry: targetCountry
          }),
        });

        if (response.ok) {
          // 下载文件
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          
          // 从响应头获取文件名
          const contentDisposition = response.headers.get('content-disposition');
          let fileName = `产品资料_${targetCountry}_${new Date().toISOString().slice(0, 10)}.xlsx`;
          if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename\*?=['"]?([^'";]+)/);
            if (fileNameMatch) {
              fileName = decodeURIComponent(fileNameMatch[1]);
            }
          }
          
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          message.success(`导出成功！已下载 ${selectedRows.length} 条记录到 ${targetCountry} 模板`);
          setSelectedRowKeys([]);
          setSelectedRows([]);
        } else {
          const errorResult = await response.json();
          message.error(errorResult.message || '导出失败');
        }
      } catch (error) {
        message.error('导出失败: ' + (error instanceof Error ? error.message : String(error)));
      } finally {
        setExportLoading(false);
      }
    }
  };

  // 上传资料表
  const handleUploadTemplate = async (file?: File) => {
    if (!uploadCountry) {
      message.error('请选择对应的国家');
      return;
    }

    const fileToUpload = file || (fileList.length > 0 ? fileList[0].originFileObj : null);
    if (!fileToUpload) {
      message.error('请选择要上传的Excel文件');
      return;
    }

    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('country', uploadCountry);

    setUploadLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/product-information/upload-template`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        message.success(
          `${result.message}！新增${result.data.inserted}条，更新${result.data.updated}条记录${
            result.data.errors > 0 ? `，${result.data.errors}条失败` : ''
          }`
        );
        
        // 显示错误详情（如果有）
        if (result.data.errorDetails && result.data.errorDetails.length > 0) {
          Modal.info({
            title: '导入详情',
            width: 600,
            content: (
              <div>
                <p>导入完成统计：</p>
                <ul>
                  <li>新增记录：{result.data.inserted} 条</li>
                  <li>更新记录：{result.data.updated} 条</li>
                  <li>失败记录：{result.data.errors} 条</li>
                </ul>
                {result.data.errorDetails.length > 0 && (
                  <>
                    <p>错误详情（前10条）：</p>
                    <ul style={{ maxHeight: '200px', overflow: 'auto' }}>
                      {result.data.errorDetails.map((error: string, index: number) => (
                        <li key={index} style={{ color: '#ff4d4f', fontSize: '12px' }}>
                          {error}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ),
          });
        }

        setUploadVisible(false);
        setUploadCountry('');
        setFileList([]);
        fetchData(); // 刷新数据
      } else {
        message.error(result.message || '上传失败');
      }
    } catch (error) {
      message.error('上传失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setUploadLoading(false);
    }
  };

  // 处理展开/收起
  const handleExpand = (parentKey: string) => {
    const fullParentKey = `parent-${parentKey}`;
    const isExpanded = expandedRowKeys.includes(fullParentKey);
    
    if (isExpanded) {
      // 收起
      setExpandedRowKeys(prev => prev.filter(key => key !== fullParentKey));
    } else {
      // 展开
      setExpandedRowKeys(prev => [...prev, fullParentKey]);
    }
  };

  // 获取ASIN信息
  const fetchAsinData = async (sellerSkus: string[], site: string) => {
    try {
      console.log('🔍 正在获取ASIN信息:', { sellerSkus, site });
      
      // 站点名称映射：中文站点名 -> API站点名
      const siteMapping: {[key: string]: string} = {
        '美国': 'www.amazon.com',
        '英国': 'www.amazon.co.uk',
        '德国': 'www.amazon.de',
        '法国': 'www.amazon.fr',
        '意大利': 'www.amazon.it',
        '西班牙': 'www.amazon.es',
        '日本': 'www.amazon.co.jp',
        '加拿大': 'www.amazon.ca',
        '澳大利亚': 'www.amazon.com.au',
        '印度': 'www.amazon.in',
        '阿联酋': 'www.amazon.ae'
      };
      
      const apiSite = siteMapping[site] || site;
      const response = await fetch(`${API_BASE_URL}/api/product-information/asin-info?sellerSkus=${sellerSkus.join(',')}&site=${apiSite}`);
      const result = await response.json();
      
      console.log('📦 ASIN查询结果:', result);
      
      if (result.success) {
        // 合并到现有的asinData中，而不是替换
        setAsinData(prev => ({
          ...prev,
          ...result.data
        }));
      }
    } catch (error) {
      console.error('获取ASIN信息失败:', error);
    }
  };

  // 生成亚马逊链接
  const generateAmazonUrl = (asin: string, site: string) => {
    const siteMap: {[key: string]: string} = {
      '美国': 'amazon.com',
      '英国': 'amazon.co.uk',
      '德国': 'amazon.de',
      '法国': 'amazon.fr',
      '意大利': 'amazon.it',
      '西班牙': 'amazon.es',
      '日本': 'amazon.co.jp',
      '加拿大': 'amazon.ca',
      '澳大利亚': 'amazon.com.au',
      '印度': 'amazon.in',
      '阿联酋': 'amazon.ae'
    };
    
    const domain = siteMap[site] || 'amazon.com';
    return `https://www.${domain}/dp/${asin}`;
  };


  // 表格列定义
  const columns: ColumnsType<TableRowData> = [
    {
      title: '站点',
      dataIndex: 'site',
      key: 'site',
      width: 100,
      fixed: 'left',
      render: (site: string) => <Tag color="blue">{site}</Tag>
    },
    {
      title: isGroupedView ? '父SKU/商品SKU' : '商品SKU',
      dataIndex: 'item_sku',
      key: 'item_sku',
      width: 220,
      fixed: 'left',
      ellipsis: true,
      render: (value: string, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          // 父级行显示父SKU和展开/收起按钮
          const isExpanded = expandedRowKeys.includes(`parent-${record.key}`);
          
          // 获取母SKU的ASIN信息
          const siteMapping: {[key: string]: string} = {
            '美国': 'www.amazon.com',
            '英国': 'www.amazon.co.uk',
            '德国': 'www.amazon.de',
            '法国': 'www.amazon.fr',
            '意大利': 'www.amazon.it',
            '西班牙': 'www.amazon.es',
            '日本': 'www.amazon.co.jp',
            '加拿大': 'www.amazon.ca',
            '澳大利亚': 'www.amazon.com.au',
            '印度': 'www.amazon.in',
            '阿联酋': 'www.amazon.ae'
          };
          
          const apiSite = siteMapping[record.site] || record.site;
          const asinKey = `${record.parent_sku}_${apiSite}`;
          const asinInfo = asinData[asinKey];
          
          return (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Button
                type="text"
                size="small"
                icon={isExpanded ? <DownOutlined /> : <RightOutlined />}
                onClick={() => handleExpand(record.key)}
                style={{ 
                  border: 'none', 
                  padding: '0 8px', 
                  marginRight: '12px',
                  color: isExpanded ? '#1890ff' : '#999',
                  fontSize: '12px'
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  fontWeight: 'bold', 
                  color: '#1890ff',
                  fontSize: '14px'
                }}>
                  <span style={{ marginRight: '8px' }}>
                    {record.parent_sku || '未分组'}
                  </span>
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#666', 
                  fontWeight: 'normal',
                  marginTop: '2px'
                }}>
                  <Space size={8}>
                    <span>🎯 {record.children_count} 个子产品</span>
                    <span>📦 总库存: {record.total_quantity}</span>
                  </Space>
                </div>
                {/* 显示母SKU的ASIN信息 */}
                {asinInfo && asinInfo.asin1 && (
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#1890ff', 
                    marginTop: '4px',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                  onClick={() => {
                    // 将API站点名转换为中文站点名
                    const apiSiteToChinese: {[key: string]: string} = {
                      'www.amazon.com': '美国',
                      'www.amazon.co.uk': '英国',
                      'www.amazon.de': '德国',
                      'www.amazon.fr': '法国',
                      'www.amazon.it': '意大利',
                      'www.amazon.es': '西班牙',
                      'www.amazon.co.jp': '日本',
                      'www.amazon.ca': '加拿大',
                      'www.amazon.com.au': '澳大利亚',
                      'www.amazon.in': '印度',
                      'www.amazon.ae': '阿联酋'
                    };
                    
                    const chineseSite = apiSiteToChinese[asinInfo.site] || '美国';
                    const amazonUrl = generateAmazonUrl(asinInfo.asin1, chineseSite);
                    window.open(amazonUrl, '_blank');
                  }}
                  title={`点击打开亚马逊页面: ${asinInfo.asin1}`}
                  >
                    ASIN: {asinInfo.asin1}
                  </div>
                )}
              </div>
            </div>
          );
        } else {
          // 子级行显示商品SKU和ASIN
          // 站点名称映射：中文站点名 -> API站点名
          const siteMapping: {[key: string]: string} = {
            '美国': 'www.amazon.com',
            '英国': 'www.amazon.co.uk',
            '德国': 'www.amazon.de',
            '法国': 'www.amazon.fr',
            '意大利': 'www.amazon.it',
            '西班牙': 'www.amazon.es',
            '日本': 'www.amazon.co.jp',
            '加拿大': 'www.amazon.ca',
            '澳大利亚': 'www.amazon.com.au',
            '印度': 'www.amazon.in',
            '阿联酋': 'www.amazon.ae'
          };
          
          const apiSite = siteMapping[record.site] || record.site;
          const asinKey = `${value}_${apiSite}`;
          const asinInfo = asinData[asinKey];
          
          // 调试信息
          if (value && record.site) {
            console.log('🔍 查找ASIN:', { 
              sku: value, 
              site: record.site,
              apiSite,
              asinKey, 
              asinInfo,
              allAsinKeys: Object.keys(asinData)
            });
          }
          
          return (
            <div style={{ 
              marginLeft: isGroupedView ? '40px' : '0',
              padding: '4px 0'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center'
              }}>
                <div style={{
                  width: '3px',
                  height: '20px',
                  backgroundColor: '#52c41a',
                  borderRadius: '1px',
                  marginRight: '8px'
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    color: '#262626'
                  }}>
                    {value}
                  </div>
                  {asinInfo && asinInfo.asin1 && (
                    <div style={{ 
                      fontSize: '11px',
                      color: '#1890ff',
                      marginTop: '2px',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                    onClick={() => {
                      // 将API站点名转换为中文站点名
                      const apiSiteToChinese: {[key: string]: string} = {
                        'www.amazon.com': '美国',
                        'www.amazon.co.uk': '英国',
                        'www.amazon.de': '德国',
                        'www.amazon.fr': '法国',
                        'www.amazon.it': '意大利',
                        'www.amazon.es': '西班牙',
                        'www.amazon.co.jp': '日本',
                        'www.amazon.ca': '加拿大',
                        'www.amazon.com.au': '澳大利亚',
                        'www.amazon.in': '印度',
                        'www.amazon.ae': '阿联酋'
                      };
                      
                      const chineseSite = apiSiteToChinese[asinInfo.site] || '美国';
                      const amazonUrl = generateAmazonUrl(asinInfo.asin1, chineseSite);
                      window.open(amazonUrl, '_blank');
                    }}
                    title={`点击打开亚马逊页面: ${asinInfo.asin1}`}
                    >
                      ASIN: {asinInfo.asin1}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }
      }
    },
    {
      title: '产品图片',
      key: 'product_images',
      width: 120,
      render: (_, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          // 父级行显示第一个子产品的主图
          const firstChild = record.children.find(c => c.main_image_url);
          if (firstChild?.main_image_url) {
            return (
              <div style={{ textAlign: 'center' }}>
                <img 
                  src={firstChild.main_image_url} 
                  alt="系列主图" 
                  style={{ 
                    width: '50px', 
                    height: '50px', 
                    objectFit: 'cover', 
                    borderRadius: '6px',
                    border: '2px solid #e8f4fd'
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                  系列预览
                </div>
              </div>
            );
          }
          return (
            <div style={{ textAlign: 'center', color: '#999' }}>
              <div style={{ fontSize: '24px' }}>📁</div>
              <div style={{ fontSize: '10px' }}>系列产品</div>
            </div>
          );
        }
        
        const productRecord = record as ProductInformationData;
        const images = [
          productRecord.main_image_url,
          productRecord.swatch_image_url,
          productRecord.other_image_url1,
          productRecord.other_image_url2,
          productRecord.other_image_url3,
          productRecord.other_image_url4,
          productRecord.other_image_url5,
          productRecord.other_image_url6,
          productRecord.other_image_url7,
          productRecord.other_image_url8
        ].filter(url => url && url.trim());
        
        if (images.length === 0) {
          return (
            <div style={{ 
              marginLeft: isGroupedView ? '40px' : '0',
              color: '#999',
              textAlign: 'center'
            }}>
              -
            </div>
          );
        }
        
        return (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: isGroupedView ? 'flex-start' : 'center',
            marginLeft: isGroupedView ? '40px' : '0'
          }}>
            <img 
              src={images[0]} 
              alt="商品主图" 
              style={{ 
                width: '45px', 
                height: '45px', 
                objectFit: 'cover', 
                borderRadius: '4px',
                border: '1px solid #d9d9d9'
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            {images.length > 1 && (
              <span style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                +{images.length - 1}张
              </span>
            )}
          </div>
        );
      }
    },
    {
      title: '商品名称',
      dataIndex: 'item_name',
      key: 'item_name',
      width: 250,
      ellipsis: {
        showTitle: false,
      },
      render: (name: string, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          // 父级行优先显示母SKU记录的商品名称，其次是第一个子产品的名称
          let displayName = '';
          if (record.parent_record && record.parent_record.item_name) {
            displayName = record.parent_record.item_name;
          } else if (record.children.length > 0) {
            displayName = record.children[0].item_name;
          } else {
            displayName = `${record.brand_name} 系列产品`;
          }
          
          return (
            <Tooltip placement="topLeft" title={displayName}>
              <div style={{ 
                fontWeight: 'bold',
                fontSize: '14px',
                lineHeight: '1.4'
              }}>
                {displayName}
              </div>
            </Tooltip>
          );
        } else {
          return (
            <Tooltip placement="topLeft" title={name}>
              <div style={{ 
                marginLeft: isGroupedView ? '40px' : '0',
                fontSize: '13px',
                color: '#595959',
                lineHeight: '1.4'
              }}>
                {name}
              </div>
            </Tooltip>
          );
        }
      },
    },
    {
      title: '外部产品ID',
      key: 'external_product_id_info',
      width: 160,
      ellipsis: true,
      render: (_, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return (
            <div style={{ 
              color: '#999', 
              fontSize: '12px',
              textAlign: 'center'
            }}>
              - 系列产品 -
            </div>
          );
        }
        const productRecord = record as ProductInformationData;
        return (
          <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
            <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
              {productRecord.external_product_id || '-'}
            </div>
            {productRecord.external_product_id_type && (
              <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                <Tag color="geekblue">
                  {productRecord.external_product_id_type}
                </Tag>
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: '品牌/制造商',
      key: 'brand_manufacturer',
      width: 160,
      ellipsis: true,
      render: (_, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return (
            <div style={{ padding: '4px 0' }}>
              <div style={{ 
                fontWeight: 'bold', 
                fontSize: '13px',
                color: '#262626'
              }}>
                {record.brand_name}
              </div>
              <div style={{ 
                fontSize: '11px', 
                color: '#999',
                marginTop: '2px'
              }}>
                {record.manufacturer}
              </div>
            </div>
          );
        }
        const productRecord = record as ProductInformationData;
        return (
          <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
            <div style={{ fontSize: '12px' }}>
              {productRecord.brand_name || '-'}
            </div>
            <div style={{ fontSize: '11px', color: '#999' }}>
              {productRecord.manufacturer || '-'}
            </div>
          </div>
        );
      }
    },
    {
      title: '产品类型',
      key: 'product_type',
      width: 140,
      ellipsis: true,
      render: (_, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return (
            <div style={{ 
              color: '#999', 
              fontSize: '12px',
              textAlign: 'center'
            }}>
              - 系列产品 -
            </div>
          );
        }
        const productRecord = record as ProductInformationData;
        return (
          <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
            <div style={{ fontSize: '12px' }}>
              {productRecord.item_type || '-'}
            </div>
            {productRecord.feed_product_type && (
              <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                <Tag color="cyan">
                  {productRecord.feed_product_type}
                </Tag>
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: '型号',
      dataIndex: 'model',
      key: 'model',
      width: 120,
      ellipsis: true,
      render: (value: string, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return (
            <div style={{ 
              color: '#999', 
              fontSize: '12px',
              textAlign: 'center'
            }}>
              - 系列产品 -
            </div>
          );
        }
        return (
          <div style={{ 
            marginLeft: isGroupedView ? '40px' : '0',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            {value || '-'}
          </div>
        );
      }
    },
    {
      title: '价格信息',
      key: 'price_info',
      width: 140,
      render: (_, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          // 计算价格范围
          const prices = record.children
            .filter(child => child.standard_price)
            .map(child => child.standard_price);
          
          if (prices.length === 0) {
            return (
              <div style={{ 
                color: '#999', 
                fontSize: '12px',
                textAlign: 'center'
              }}>
                - 系列产品 -
              </div>
            );
          }
          
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          
          return (
            <div style={{ fontSize: '12px' }}>
              <div style={{ fontWeight: 'bold', color: '#52c41a' }}>
                ${minPrice === maxPrice ? minPrice.toFixed(2) : `${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}`}
              </div>
              <div style={{ fontSize: '11px', color: '#999' }}>
                价格区间
              </div>
            </div>
          );
        }
        const productRecord = record as ProductInformationData;
        return (
          <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#52c41a' }}>
              {productRecord.standard_price ? `$${productRecord.standard_price}` : '-'}
            </div>
            <div style={{ fontSize: '11px', color: '#999' }}>
              标价: {productRecord.list_price ? `$${productRecord.list_price}` : '-'}
            </div>
          </div>
        );
      }
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      render: (qty: number, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return (
            <div style={{ textAlign: 'center' }}>
              <Badge 
                count={record.total_quantity} 
                showZero 
                style={{ 
                  backgroundColor: '#52c41a',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              />
              <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                总计
              </div>
            </div>
          );
        }
        return (
          <div style={{ 
            marginLeft: isGroupedView ? '40px' : '0',
            textAlign: isGroupedView ? 'left' : 'center'
          }}>
            <Badge 
              count={qty || 0} 
              showZero 
              style={{ 
                backgroundColor: qty > 0 ? '#1890ff' : '#d9d9d9',
                fontSize: '11px'
              }}
            />
          </div>
        );
      }
    },
    {
      title: '父SKU关系',
      key: 'parent_sku_info',
      width: 150,
      ellipsis: true,
      render: (_, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return record.parent_sku || '-';
        }
        const productRecord = record as ProductInformationData;
        return (
          <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
            <div>原始: {productRecord.original_parent_sku || '-'}</div>
            <div>父SKU: {productRecord.parent_sku || '-'}</div>
            {productRecord.parent_child && (
              <div style={{ fontSize: '11px', color: '#999' }}>
                关系: {productRecord.parent_child}
              </div>
            )}
            {productRecord.relationship_type && (
              <div style={{ fontSize: '11px', color: '#999' }}>
                类型: {productRecord.relationship_type}
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: '变体信息',
      key: 'variant_info',
      width: 170,
      ellipsis: true,
      render: (_, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          // 统计变体信息
          const colors = Array.from(new Set(record.children.map(c => c.color_name).filter(Boolean)));
          const sizes = Array.from(new Set(record.children.map(c => c.size_name).filter(Boolean)));
          
          return (
            <div style={{ fontSize: '11px' }}>
              {colors.length > 0 && (
                <div style={{ marginBottom: '2px' }}>
                  <Tag color="magenta">
                    {colors.length}种颜色
                  </Tag>
                </div>
              )}
              {sizes.length > 0 && (
                <div>
                  <Tag color="purple">
                    {sizes.length}种尺寸
                  </Tag>
                </div>
              )}
              {colors.length === 0 && sizes.length === 0 && (
                <div style={{ color: '#999', textAlign: 'center' }}>
                  - 系列产品 -
                </div>
              )}
            </div>
          );
        }
        const productRecord = record as ProductInformationData;
        return (
          <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
            <Space direction="vertical" size={2}>
              {productRecord.color_name && (
                <Tag color="magenta">
                  {productRecord.color_name}
                </Tag>
              )}
              {productRecord.size_name && (
                <Tag color="purple">
                  {productRecord.size_name}
                </Tag>
              )}
              {productRecord.variation_theme && (
                <div style={{ fontSize: '10px', color: '#999' }}>
                  主题: {productRecord.variation_theme}
                </div>
              )}
            </Space>
          </div>
        );
      }
    },
    {
      title: '颜色/尺寸映射',
      key: 'mapping_info',
      width: 120,
      ellipsis: true,
      render: (_, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        const productRecord = record as ProductInformationData;
        return (
          <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
            {productRecord.color_map && <div>颜色: {productRecord.color_map}</div>}
            {productRecord.size_map && <div>尺寸: {productRecord.size_map}</div>}
            {(!productRecord.color_map && !productRecord.size_map) && '-'}
          </div>
        );
      }
    },
    {
      title: '产品描述',
      dataIndex: 'product_description',
      key: 'product_description',
      width: 200,
      ellipsis: {
        showTitle: false,
      },
      render: (description: string, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        return (
          <Tooltip placement="topLeft" title={description}>
            <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
              {description ? (description.length > 50 ? `${description.substring(0, 50)}...` : description) : '-'}
            </div>
          </Tooltip>
        );
      }
    },
    {
      title: '产品要点',
      key: 'bullet_points',
      width: 250,
      ellipsis: {
        showTitle: false,
      },
      render: (_, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        const productRecord = record as ProductInformationData;
        const bulletPoints = [
          productRecord.bullet_point1,
          productRecord.bullet_point2,
          productRecord.bullet_point3,
          productRecord.bullet_point4,
          productRecord.bullet_point5
        ].filter(point => point && point.trim());
        
        if (bulletPoints.length === 0) return '-';
        
        const displayText = bulletPoints.map((point, index) => `${index + 1}. ${point}`).join(' | ');
        const shortText = displayText.length > 100 ? `${displayText.substring(0, 100)}...` : displayText;
        
        return (
          <Tooltip placement="topLeft" title={
            <div>
              {bulletPoints.map((point, index) => (
                <div key={index} style={{ marginBottom: '4px' }}>
                  <strong>{index + 1}.</strong> {point}
                </div>
              ))}
            </div>
          }>
            <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
              {shortText}
            </div>
          </Tooltip>
        );
      }
    },
    {
      title: '通用关键词',
      dataIndex: 'generic_keywords',
      key: 'generic_keywords',
      width: 150,
      ellipsis: true,
      render: (value: string, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        return (
          <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
            {value || '-'}
          </div>
        );
      }
    },
    {
      title: '产品属性',
      key: 'product_attributes',
      width: 180,
      ellipsis: true,
      render: (_, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        const productRecord = record as ProductInformationData;
        const attributes = [];
        
        if (productRecord.target_gender) attributes.push(`性别: ${productRecord.target_gender}`);
        if (productRecord.department_name) attributes.push(`部门: ${productRecord.department_name}`);
        if (productRecord.age_range_description) attributes.push(`年龄: ${productRecord.age_range_description}`);
        if (productRecord.style_name) attributes.push(`风格: ${productRecord.style_name}`);
        
        return attributes.length > 0 ? (
          <Tooltip title={attributes.join(', ')}>
            <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
              {attributes.slice(0, 2).map((attr, index) => (
                <div key={index} style={{ fontSize: '11px' }}>{attr}</div>
              ))}
              {attributes.length > 2 && <div style={{ fontSize: '10px', color: '#999' }}>+{attributes.length - 2}项</div>}
            </div>
          </Tooltip>
        ) : '-';
      }
    },
    {
      title: '材质特性',
      key: 'material_features',
      width: 160,
      ellipsis: true,
      render: (_, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        const productRecord = record as ProductInformationData;
        const features = [];
        
        if (productRecord.material_type) features.push(`材质: ${productRecord.material_type}`);
        if (productRecord.outer_material_type1) features.push(`外材: ${productRecord.outer_material_type1}`);
        if (productRecord.closure_type) features.push(`扣合: ${productRecord.closure_type}`);
        if (productRecord.water_resistance_level) features.push(`防水: ${productRecord.water_resistance_level}`);
        if (productRecord.special_features) features.push(`特性: ${productRecord.special_features}`);
        
        return features.length > 0 ? (
          <Tooltip title={features.join(', ')}>
            <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
              {features.slice(0, 2).map((feature, index) => (
                <div key={index} style={{ fontSize: '11px' }}>{feature}</div>
              ))}
              {features.length > 2 && <div style={{ fontSize: '10px', color: '#999' }}>+{features.length - 2}项</div>}
            </div>
          </Tooltip>
        ) : '-';
      }
    },
    {
      title: '护理信息',
      key: 'care_info',
      width: 150,
      ellipsis: true,
      render: (_, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        const productRecord = record as ProductInformationData;
        const careInfo = [];
        
        if (productRecord.care_instructions) careInfo.push(`护理: ${productRecord.care_instructions}`);
        if (productRecord.recommended_uses_for_product) careInfo.push(`用途: ${productRecord.recommended_uses_for_product}`);
        if (productRecord.lining_description) careInfo.push(`内衬: ${productRecord.lining_description}`);
        if (productRecord.strap_type) careInfo.push(`带子: ${productRecord.strap_type}`);
        
        return careInfo.length > 0 ? (
          <Tooltip title={careInfo.join(', ')}>
            <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
              {careInfo.slice(0, 2).map((info, index) => (
                <div key={index} style={{ fontSize: '11px' }}>{info}</div>
              ))}
              {careInfo.length > 2 && <div style={{ fontSize: '10px', color: '#999' }}>+{careInfo.length - 2}项</div>}
            </div>
          </Tooltip>
        ) : '-';
      }
    },
    {
      title: '适用季节',
      key: 'seasons_info',
      width: 120,
      ellipsis: true,
      render: (_, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        const productRecord = record as ProductInformationData;
        const seasons = [
          productRecord.seasons1,
          productRecord.seasons2,
          productRecord.seasons3,
          productRecord.seasons4
        ].filter(season => season && season.trim());
        
        if (seasons.length === 0) return '-';
        
        return (
          <Tooltip title={seasons.join(', ')}>
            <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
              {seasons.slice(0, 2).map((season, index) => (
                <div key={index} style={{ fontSize: '11px' }}>{season}</div>
              ))}
              {seasons.length > 2 && <div style={{ fontSize: '10px', color: '#999' }}>+{seasons.length - 2}项</div>}
            </div>
          </Tooltip>
        );
      }
    },
    {
      title: '生活方式',
      dataIndex: 'lifestyle1',
      key: 'lifestyle1',
      width: 100,
      ellipsis: true,
      render: (value: string, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        return (
          <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
            {value || '-'}
          </div>
        );
      }
    },
    {
      title: '存储规格',
      key: 'storage_info',
      width: 140,
      ellipsis: true,
      render: (_, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        const productRecord = record as ProductInformationData;
        const storageInfo = [];
        
        if (productRecord.storage_volume && productRecord.storage_volume_unit_of_measure) {
          storageInfo.push(`容量: ${productRecord.storage_volume}${productRecord.storage_volume_unit_of_measure}`);
        }
        
        return storageInfo.length > 0 ? (
          <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
            {storageInfo.map((info, index) => (
              <div key={index} style={{ fontSize: '11px' }}>{info}</div>
            ))}
          </div>
        ) : '-';
      }
    },
    {
      title: '尺寸规格',
      key: 'dimension_info',
      width: 160,
      ellipsis: true,
      render: (_, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        const productRecord = record as ProductInformationData;
        const dimensions = [];
        
        if (productRecord.depth_front_to_back && productRecord.depth_front_to_back_unit_of_measure) {
          dimensions.push(`深度: ${productRecord.depth_front_to_back}${productRecord.depth_front_to_back_unit_of_measure}`);
        }
        if (productRecord.depth_width_side_to_side && productRecord.depth_width_side_to_side_unit_of_measure) {
          dimensions.push(`宽度: ${productRecord.depth_width_side_to_side}${productRecord.depth_width_side_to_side_unit_of_measure}`);
        }
        if (productRecord.depth_height_floor_to_top && productRecord.depth_height_floor_to_top_unit_of_measure) {
          dimensions.push(`高度: ${productRecord.depth_height_floor_to_top}${productRecord.depth_height_floor_to_top_unit_of_measure}`);
        }
        
        return dimensions.length > 0 ? (
          <Tooltip title={dimensions.join(', ')}>
            <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
              {dimensions.slice(0, 2).map((dim, index) => (
                <div key={index} style={{ fontSize: '11px' }}>{dim}</div>
              ))}
              {dimensions.length > 2 && <div style={{ fontSize: '10px', color: '#999' }}>+{dimensions.length - 2}项</div>}
            </div>
          </Tooltip>
        ) : '-';
      }
    },
    {
      title: '原产国',
      dataIndex: 'country_of_origin',
      key: 'country_of_origin',
      width: 100,
      ellipsis: true,
      render: (value: string, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        return (
          <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
            {value || '-'}
          </div>
        );
      }
    },
    {
      title: '进口/安全信息',
      key: 'import_safety_info',
      width: 140,
      ellipsis: true,
      render: (_, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        const productRecord = record as ProductInformationData;
        const info = [];
        
        if (productRecord.import_designation) info.push(`进口: ${productRecord.import_designation}`);
        if (productRecord.cpsia_cautionary_statement1) info.push(`安全: ${productRecord.cpsia_cautionary_statement1}`);
        
        return info.length > 0 ? (
          <Tooltip title={info.join(', ')}>
            <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
              {info.map((item, index) => (
                <div key={index} style={{ fontSize: '11px' }}>{item}</div>
              ))}
            </div>
          </Tooltip>
        ) : '-';
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          // 父级行的操作
          const isExpanded = expandedRowKeys.includes(`parent-${record.key}`);
          return (
            <Space size="small">
              <Button
                type="text"
                size="small"
                onClick={() => handleExpand(record.key)}
                style={{
                  color: isExpanded ? '#1890ff' : '#666',
                  fontSize: '12px'
                }}
              >
                {isExpanded ? '收起子产品' : '展开子产品'}
              </Button>
              <Divider type="vertical" />
              <span style={{ color: '#999', fontSize: '11px' }}>
                母SKU组
              </span>
            </Space>
          );
        } else {
          // 子级行或普通行的操作
          const productRecord = record as ProductInformationData;
          return (
            <div style={{ marginLeft: isGroupedView ? '40px' : '0' }}>
              <Space size="small">
                <Tooltip title="查看详情">
                  <Button
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => handleViewDetail(productRecord)}
                    style={{ padding: '2px 4px' }}
                  />
                </Tooltip>
                <Tooltip title="编辑">
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(productRecord)}
                    style={{ padding: '2px 4px' }}
                  />
                </Tooltip>
                <Popconfirm
                  title="确定删除这条记录吗？"
                  onConfirm={() => handleDelete(productRecord)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Tooltip title="删除">
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      style={{ padding: '2px 4px' }}
                    />
                  </Tooltip>
                </Popconfirm>
              </Space>
            </div>
          );
        }
      },
    },
  ];

  // 处理行选择
  const handleRowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[], newSelectedRows: TableRowData[]) => {
      // 不过滤keys，让Antd正确管理选择状态
      setSelectedRowKeys(newSelectedRowKeys as string[]);
      
      // 但是在selectedRows中只保存子SKU数据，用于业务逻辑
      const productRows = newSelectedRows.filter((row): row is ProductInformationData => {
        return !('isParent' in row);
      });
      setSelectedRows(productRows);
    },
    onSelect: (record: TableRowData, selected: boolean) => {
      const key = isGroupedView && 'isParent' in record && record.isParent 
        ? `parent-${record.key}` 
        : `${(record as ProductInformationData).site}-${(record as ProductInformationData).item_sku}`;
      
      if (isGroupedView && 'isParent' in record && record.isParent) {
        // 选择母SKU时，联动选择所有子SKU
        const parentRecord = record as GroupedProductData;
        const childKeys = parentRecord.children.map(child => `${child.site}-${child.item_sku}`);
        
        if (selected) {
          // 选中母SKU：先展开以显示子SKU，然后延迟设置选择状态
          const parentSkuKey = `parent-${parentRecord.key}`;
          const needExpand = !expandedRowKeys.includes(parentSkuKey);
          
          if (needExpand) {
            setExpandedRowKeys([...expandedRowKeys, parentSkuKey]);
          }
          
          // 准备选择状态数据
          const newKeys = Array.from(new Set([...selectedRowKeys, key, ...childKeys]));
          const newChildRows = [...selectedRows];
          
          // 添加所有子SKU到selectedRows
          parentRecord.children.forEach(childSku => {
            const childKey = `${childSku.site}-${childSku.item_sku}`;
            if (!newChildRows.some(row => `${row.site}-${row.item_sku}` === childKey)) {
              newChildRows.push(childSku);
            }
          });
          
          // 统一使用延迟设置，确保所有情况下都能正确处理状态更新
          setTimeout(() => {
            setSelectedRowKeys(newKeys);
            setSelectedRows(newChildRows);
          }, needExpand ? 50 : 10);
        } else {
          // 取消选中母SKU：移除母SKU key和所有子SKU keys
          const keysToRemove = [key, ...childKeys];
          const newKeys = selectedRowKeys.filter(k => !keysToRemove.includes(k));
          const newChildRows = selectedRows.filter(row => {
            const rowKey = `${row.site}-${row.item_sku}`;
            return !childKeys.includes(rowKey);
          });
          
          // 也使用延迟设置确保状态更新的正确性
          setTimeout(() => {
            setSelectedRowKeys(newKeys);
            setSelectedRows(newChildRows);
          }, 10);
        }
      } else {
        // 选择子SKU时，需要检查是否影响母SKU状态
        const productRecord = record as ProductInformationData;
        const parentRow = groupedData.find(group => 
          group.children.some(child => 
            child.site === productRecord.site && child.item_sku === productRecord.item_sku
          )
        );
        
        if (selected) {
          // 选中子SKU
          const newKeys = [...selectedRowKeys, key];
          const newChildRows = [...selectedRows, productRecord];
          
          // 检查是否所有同级子SKU都被选中，如果是则也选中母SKU
          if (parentRow) {
            const allChildKeys = parentRow.children.map(child => `${child.site}-${child.item_sku}`);
            const selectedChildKeys = newKeys.filter(k => allChildKeys.includes(k));
            if (selectedChildKeys.length === allChildKeys.length) {
              const parentKey = `parent-${parentRow.key}`;
              if (!newKeys.includes(parentKey)) {
                newKeys.push(parentKey);
              }
            }
          }
          
          setSelectedRowKeys(newKeys);
          setSelectedRows(newChildRows);
        } else {
          // 取消选中子SKU
          const newKeys = selectedRowKeys.filter(k => k !== key);
          const newChildRows = selectedRows.filter(row => `${row.site}-${row.item_sku}` !== key);
          
          // 如果取消选中子SKU，确保母SKU也被取消选中
          if (parentRow) {
            const parentKey = `parent-${parentRow.key}`;
            if (newKeys.includes(parentKey)) {
              const parentIndex = newKeys.indexOf(parentKey);
              newKeys.splice(parentIndex, 1);
            }
          }
          
          setSelectedRowKeys(newKeys);
          setSelectedRows(newChildRows);
        }
      }
    },
    onSelectAll: (selected: boolean, selectedRows: TableRowData[], changeRows: TableRowData[]) => {
      if (selected) {
        // 全选：首先展开所有母SKU，然后选择所有子SKU
        const allParentKeys: string[] = [];
        const allKeys: string[] = [];
        const allChildRows: ProductInformationData[] = [];
        
        // 收集所有母SKU和子SKU
        groupedData.forEach(group => {
          const parentKey = `parent-${group.key}`;
          allParentKeys.push(parentKey);
          allKeys.push(parentKey);
          
          // 添加所有子SKU
          group.children.forEach(child => {
            const childKey = `${child.site}-${child.item_sku}`;
            if (!allKeys.includes(childKey)) {
              allKeys.push(childKey);
              allChildRows.push(child);
            }
          });
        });
        
        // 展开所有母SKU以确保子SKU可见
        const uniqueExpandedKeys = Array.from(new Set([...expandedRowKeys, ...allParentKeys]));
        setExpandedRowKeys(uniqueExpandedKeys);
        
        // 延迟设置选择状态，确保展开动画完成
        setTimeout(() => {
          setSelectedRowKeys(allKeys);
          setSelectedRows(allChildRows);
        }, 100);
      } else {
        // 取消全选
        setSelectedRowKeys([]);
        setSelectedRows([]);
      }
    },
    getCheckboxProps: (record: TableRowData) => ({
      name: isGroupedView && 'isParent' in record && record.isParent 
        ? `parent-${record.key}` 
        : `${(record as ProductInformationData).site}-${(record as ProductInformationData).item_sku}`,
    }),
  };

  // 组件加载时获取统计信息
  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  // 当数据加载时获取ASIN信息
  useEffect(() => {
    if (currentViewData && currentViewData.length > 0) {
      // 提取所有子SKU的seller-sku
      const sellerSkus = currentViewData
        .filter(record => !('isParent' in record && record.isParent))
        .map(record => {
          const productRecord = record as ProductInformationData;
          return productRecord.item_sku;
        })
        .filter(sku => sku);
      
      if (sellerSkus.length > 0) {
        fetchAsinData(sellerSkus, queryParams.site);
      }
    }
  }, [currentViewData, queryParams.site]);

  return (
    <div style={{ padding: '24px' }}>
      <style>
        {`
          .child-row {
            background-color: #fafbfc !important;
            border-left: 3px solid #e6f7ff !important;
          }
          .child-row:hover {
            background-color: #f0f8ff !important;
          }
          .child-row td {
            border-top: 1px solid #e6f7ff !important;
            position: relative;
          }
          
          .parent-row {
            background-color: #fff !important;
            border-left: 4px solid #1890ff !important;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important;
          }
          .parent-row:hover {
            background-color: #f8fafe !important;
          }
          
          .ant-table-thead > tr > th {
            background-color: #fafafa !important;
            font-weight: 600 !important;
            color: #262626 !important;
            border-bottom: 2px solid #e8e8e8 !important;
          }
          
          .ant-table-tbody > tr > td {
            padding: 12px 16px !important;
          }
          
          .child-row td:first-child::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background: linear-gradient(to bottom, #52c41a, #95f985);
          }
          
          /* 展开动画效果 */
          .child-row {
            animation: fadeInUp 0.3s ease-out;
          }
          
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
      
      <Card style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, marginBottom: 16, color: '#262626' }}>
          📋 产品资料管理
        </h1>
        
        {/* 统计信息 */}
        {statistics && (
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <Statistic 
                  title="总记录数" 
                  value={statistics.totalCount}
                  prefix="📊"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <Statistic 
                  title="母SKU数量" 
                  value={statistics.parentSkuCount} 
                  prefix="📁"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <Statistic 
                  title="站点数量" 
                  value={statistics.siteStats?.length || 0}
                  prefix="🌐"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <Statistic 
                  title="品牌数量" 
                  value={statistics.brandStats?.length || 0}
                  prefix="🏷️"
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* 搜索和筛选 */}
        <Space size="middle" style={{ marginBottom: 16 }}>
          <Search
            placeholder="搜索SKU/商品名称/品牌"
            allowClear
            style={{ width: 300 }}
            value={queryParams.search}
            onChange={(e) => updateQueryParams({ search: e.target.value })}
            onSearch={() => fetchData()}
          />
          
          <Select
            style={{ width: 120 }}
            placeholder="选择站点"
            value={queryParams.site}
            onChange={(value) => {
              updateQueryParams({ site: value });
              // 站点筛选后自动触发数据获取
              setTimeout(() => fetchData(), 100);
            }}
          >
            <Option value="all">全部站点</Option>
            {siteList.map(site => (
              <Option key={site} value={site}>{site}</Option>
            ))}
          </Select>

          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => fetchData()}
          >
            搜索
          </Button>

          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              updateQueryParams({
                page: 1,
                search: '',
                site: 'all'
              });
            }}
          >
            重置
          </Button>

          {/* 视图切换按钮 */}
          <Button.Group>
            <Button 
              type={isGroupedView ? "primary" : "default"}
              onClick={() => {
                if (!isGroupedView) {
                  setIsGroupedView(true);
                  // 切换到分组视图时重置分页到第一页
                  updateQueryParams({ page: 1 });
                }
              }}
              icon={<span>📁</span>}
            >
              分组视图
            </Button>
            <Button 
              type={!isGroupedView ? "primary" : "default"}
              onClick={() => {
                if (isGroupedView) {
                  setIsGroupedView(false);
                  // 切换到列表视图时重置分页到第一页
                  updateQueryParams({ page: 1 });
                }
              }}
              icon={<span>📄</span>}
            >
              列表视图
            </Button>
          </Button.Group>

          {/* 数据操作按钮 */}
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => setUploadVisible(true)}
          >
            上传资料表
          </Button>

        </Space>

        {/* 批量操作 */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            {selectedRowKeys.length > 0 && <span>已选择 {selectedRowKeys.length} 项</span>}
            <Button
              type="primary"
              icon={<ExportOutlined />}
              onClick={handleExportToTemplate}
              loading={exportLoading}
              disabled={selectedRowKeys.length === 0}
            >
              导出到模板
            </Button>
          </Space>
          <Popconfirm
            title="确定批量删除选中的记录吗？"
            onConfirm={handleBatchDelete}
            okText="确定"
            cancelText="取消"
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
            disabled={selectedRowKeys.length === 0}
          >
            <Button danger disabled={selectedRowKeys.length === 0}>
              批量删除
            </Button>
          </Popconfirm>
        </div>

        {/* 数据表格 */}
        <div ref={tableRef}>
          <Table
            columns={columns}
            dataSource={currentViewData}
            rowKey={(record) => {
              if ('isParent' in record && record.isParent) {
                return `parent-${record.key}`;
              } else {
                const productRecord = record as ProductInformationData;
                return `${productRecord.site}-${productRecord.item_sku}`;
              }
            }}
            rowSelection={handleRowSelection}
            loading={loading}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            }}
            sticky={{ offsetHeader: 64 }}
            size="middle"
            rowClassName={(record) => {
              if (isGroupedView && 'isParent' in record && record.isParent) {
                return 'parent-row';
              } else if (isGroupedView && !('isParent' in record && record.isParent)) {
                return 'child-row';
              }
              return '';
            }}
          />
        </div>

        {/* 分页 */}
        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <Pagination
            current={currentPagination.current}
            pageSize={currentPagination.pageSize}
            total={currentPagination.total}
            showSizeChanger
            showQuickJumper
            showTotal={(total, range) => {
              if (isGroupedView) {
                return `第 ${range[0]}-${range[1]} 个母SKU，共 ${total} 个母SKU`;
              } else {
                return `第 ${range[0]}-${range[1]} 条记录，共 ${total} 条记录`;
              }
            }}
            pageSizeOptions={['20', '50', '100', '200']}
            onChange={(page, pageSize) => {
              updateQueryParams({ page, limit: pageSize || queryParams.limit });
            }}
          />
        </div>
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="产品资料详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={900}
      >
        {currentRecord && (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="站点" span={1}>{currentRecord.site}</Descriptions.Item>
            <Descriptions.Item label="商品SKU" span={1}>{currentRecord.item_sku}</Descriptions.Item>
            <Descriptions.Item label="商品名称" span={2}>{currentRecord.item_name}</Descriptions.Item>
            <Descriptions.Item label="外部产品ID" span={1}>{currentRecord.external_product_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="外部产品ID类型" span={1}>{currentRecord.external_product_id_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="原始父SKU" span={1}>{currentRecord.original_parent_sku || '-'}</Descriptions.Item>
            <Descriptions.Item label="父SKU" span={1}>{currentRecord.parent_sku || '-'}</Descriptions.Item>
            <Descriptions.Item label="品牌" span={1}>{currentRecord.brand_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="制造商" span={1}>{currentRecord.manufacturer || '-'}</Descriptions.Item>
            <Descriptions.Item label="产品类型" span={1}>{currentRecord.item_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="商品类型" span={1}>{currentRecord.feed_product_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="型号" span={1}>{currentRecord.model || '-'}</Descriptions.Item>
            <Descriptions.Item label="颜色" span={1}>{currentRecord.color_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="尺寸" span={1}>{currentRecord.size_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="标准价格" span={1}>{currentRecord.standard_price ? `$${currentRecord.standard_price}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="标价" span={1}>{currentRecord.list_price ? `$${currentRecord.list_price}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="数量" span={1}>{currentRecord.quantity || '-'}</Descriptions.Item>
            <Descriptions.Item label="原产国" span={1}>{currentRecord.country_of_origin || '-'}</Descriptions.Item>
            <Descriptions.Item label="父子关系" span={1}>{currentRecord.parent_child || '-'}</Descriptions.Item>
            <Descriptions.Item label="关系类型" span={1}>{currentRecord.relationship_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="变体主题" span={1}>{currentRecord.variation_theme || '-'}</Descriptions.Item>
            <Descriptions.Item label="颜色映射" span={1}>{currentRecord.color_map || '-'}</Descriptions.Item>
            <Descriptions.Item label="尺寸映射" span={1}>{currentRecord.size_map || '-'}</Descriptions.Item>
            <Descriptions.Item label="目标性别" span={1}>{currentRecord.target_gender || '-'}</Descriptions.Item>
            <Descriptions.Item label="部门" span={1}>{currentRecord.department_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="风格" span={1}>{currentRecord.style_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="通用关键词" span={2}>{currentRecord.generic_keywords || '-'}</Descriptions.Item>
            <Descriptions.Item label="产品描述" span={2}>
              <div style={{ maxHeight: '120px', overflow: 'auto' }}>
                {currentRecord.product_description || '-'}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="要点1" span={2}>{currentRecord.bullet_point1 || '-'}</Descriptions.Item>
            <Descriptions.Item label="要点2" span={2}>{currentRecord.bullet_point2 || '-'}</Descriptions.Item>
            <Descriptions.Item label="要点3" span={2}>{currentRecord.bullet_point3 || '-'}</Descriptions.Item>
            <Descriptions.Item label="要点4" span={2}>{currentRecord.bullet_point4 || '-'}</Descriptions.Item>
            <Descriptions.Item label="要点5" span={2}>{currentRecord.bullet_point5 || '-'}</Descriptions.Item>
            {currentRecord.main_image_url && (
              <Descriptions.Item label="主图" span={2}>
                <img 
                  src={currentRecord.main_image_url} 
                  alt="主图" 
                  style={{ maxWidth: '200px', maxHeight: '150px' }} 
                />
              </Descriptions.Item>
            )}
            {currentRecord.swatch_image_url && (
              <Descriptions.Item label="样本图" span={2}>
                <img 
                  src={currentRecord.swatch_image_url} 
                  alt="样本图" 
                  style={{ maxWidth: '200px', maxHeight: '150px' }} 
                />
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑产品资料"
        open={editVisible}
        onOk={handleSaveEdit}
        onCancel={() => setEditVisible(false)}
        width={1000}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="商品名称" name="item_name">
                <Input placeholder="请输入商品名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="外部产品ID" name="external_product_id">
                <Input placeholder="请输入外部产品ID" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="品牌" name="brand_name">
                <Input placeholder="请输入品牌" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="制造商" name="manufacturer">
                <Input placeholder="请输入制造商" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="产品类型" name="item_type">
                <Input placeholder="请输入产品类型" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="型号" name="model">
                <Input placeholder="请输入型号" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="标准价格" name="standard_price">
                <Input type="number" placeholder="请输入标准价格" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="标价" name="list_price">
                <Input type="number" placeholder="请输入标价" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="数量" name="quantity">
                <Input type="number" placeholder="请输入数量" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="颜色" name="color_name">
                <Input placeholder="请输入颜色" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="尺寸" name="size_name">
                <Input placeholder="请输入尺寸" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="原产国" name="country_of_origin">
                <Input placeholder="请输入原产国" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="父SKU" name="parent_sku">
                <Input placeholder="请输入父SKU" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="变体主题" name="variation_theme">
                <Input placeholder="请输入变体主题" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="目标性别" name="target_gender">
                <Select placeholder="请选择目标性别" allowClear>
                  <Option value="Male">男性</Option>
                  <Option value="Female">女性</Option>
                  <Option value="Unisex">中性</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="部门" name="department_name">
                <Input placeholder="请输入部门" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="产品描述" name="product_description">
            <Input.TextArea rows={4} placeholder="请输入产品描述" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="通用关键词" name="generic_keywords">
                <Input placeholder="请输入通用关键词" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="主图URL" name="main_image_url">
                <Input placeholder="请输入主图URL" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="要点1" name="bullet_point1">
            <Input.TextArea rows={2} placeholder="请输入要点1" />
          </Form.Item>

          <Form.Item label="要点2" name="bullet_point2">
            <Input.TextArea rows={2} placeholder="请输入要点2" />
          </Form.Item>

          <Form.Item label="要点3" name="bullet_point3">
            <Input.TextArea rows={2} placeholder="请输入要点3" />
          </Form.Item>
        </Form>
      </Modal>


      {/* 上传弹窗 */}
      <Modal
        title="上传资料表文件"
        open={uploadVisible}
        onCancel={() => {
          setUploadVisible(false);
          setUploadCountry('');
          setFileList([]);
        }}
        footer={null}
        width={600}
      >
        <div style={{ padding: '16px 0' }}>
          <p style={{ marginBottom: 16, color: '#666' }}>
            上传Excel资料表文件，系统将自动解析并导入到产品资料数据库中
          </p>
          
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                选择对应国家：
              </label>
              <Select
                style={{ width: '100%' }}
                placeholder="请选择资料表对应的国家站点"
                value={uploadCountry}
                onChange={setUploadCountry}
                size="large"
              >
                <Option value="美国">美国</Option>
                <Option value="英国">英国</Option>
                <Option value="德国">德国</Option>
                <Option value="法国">法国</Option>
                <Option value="意大利">意大利</Option>
                <Option value="西班牙">西班牙</Option>
                <Option value="日本">日本</Option>
                <Option value="加拿大">加拿大</Option>
                <Option value="澳大利亚">澳大利亚</Option>
                <Option value="印度">印度</Option>
                <Option value="阿联酋">阿联酋</Option>
              </Select>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                选择Excel文件：
              </label>
              <Upload
                fileList={fileList}
                onChange={({ fileList }) => setFileList(fileList)}
                beforeUpload={(file) => {
                  // 检查文件类型
                  const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                                 file.type === 'application/vnd.ms-excel' ||
                                 file.name.endsWith('.xlsx') || 
                                 file.name.endsWith('.xls');
                  if (!isExcel) {
                    message.error('请选择Excel文件（.xlsx或.xls）');
                    return false;
                  }
                  
                  // 检查文件大小
                  const isLt10M = file.size / 1024 / 1024 < 10;
                  if (!isLt10M) {
                    message.error('文件大小不能超过10MB');
                    return false;
                  }
                  
                  // 检查是否选择了国家
                  if (!uploadCountry) {
                    message.error('请先选择对应的国家');
                    return false;
                  }
                  
                  // 自动上传文件
                  handleUploadTemplate(file);
                  return false; // 阻止默认上传行为
                }}
                maxCount={1}
                accept=".xlsx,.xls"
                style={{ width: '100%' }}
              >
                <Button icon={<UploadOutlined />} size="large" style={{ width: '100%' }}>
                  选择Excel文件
                </Button>
              </Upload>
              <div style={{ marginTop: '8px', color: '#999', fontSize: '12px' }}>
                支持.xlsx和.xls格式，文件大小限制10MB
              </div>
            </div>
          </Space>
        </div>
      </Modal>
    </div>
  );
};

export default ProductInformation; 