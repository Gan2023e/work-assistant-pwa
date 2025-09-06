import React, { useState } from 'react';
import { Tabs } from 'antd';
import Listings from './Listings';
import ListingsSku from './ListingsSku';

const ListingsWithTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('sku-mapping');

  return (
    <div className="listings-page">
      <div className="listings-header" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>在线Listings管理</h1>
      </div>
      
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane tab="SKU映射管理" key="sku-mapping">
          {/* 原有的SKU映射管理内容 */}
          <div style={{ marginTop: -16 }}>
            <Listings />
          </div>
        </Tabs.TabPane>
        
        <Tabs.TabPane tab="Listings SKU数据" key="listings-sku">
          {/* 新的Listings SKU数据内容 */}
          <ListingsSku />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default ListingsWithTabs; 