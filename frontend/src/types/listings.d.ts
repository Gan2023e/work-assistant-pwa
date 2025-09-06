// 映射详情信息
export interface MappingDetail {
  amzSku: string;
  site: string;
  skuType: string;
  updateTime: string;
  asin?: string;
  price?: number;
  fulfillmentChannel?: string;
  quantity?: number;
  isFbaSku?: boolean;
  isInListings?: boolean;
}

// 国家状态信息
export interface CountryStatus {
  isListed: boolean;
  mappings: MappingDetail[];
}

// 母SKU信息
export interface ParentSkuData {
  skuid: string | null;
  parent_sku: string;
  child_sku: string | null;
  sellercolorname?: string;
  sellersizename?: string;
  qty_per_box?: number;
  weblink?: string;
  product_status?: string;
  notice?: string;
  countryStatus: Record<string, CountryStatus>;
  listingStatus: 'listed' | 'unlisted' | 'partial';
  listedCount: number;
  totalCountries: number;
  listingRate: number;
}

// 扩展数据类型以支持层级结构
export interface ExpandedParentSkuData extends ParentSkuData {
  isParentRow?: boolean;
  childSkus?: ParentSkuData[];
  colorCount?: number;
  sizeCount?: number;
  totalListedCount?: number;
  totalSkuCount?: number;
  key?: string;
}

// 数据一致性检查结果
export interface DataConsistencyResult {
  statistics: {
    totalSkuRecords: number;
    totalWeblinkRecords: number;
    consistentRecords: number;
    missingWeblinkRecords: number;
    missingSkuRecords: number;
    consistencyRate: number;
  };
  inconsistentData: {
    missingWeblink: Array<{
      parent_sku: string;
      sku_count: number;
      issue_type: string;
    }>;
    missingSku: Array<{
      parent_sku: string;
      status: string;
      weblink: string;
      notice: string;
      issue_type: string;
    }>;
  };
}

// 数据同步请求
export interface DataSyncRequest {
  action: 'create_weblink' | 'delete_orphan';
  parentSkus: string[];
}

// SKU映射信息
export interface SkuMapping {
  amz_sku: string;
  site: string;
  country: string;
  local_sku: string;
  sku_type?: string;
  update_time?: string;
}

// API响应类型
export interface ListingsResponse {
  code: number;
  message: string;
  data: {
    total: number;
    current: number;
    pageSize: number;
    records: ParentSkuData[];
    countryList: string[];
    siteList: string[];
    summary: {
      totalSkus: number;
      listedSkus: number;
      unlistedSkus: number;
      partialSkus: number;
    };
  };
}

// 统计数据类型
export interface ListingsStatistics {
  totalSkus: number;
  mappedSkus: number;
  unmappedSkus: number;
  totalMappings: number;
  mappingRate: number;
  siteStats: Record<string, number>;
}

// 查询参数类型
export interface ListingsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  site?: string;
  status?: 'all' | 'listed' | 'unlisted' | 'partial';
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
}

// 添加映射表单数据
export interface AddMappingForm {
  local_sku: string;
  amz_sku: string;
  site: string;
  country: string;
  sku_type?: string;
}

// 批量导入数据格式
export interface BatchMappingData {
  local_sku: string;
  amz_sku: string;
  site: string;
  country: string;
  sku_type?: string;
}

// Listings SKU数据类型
export interface ListingsSkuData {
  'listing-id': string;
  'item-name'?: string;
  'item-description'?: string;
  'seller-sku'?: string;
  price?: number | string;
  quantity?: number | string;
  'open-date'?: string;
  'image-url'?: string;
  asin1?: string;
  asin2?: string;
  asin3?: string;
  site?: string;
  status?: string;
  'fulfillment-channel'?: string;
  'price-designation'?: string;
  // 关联的本地SKU信息（通过映射表获取）
  local_sku?: string;
  country?: string;
  parent_sku?: string;
  child_sku?: string;
  sellercolorname?: string;
  sellersizename?: string;
  weblink?: string;
  product_status?: string;
  sku_type?: string;
}

// Listings SKU查询参数
export interface ListingsSkuQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  site?: string;
  fulfillment_channel?: string;
  status?: string;
  country?: string;
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
}

// Listings SKU API响应类型
export interface ListingsSkuResponse {
  code: number;
  message: string;
  data: {
    total: number;
    current: number;
    pageSize: number;
    records: ListingsSkuData[];
    siteList: string[];
    countryList: string[];
    fulfillmentChannelList: string[];
    statusList: string[];
    summary: {
      totalListings: number;
      activeListings: number;
      fbaListings: number;
      fbmListings: number;
    };
  };
} 