// 发货相关的类型定义

export interface MergedShippingData {
  record_num: number;
  need_num: string;
  amz_sku: string;
  amazon_sku?: string;
  local_sku: string;
  site?: string;
  fulfillment_channel?: string;
  quantity: number;
  shipping_method?: string;
  marketplace: string;
  country: string;
  status: '待发货' | '已发货' | '已取消' | '有库存无需求' | '库存未映射';
  created_at: string;
  mapping_method?: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  total_available: number;
  shortage: number;
}

export interface CountryInventory {
  country: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  mixed_box_count: number;
  total_quantity: number;
}

export interface WholeBoxConfirmData {
  amz_sku: string;
  total_quantity: number;
  total_boxes: number;
  confirm_boxes: number;
  confirm_quantity: number;
}

export interface MixedBoxItem {
  box_num: string;
  sku: string;
  amz_sku: string;
  quantity: number;
}

export interface ShippingConfirmData {
  box_num: string;
  amz_sku: string;
  quantity: number;
}

export interface UnmappedInventoryItem {
  local_sku: string;
  country: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  total_available: number;
  auto_amz_sku?: string;
  site?: string;
} 