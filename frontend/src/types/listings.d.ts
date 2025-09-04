// 映射详情信息
export interface MappingDetail {
  amzSku: string;
  site: string;
  skuType: string;
  updateTime: string;
}

// 国家状态信息
export interface CountryStatus {
  isListed: boolean;
  mappings: MappingDetail[];
}

// 母SKU信息
export interface ParentSkuData {
  skuid: string;
  parent_sku: string;
  child_sku: string;
  sellercolorname?: string;
  sellersizename?: string;
  qty_per_box?: number;
  weblink?: string;
  product_status?: string;
  countryStatus: Record<string, CountryStatus>;
  listingStatus: 'listed' | 'unlisted' | 'partial';
  listedCount: number;
  totalCountries: number;
  listingRate: number;
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