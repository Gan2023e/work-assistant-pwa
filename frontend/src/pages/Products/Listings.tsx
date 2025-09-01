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
  Upload,
  Tag,
  Tooltip,
  Popconfirm,
  Space
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  InfoCircleOutlined
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
    const csvData = listings.map(sku => ({
      母SKU: sku.parent_sku,
      子SKU: sku.child_sku,
      颜色: sku.sellercolorname || '',
      尺寸: sku.sellersizename || '',
      装箱数量: sku.qty_per_box || '',
      上架状态: sku.listingStatus === 'listed' ? '全部上架' : 
                sku.listingStatus === 'partial' ? '部分上架' : '未上架',
      上架率: `${sku.listingRate}%`,
      上架站点数: `${sku.listedCount}/${sku.totalSites}`
    }));
    
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
  
  // 渲染站点标签
  const renderSiteTags = (sku: ParentSkuData) => {
    return siteList.map(site => {
      const status = sku.siteStatus[site];
      return (
        <Tooltip
          key={site}
          title={
            status?.isListed 
              ? `已上架 - Amazon SKU: ${status.amzSku} (${status.country})`
              : '未上架'
          }
        >
          <span
            className={`site-tag ${status?.isListed ? 'listed' : 'unlisted'}`}
            onClick={() => {
              if (!status?.isListed) {
                setSelectedSku(sku);
                addForm.setFieldsValue({
                  local_sku: sku.child_sku,
                  site: site
                });
                setAddMappingVisible(true);
              }
            }}
          >
            {site.replace('Amazon.', '')}: {status?.isListed ? '✓' : '✗'}
          </span>
        </Tooltip>
      );
    });
  };
  
  // 渲染SKU卡片
  const renderSkuCard = (sku: ParentSkuData) => (
    <div key={sku.skuid} className="sku-card">
      <div className="sku-header">
        <div className="sku-basic-info">
          <div className="sku-title">{sku.parent_sku}</div>
          <div className="sku-subtitle">{sku.child_sku}</div>
          <div className="sku-details">
            {sku.sellercolorname && <span>颜色: {sku.sellercolorname}</span>}
            {sku.sellersizename && <span>尺寸: {sku.sellersizename}</span>}
            {sku.qty_per_box && <span>装箱: {sku.qty_per_box}个</span>}
          </div>
        </div>
        <div className="sku-actions">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleViewSkuDetail(sku)}
          />
          <Button
            type="text"
            icon={<PlusOutlined />}
            onClick={() => {
              setSelectedSku(sku);
              addForm.setFieldsValue({ local_sku: sku.child_sku });
              setAddMappingVisible(true);
            }}
          />
        </div>
      </div>
      
      <div className="sites-status">
        <div className="sites-status-title">站点上架状态:</div>
        <div className="site-tags">
          {renderSiteTags(sku)}
        </div>
      </div>
      
      <div className="listing-summary">
        <span className={`listing-rate ${getListingRateClass(sku.listingRate)}`}>
          {sku.listingRate}%
        </span>
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${sku.listingRate}%` }}
          />
        </div>
        <span>({sku.listedCount}/{sku.totalSites})</span>
      </div>
    </div>
  );
  
  // 组件加载时获取数据
  useEffect(() => {
    fetchListings();
    fetchStatistics();
  }, [fetchListings, fetchStatistics]);

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
            <Option value="all">全部站点</Option>
            {siteList.map(site => (
              <Option key={site} value={site}>
                {site.replace('Amazon.', '')}
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
        <div className="listings-stats">
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
        </div>
      )}
      
      {/* 内容区域 */}
      <div className="listings-content">
        <Spin spinning={loading}>
          {listings.length === 0 ? (
            <div className="empty-state">
              <Empty
                description="暂无数据"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          ) : (
            <>
              {listings.map(renderSkuCard)}
              
              <div style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid #f0f0f0' }}>
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
            </>
          )}
        </Spin>
      </div>
      
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
            rules={[{ required: true, message: '请输入国家' }]}
          >
            <Input placeholder="请输入国家" />
          </Form.Item>
          
          <Form.Item
            label="SKU类型"
            name="sku_type"
          >
            <Select placeholder="请选择SKU类型">
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