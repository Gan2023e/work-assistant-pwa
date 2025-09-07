import React, { useState, useEffect, useCallback } from 'react';
import {
  Input,
  Select,
  Button,
  Pagination,
  message,
  Table,
  Card,
  Tag,
  Tooltip,
  Empty,
  Modal,
  Descriptions,
  Spin
} from 'antd';
import {
  ReloadOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { API_BASE_URL, apiClient } from '../../config/api';
import {
  ListingsSkuData,
  ListingsSkuQueryParams,
  ListingsSkuResponse
} from '../../types/listings';

const { Search } = Input;
const { Option } = Select;

const ListingsSku: React.FC = () => {
  // 状态管理
  const [listingsSkuData, setListingsSkuData] = useState<ListingsSkuData[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [siteList, setSiteList] = useState<any[]>([]);
  const [fulfillmentChannelList, setFulfillmentChannelList] = useState<string[]>([]);
  const [statusList, setStatusList] = useState<string[]>([]);
  const [summary, setSummary] = useState<any>(null);

  // FBA库存详情弹窗状态
  const [fbaDetailModalVisible, setFbaDetailModalVisible] = useState(false);
  const [fbaDetailLoading, setFbaDetailLoading] = useState(false);
  const [selectedFbaInfo, setSelectedFbaInfo] = useState<{
    sellerSku: string;
    site: string;
    country: string;
  } | null>(null);
  const [fbaInventoryDetail, setFbaInventoryDetail] = useState<any>(null);

  // 查询参数
  const [queryParams, setQueryParams] = useState<ListingsSkuQueryParams>({
    page: 1,
    limit: 50,
    search: '',
    site: 'all',
    fulfillment_channel: 'all',
    status: ['Active', 'Inactive'], // 默认显示Active和Inactive状态
    sort_by: 'seller-sku',
    sort_order: 'ASC'
  });

  // 获取Listings SKU数据
  const fetchListingsSkuData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== '' && value !== 'all') {
          if (key === 'status' && Array.isArray(value)) {
            // 多选状态处理：将数组转换为逗号分隔的字符串
            if (value.length > 0) {
              params.append(key, value.join(','));
            }
          } else {
            params.append(key, String(value));
          }
        }
      });
      
      const result: ListingsSkuResponse = await apiClient.get(`/api/listings/sku-data?${params}`);
      
      if (result.code === 0) {
        setListingsSkuData(result.data.records);
        setTotal(result.data.total);
        setSiteList(result.data.siteList);
        setFulfillmentChannelList(result.data.fulfillmentChannelList || []);
        setStatusList(result.data.statusList || []);
        setSummary(result.data.summary);
      } else {
        message.error(result.message || '获取Listings SKU数据失败');
      }
    } catch (error) {
      console.error('获取Listings SKU数据失败:', error);
      message.error('获取数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  // 更新查询参数
  const updateQueryParams = (newParams: Partial<ListingsSkuQueryParams>) => {
    setQueryParams(prev => ({ ...prev, ...newParams, page: 1 }));
  };

  // 分页处理
  const handlePageChange = (page: number, pageSize?: number) => {
    setQueryParams(prev => ({ ...prev, page, limit: pageSize || prev.limit }));
  };

  // 获取FBA库存详情
  const fetchFbaInventoryDetail = async (sellerSku: string, site: string) => {
    setFbaDetailLoading(true);
    try {
      const result = await apiClient.get(`/api/listings/fba-inventory/${encodeURIComponent(sellerSku)}/${encodeURIComponent(site)}`);
      
      if (result.code === 0) {
        setFbaInventoryDetail(result.data);
      } else {
        message.error(result.message || '获取FBA库存详情失败');
      }
    } catch (error) {
      console.error('获取FBA库存详情失败:', error);
      message.error('获取FBA库存详情失败，请稍后重试');
    } finally {
      setFbaDetailLoading(false);
    }
  };

  // 打开FBA库存详情弹窗
  const handleShowFbaDetail = (record: ListingsSkuData) => {
    if (!record['seller-sku'] || !record.site) {
      message.error('SKU或站点信息不完整');
      return;
    }
    
    const siteToCountryMap = {
      'www.amazon.com': '美国',
      'www.amazon.ca': '加拿大',
      'www.amazon.co.uk': '英国',
      'www.amazon.com.au': '澳大利亚',
      'www.amazon.ae': '阿联酋',
      'www.amazon.de': '德国',
      'www.amazon.fr': '法国',
      'www.amazon.it': '意大利',
      'www.amazon.es': '西班牙'
    };
    
    const sellerSku = record['seller-sku'];
    const site = record.site;
    
    setSelectedFbaInfo({
      sellerSku,
      site,
      country: siteToCountryMap[site as keyof typeof siteToCountryMap] || site
    });
    setFbaDetailModalVisible(true);
    fetchFbaInventoryDetail(sellerSku, site);
  };

  // 导出数据
  const handleExport = () => {
    const csvData = listingsSkuData.map(item => ({
      'Listing ID': item['listing-id'],
      'Seller SKU': item['seller-sku'],
      '本地SKU': item.local_sku || '',
      '母SKU': item.parent_sku || '',
      '子SKU': item.child_sku || '',
      '站点': item.site,
      '价格': item.price || '',
      '数量': item.quantity || '',
      '履行渠道': item['fulfillment-channel'],
      'ASIN': item.asin1 || '',
      '状态': item.status,
      '产品链接': item.weblink || '',
      '颜色': item.sellercolorname || '',
      '尺寸': item.sellersizename || ''
    }));
    
    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
    ].join('\n');
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `listings_sku_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 表格列配置
  const columns = [
    {
      title: 'Seller SKU',
      dataIndex: 'seller-sku',
      key: 'seller-sku',
      width: 140,
      align: 'center' as const,
      render: (text: string) => (
        <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#1890ff' }}>{text}</span>
      ),
    },

    {
      title: '本地SKU',
      dataIndex: 'local_sku',
      key: 'local_sku',
      width: 120,
      align: 'center' as const,
      render: (text: string) => (
        <span style={{ fontSize: 12, color: '#52c41a' }}>{text || '-'}</span>
      ),
    },
    {
      title: '母SKU',
      dataIndex: 'parent_sku',
      key: 'parent_sku',
      width: 120,
      align: 'center' as const,
      render: (text: string, record: ListingsSkuData) => {
        if (text && record.weblink) {
          return (
            <a 
              href={record.weblink} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: '#1890ff' }}
            >
              {text}
            </a>
          );
        }
        return <span style={{ fontSize: 12 }}>{text || '-'}</span>;
      },
    },
    {
      title: '站点',
      dataIndex: 'site',
      key: 'site',
      width: 80,
      align: 'center' as const,
      render: (text: string) => (
        <Tag color="blue" style={{ fontSize: 11 }}>{text}</Tag>
      ),
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      align: 'center' as const,
      render: (price: number) => (
        <span style={{ fontSize: 12, fontWeight: 'bold', color: '#fa8c16' }}>
          {price && !isNaN(price) ? `$${price.toFixed(2)}` : '-'}
        </span>
      ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      align: 'center' as const,
      render: (quantity: number, record: ListingsSkuData) => {
        const isFbaChannel = record['fulfillment-channel']?.includes('AMAZON');
        const quantityValue = quantity || 0;
        
        if (isFbaChannel) {
          return (
            <Tooltip title="点击查看FBA库存详情">
              <span 
                style={{ 
                  fontSize: 12, 
                  color: quantityValue > 0 ? '#52c41a' : '#ff4d4f',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textDecorationStyle: 'dashed'
                }}
                onClick={() => handleShowFbaDetail(record)}
              >
                {quantityValue}
              </span>
            </Tooltip>
          );
        }
        
        return (
          <span style={{ fontSize: 12, color: quantityValue > 0 ? '#52c41a' : '#ff4d4f' }}>
            {quantityValue}
          </span>
        );
      },
    },
    {
      title: '履行渠道',
      dataIndex: 'fulfillment-channel',
      key: 'fulfillment-channel',
      width: 120,
      align: 'center' as const,
      render: (channel: string) => {
        // 显示原始的fulfillment-channel字段内容
        let color = 'default';
        if (channel?.includes('AMAZON')) {
          color = 'blue'; // FBA渠道
        } else if (channel === 'DEFAULT') {
          color = 'orange'; // 本地发货
        }
        return <Tag color={color} style={{ fontSize: 11 }}>{channel || '-'}</Tag>;
      },
    },
    {
      title: 'ASIN',
      dataIndex: 'asin1',
      key: 'asin1',
      width: 110,
      align: 'center' as const,
      render: (asin: string) => (
        <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{asin || '-'}</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center' as const,
      render: (status: string) => {
        const statusConfig = {
          'Active': { color: 'success', text: '活跃' },
          'Inactive': { color: 'default', text: '非活跃' },
          'Suppressed': { color: 'error', text: '被抑制' }
        };
        const config = statusConfig[status as keyof typeof statusConfig] || { color: 'default', text: status || '-' };
        return <Tag color={config.color} style={{ fontSize: 11 }}>{config.text}</Tag>;
      },
    }
  ];

  // 组件加载时获取数据
  useEffect(() => {
    fetchListingsSkuData();
  }, [fetchListingsSkuData]);

  // 移除重复的useEffect - 已经通过fetchListingsSkuData的依赖项处理了queryParams变化
  // useEffect(() => {
  //   fetchListingsSkuData();
  // }, [queryParams]);

  return (
    <div>
      {/* 筛选条件 */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Search
          placeholder="搜索Seller SKU/Listing ID/ASIN"
          value={queryParams.search}
          onChange={(e) => updateQueryParams({ search: e.target.value })}
          onSearch={() => fetchListingsSkuData()}
          style={{ width: 300 }}
        />
        
        <Select
          value={queryParams.site}
          onChange={(value) => updateQueryParams({ site: value })}
          placeholder="选择站点"
          style={{ width: 120 }}
        >
          <Option value="all">全部站点</Option>
          {siteList.map((siteItem: any) => (
            <Option key={siteItem.site} value={siteItem.site}>
              {siteItem.country}
            </Option>
          ))}
        </Select>
        
        <Select
          value={queryParams.fulfillment_channel}
          onChange={(value) => updateQueryParams({ fulfillment_channel: value })}
          placeholder="履行渠道"
          style={{ width: 120 }}
        >
          <Option value="all">全部渠道</Option>
          {fulfillmentChannelList.map(channel => (
            <Option key={channel} value={channel}>
              {channel}
            </Option>
          ))}
        </Select>
        
        <Select
          mode="multiple"
          value={Array.isArray(queryParams.status) ? queryParams.status : []}
          onChange={(value) => updateQueryParams({ status: value.length > 0 ? value : ['Active', 'Inactive'] })}
          placeholder="选择状态"
          style={{ width: 160 }}
          allowClear
          maxTagCount="responsive"
        >
          {statusList.map(status => (
            <Option key={status} value={status}>{status}</Option>
          ))}
        </Select>
        

        
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            setQueryParams({
              page: 1,
              limit: 50,
              search: '',
              site: 'all',
              fulfillment_channel: 'all',
              status: ['Active', 'Inactive'], // 刷新时重置为默认状态
              sort_by: 'seller-sku',
              sort_order: 'ASC'
            });
          }}
        >
          刷新
        </Button>
        
        <Button
          icon={<DownloadOutlined />}
          onClick={handleExport}
        >
          导出数据
        </Button>
      </div>

      {/* 统计信息 */}
      {summary && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 32, justifyContent: 'space-around' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>{summary.totalListings}</div>
              <div style={{ fontSize: 14, color: '#666' }}>总Listing数</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>{summary.activeListings}</div>
              <div style={{ fontSize: 14, color: '#666' }}>活跃Listing</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#722ed1' }}>{summary.fbaListings}</div>
              <div style={{ fontSize: 14, color: '#666' }}>FBA Listing</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fa8c16' }}>{summary.localShipmentListings}</div>
              <div style={{ fontSize: 14, color: '#666' }}>本地发货 Listing</div>
            </div>
          </div>
        </Card>
      )}

      {/* 表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={listingsSkuData}
          loading={loading}
          pagination={false}
          scroll={{ x: 1400 }}
          rowKey="listing-id"
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
            pageSizeOptions={['20', '50', '100', '200']}
            onChange={handlePageChange}
          />
        </div>
      </Card>

      {/* FBA库存详情弹窗 */}
      <Modal
        title={
          <div>
            <span>FBA库存详情</span>
            {selectedFbaInfo && (
              <Tag color="blue" style={{ marginLeft: 8 }}>
                {selectedFbaInfo.country} - {selectedFbaInfo.sellerSku}
              </Tag>
            )}
          </div>
        }
        open={fbaDetailModalVisible}
        onCancel={() => {
          setFbaDetailModalVisible(false);
          setSelectedFbaInfo(null);
          setFbaInventoryDetail(null);
        }}
        width={800}
        footer={[
          <Button key="close" onClick={() => {
            setFbaDetailModalVisible(false);
            setSelectedFbaInfo(null);
            setFbaInventoryDetail(null);
          }}>
            关闭
          </Button>
        ]}
      >
        <Spin spinning={fbaDetailLoading}>
          {fbaInventoryDetail ? (
            <div>
              {/* 库存概况 */}
              <Card title="库存概况" size="small" style={{ marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                      {fbaInventoryDetail.summary?.totalQuantity || 0}
                    </div>
                    <div style={{ color: '#666' }}>总库存</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                      {fbaInventoryDetail.summary?.fulfillableQuantity || 0}
                    </div>
                    <div style={{ color: '#666' }}>可售库存</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fa8c16' }}>
                      {fbaInventoryDetail.summary?.inboundQuantity || 0}
                    </div>
                    <div style={{ color: '#666' }}>在途库存</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>
                      {fbaInventoryDetail.summary?.unsellableQuantity || 0}
                    </div>
                    <div style={{ color: '#666' }}>不可售库存</div>
                  </div>
                </div>
              </Card>

              {/* 详细信息 */}
              <Card title="详细信息" size="small">
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="SKU">{fbaInventoryDetail.current?.sku}</Descriptions.Item>
                  <Descriptions.Item label="站点">{fbaInventoryDetail.current?.site}</Descriptions.Item>
                  <Descriptions.Item label="可售数量">{fbaInventoryDetail.current?.['afn-fulfillable-quantity'] || 0}</Descriptions.Item>
                  <Descriptions.Item label="总数量">{fbaInventoryDetail.current?.['afn-total-quantity'] || 0}</Descriptions.Item>
                  <Descriptions.Item label="在途-处理中">{fbaInventoryDetail.current?.['afn-inbound-working-quantity'] || 0}</Descriptions.Item>
                  <Descriptions.Item label="在途-已发货">{fbaInventoryDetail.current?.['afn-inbound-shipped-quantity'] || 0}</Descriptions.Item>
                  <Descriptions.Item label="在途-接收中">{fbaInventoryDetail.current?.['afn-inbound-receiving-quantity'] || 0}</Descriptions.Item>
                  <Descriptions.Item label="预留数量">{fbaInventoryDetail.current?.['afn-reserved-quantity'] || 0}</Descriptions.Item>
                  <Descriptions.Item label="不可售数量">{fbaInventoryDetail.current?.['afn-unsellable-quantity'] || 0}</Descriptions.Item>
                  <Descriptions.Item label="商品状态">{fbaInventoryDetail.current?.condition || '-'}</Descriptions.Item>
                  <Descriptions.Item label="单位体积">{fbaInventoryDetail.current?.['per-unit-volume'] || '-'}</Descriptions.Item>
                  <Descriptions.Item label="店铺">{fbaInventoryDetail.current?.store || '-'}</Descriptions.Item>
                </Descriptions>
              </Card>

              {/* 额外信息 */}
              <Card title="额外信息" size="small" style={{ marginTop: 16 }}>
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="AFN仓库数量">{fbaInventoryDetail.current?.['afn-warehouse-quantity'] || 0}</Descriptions.Item>
                  <Descriptions.Item label="AFN研究中数量">{fbaInventoryDetail.current?.['afn-researching-quantity'] || 0}</Descriptions.Item>
                  <Descriptions.Item label="本地可售数量">{fbaInventoryDetail.current?.['afn-fulfillable-quantity-local'] || 0}</Descriptions.Item>
                  <Descriptions.Item label="远程可售数量">{fbaInventoryDetail.current?.['afn-fulfillable-quantity-remote'] || 0}</Descriptions.Item>
                  <Descriptions.Item label="未来供应可购买">{fbaInventoryDetail.current?.['afn-future-supply-buyable'] || 0}</Descriptions.Item>
                  <Descriptions.Item label="预留未来供应">{fbaInventoryDetail.current?.['afn-reserved-future-supply'] || 0}</Descriptions.Item>
                </Descriptions>
              </Card>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Empty description="暂无FBA库存数据" />
            </div>
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default ListingsSku; 