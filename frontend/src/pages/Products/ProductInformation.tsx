import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Spin
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined
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
  const [currentRecord, setCurrentRecord] = useState<ProductInformationData | null>(null);
  const [form] = Form.useForm();

  // 按父SKU分组数据的函数
  const groupDataByParentSku = useCallback((rawData: ProductInformationData[]): GroupedProductData[] => {
    const groups: { [key: string]: ProductInformationData[] } = {};
    
    // 按parent_sku分组，没有parent_sku的单独处理
    rawData.forEach(item => {
      const parentKey = item.parent_sku || `single_${item.site}_${item.item_sku}`;
      if (!groups[parentKey]) {
        groups[parentKey] = [];
      }
      groups[parentKey].push(item);
    });

    // 转换为GroupedProductData格式
    const result: GroupedProductData[] = [];
    Object.entries(groups).forEach(([parentKey, children]) => {
      if (children.length === 1 && !children[0].parent_sku) {
        // 单个产品且没有parent_sku，直接添加为普通行
        return;
      }

      // 计算汇总信息
      const totalQuantity = children.reduce((sum, child) => sum + (child.quantity || 0), 0);
      const firstChild = children[0];
      
      const groupedItem: GroupedProductData = {
        key: parentKey,
        parent_sku: parentKey.startsWith('single_') ? '' : parentKey,
        site: firstChild.site,
        brand_name: firstChild.brand_name,
        manufacturer: firstChild.manufacturer,
        total_quantity: totalQuantity,
        children_count: children.length,
        children: children,
        isParent: true
      };
      
      result.push(groupedItem);
    });

    // 按parent_sku排序
    return result.sort((a, b) => (a.parent_sku || '').localeCompare(b.parent_sku || ''));
  }, []);

  // 处理数据，根据视图模式生成不同的数据结构
  const processedData = useMemo((): TableRowData[] => {
    if (!isGroupedView) {
      return data;
    }
    return groupedData;
  }, [data, groupedData, isGroupedView]);

  // 获取数据列表
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        params.append(key, value.toString());
      });

      const response = await fetch(`${API_BASE_URL}/api/product-information/list?${params}`);
      const result = await response.json();

      if (result.success) {
        const rawData = result.data;
        setData(rawData);
        // 生成分组数据
        const grouped = groupDataByParentSku(rawData);
        setGroupedData(grouped);
        setPagination(result.pagination);
        setSiteList(result.siteList || []);
      } else {
        message.error(result.message || '获取数据失败');
      }
    } catch (error) {
      message.error('获取数据失败: ' + error);
    } finally {
      setLoading(false);
    }
  }, [queryParams, groupDataByParentSku]);

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
      
      const response = await fetch(`${API_BASE_URL}/api/product-information/${currentRecord?.site}/${currentRecord?.item_sku}`, {
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
      message.error('保存失败: ' + error);
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
      message.error('删除失败: ' + error);
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
      message.error('批量删除失败: ' + error);
    }
  };

  // 表格列定义
  const columns: ColumnsType<TableRowData> = [
    {
      title: '站点',
      dataIndex: 'site',
      key: 'site',
      width: 80,
      fixed: 'left',
      render: (site: string) => <Tag color="blue">{site}</Tag>
    },
    {
      title: isGroupedView ? '父SKU/商品SKU' : '商品SKU',
      dataIndex: 'item_sku',
      key: 'item_sku',
      width: 150,
      fixed: 'left',
      ellipsis: true,
      render: (value: string, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          // 父级行显示父SKU
          return (
            <div style={{ fontWeight: 'bold', color: '#1890ff' }}>
              📁 {record.parent_sku || '未分组'}
              <div style={{ fontSize: '12px', color: '#999', fontWeight: 'normal' }}>
                {record.children_count} 个子产品
              </div>
            </div>
          );
        } else {
          // 子级行或普通行显示商品SKU
          return <span style={{ marginLeft: isGroupedView ? '16px' : '0' }}>{value}</span>;
        }
      }
    },
    {
      title: '商品名称',
      dataIndex: 'item_name',
      key: 'item_name',
      width: 200,
      ellipsis: {
        showTitle: false,
      },
      render: (name: string, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          // 父级行显示汇总信息
          return (
            <span style={{ fontWeight: 'bold' }}>
              {record.brand_name} 系列产品
            </span>
          );
        } else {
          return (
            <Tooltip placement="topLeft" title={name}>
              <span style={{ marginLeft: isGroupedView ? '16px' : '0' }}>{name}</span>
            </Tooltip>
          );
        }
      },
    },
    {
      title: '外部产品ID',
      dataIndex: 'external_product_id',
      key: 'external_product_id',
      width: 120,
      ellipsis: true,
      render: (value: string, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        return value || '-';
      }
    },
    {
      title: '品牌',
      dataIndex: 'brand_name',
      key: 'brand_name',
      width: 100,
      ellipsis: true
    },
    {
      title: '制造商',
      dataIndex: 'manufacturer',
      key: 'manufacturer',
      width: 120,
      ellipsis: true
    },
    {
      title: '产品类型',
      dataIndex: 'item_type',
      key: 'item_type',
      width: 120,
      ellipsis: true,
      render: (value: string, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        return value || '-';
      }
    },
    {
      title: '标准价格',
      dataIndex: 'standard_price',
      key: 'standard_price',
      width: 100,
      render: (price: number, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        return price ? `$${price}` : '-';
      }
    },
    {
      title: '标价',
      dataIndex: 'list_price',
      key: 'list_price',
      width: 100,
      render: (price: number, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        return price ? `$${price}` : '-';
      }
    },
    {
      title: '原始父SKU',
      dataIndex: 'original_parent_sku',
      key: 'original_parent_sku',
      width: 120,
      ellipsis: true,
      render: (value: string, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        return value || '-';
      }
    },
    {
      title: '父SKU',
      dataIndex: 'parent_sku',
      key: 'parent_sku',
      width: 120,
      ellipsis: true,
      render: (value: string, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return record.parent_sku || '-';
        }
        return value || '-';
      }
    },
    {
      title: '颜色',
      dataIndex: 'color_name',
      key: 'color_name',
      width: 100,
      ellipsis: true,
      render: (value: string, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        return value || '-';
      }
    },
    {
      title: '尺寸',
      dataIndex: 'size_name',
      key: 'size_name',
      width: 100,
      ellipsis: true,
      render: (value: string, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return '-';
        }
        return value || '-';
      }
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      render: (qty: number, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          return <span style={{ fontWeight: 'bold', color: '#52c41a' }}>{record.total_quantity}</span>;
        }
        return qty || '-';
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
        return value || '-';
      }
    },
    {
      title: '主图',
      dataIndex: 'main_image_url',
      key: 'main_image_url',
      width: 80,
      render: (url: string, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          // 父级行显示第一个子产品的主图
          const firstChild = record.children[0];
          if (firstChild?.main_image_url) {
            return (
              <img 
                src={firstChild.main_image_url} 
                alt="主图" 
                style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', opacity: 0.7 }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            );
          }
          return '📁';
        }
        
        return url ? (
          <img 
            src={url} 
            alt="主图" 
            style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : '-';
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record: TableRowData) => {
        if (isGroupedView && 'isParent' in record && record.isParent) {
          // 父级行的操作
          return (
            <Space size="small">
              <Tooltip title="展开/收起">
                <Button
                  type="link"
                  size="small"
                  icon={<EyeOutlined />}
                />
              </Tooltip>
            </Space>
          );
        } else {
          // 子级行或普通行的操作
          const productRecord = record as ProductInformationData;
          return (
            <Space size="small">
              <Tooltip title="查看详情">
                <Button
                  type="link"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => handleViewDetail(productRecord)}
                />
              </Tooltip>
              <Tooltip title="编辑">
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(productRecord)}
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
                  />
                </Tooltip>
              </Popconfirm>
            </Space>
          );
        }
      },
    },
  ];

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedRowKeys: React.Key[], selectedRows: TableRowData[]) => {
      setSelectedRowKeys(selectedRowKeys as string[]);
      // 过滤出真正的产品数据行，排除父级分组行
      const productRows = selectedRows.filter((row): row is ProductInformationData => {
        return !('isParent' in row);
      });
      setSelectedRows(productRows);
    },
    // 在分组视图下，只允许选择子级行，不允许选择父级行
    getCheckboxProps: (record: TableRowData) => ({
      disabled: isGroupedView && 'isParent' in record && record.isParent,
    }),
  };

  // 组件加载时获取数据
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  return (
    <div style={{ padding: '24px' }}>
      <Card style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, marginBottom: 16 }}>产品资料管理</h1>
        
        {/* 统计信息 */}
        {statistics && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Statistic title="总记录数" value={statistics.totalCount} />
            </Col>
            <Col span={6}>
              <Statistic title="站点数量" value={statistics.siteStats?.length || 0} />
            </Col>
            <Col span={6}>
              <Statistic title="品牌数量" value={statistics.brandStats?.length || 0} />
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
            onChange={(value) => updateQueryParams({ site: value })}
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
              onClick={() => setIsGroupedView(true)}
              icon={<span>📁</span>}
            >
              分组视图
            </Button>
            <Button 
              type={!isGroupedView ? "primary" : "default"}
              onClick={() => setIsGroupedView(false)}
              icon={<span>📄</span>}
            >
              列表视图
            </Button>
          </Button.Group>
        </Space>

        {/* 批量操作 */}
        {selectedRowKeys.length > 0 && (
          <Space style={{ marginBottom: 16 }}>
            <span>已选择 {selectedRowKeys.length} 项</span>
            <Popconfirm
              title="确定批量删除选中的记录吗？"
              onConfirm={handleBatchDelete}
              okText="确定"
              cancelText="取消"
              icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
            >
              <Button danger>批量删除</Button>
            </Popconfirm>
          </Space>
        )}

        {/* 数据表格 */}
        <Table
          columns={columns}
          dataSource={processedData}
          rowKey={(record) => {
            if ('isParent' in record && record.isParent) {
              return `parent-${record.key}`;
            } else {
              const productRecord = record as ProductInformationData;
              return `${productRecord.site}-${productRecord.item_sku}`;
            }
          }}
          rowSelection={isGroupedView ? undefined : rowSelection}
          loading={loading}
          pagination={false}
          scroll={{ x: 2000 }}
          locale={{
            emptyText: <Empty description="暂无数据" />
          }}
          expandable={isGroupedView ? {
            expandedRowRender: (parentRecord) => {
              if ('isParent' in parentRecord && parentRecord.isParent) {
                // 为子表格创建专门的列定义，确保类型正确
                const childColumns: ColumnsType<ProductInformationData> = columns
                  .filter(col => col.key !== 'action') // 子表格不显示操作列
                  .map(col => ({
                    ...col,
                    render: col.render ? (value: any, record: ProductInformationData, index: number) => {
                      // 对于子行，强制非分组模式渲染
                      if (typeof col.render === 'function') {
                        return col.render(value, record, index);
                      }
                      return value;
                    } : undefined
                  })) as ColumnsType<ProductInformationData>;

                return (
                  <Table<ProductInformationData>
                    columns={childColumns}
                    dataSource={parentRecord.children}
                    rowKey={(record: ProductInformationData) => `child-${record.site}-${record.item_sku}`}
                    pagination={false}
                    showHeader={false}
                    size="small"
                    style={{ margin: '0 40px' }}
                  />
                );
              }
              return null;
            },
            defaultExpandAllRows: false,
            expandRowByClick: true,
            expandIcon: ({ expanded, onExpand, record }) => {
              if ('isParent' in record && record.isParent) {
                return (
                  <Button
                    type="text"
                    size="small"
                    icon={expanded ? '📂' : '📁'}
                    onClick={e => onExpand(record, e)}
                    style={{ border: 'none', padding: '0 4px' }}
                  />
                );
              }
              return null;
            }
          } : undefined}
        />

        {/* 分页 */}
        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <Pagination
            current={pagination.current}
            pageSize={pagination.pageSize}
            total={pagination.total}
            showSizeChanger
            showQuickJumper
            showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条/共 ${total} 条`}
            onChange={(page, pageSize) => {
              updateQueryParams({ page, limit: pageSize });
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
            <Descriptions.Item label="产品类型" span={1}>{currentRecord.feed_product_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="商品类型" span={1}>{currentRecord.item_type || '-'}</Descriptions.Item>
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
    </div>
  );
};

export default ProductInformation; 