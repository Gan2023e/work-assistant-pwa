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
  Card
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
    limit: 20,
    search: '',
    site: 'all',
    status: 'all',
    sort_by: 'parent_sku',
    sort_order: 'ASC'
  });
  
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
        if (selectedSku) {
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
    const mainCountries = ['美国', '英国', '德国', '法国', '意大利'];
    
    const csvData = listings.map(sku => {
      const baseData = {
        母SKU: sku.parent_sku,
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
  
  // 查看SKU详情
  const handleViewSkuDetail = (sku: ParentSkuData) => {
    setSelectedSku(sku);
    setSkuDetailVisible(true);
    fetchSkuMappings(sku.child_sku);
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
    const status = countryStatus[country];
    
    if (!status?.isListed || status.mappings.length === 0) {
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
              onClick={() => handleViewSkuDetail(listings.find(sku => sku.child_sku === childSku)!)}
            >
              {mapping.amzSku}
            </Tag>
          </Tooltip>
        ))}
      </div>
    );
  };

  // 表格列配置 - 固定5个主要国家列
  const getColumns = () => {
    // 定义5个主要国家
    const mainCountries = ['美国', '英国', '德国', '法国', '意大利'];
    
    const baseColumns = [
      {
        title: '母SKU',
        dataIndex: 'parent_sku',
        key: 'parent_sku',
        width: 120,
        fixed: 'left' as const,
        sorter: true,
      },
      {
        title: '子SKU',
        dataIndex: 'child_sku',
        key: 'child_sku',
        width: 120,
        fixed: 'left' as const,
      },
      {
        title: '颜色',
        dataIndex: 'sellercolorname',
        key: 'sellercolorname',
        width: 80,
        render: (text: string) => text || '-',
      },
      {
        title: '尺寸',
        dataIndex: 'sellersizename', 
        key: 'sellersizename',
        width: 80,
        render: (text: string) => text || '-',
      },
      {
        title: '装箱数量',
        dataIndex: 'qty_per_box',
        key: 'qty_per_box',
        width: 80,
        render: (text: number) => text ? `${text}个` : '-',
      }
    ];

    // 固定生成5个主要国家列
    const countryColumns = mainCountries.map(country => ({
      title: country,
      key: `country-${country}`,
      width: 120,
      render: (text: any, record: ParentSkuData) => 
        renderCountryStatus(record.countryStatus, record.child_sku, country),
    }));

    const endColumns = [
      {
        title: '上架进度',
        key: 'listingProgress',
        width: 150,
        render: (text: any, record: ParentSkuData) => (
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
      },
      {
        title: '上架状态',
        dataIndex: 'listingStatus',
        key: 'listingStatus',
        width: 100,
        render: (status: string) => {
          const statusMap = {
            'listed': { color: 'success', text: '全部上架' },
            'partial': { color: 'warning', text: '部分上架' },
            'unlisted': { color: 'default', text: '未上架' }
          };
          const config = statusMap[status as keyof typeof statusMap];
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      {
        title: '操作',
        key: 'actions',
        width: 120,
        fixed: 'right' as const,
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
            value={queryParams.site}
            onChange={(value) => updateQueryParams({ site: value })}
          >
            <Option value="all">全部国家</Option>
            {['美国', '英国', '德国', '法国', '意大利'].map(country => (
              <Option key={country} value={country}>
                {country}
              </Option>
            ))}
          </Select>
          
          <Select
            value={queryParams.status}
            onChange={(value) => updateQueryParams({ status: value })}
          >
            <Option value="all">全部状态</Option>
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
          dataSource={listings}
          loading={loading}
          pagination={false}
          scroll={{ x: 1450 }}
          rowKey="skuid"
          onChange={handleTableChange}
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
              {['美国', '英国', '德国', '法国', '意大利'].map(country => (
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
    </div>
  );
};

export default Listings; 