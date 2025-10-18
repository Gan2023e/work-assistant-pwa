import React, { useState, useRef } from 'react';
import { 
  Button, 
  Input, 
  InputNumber,
  Table, 
  message, 
  Space, 
  Select, 
  Modal, 
  Popconfirm,
  Form,
  Tooltip,
  Typography,
  Card,
  Row,
  Col,
  Statistic,
  DatePicker,
  Divider,
  Radio,
  Spin,
  Checkbox,
  AutoComplete,
  Upload,
  List,
  Badge,
  Tag,
  Progress,
  Switch,
  Steps,
  Layout,
} from 'antd';

import { useTaskContext } from '../../contexts/TaskContext';
import { logger } from '../../utils/logger';
import { 
  UploadOutlined, 
  DeleteOutlined, 
  LinkOutlined,
  ReloadOutlined,
  SearchOutlined,
  CameraOutlined,
  CloudUploadOutlined,
  FilterOutlined,
  FilePdfOutlined,
  PlusOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  FileExcelOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
  CloseCircleOutlined,
  GlobalOutlined,
  PlayCircleOutlined,
  EditOutlined,
  CalculatorOutlined,
  DownOutlined,
  UpOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ExperimentOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ColumnsType, TableProps } from 'antd/es/table';
import { API_BASE_URL, API_ENDPOINTS, apiClient } from '../../config/api';
import ProfitCalculator from '../../components/ProfitCalculator';

// 添加CSS样式
const cardAnimationStyle = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .card-group-enter {
    animation: fadeInUp 0.4s ease-out;
  }
  
  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
  }
`;

// 注入样式
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = cardAnimationStyle;
  if (!document.querySelector('style[data-card-animation]')) {
    styleElement.setAttribute('data-card-animation', 'true');
    document.head.appendChild(styleElement);
  }
}

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;
const { RangePicker } = DatePicker;

// 处理ads_add字段的辅助函数
const parseAdsAdd = (adsAdd: string | { US: string; UK: string } | undefined): { US: string; UK: string } => {
  if (!adsAdd) return { US: '否', UK: '否' };
  
  if (typeof adsAdd === 'string') {
    try {
      const parsed = JSON.parse(adsAdd);
      return {
        US: parsed.US || '否',
        UK: parsed.UK || '否'
      };
    } catch {
      // 如果不是JSON格式，返回默认值
      return { US: '否', UK: '否' };
    }
  }
  
  return adsAdd;
};

const formatAdsAdd = (adsAdd: { US: string; UK: string }): string => {
  return JSON.stringify(adsAdd);
};

interface ProductRecord {
  id: number;
  parent_sku: string;
  weblink: string;
  update_time: string;
  check_time: string;
  status: string;
  notice: string;
  cpc_status: string;
  cpc_submit: string;
  model_number: string;
  recommend_age: string;
  ads_add: string | { US: string; UK: string }; // 支持JSON格式
  list_parent_sku: string;
  no_inventory_rate: string;
  sales_30days: string;
  seller_name: string;
  cpc_files?: string;
  // 新增字段
  is_key_product?: boolean;
  competitor_links?: string;
  custom_category?: string; // 自定义类目
}

interface SellerInventorySkuRecord {
  skuid: string;
  parent_sku: string;
  child_sku: string;
  vendor_sku?: string;
  sellercolorname?: string;
  sellersizename?: string;
  qty_per_box?: number;
  price?: number;
  weight?: number;
  weight_type?: 'estimated' | 'measured';
}

interface CpcFile {
  uid: string;
  name: string;
  url: string;
  objectName: string;
  size: number;
  uploadTime: string;
  extractedData?: {
    styleNumber: string;
    recommendAge: string;
  };
}



interface EditingCell {
  id: number;
  field: string;
  value: string;
}

// 注：状态、CPC测试情况、CPC提交情况选项现在都从数据库动态获取

// 统计卡片组件
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
  span?: number;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, onClick, span = 2 }) => (
  <Col span={span} xs={12} sm={8} md={6} lg={span} xl={span}>
    <Card 
      size="small"
      hoverable 
      onClick={onClick}
      className="stat-card"
      style={{ 
        cursor: 'pointer', 
        minHeight: span === 24 ? '75px' : '85px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        border: '1px solid #f0f0f0',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: span === 24 ? '8px' : '0'
      }}
      bodyStyle={{ 
        padding: span === 24 ? '12px' : '14px',
        position: 'relative',
        zIndex: 1
      }}
    >
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '30px',
        height: '30px',
        background: `linear-gradient(135deg, ${color}20, ${color}10)`,
        borderRadius: '0 0 0 100%',
        opacity: 0.3
      }} />
      <Statistic
        title={
          <span style={{ 
            fontSize: span === 24 ? '11px' : '12px', 
            fontWeight: 500, 
            color: '#666',
            display: 'block',
            marginBottom: '2px',
            lineHeight: 1.2
          }}>
            {title}
          </span>
        }
        value={value}
        prefix={
          <span style={{ 
            color: color, 
            marginRight: span === 24 ? '6px' : '8px',
            fontSize: span === 24 ? '14px' : '16px'
          }}>
            {icon}
          </span>
        }
        valueStyle={{ 
          color, 
          fontSize: span === 24 ? '16px' : '18px', 
          fontWeight: 'bold',
          lineHeight: 1.2
        }}
      />
    </Card>
  </Col>
);

// 卡片分组组件
interface CardGroupProps {
  title: string;
  children: React.ReactNode;
  backgroundColor?: string;
  collapsed?: boolean;
  onCollapse?: () => void;
  total?: number;
  subtitle?: string;
}

const CardGroup: React.FC<CardGroupProps> = ({ 
  title, 
  children, 
  backgroundColor = '#fafafa',
  collapsed = false,
  onCollapse,
  total,
  subtitle
}) => (
  <Card 
    size="small" 
    className="card-group-enter"
    style={{ 
      marginBottom: '16px',
      backgroundColor,
      border: '1px solid #e8e8e8',
      borderRadius: '12px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
    }}
    bodyStyle={{ padding: '16px' }}
    title={
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: '15px',
            fontWeight: 600,
            color: '#333'
          }}>{title}</span>
          {total !== undefined && (
            <Badge 
              count={total} 
              style={{ 
                backgroundColor: '#722ed1',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            />
          )}
          {subtitle && (
            <span style={{
              fontSize: '12px',
              color: '#888',
              fontWeight: 'normal'
            }}>
              {subtitle}
            </span>
          )}
        </div>
        {onCollapse && (
          <Button 
            type="text" 
            size="small"
            icon={collapsed ? <DownOutlined /> : <UpOutlined />}
            onClick={onCollapse}
            style={{ 
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'all 0.2s'
            }}
          />
        )}
      </div>
    }
  >
    {!collapsed && (
      <div style={{ marginTop: '12px' }}>
        {children}
      </div>
    )}
  </Card>
);

// 侧边栏统计面板组件
const SidebarStatsPanel: React.FC<{
  statistics: any;
  cardGroupCollapsed: any;
  setCardGroupCollapsed: any;
  handleCardClick: any;
  handleCanOrganizeDataClick: any;
  handleCpcPendingListingClick: any;
  handleCpcTestedButNoAdsClick: any;
  handleKeyProductsClick: any;
  handleCustomCategoriesClick: any;
  handleCategoryClick: any;
  categories: Array<{name: string, count: number}>;
  collapsed: boolean;
}> = ({
  statistics,
  cardGroupCollapsed,
  setCardGroupCollapsed,
  handleCardClick,
  handleCanOrganizeDataClick,
  handleCpcPendingListingClick,
  handleCpcTestedButNoAdsClick,
  handleKeyProductsClick,
  handleCustomCategoriesClick,
  handleCategoryClick,
  categories,
  collapsed
}) => (
  <div style={{ 
    padding: collapsed ? '12px 8px' : '16px',
    height: '100%',
    overflowY: 'auto'
  }}>
    {/* 全部展开/收起按钮 */}
    {!collapsed && (
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <Button 
          type="text" 
          size="small"
          onClick={() => {
            const allCollapsed = Object.values(cardGroupCollapsed).every(v => v);
            setCardGroupCollapsed({
              productStatus: !allCollapsed,
              cpcTesting: !allCollapsed,
              special: !allCollapsed
            });
          }}
          style={{ fontSize: '11px' }}
        >
          {Object.values(cardGroupCollapsed).every(v => v) ? '全部展开' : '全部收起'}
        </Button>
      </div>
    )}

    {/* 产品状态组 */}
    <CardGroup 
      title={collapsed ? "📋" : "📋 产品状态"}
      backgroundColor="#f6ffed"
      total={collapsed ? undefined : statistics.newProductFirstReview + statistics.infringementSecondReview + 
             statistics.waitingPImage + statistics.waitingUpload + statistics.canOrganizeData}
      subtitle={collapsed ? undefined : "产品审核与处理流程"}
      collapsed={cardGroupCollapsed.productStatus}
      onCollapse={collapsed ? undefined : () => setCardGroupCollapsed((prev: any) => ({
        ...prev,
        productStatus: !prev.productStatus
      }))}
    >
      <Row gutter={[8, 8]}>
        <StatCard
          title="新品一审"
          value={statistics.newProductFirstReview}
          icon={<PlusOutlined />}
          color="#1890ff"
          onClick={() => handleCardClick('新品一审')}
          span={collapsed ? 24 : 12}
        />
        <StatCard
          title="侵权二审"
          value={statistics.infringementSecondReview}
          icon={<SearchOutlined />}
          color="#fa541c"
          onClick={() => handleCardClick('待审核')}
          span={collapsed ? 24 : 12}
        />
        <StatCard
          title="待P图"
          value={statistics.waitingPImage}
          icon={<CameraOutlined />}
          color="#cf1322"
          onClick={() => handleCardClick('待P图')}
          span={collapsed ? 24 : 12}
        />
        <StatCard
          title="待上传"
          value={statistics.waitingUpload}
          icon={<CloudUploadOutlined />}
          color="#1890ff"
          onClick={() => handleCardClick('待上传')}
          span={collapsed ? 24 : 12}
        />
        <StatCard
          title="可整理资料"
          value={statistics.canOrganizeData}
          icon={<FileExcelOutlined />}
          color="#722ed1"
          onClick={handleCanOrganizeDataClick}
          span={collapsed ? 24 : 12}
        />
      </Row>
    </CardGroup>

    {/* CPC检测流程组 */}
    <CardGroup 
      title={collapsed ? "🔬" : "🔬 CPC检测流程"}
      backgroundColor="#fff7e6"
      total={collapsed ? undefined : statistics.cpcTestPending + statistics.cpcTesting + statistics.cpcSampleSent + 
             statistics.cpcTestingInProgress + statistics.cpcPendingListing + statistics.cpcTestedButNoAds}
      subtitle={collapsed ? undefined : "CPC测试全流程管理"}
      collapsed={cardGroupCollapsed.cpcTesting}
      onCollapse={collapsed ? undefined : () => setCardGroupCollapsed((prev: any) => ({
        ...prev,
        cpcTesting: !prev.cpcTesting
      }))}
    >
      <Row gutter={[8, 8]}>
        <StatCard
          title="CPC测试待审核"
          value={statistics.cpcTestPending}
          icon={<ClockCircleOutlined />}
          color="#fa8c16"
          onClick={() => handleCardClick('申请测试', 'cpc_status')}
          span={collapsed ? 24 : 12}
        />
        <StatCard
          title="CPC样品待采购"
          value={statistics.cpcTesting}
          icon={<SearchOutlined />}
          color="#13c2c2"
          onClick={() => handleCardClick('CPC样品待采购', 'cpc_status')}
          span={collapsed ? 24 : 12}
        />
        <StatCard
          title="CPC已发样品"
          value={statistics.cpcSampleSent}
          icon={<CheckCircleOutlined />}
          color="#52c41a"
          onClick={() => handleCardClick('样品已发', 'cpc_status')}
          span={collapsed ? 24 : 12}
        />
        <StatCard
          title="CPC测试中"
          value={statistics.cpcTestingInProgress}
          icon={<PlayCircleOutlined />}
          color="#fa8c16"
          onClick={() => handleCardClick('测试中', 'cpc_status')}
          span={collapsed ? 24 : 12}
        />
        <StatCard
          title="CPC待上架产品"
          value={statistics.cpcPendingListing}
          icon={<PlayCircleOutlined />}
          color="#722ed1"
          onClick={handleCpcPendingListingClick}
          span={collapsed ? 24 : 12}
        />
        <StatCard
          title="CPC已检测但广告未创建"
          value={statistics.cpcTestedButNoAds}
          icon={<ExclamationCircleOutlined />}
          color="#ff4d4f"
          onClick={handleCpcTestedButNoAdsClick}
          span={collapsed ? 24 : 12}
        />
      </Row>
    </CardGroup>

    {/* 特殊标记组 */}
    <CardGroup 
      title={collapsed ? "⭐" : "⭐ 特殊标记"}
      backgroundColor="#fff1f0"
      total={collapsed ? undefined : statistics.keyProducts + statistics.customCategories}
      subtitle={collapsed ? undefined : "重要产品标识与自定义分类"}
      collapsed={cardGroupCollapsed.special}
      onCollapse={collapsed ? undefined : () => setCardGroupCollapsed((prev: any) => ({
        ...prev,
        special: !prev.special
      }))}
    >
      <Row gutter={[8, 8]}>
        <StatCard
          title="重点款产品"
          value={statistics.keyProducts}
          icon={<CheckCircleOutlined />}
          color="#f5222d"
          onClick={handleKeyProductsClick}
          span={12}
        />
        {categories.length > 0 ? (
          // 显示具体的自定义类目，每行最多2个
          categories.slice(0, 6).map((category, index) => (
            <Tooltip key={category.name} title={`点击查看"${category.name}"类目的产品`}>
              <StatCard
                title={category.name.length > 8 ? `${category.name.substring(0, 8)}...` : category.name}
                value={category.count}
                icon={<ExperimentOutlined />}
                color="#1890ff"
                onClick={() => handleCategoryClick(category.name)}
                span={12} // 每行最多2个，所以每个占12个栅格
              />
            </Tooltip>
          ))
        ) : (
          <StatCard
            title="自定义类目"
            value={statistics.customCategories}
            icon={<ExperimentOutlined />}
            color="#1890ff"
            onClick={handleCustomCategoriesClick}
            span={12}
          />
        )}
      </Row>
    </CardGroup>
  </div>
);

const Purchase: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProductRecord[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editForm] = Form.useForm<any>();
  const [editModalVisible, setEditModalVisible] = useState(false);
  
  // 母SKU编辑相关状态
  const [editingParentSku, setEditingParentSku] = useState<{id: number, currentValue: string} | null>(null);
  const [parentSkuInputValue, setParentSkuInputValue] = useState<string>('');
  
  // 备注编辑相关状态
  const [editingNotice, setEditingNotice] = useState<{id: number, currentValue: string} | null>(null);
  const [noticeInputValue, setNoticeInputValue] = useState<string>('');
  const [isSavingNotice, setIsSavingNotice] = useState<boolean>(false);
  
  // 英国模板选择相关状态
  const [ukTemplateModalVisible, setUkTemplateModalVisible] = useState(false);
  const [ukTemplates, setUkTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
  // 行编辑相关状态
  const [editingRecord, setEditingRecord] = useState<ProductRecord | null>(null);
  const [recordEditForm] = Form.useForm<any>();
  const [recordEditModalVisible, setRecordEditModalVisible] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [addTemplateModalVisible, setAddTemplateModalVisible] = useState(false);
  // 多站点模板文件管理
  const [allTemplateFiles, setAllTemplateFiles] = useState<Record<string, any[]>>({
    US: [],
    CA: [],
    UK: [],
    AE: [],
    AU: []
  });
  const [activeTabKey, setActiveTabKey] = useState<string>('US');
  const [templateLoading, setTemplateLoading] = useState<Record<string, boolean>>({
    US: false,
    CA: false,
    UK: false,
    AE: false,
    AU: false
  });
  // 类目管理
  const [templateCategories, setTemplateCategories] = useState<Record<string, any[]>>({
    US: [],
    CA: [],
    UK: [],
    AE: [],
    AU: []
  });
  const [selectedCategory, setSelectedCategory] = useState<Record<string, string>>({
    US: 'backpack',
    CA: 'backpack',
    UK: 'backpack',
    AE: 'backpack',
    AU: 'backpack'
  });
  const [globalTemplateLoading, setGlobalTemplateLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const templateFileInputRef = useRef<HTMLInputElement>(null);
  
  // 添加模板表单状态
  const [addTemplateForm] = Form.useForm();
  const [selectedUploadCountry, setSelectedUploadCountry] = useState('US');
  const [selectedUploadCategory, setSelectedUploadCategory] = useState('backpack');
  
  // 邮件配置状态
  const [emailConfig, setEmailConfig] = useState({
    receiver: '',
    subject: ''
  });
  
  // CPC文件相关状态
  const [cpcModalVisible, setCpcModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<ProductRecord | null>(null);
  const [cpcFiles, setCpcFiles] = useState<CpcFile[]>([]);
  const [cpcUploading, setCpcUploading] = useState(false);
  
  // 自动识别结果状态
  const [extractedDataVisible, setExtractedDataVisible] = useState(false);
  const [pendingExtractedData, setPendingExtractedData] = useState<{
    styleNumber: string;
    recommendAge: string;
  } | null>(null);
  
  // 搜索相关状态
  const [searchType, setSearchType] = useState<'sku' | 'weblink' | 'competitor_asin'>('sku');
  const [isFuzzySearch, setIsFuzzySearch] = useState(false);
  
  // 上传结果对话框状态
  const [uploadResultVisible, setUploadResultVisible] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    successCount: number;
    updatedCount?: number;
    skippedCount: number;
    totalRows: number;
    skippedRecords: Array<{
      row: number;
      sku: string;
      link: string;
      reason: string;
    }>;
    updatedRecords?: Array<{
      row: number;
      sku: string;
      link: string;
      oldStatus: string;
      newStatus: string;
    }>;
    errorMessages: string[];
  } | null>(null);
  
  // 筛选相关状态
  const [filters, setFilters] = useState({
    status: '',
    cpc_status: '',
    cpc_submit: '',
    seller_name: '',
    dateRange: null as [string, string] | null
  });
  const [filteredData, setFilteredData] = useState<ProductRecord[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [originalData, setOriginalData] = useState<ProductRecord[]>([]);
  
  // 统计数据（基于全库数据）
  const [statistics, setStatistics] = useState({
    newProductFirstReview: 0,
    infringementSecondReview: 0,
    waitingPImage: 0,
    waitingUpload: 0,
    canOrganizeData: 0,
    cpcTestPending: 0,
    cpcTesting: 0,
    cpcSampleSent: 0,
    cpcTestingInProgress: 0,  // 新增CPC测试中统计
    cpcPendingListing: 0,
    cpcTestedButNoAds: 0,  // 新增CPC已检测但广告未创建统计
    keyProducts: 0,  // 新增重点款统计
    customCategories: 0  // 新增自定义类目统计
  });

  // 分页状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0
  });
  
  // 生成其他站点资料表相关状态
  const [otherSiteModalVisible, setOtherSiteModalVisible] = useState(false);
  const [uploadedExcelFiles, setUploadedExcelFiles] = useState<Record<string, File | null>>({
    US: null,
    CA: null,
    UK: null,
    AE: null,
    AU: null
  });
  const [activeSiteTabKey, setActiveSiteTabKey] = useState<string>('US');
  const [otherSiteLoading, setOtherSiteLoading] = useState<Record<string, boolean>>({
    US: false,
    CA: false,
    UK: false,
    AE: false,
    AU: false
  });
  const [missingColumnsModalVisible, setMissingColumnsModalVisible] = useState(false);
  const [missingColumnsInfo, setMissingColumnsInfo] = useState<any>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, { blob: Blob; fileName: string } | null>>({
    US: null,
    CA: null,
    UK: null,
    AE: null,
    AU: null
  });
  const [batchProgress, setBatchProgress] = useState<Record<string, 'pending' | 'processing' | 'completed' | 'failed'>>({
    US: 'pending',
    CA: 'pending',
    UK: 'pending',
    AE: 'pending',
    AU: 'pending'
  });

  // 新增：3步流程相关状态
  const [currentStep, setCurrentStep] = useState(0); // 当前步骤：0=上传源数据，1=选择目标站点，2=下载管理
  const [sourceCountry, setSourceCountry] = useState<string>(''); // 源站点
  const [sourceFile, setSourceFile] = useState<File | null>(null); // 源文件
  const [sourceDataUploaded, setSourceDataUploaded] = useState(false); // 源数据是否已上传到数据库
  const [selectedTargetCountries, setSelectedTargetCountries] = useState<string[]>([]); // 选择的目标站点
  const [generationInProgress, setGenerationInProgress] = useState(false); // 是否正在生成
  const [completedCountries, setCompletedCountries] = useState<string[]>([]); // 已完成生成的站点
  const [downloadHistory, setDownloadHistory] = useState<Record<string, { blob: Blob; fileName: string; generatedAt: string }>>({});
  
  // 新增：上传进度相关状态
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  // 全库统计数据
  const [allDataStats, setAllDataStats] = useState({
    statusStats: [] as { value: string; count: number }[],
    cpcStatusStats: [] as { value: string; count: number }[],
    cpcSubmitStats: [] as { value: string; count: number }[],
    supplierStats: [] as { value: string; count: number }[]
  });

  // 卡片分组折叠状态
  const [cardGroupCollapsed, setCardGroupCollapsed] = useState({
    productStatus: false,
    cpcTesting: false,
    special: false
  });

  // 侧边栏状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  // 使用全局任务上下文
  const { tasks: backgroundTasks, addTask, updateTask, removeTask, hasRunningTasks } = useTaskContext();

  // 添加钉钉推送开关状态
  const [enableDingTalkNotification, setEnableDingTalkNotification] = useState(true);

  // 新链接（采购用）相关状态
  const [newLinksModalVisible, setNewLinksModalVisible] = useState(false);
  const [newLinksInput, setNewLinksInput] = useState('');
  const [newLinksLoading, setNewLinksLoading] = useState(false);
  const [newLinksResultVisible, setNewLinksResultVisible] = useState(false);
  const [newLinksResult, setNewLinksResult] = useState<{
    message: string;
    successCount: number;
    duplicateCount: number;
    errorCount: number;
    totalCount: number;
    errors: Array<{
      line: number;
      originalLink: string;
      extractedLink?: string;
      error: string;
    }>;
    duplicates: Array<{
      line: number;
      originalLink: string;
      extractedLink: string;
      error: string;
    }>;
  } | null>(null);

  // FBASKU生成相关状态
  const [fbaSkuModalVisible, setFbaSkuModalVisible] = useState(false);
  const [fbaSkuCountry, setFbaSkuCountry] = useState('US');
  const [fbaSkuLoading, setFbaSkuLoading] = useState(false);
  
  // 数据缺失对话框相关状态
  const [dataMissingModalVisible, setDataMissingModalVisible] = useState(false);
  const [missingDataInfo, setMissingDataInfo] = useState<any>(null);
  const [amzSkuMappingForm] = Form.useForm();
  const [mappingFormLoading, setMappingFormLoading] = useState(false);
  const [currentSelectedParentSkus, setCurrentSelectedParentSkus] = useState<string[]>([]);

  // SellerInventorySku相关状态
  const [sellerSkuModalVisible, setSellerSkuModalVisible] = useState(false);
  const [sellerSkuData, setSellerSkuData] = useState<SellerInventorySkuRecord[]>([]);
  const [sellerSkuLoading, setSellerSkuLoading] = useState(false);
  const [currentParentSku, setCurrentParentSku] = useState<string>('');
  const [sellerSkuEditingKey, setSellerSkuEditingKey] = useState<string>('');
  // 批量设置相关状态
  const [selectedSkuIds, setSelectedSkuIds] = useState<string[]>([]);
  const [batchQtyPerBox, setBatchQtyPerBox] = useState<number | undefined>(undefined);
  const [batchVendorSku, setBatchVendorSku] = useState<string>('');
  const [batchWeight, setBatchWeight] = useState<number | undefined>(undefined);
  const [batchPrice, setBatchPrice] = useState<number | undefined>(undefined);
  const [batchLoading, setBatchLoading] = useState(false);
  // 用于获取输入框值的refs
  const colorInputRef = useRef<any>(null);
  const sizeInputRef = useRef<any>(null);
  const qtyInputRef = useRef<any>(null);
  const priceInputRef = useRef<any>(null);
  const weightInputRef = useRef<any>(null);
  const weightTypeInputRef = useRef<any>(null);
  const vendorSkuInputRef = useRef<any>(null);
  
  // 利润推算器相关状态
  const [profitCalculatorVisible, setProfitCalculatorVisible] = useState(false);
  
  // 竞争对手链接管理相关状态
  const [competitorLinksModalVisible, setCompetitorLinksModalVisible] = useState(false);
  const [currentCompetitorRecord, setCurrentCompetitorRecord] = useState<ProductRecord | null>(null);
  const [competitorLinksInput, setCompetitorLinksInput] = useState('');

  // 广告创建站点选择相关状态
  const [adsSiteModalVisible, setAdsSiteModalVisible] = useState(false);
  const [currentAdsRecord, setCurrentAdsRecord] = useState<ProductRecord | null>(null);
  const [adsUsStatus, setAdsUsStatus] = useState('否');
  const [adsUkStatus, setAdsUkStatus] = useState('否');

  // 产品上下架功能相关状态
  const [productStatusModalVisible, setProductStatusModalVisible] = useState(false);
  const [productStatusAction, setProductStatusAction] = useState<'上架' | '下架' | '数量调整' | null>(null);
  const [quantityAdjustmentText, setQuantityAdjustmentText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 自定义类目相关状态
  const [customCategoryModalVisible, setCustomCategoryModalVisible] = useState(false);
  const [currentCustomCategoryRecord, setCurrentCustomCategoryRecord] = useState<ProductRecord | null>(null);
  const [customCategoryValue, setCustomCategoryValue] = useState('');
  
  // 类目管理相关状态
  const [categoryManagerVisible, setCategoryManagerVisible] = useState(false);
  const [categories, setCategories] = useState<Array<{name: string, count: number}>>([]);
  const [categoryManagerLoading, setCategoryManagerLoading] = useState(false);
  
  // 类目编辑相关状态
  const [editingCategory, setEditingCategory] = useState<{name: string, count: number} | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryModalVisible, setEditCategoryModalVisible] = useState(false);
  const [editCategoryLoading, setEditCategoryLoading] = useState(false);
  
  // 批量操作相关状态
  const [batchCategoryModalVisible, setBatchCategoryModalVisible] = useState(false);
  const [batchAction, setBatchAction] = useState<'set' | 'add' | 'clear'>('set');
  const [batchCategoryName, setBatchCategoryName] = useState('');

  // 获取全库统计数据
  const fetchAllDataStatistics = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/statistics`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const result = await res.json();
      
      setStatistics(result.statistics);
      setAllDataStats({
        statusStats: result.statusStats || [],
        cpcStatusStats: result.cpcStatusStats || [],
        cpcSubmitStats: result.cpcSubmitStats || [],
        supplierStats: result.supplierStats || []
      });
      
      if (result.cpcSubmitStats && result.cpcSubmitStats.length > 0) {
        logger.success(`CPC提交情况数据加载成功，共 ${result.cpcSubmitStats.length} 种状态`);
      } else {
        logger.warn('CPC提交情况数据为空');
      }
    } catch (e) {
      logger.error('获取统计数据失败:', e);
    }
  };

  // 页面加载时获取统计数据并默认显示可整理资料记录
  React.useEffect(() => {
    fetchAllDataStatistics();
    fetchCategories(); // 获取类目数据
    // 默认显示可整理资料记录
    handleCanOrganizeDataClick();
  }, []);

  // 获取邮件配置
  React.useEffect(() => {
    const fetchEmailConfig = async () => {
      try {
        const response = await fetch('/api/config/email');
        if (response.ok) {
          const config = await response.json();
          // 只有在获取到有效配置时才更新状态
          if (config.receiver && config.subject) {
            setEmailConfig(config);
          } else {
            console.error('邮件配置不完整:', config);
          }
        } else {
          console.error('获取邮件配置失败，状态码:', response.status);
        }
      } catch (error) {
        console.error('获取邮件配置失败:', error);
      }
    };
    fetchEmailConfig();
  }, []);



  // 搜索功能
  const handleSearch = async () => {
    const keywords = input
      .split('\n')
      .map(i => i.trim())
      .filter(Boolean);
    if (keywords.length === 0) {
      const searchTypeName = searchType === 'sku' ? 'SKU' : 
                            searchType === 'weblink' ? '产品链接/ID' : '竞争对手ASIN';
      message.warning(`请输入${searchTypeName}`);
      return;
    }
    
    setLoading(true);
    try {
      const requestPayload = { 
        keywords,
        searchType,
        isFuzzy: searchType === 'weblink' || searchType === 'competitor_asin' ? true : isFuzzySearch // 产品链接和竞争对手ASIN搜索强制模糊搜索
      };
      
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const result = await res.json();
      const searchData = result.data || [];
      setData(searchData);
      setOriginalData(searchData);
      setFilteredData(searchData);
      
      // 更新分页状态
      setPagination(prev => ({
        ...prev,
        current: 1,
        total: searchData.length
      }));
      
      if (!searchData || searchData.length === 0) {
        message.info('未找到匹配的产品信息');
      } else {
        const searchTypeName = searchType === 'sku' ? 'SKU' : 
                              searchType === 'weblink' ? '产品链接/ID' : '竞争对手ASIN';
        const searchModeName = searchType === 'weblink' || searchType === 'competitor_asin' ? '模糊' : (isFuzzySearch ? '模糊' : '精确');
        message.success(`通过${searchModeName}搜索${searchTypeName}，找到 ${searchData.length} 条产品信息`);
      }
    } catch (e) {
      console.error('搜索失败:', e);
      message.error(`查询失败: ${e instanceof Error ? e.message : '未知错误'}`);
    }
    setLoading(false);
  };

  // 筛选功能 - 从全库数据中筛选
  const applyFilters = async (currentFilters: any) => {
    try {
      // 构建查询条件
      const conditions: any = {};
      if (currentFilters.status) {
        conditions.status = currentFilters.status;
      }
      if (currentFilters.cpc_status) {
        conditions.cpc_status = currentFilters.cpc_status;
      }
      if (currentFilters.cpc_submit !== undefined && currentFilters.cpc_submit !== '') {
        conditions.cpc_submit = currentFilters.cpc_submit;
      }
      if (currentFilters.seller_name) {
        conditions.seller_name = currentFilters.seller_name;
      }
      if (currentFilters.dateRange) {
        conditions.dateRange = currentFilters.dateRange;
      }

      // 如果没有筛选条件，清空数据
      if (Object.keys(conditions).length === 0) {
        setFilteredData([]);
        setData([]);
        setOriginalData([]);
        return;
      }

      // 调用后端API获取筛选数据
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/filter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conditions),
      });

      if (!res.ok) {
        let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const errorData = await res.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          console.warn('无法解析错误响应JSON:', parseError);
        }
        throw new Error(errorMessage);
      }

      const result = await res.json();
      const filteredData = result.data || [];
      
      setData(filteredData);
      setOriginalData(filteredData);
      setFilteredData(filteredData);
      
      message.success(`筛选完成，找到 ${filteredData.length} 条符合条件的记录`);
    } catch (e) {
      console.error('筛选失败:', e);
      let errorMessage = '筛选失败';
      
      if (e instanceof Error) {
        errorMessage = '筛选失败: ' + e.message;
      } else if (typeof e === 'string') {
        errorMessage = '筛选失败: ' + e;
      }
      
      message.error(errorMessage);
    }
  };

  // 处理筛选变化
  const handleFilterChange = (filterType: string, value: string | [string, string] | null) => {
    const newFilters = { ...filters, [filterType]: value };
    setFilters(newFilters);
    applyFilters(newFilters);
  };



  // 点击卡片显示对应状态数据
  const handleCardClick = (status: string, type: 'status' | 'cpc_status' = 'status') => {
    const cardFilters = { ...filters, [type]: status };
    setFilters(cardFilters);
    applyFilters(cardFilters);
  };

  // 点击CPC待上架产品数卡片的特殊处理
  const handleCpcPendingListingClick = async () => {
    try {
      // 构建特殊查询条件：已测试且CPC提交情况为空
      const conditions = {
        cpc_status: '已测试',
        cpc_submit_empty: true // 特殊标识，后端会处理
      };

      // 调用后端API获取筛选数据
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/filter-cpc-pending-listing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conditions),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      const filteredData = result.data || [];
      
      setData(filteredData);
      setOriginalData(filteredData);
      setFilteredData(filteredData);
      
      // 更新分页状态
      setPagination(prev => ({
        ...prev,
        current: 1,
        total: filteredData.length
      }));
      
      // 更新筛选状态以反映当前筛选条件
      setFilters({ 
        ...filters, 
        cpc_status: '已测试',
        cpc_submit: '' // 显示为空的提交情况
      });
      
      message.success(`筛选完成，找到 ${filteredData.length} 条CPC待上架产品记录`);
    } catch (e) {
      console.error('筛选CPC待上架产品失败:', e);
      message.error('筛选CPC待上架产品失败');
    }
  };

  // 点击CPC已检测但广告未创建产品数卡片的特殊处理
  const handleCpcTestedButNoAdsClick = async () => {
    try {
      // 调用后端API获取筛选数据
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/filter-cpc-tested-but-no-ads`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      const filteredData = result.data || [];
      
      setData(filteredData);
      setOriginalData(filteredData);
      setFilteredData(filteredData);
      
      // 更新分页状态
      setPagination(prev => ({
        ...prev,
        current: 1,
        total: filteredData.length
      }));
      
      // 更新筛选状态以反映当前筛选条件
      setFilters({ 
        ...filters, 
        cpc_status: '已测试'
      });
      
      message.success(`筛选完成，找到 ${filteredData.length} 条CPC已检测但广告未创建产品记录`);
    } catch (e) {
      console.error('筛选CPC已检测但广告未创建产品失败:', e);
      message.error('筛选CPC已检测但广告未创建产品失败');
    }
  };

  // 点击可整理资料卡片的处理
  const handleCanOrganizeDataClick = async () => {
    try {
      // 调用后端API获取可整理资料的记录
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/filter-can-organize-data`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      const filteredData = result.data || [];
      
      setData(filteredData);
      setOriginalData(filteredData);
      setFilteredData(filteredData);
      
      // 更新分页状态
      setPagination(prev => ({
        ...prev,
        current: 1,
        total: filteredData.length
      }));
      
      // 更新筛选状态以反映当前筛选条件
      setFilters({ 
        ...filters, 
        status: '', // 清除单一状态筛选，因为这里是多状态
        cpc_status: '',
        cpc_submit: '',
        seller_name: '',
        dateRange: null
      });
      
      message.success(`筛选完成，找到 ${filteredData.length} 条可整理资料记录（状态为"待P图"和"待上传"）`);
    } catch (e) {
      console.error('筛选可整理资料失败:', e);
      message.error('筛选可整理资料失败');
    }
  };

  // 获取唯一的CPC状态选项（基于全库数据）
  const getUniqueCpcStatuses = () => {
    return allDataStats.cpcStatusStats
      .sort((a, b) => a.value.localeCompare(b.value));
  };

  // 获取唯一的CPC提交情况选项（基于全库数据）
  const getUniqueCpcSubmits = () => {
    if (!allDataStats.cpcSubmitStats || !Array.isArray(allDataStats.cpcSubmitStats)) {
      console.warn('CPC提交情况统计数据为空或格式错误:', allDataStats.cpcSubmitStats);
      return [];
    }
    return allDataStats.cpcSubmitStats
      .filter(item => item && item.value && item.count > 0) // 过滤无效数据
      .sort((a: { value: string; count: number }, b: { value: string; count: number }) => a.value.localeCompare(b.value));
  };

  // 获取唯一的供应商选项（基于全库数据）
  const getUniqueSuppliers = () => {
    return allDataStats.supplierStats
      .sort((a, b) => a.value.localeCompare(b.value));
  };

  // 获取唯一的状态选项（基于全库数据）
  const getUniqueStatuses = () => {
    return allDataStats.statusStats
      .sort((a, b) => a.value.localeCompare(b.value));
  };

  // CPC文件管理相关函数
  const handleCpcFileManage = async (record: ProductRecord) => {
    setCurrentRecord(record);
    setCpcModalVisible(true);
    setExtractedDataVisible(false);
    setPendingExtractedData(null);
    await loadCpcFiles(record.id);
  };

  const loadCpcFiles = async (recordId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/cpc-files/${recordId}`);
      if (res.ok) {
        const result = await res.json();
        setCpcFiles(result.data || []);
      }
    } catch (e) {
      console.error('加载CPC文件失败:', e);
    }
  };

  // 单文件上传处理逻辑
  const handleSingleFileUpload = async (file: File) => {
    if (!currentRecord) return null;

    try {
      const formData = new FormData();
      formData.append('cpcFile', file);

      const res = await fetch(`${API_BASE_URL}/api/product_weblink/upload-cpc-file/${currentRecord.id}`, {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();
      
      if (result.code === 0) {
        await loadCpcFiles(currentRecord.id);
        return result;
      } else {
        console.error(`文件 ${file.name} 上传失败:`, result.message);
        return null;
      }
    } catch (e) {
      console.error(`文件 ${file.name} 上传失败:`, e);
      return null;
    }
  };

  // 多文件批量上传处理
  const handleMultipleFileUpload = async (files: File[]) => {
    if (!currentRecord || files.length === 0) return;

    setCpcUploading(true);
    const uploadResults = [];
    let cpcCertificateExtracted = false;
    let extractedInfo: any = null;

    try {
      const loadingMessage = message.loading(`正在批量上传 ${files.length} 个文件...`, 0);

      // 筛选PDF文件
      const pdfFiles = files.filter(file => file.type === 'application/pdf');
      const skippedFiles = files.length - pdfFiles.length;

      if (skippedFiles > 0) {
        message.warning(`跳过 ${skippedFiles} 个非PDF文件`);
      }

      // 逐个上传PDF文件
      for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i];
        const result = await handleSingleFileUpload(file);
        
        if (result) {
          uploadResults.push({
            file: file.name,
            success: true,
            result: result
          });

          // 检查是否为CPC证书文件且是第一个提取到信息的文件
          if (!cpcCertificateExtracted && result.data.extractedData && 
              (result.data.extractedData.styleNumber || result.data.extractedData.recommendAge)) {
            cpcCertificateExtracted = true;
            extractedInfo = result.data.extractedData;
          }
        } else {
          uploadResults.push({
            file: file.name,
            success: false
          });
        }
      }

      loadingMessage(); // 关闭loading消息

      // 生成批量上传结果提示
      const successCount = uploadResults.filter(r => r.success).length;
      const totalPdfCount = pdfFiles.length;
      
      const notifications = [];
      
      if (successCount > 0) {
        if (totalPdfCount === successCount) {
          notifications.push(`成功上传 ${successCount} 个PDF文件`);
        } else {
          notifications.push(`成功上传 ${successCount}/${totalPdfCount} 个PDF文件`);
        }
        
                          if (cpcCertificateExtracted && extractedInfo) {
           // 显示提取结果确认对话框
           setPendingExtractedData(extractedInfo);
           setExtractedDataVisible(true);
           
           const extractedDetails = [];
           if (extractedInfo.styleNumber) {
             extractedDetails.push(`Style Number: ${extractedInfo.styleNumber}`);
           }
           if (extractedInfo.recommendAge) {
             extractedDetails.push(`推荐年龄: ${extractedInfo.recommendAge}`);
           }
           notifications.push(`已从CPC证书文件中自动识别信息：${extractedDetails.join(', ')}，请确认是否应用`);
          } else {
           // 检查是否有CPC证书文件但已经提取过信息
           const hasCpcButAlreadyExtracted = uploadResults.some(r => 
             r.success && r.result?.data?.hasExistingData && 
             r.result?.data?.extractedData && 
             (r.result.data.extractedData.styleNumber || r.result.data.extractedData.recommendAge)
           );
           
           if (hasCpcButAlreadyExtracted) {
             notifications.push('检测到CPC证书文件，但信息已从之前的文件中提取过，跳过重复提取');
           } else if (successCount > 0) {
             notifications.push('未检测到CHILDREN\'S PRODUCT CERTIFICATE文件，无法自动提取信息');
           }
         }

        // 检查是否更新了CPC测试状态
        const latestResult = uploadResults.find(r => r.success && r.result?.data?.cpcStatusUpdated)?.result;
        if (latestResult?.data?.cpcStatusUpdated) {
          notifications.push(`CPC文件数量已达到${latestResult.data.totalFileCount}个，已自动更新CPC测试情况为"已测试"`);
        }

        message.success(notifications.join('；'));
        await loadCpcFiles(currentRecord.id); // 刷新CPC文件列表
        
        // 只有在有搜索条件或筛选条件时才刷新表格数据
        const hasSearchInput = input.trim().length > 0;
        const hasFilters = filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange;
        
        if (hasSearchInput) {
          handleSearch();
        } else if (hasFilters) {
          applyFilters(filters);
        }
      } else {
        message.error('所有文件上传失败');
      }

    } catch (e) {
      message.error('批量上传失败');
    } finally {
      setCpcUploading(false);
    }
  };

  // 兼容原有的单文件上传接口
  const handleCpcFileUpload = async (file: File) => {
    if (!currentRecord) return false;

    setCpcUploading(true);
    
    try {
      const result = await handleSingleFileUpload(file);
      
      if (result) {
        // 显示单文件上传的详细提示
        const notifications = [];
        
                 if (result.data.isFirstExtraction) {
           // 显示提取结果确认对话框
           setPendingExtractedData(result.data.extractedData);
           setExtractedDataVisible(true);
           
           const extractedInfo = [];
           if (result.data.extractedData.styleNumber) {
             extractedInfo.push(`Style Number: ${result.data.extractedData.styleNumber}`);
           }
           if (result.data.extractedData.recommendAge) {
             extractedInfo.push(`推荐年龄: ${result.data.extractedData.recommendAge}`);
           }
           notifications.push(`已自动识别信息：${extractedInfo.join(', ')}，请确认是否应用`);
         } else if (result.data.hasExistingData && 
                   result.data.extractedData && 
                   (result.data.extractedData.styleNumber || result.data.extractedData.recommendAge)) {
           notifications.push("检测到CPC证书文件，但信息已从之前的文件中提取过，跳过重复提取");
         } else if (result.data.extractedData && 
                  !result.data.extractedData.styleNumber && 
                  !result.data.extractedData.recommendAge) {
           notifications.push("文件上传成功，但未能提取信息（请确保上传的是CHILDREN'S PRODUCT CERTIFICATE文件）");
         }
        
        if (result.data.cpcStatusUpdated) {
          notifications.push(`CPC文件数量已达到${result.data.totalFileCount}个，已自动更新CPC测试情况为"已测试"`);
        }
        
        if (notifications.length > 0) {
          message.success(`文件上传成功；${notifications.join('；')}`);
        } else {
          message.success('文件上传成功');
        }
        
        // 刷新表格数据
        if (result.data.cpcStatusUpdated || 
            (result.data.extractedData && (result.data.extractedData.styleNumber || result.data.extractedData.recommendAge))) {
          
          const hasSearchInput = input.trim().length > 0;
          const hasFilters = filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange;
          
          if (hasSearchInput) {
            handleSearch();
          } else if (hasFilters) {
            applyFilters(filters);
          }
        }
      } else {
        message.error('上传失败');
      }
    } catch (e) {
      message.error('上传失败');
    } finally {
      setCpcUploading(false);
    }
    
    return false; // 阻止默认上传
  };

  const handleCpcFileDelete = async (fileUid: string) => {
    if (!currentRecord) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/cpc-file/${currentRecord.id}/${fileUid}`, {
        method: 'DELETE',
      });

      const result = await res.json();
      
      if (result.code === 0) {
        await loadCpcFiles(currentRecord.id);
        
        // 显示删除成功消息和当前文件状态
        const remainingCount = cpcFiles.length - 1;
        let deleteMessage = result.message;
        if (remainingCount === 0) {
          deleteMessage += '，当前无CPC文件';
        } else if (remainingCount === 1) {
          deleteMessage += `，当前还有${remainingCount}个CPC文件`;
        } else {
          deleteMessage += `，当前还有${remainingCount}个CPC文件（已达到测试要求）`;
        }
        
        message.success(deleteMessage);
      } else {
        message.error(result.message);
      }
    } catch (e) {
      message.error('删除失败');
    }
  };

  const getCpcFileCount = (record: ProductRecord) => {
    if (!record.cpc_files) return 0;
    try {
      const files = JSON.parse(record.cpc_files);
      return Array.isArray(files) ? files.length : 0;
    } catch {
      return 0;
    }
  };

  // 确认应用提取的信息
  const handleConfirmExtractedData = async () => {
    if (!currentRecord || !pendingExtractedData) return;

    try {
      const updateData: any = {};
      if (pendingExtractedData.styleNumber) {
        updateData.model_number = pendingExtractedData.styleNumber;
      }
      if (pendingExtractedData.recommendAge) {
        updateData.recommend_age = pendingExtractedData.recommendAge;
      }

      const res = await fetch(`${API_BASE_URL}/api/product_weblink/update/${currentRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        message.success('信息应用成功');
        setExtractedDataVisible(false);
        setPendingExtractedData(null);
        
        // 刷新表格数据
        const hasSearchInput = input.trim().length > 0;
        const hasFilters = filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange;
        
        if (hasSearchInput) {
          handleSearch();
        } else if (hasFilters) {
          applyFilters(filters);
        }
      } else {
        message.error('信息应用失败');
      }
    } catch (e) {
      message.error('信息应用失败');
    }
  };

  // 取消应用提取的信息
  const handleCancelExtractedData = () => {
    setExtractedDataVisible(false);
    setPendingExtractedData(null);
    message.info('已取消应用提取的信息');
  };

  // 批量更新状态
  const handleBatchUpdateStatus = async (status: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要更新的记录');
      return;
    }

    try {
      // 获取选中记录的旧状态
      const selectedRecords = data.filter(item => selectedRowKeys.includes(item.id));
      const oldStatus = selectedRecords.length > 0 ? selectedRecords[0].status : '';
      
      // 确保传递给后端的ID是数字类型
      const ids = selectedRowKeys.map(key => Number(key));
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status, old_status: oldStatus }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      message.success('批量更新成功');
      setSelectedRowKeys([]);
      
      // 更新本地数据
      setData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, status }
            : item
        )
      );
      
      setOriginalData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, status }
            : item
        )
      );
      
      setFilteredData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, status }
            : item
        )
      );
      
      // 刷新统计信息
      fetchAllDataStatistics();

      // 新增：批量更新后自动刷新数据
      if (
        filters.status ||
        filters.cpc_status ||
        filters.cpc_submit ||
        filters.seller_name ||
        filters.dateRange
      ) {
        // 有筛选条件，重新筛选
        applyFilters(filters);
      } else {
        // 无筛选，只有在有搜索输入时才重新搜索
        const hasSearchInput = input.trim().length > 0;
        if (hasSearchInput) {
          handleSearch();
        }
      }
    } catch (e) {
      console.error('批量更新失败:', e);
      message.error('批量更新失败');
    }
  };

  // 处理产品上下架操作
  const handleProductStatusAction = async (action: '上架' | '下架' | '数量调整') => {
    if (isProcessing) return; // 防止重复点击
    
    try {
      setIsProcessing(true);
      let result;

      if (action === '数量调整') {
        if (!quantityAdjustmentText.trim()) {
          message.warning('请输入SKU及数量信息');
          return;
        }
        
        // 验证输入格式
        const lines = quantityAdjustmentText.split('\n').filter(line => line.trim());
        const invalidLines = lines.filter(line => {
          const parts = line.trim().split(/\s+/);
          return parts.length < 2 || isNaN(Number(parts[1])) || Number(parts[1]) < 0;
        });
        
        if (invalidLines.length > 0) {
          message.error(`以下行格式不正确，请确保每行格式为"SKU 数量"：\n${invalidLines.join('\n')}`);
          return;
        }
        
        // 数量调整需要单独发送邮件
        const emailContent = `产品数量调整\n${quantityAdjustmentText}`;
        const emailSubject = '产品手动上下架及数量调整';
        
        result = await apiClient.post('/api/product_weblink/send-status-email', {
          subject: emailSubject,
          content: emailContent
        });
      } else {
        // 上架或下架操作需要选中记录
        if (selectedRowKeys.length === 0) {
          message.warning('请先选择要操作的记录');
          return;
        }

        // 获取选中记录的详细信息
        const selectedRecords = data.filter(item => selectedRowKeys.includes(item.id));
        const parentSkus = selectedRecords.map(record => record.parent_sku);

        // 先检查状态，再执行操作
        if (action === '上架') {
          // 检查状态是否为"商品已下架"
          const invalidRecords = selectedRecords.filter(record => record.status !== '商品已下架');
          if (invalidRecords.length > 0) {
            message.error(`以下记录状态不是"商品已下架"，无法执行上架操作：${invalidRecords.map(r => r.parent_sku).join(', ')}`);
            return;
          }
        } else if (action === '下架') {
          // 检查状态是否为"已经上传"
          const invalidRecords = selectedRecords.filter(record => record.status !== '已经上传');
          if (invalidRecords.length > 0) {
            message.error(`以下记录状态不是"已经上传"，无法执行下架操作：${invalidRecords.map(r => r.parent_sku).join(', ')}`);
            return;
          }
        }

        // 更新数据库状态（后端会自动发送邮件）
        const ids = selectedRecords.map(record => record.id);
        const newStatus = action === '上架' ? '已经上传' : '商品已下架';
        
        result = await apiClient.post('/api/product_weblink/batch-update-status', {
          ids: ids,
          status: newStatus,
          old_status: action === '上架' ? '商品已下架' : '已经上传'
        });
      }

      // 检查API响应
      if (result && result.message) {
        message.success(`${action}操作成功`);
        setProductStatusModalVisible(false);
        setProductStatusAction(null);
        setQuantityAdjustmentText('');
        
        // 刷新数据 - 重新执行当前搜索
        if (input.trim()) {
          handleSearch();
        } else {
          // 如果没有搜索条件，清空数据
          setData([]);
          setOriginalData([]);
        }
      } else {
        throw new Error('服务器响应异常');
      }
    } catch (error) {
      console.error(`${action}操作失败:`, error);
      let errorMessage = '未知错误';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }
      
      message.error(`${action}操作失败: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 直接处理产品上架操作（无需确认对话框）
  const handleDirectProductOnline = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要上架的记录');
      return;
    }

    try {
      // 获取选中记录的详细信息
      const selectedRecords = data.filter(item => selectedRowKeys.includes(item.id));
      const parentSkus = selectedRecords.map(record => record.parent_sku);

      // 更新数据库状态（移除状态检查限制）
      const ids = selectedRecords.map(record => record.id);
      await apiClient.post('/api/product_weblink/batch-update-status', {
        ids: ids,
        status: '已经上传',
        old_status: selectedRecords[0]?.status || '商品已下架' // 使用第一个记录的状态作为旧状态
      });

      // 发送邮件
      const emailContent = `产品上架\n${parentSkus.join('\n')}`;
      await apiClient.post('/api/product_weblink/send-status-email', {
        subject: '产品手动上下架及数量调整',
        content: emailContent
      });

      message.success('产品上架操作成功');
      
      // 刷新数据
      if (input.trim()) {
        handleSearch();
      } else {
        setData([]);
        setOriginalData([]);
      }
    } catch (error) {
      console.error('产品上架操作失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      message.error(`产品上架操作失败: ${errorMessage}`);
    }
  };

  // 直接处理产品下架操作（无需确认对话框）
  const handleDirectProductOffline = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要下架的记录');
      return;
    }

    try {
      // 获取选中记录的详细信息
      const selectedRecords = data.filter(item => selectedRowKeys.includes(item.id));
      const parentSkus = selectedRecords.map(record => record.parent_sku);

      // 更新数据库状态（移除状态检查限制）
      const ids = selectedRecords.map(record => record.id);
      await apiClient.post('/api/product_weblink/batch-update-status', {
        ids: ids,
        status: '商品已下架',
        old_status: selectedRecords[0]?.status || '已经上传' // 使用第一个记录的状态作为旧状态
      });

      // 发送邮件
      const emailContent = `产品下架\n${parentSkus.join('\n')}`;
      await apiClient.post('/api/product_weblink/send-status-email', {
        subject: '产品手动上下架及数量调整',
        content: emailContent
      });

      message.success('产品下架操作成功');
      
      // 刷新数据
      if (input.trim()) {
        handleSearch();
      } else {
        setData([]);
        setOriginalData([]);
      }
    } catch (error) {
      console.error('产品下架操作失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      message.error(`产品下架操作失败: ${errorMessage}`);
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的记录');
      return;
    }

    try {
      // 确保传递给后端的ID是数字类型
      const ids = selectedRowKeys.map(key => Number(key));
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      message.success('批量删除成功');
      setSelectedRowKeys([]);
      
      // 从本地数据中移除已删除的记录
      setData(prevData => 
        prevData.filter(item => !selectedRowKeys.includes(item.id))
      );
      
      setOriginalData(prevData => 
        prevData.filter(item => !selectedRowKeys.includes(item.id))
      );
      
      setFilteredData(prevData => 
        prevData.filter(item => !selectedRowKeys.includes(item.id))
      );
      
      // 刷新统计信息
      fetchAllDataStatistics();
    } catch (e) {
      console.error('批量删除失败:', e);
      message.error('批量删除失败');
    }
  };

  // 批量导出Excel
  const handleBatchExport = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要导出的记录');
      return;
    }

    try {
      // 获取选中的记录
      const currentData = filteredData.length > 0 || filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange ? filteredData : data;
      const selectedRecords = currentData.filter(record => 
        selectedRowKeys.some(key => Number(key) === record.id)
      );

      if (selectedRecords.length === 0) {
        message.warning('没有找到选中的记录');
        return;
      }

      // 准备导出数据
      const exportData = selectedRecords.map(record => ({
        '母SKU': record.parent_sku || '',
        '产品链接': record.weblink || '',
        '上传时间': record.update_time ? dayjs(record.update_time).format('YYYY-MM-DD HH:mm:ss') : '',
        '检查时间': record.check_time ? dayjs(record.check_time).format('YYYY-MM-DD HH:mm:ss') : '',
        '产品状态': record.status || '',
        '备注': record.notice || '',
        'CPC测试情况': record.cpc_status || '',
        'CPC提交情况': record.cpc_submit || '',
        'Style Number': record.model_number || '',
        '推荐年龄': record.recommend_age || '',
        '广告创建': record.ads_add || '',
        '上架母SKU': record.list_parent_sku || '',
        '缺货率': record.no_inventory_rate || '',
        '30天销量': record.sales_30days || '',
        '供应商': record.seller_name || ''
      }));

      // 调用导出API
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/export-excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: exportData }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      // 下载文件
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // 生成文件名
      const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
      link.download = `采购链接管理_${timestamp}.xlsx`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 清理URL对象
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 5000);

      message.success(`成功导出 ${selectedRecords.length} 条记录到Excel文件`);
    } catch (e: unknown) {
      console.error('导出Excel失败:', e);
      const errorMessage = e instanceof Error ? e.message : '导出失败';
      message.error(errorMessage);
    }
  };

  // 批量添加新链接（采购用）
  const handleBatchAddNewLinks = async () => {
    const links = newLinksInput
      .split('\n')
      .map(link => link.trim())
      .filter(Boolean);

    if (links.length === 0) {
      message.warning('请输入产品链接');
      return;
    }

    setNewLinksLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-add-purchase-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links }),
      });

      const result = await res.json();

      if (!res.ok) {
        // 显示详细错误信息
        if (result.errors && result.errors.length > 0) {
          const errorDetails = result.errors.map((err: any) => 
            `第${err.line}行: ${err.error}`
          ).join('\n');
          
          Modal.error({
            title: '链接格式错误',
            content: (
              <div>
                <p>{result.message}</p>
                <div style={{ 
                  marginTop: '12px', 
                  padding: '8px', 
                  backgroundColor: '#fff2f0', 
                  borderRadius: '4px',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  <Text code style={{ whiteSpace: 'pre-wrap' }}>
                    {errorDetails}
                  </Text>
                </div>
              </div>
            ),
            width: 500
          });
        } else {
          message.error(result.message || `HTTP ${res.status}: ${res.statusText}`);
        }
        return;
      }

      // 设置处理结果并显示详细对话框
      setNewLinksResult({
        ...result.data,
        message: result.message
      });
      setNewLinksResultVisible(true);

      setNewLinksModalVisible(false);
      setNewLinksInput('');
      
      // 刷新统计信息
      fetchAllDataStatistics();
      
      // 如果当前有搜索或筛选条件，刷新数据
      const hasSearchInput = input.trim().length > 0;
      const hasFilters = filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange;
      
      if (hasSearchInput) {
        handleSearch();
      } else if (hasFilters) {
        applyFilters(filters);
      }
    } catch (e: unknown) {
      console.error('批量添加新链接失败:', e);
      const errorMessage = e instanceof Error ? e.message : '批量添加失败';
      message.error(errorMessage);
    } finally {
      setNewLinksLoading(false);
    }
  };

  // 批量发送CPC测试申请
  const handleBatchSendCpcTest = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要申请测试的记录');
      return;
    }

    try {
      // 确保传递给后端的ID是数字类型
      const ids = selectedRowKeys.map(key => Number(key));
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-send-cpc-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      message.success(result.message);
      setSelectedRowKeys([]);
      
      // 更新本地数据中的CPC状态
      setData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, cpc_status: '申请测试' }
            : item
        )
      );
      
      setOriginalData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, cpc_status: '申请测试' }
            : item
        )
      );
      
      setFilteredData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, cpc_status: '申请测试' }
            : item
        )
      );
      
      // 刷新统计信息
      fetchAllDataStatistics();
    } catch (e) {
      console.error('发送CPC测试申请失败:', e);
      message.error('发送CPC测试申请失败');
    }
  };

  // 批量标记CPC样品已发
  const handleBatchMarkCpcSampleSent = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要标记的记录');
      return;
    }

    try {
      // 确保传递给后端的ID是数字类型
      const ids = selectedRowKeys.map(key => Number(key));
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-mark-cpc-sample-sent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      message.success(result.message);
      setSelectedRowKeys([]);
      
      // 更新本地数据中的CPC状态
      setData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, cpc_status: '样品已发' }
            : item
        )
      );
      
      setOriginalData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, cpc_status: '样品已发' }
            : item
        )
      );
      
      setFilteredData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, cpc_status: '样品已发' }
            : item
        )
      );
      
      // 刷新统计信息
      fetchAllDataStatistics();
    } catch (e) {
      console.error('标记CPC样品已发失败:', e);
      message.error('标记CPC样品已发失败');
    }
  };
  
  // 批量标记CPC测试申请通过
  const handleBatchCpcTestApproved = async (): Promise<void> => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要标记的记录');
      return;
    }

    try {
      // 确保传递给后端的ID是数字类型
      const ids = selectedRowKeys.map(key => Number(key));
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-cpc-test-approved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      message.success(result.message);
      setSelectedRowKeys([]);
      
      // 更新本地数据中的CPC状态
      setData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, cpc_status: 'CPC样品待采购' }
            : item
        )
      );
      
      setOriginalData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, cpc_status: 'CPC样品待采购' }
            : item
        )
      );
      
      setFilteredData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, cpc_status: 'CPC样品待采购' }
            : item
        )
      );
      
      // 刷新统计信息
      fetchAllDataStatistics();
    } catch (e) {
      console.error('标记CPC测试申请通过失败:', e);
      message.error('标记CPC测试申请通过失败');
    }
  };

  // 批量取消CPC检测
  const handleBatchCancelCpcDetection = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要取消检测的记录');
      return;
    }

    // 检查选中的记录中是否有支持取消检测的CPC测试情况
    const currentData = filteredData.length > 0 || filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange ? filteredData : data;
    const selectedRecords = currentData.filter(record => selectedRowKeys.includes(record.id));
    const eligibleRecords = selectedRecords.filter(record => 
      record.cpc_status === 'CPC样品待采购' || 
      record.cpc_status === '测试中' || 
      record.cpc_status === '样品已发'
    );
    
    if (eligibleRecords.length === 0) {
      message.warning('选中的记录中没有可取消检测的记录（支持取消：CPC样品待采购、测试中、样品已发）');
      return;
    }

    if (eligibleRecords.length < selectedRecords.length) {
      const ineligibleCount = selectedRecords.length - eligibleRecords.length;
      message.warning(`已忽略 ${ineligibleCount} 条不符合条件的记录（只能取消CPC测试情况为"CPC样品待采购"、"测试中"、"样品已发"的记录）`);
    }

    try {
      // 只处理符合条件的记录
      const ids = eligibleRecords.map(record => Number(record.id));
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-cancel-cpc-detection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      message.success(`成功取消 ${eligibleRecords.length} 条记录的CPC检测`);
      setSelectedRowKeys([]);
      
      // 更新本地数据中的CPC状态，将符合条件的记录设置为空字符串
      const eligibleIds = eligibleRecords.map(record => record.id);
      setData(prevData => 
        prevData.map(item => 
          eligibleIds.includes(item.id) 
            ? { ...item, cpc_status: '' }
            : item
        )
      );
      
      setOriginalData(prevData => 
        prevData.map(item => 
          eligibleIds.includes(item.id) 
            ? { ...item, cpc_status: '' }
            : item
        )
      );
      
      setFilteredData(prevData => 
        prevData.map(item => 
          eligibleIds.includes(item.id) 
            ? { ...item, cpc_status: '' }
            : item
        )
      );
      
      // 刷新统计信息
      fetchAllDataStatistics();
    } catch (e) {
      console.error('取消CPC检测失败:', e);
      message.error('取消CPC检测失败');
    }
  };

  // 批量标记CPC测试情况为已测试
  const handleBatchMarkCpcTested = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要标记的记录');
      return;
    }

    try {
      // 确保传递给后端的ID是数字类型
      const ids = selectedRowKeys.map(key => Number(key));
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-mark-cpc-tested`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      message.success(`成功标记 ${ids.length} 条记录的CPC测试情况为已测试`);
      setSelectedRowKeys([]);
      
      // 更新本地数据中的CPC状态
      setData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, cpc_status: '已测试' }
            : item
        )
      );
      
      setOriginalData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, cpc_status: '已测试' }
            : item
        )
      );
      
      setFilteredData(prevData => 
        prevData.map(item => 
          selectedRowKeys.includes(item.id) 
            ? { ...item, cpc_status: '已测试' }
            : item
        )
      );
      
      // 刷新统计信息
      fetchAllDataStatistics();
    } catch (e) {
      console.error('标记CPC测试情况为已测试失败:', e);
      message.error('标记CPC测试情况为已测试失败');
    }
  };

  // 修复全选后批量打开链接的问题
  const handleBatchOpenLinks = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要打开的记录');
      return;
    }

    // 确保类型匹配：将selectedRowKeys中的值转换为数字进行比较
    const currentData = filteredData.length > 0 || filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange ? filteredData : data;
    const selectedRecords = currentData.filter(record => 
      selectedRowKeys.some(key => Number(key) === record.id)
    );
    
    const validLinks = selectedRecords.filter(record => record.weblink && record.weblink.trim() !== '');

    if (validLinks.length === 0) {
      message.warning('所选记录中没有有效的产品链接');
      return;
    }

    // 直接打开链接，提供更好的用户反馈
    const openLinks = async () => {
      let successCount = 0;
      let blockedCount = 0;
      
      message.loading('正在打开产品链接...', 1);
      
      for (let i = 0; i < validLinks.length; i++) {
        const record = validLinks[i];
        try {
          const opened = window.open(record.weblink, '_blank', 'noopener,noreferrer');
          if (opened && !opened.closed) {
            successCount++;
          } else {
            blockedCount++;
          }
          
          // 短暂延时，避免浏览器认为是垃圾邮件
          if (i < validLinks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (error) {
          blockedCount++;
          console.error('Error opening link:', record.weblink, error);
        }
      }
      
      // 详细的反馈信息
      if (successCount === validLinks.length) {
        message.success(`成功打开 ${successCount} 个产品链接`);
      } else if (successCount > 0) {
        message.warning(`成功打开 ${successCount} 个链接，${blockedCount} 个链接可能被浏览器阻止`);
      } else {
        message.error('所有链接都被浏览器阻止。请检查浏览器设置，允许此网站打开弹出窗口。');
      }
    };

    if (validLinks.length > 10) {
      Modal.confirm({
        title: '确认打开链接',
        content: `您将要打开 ${validLinks.length} 个链接，这可能会影响浏览器性能。是否继续？`,
        onOk: openLinks,
      });
    } else {
      openLinks();
    }
  };

  // 字段名称映射
  const getFieldDisplayName = (field: string) => {
    const fieldNameMap: { [key: string]: string } = {
      'parent_sku': '母SKU',
      'weblink': '产品链接',
      'status': '产品状态',
      'notice': '备注',
      'cpc_status': 'CPC测试情况',
      'cpc_submit': 'CPC提交情况',
      'model_number': 'Style Number',
      'recommend_age': '推荐年龄',
      'ads_add': '广告创建',
      'list_parent_sku': '上架母SKU',
      'no_inventory_rate': '缺货率',
      'sales_30days': '30天销量',
      'seller_name': '供应商'
    };
    return fieldNameMap[field] || field;
  };


  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingCell) return;

    try {
      const values = await (editForm as any).validateFields();
      const updateData = { [editingCell.field]: values.value };

      const res = await fetch(`${API_BASE_URL}/api/product_weblink/update/${editingCell.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      message.success('更新成功');
      setEditModalVisible(false);
      setEditingCell(null);
      (editForm as any).resetFields();
      
      // 更新本地数据
      setData(prevData => 
        prevData.map(item => 
          item.id === editingCell.id 
            ? { ...item, [editingCell.field]: values.value }
            : item
        )
      );
      
      setOriginalData(prevData => 
        prevData.map(item => 
          item.id === editingCell.id 
            ? { ...item, [editingCell.field]: values.value }
            : item
        )
      );
      
      setFilteredData(prevData => 
        prevData.map(item => 
          item.id === editingCell.id 
            ? { ...item, [editingCell.field]: values.value }
            : item
        )
      );
      
      // 刷新统计信息
      fetchAllDataStatistics();
    } catch (e) {
      console.error('更新失败:', e);
      message.error('更新失败');
    }
  };

  // 处理记录编辑
  const handleRecordEdit = (record: ProductRecord) => {
    setEditingRecord(record);
    setRecordEditModalVisible(true);
    recordEditForm.setFieldsValue({
      parent_sku: record.parent_sku,
      weblink: record.weblink,
      status: record.status,
      notice: record.notice,
      cpc_status: record.cpc_status,
      cpc_submit: record.cpc_submit,
      model_number: record.model_number,
      recommend_age: record.recommend_age,
      ads_add: record.ads_add,
      list_parent_sku: record.list_parent_sku,
      no_inventory_rate: record.no_inventory_rate,
      sales_30days: record.sales_30days,
      seller_name: record.seller_name
    });
  };

  // 保存记录编辑
  const handleSaveRecordEdit = async () => {
    if (!editingRecord) return;

    try {
      const values = await recordEditForm.validateFields();

      const res = await fetch(`${API_BASE_URL}/api/product_weblink/update/${editingRecord.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
        },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      message.success('记录更新成功');
      setRecordEditModalVisible(false);
      setEditingRecord(null);
      recordEditForm.resetFields();
      
      // 更新本地数据
      const updateLocalData = (prevData: ProductRecord[]) => 
        prevData.map(item => 
          item.id === editingRecord.id 
            ? { ...item, ...values }
            : item
        );
      
      setData(updateLocalData);
      setOriginalData(updateLocalData);
      setFilteredData(updateLocalData);
      
      // 刷新统计信息
      fetchAllDataStatistics();
    } catch (e: unknown) {
      console.error('更新记录失败:', e);
      const errorMessage = e instanceof Error ? e.message : '更新失败';
      message.error(errorMessage);
    }
  };

  // 处理记录删除

  // 处理母SKU双击编辑
  const handleParentSkuDoubleClick = (record: ProductRecord) => {
    // 只有当母SKU为空时才允许编辑
    if (!record.parent_sku || record.parent_sku.trim() === '') {
      setEditingParentSku({id: record.id, currentValue: record.parent_sku || ''});
      setParentSkuInputValue(record.parent_sku || '');
    }
  };

  // 保存母SKU编辑
  const handleSaveParentSku = async () => {
    if (!editingParentSku) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/product_weblink/update/${editingParentSku.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent_sku: parentSkuInputValue.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '更新失败');
      }

      // 更新本地数据
      const updateRecord = (records: ProductRecord[]) =>
        records.map(record =>
          record.id === editingParentSku.id
            ? { ...record, parent_sku: parentSkuInputValue.trim() }
            : record
        );

      setData(updateRecord);
      setOriginalData(updateRecord);
      setFilteredData(updateRecord);

      message.success('母SKU更新成功');
      setEditingParentSku(null);
      setParentSkuInputValue('');
    } catch (error) {
      console.error('更新母SKU失败:', error);
      message.error(error instanceof Error ? error.message : '更新失败');
    }
  };

  // 取消母SKU编辑
  const handleCancelParentSkuEdit = () => {
    setEditingParentSku(null);
    setParentSkuInputValue('');
  };

  // 处理备注双击编辑
  const handleNoticeDoubleClick = (record: ProductRecord) => {
    setEditingNotice({id: record.id, currentValue: record.notice || ''});
    setNoticeInputValue(record.notice || '');
  };

  // 保存备注编辑
  const handleSaveNotice = async () => {
    if (!editingNotice || isSavingNotice) return;

    setIsSavingNotice(true);
    try {
      console.log('开始更新备注，ID:', editingNotice.id, '新值:', noticeInputValue.trim());
      
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.productWeblink.update(editingNotice.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notice: noticeInputValue.trim()
        }),
      });

      console.log('API响应状态:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('API返回错误:', errorData);
        throw new Error(errorData.message || '更新失败');
      }

      const responseData = await response.json();
      console.log('API响应数据:', responseData);

      // 更新本地数据
      const updateRecord = (records: ProductRecord[]) =>
        records.map(record =>
          record.id === editingNotice.id
            ? { ...record, notice: noticeInputValue.trim() }
            : record
        );

      setData(updateRecord);
      setOriginalData(updateRecord);
      setFilteredData(updateRecord);
      setEditingNotice(null);
      setNoticeInputValue('');
      message.success('备注更新成功');
    } catch (error) {
      console.error('更新备注失败:', error);
      message.error(error instanceof Error ? error.message : '更新失败');
    } finally {
      setIsSavingNotice(false);
    }
  };

  // 取消备注编辑
  const handleCancelNoticeEdit = () => {
    setEditingNotice(null);
    setNoticeInputValue('');
  };

  // 新的Excel上传处理（支持SKU, 链接, 备注）
  const handleExcelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('enableDingTalkNotification', enableDingTalkNotification.toString());



    setLoading(true);
    fetch(`${API_BASE_URL}/api/product_weblink/upload-excel-new`, {
      method: 'POST',
      body: formData,
    })
      .then(async res => {
        const contentType = res.headers.get('content-type');
        let responseData = null;
        
        try {
          if (contentType && contentType.includes('application/json')) {
            responseData = await res.json();
          }
        } catch (parseError) {
          // 解析失败时设为null
        }
        
        if (!res.ok) {
          // 如果是错误响应但包含data，显示详细对话框
          if (responseData && responseData.data) {
            setUploadModalVisible(false);
            setEnableDingTalkNotification(true);
            setUploadResult(responseData.data);
            setUploadResultVisible(true);
            return; // 直接返回，不抛出错误
          }
          
          // 其他错误情况
          const errorMessage = responseData?.message || `服务器错误 (${res.status}): ${res.statusText}`;
          throw new Error(errorMessage);
        }
        
        return responseData;
      })
      .then(result => {
        // 只有在result存在时才处理
        if (result) {
          setUploadModalVisible(false);
          // 重置钉钉推送开关为默认开启状态
          setEnableDingTalkNotification(true);
          
          // 设置上传结果并显示详细对话框
          if (result.data) {
            setUploadResult(result.data);
            setUploadResultVisible(true);
            
            // 如果有成功上传或更新的记录，刷新数据
            const totalProcessed = (result.data.successCount || 0) + (result.data.updatedCount || 0);
            if (totalProcessed > 0) {
              // 刷新统计信息
              fetchAllDataStatistics();
              
              // 只有在有搜索条件或筛选条件时才刷新搜索结果
              const hasSearchInput = input.trim().length > 0;
              const hasFilters = filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange;
              
              if (hasSearchInput) {
                handleSearch();
              } else if (hasFilters) {
                applyFilters(filters);
              }
            }
          } else {
            // 兼容旧格式
            message.success(result.message);
          }
        }
      })
      .catch(e => {
        // 确保错误信息正确显示
        let errorMessage = '上传失败';
        if (e.message) {
          // 如果错误信息已经包含"上传失败"，就不重复添加
          errorMessage = e.message.includes('上传失败') ? e.message : `上传失败: ${e.message}`;
        }
        
        message.error(errorMessage);
      })
      .finally(() => {
        setLoading(false);
        // 清空文件选择
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      });
  };





  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  // 复制到剪贴板功能
  const handleCopyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(`${type}已复制到剪贴板`);
    } catch (err) {
      // 降级方案：使用传统的复制方法
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        message.success(`${type}已复制到剪贴板`);
      } catch (fallbackErr) {
        message.error('复制失败，请手动复制');
      }
      document.body.removeChild(textArea);
    }
  };

  // 表格排序处理
  const handleTableChange: TableProps<ProductRecord>['onChange'] = (paginationInfo, filters, sorter) => {
    if (paginationInfo) {
      setPagination(prev => ({
        ...prev,
        current: paginationInfo.current || 1,
        pageSize: paginationInfo.pageSize || 50
      }));
    }
  };

  // 表格列配置（添加排序功能）
  const columns: ColumnsType<ProductRecord> = [
    { 
      title: '母SKU', 
      dataIndex: 'parent_sku', 
      key: 'parent_sku', 
      align: 'center' as const,
      fixed: 'left',
      sorter: (a, b) => a.parent_sku.localeCompare(b.parent_sku),
      render: (text: string, record: ProductRecord) => {
        // 如果正在编辑这个记录的母SKU
        if (editingParentSku && editingParentSku.id === record.id) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Input
                value={parentSkuInputValue}
                onChange={(e) => setParentSkuInputValue(e.target.value)}
                onPressEnter={handleSaveParentSku}
                onBlur={handleSaveParentSku}
                autoFocus
                style={{ width: 80 }}
                size="small"
              />
              <Button
                type="text"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={handleSaveParentSku}
                style={{ color: '#52c41a' }}
              />
              <Button
                type="text"
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={handleCancelParentSkuEdit}
                style={{ color: '#ff4d4f' }}
              />
            </div>
          );
        }
        
        // 如果母SKU为空，显示可编辑的提示
        if (!text || text.trim() === '') {
          return (
            <div
              onDoubleClick={() => handleParentSkuDoubleClick(record)}
              style={{
                cursor: 'pointer',
                color: '#999',
                fontStyle: 'italic',
                padding: '4px 8px',
                border: '1px dashed #d9d9d9',
                borderRadius: '4px',
                minHeight: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="双击编辑母SKU"
            >
              双击编辑
            </div>
          );
        }
        
        // 有值时显示可选择的文本和复制按钮
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              minHeight: '24px',
              padding: '4px 8px'
            }}
          >
            <div
              onClick={() => handleParentSkuClick(text)}
              style={{
                cursor: 'pointer',
                color: '#1890ff',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                flex: 1,
                userSelect: 'text'
              }}
              title={`点击复制母SKU: ${text}`}
            >
              {text}
            </div>
            <CopyOutlined
              onClick={(e) => {
                e.stopPropagation();
                handleCopyToClipboard(text, '母SKU');
              }}
              style={{
                cursor: 'pointer',
                color: '#666',
                fontSize: '12px',
                padding: '2px',
                borderRadius: '2px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#1890ff';
                e.currentTarget.style.backgroundColor = '#f0f8ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#666';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="复制母SKU"
            />
          </div>
        );
      }
    },
    { 
      title: '产品链接', 
      dataIndex: 'weblink', 
      key: 'weblink', 
      align: 'center' as const,
      width: 200,
      fixed: 'left',
      render: (text: string) => {
        if (!text) return '';
        
        // 提取序列号部分
        const extractSequenceNumber = (url: string): string => {
          // 匹配 1688.com/offer/ 后面的数字部分
          const match = url.match(/detail\.1688\.com\/offer\/(\d+)/);
          if (match && match[1]) {
            return match[1];
          }
          
          // 如果匹配不到，尝试其他常见模式
          const otherMatch = url.match(/\/(\d+)\.html$/);
          if (otherMatch && otherMatch[1]) {
            return otherMatch[1];
          }
          
          // 如果都匹配不到，返回原URL
          return url;
        };
        
        const sequenceNumber = extractSequenceNumber(text);
        
        return (
          <Tooltip title={text}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                maxWidth: '180px'
              }}
            >
              <div
                onClick={() => window.open(text, '_blank')}
                style={{ 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap', 
                  flex: 1,
                  cursor: 'pointer',
                  color: '#1890ff',
                  userSelect: 'text',
                  padding: '4px 8px'
                }}
                title={`点击打开链接: ${text}`}
              >
                {sequenceNumber}
              </div>
              <CopyOutlined
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyToClipboard(text, '产品链接');
                }}
                style={{
                  cursor: 'pointer',
                  color: '#666',
                  fontSize: '12px',
                  padding: '2px',
                  borderRadius: '2px',
                  transition: 'all 0.2s',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#1890ff';
                  e.currentTarget.style.backgroundColor = '#f0f8ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#666';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="复制产品链接"
              />
            </div>
          </Tooltip>
        );
      }
    },
    { 
      title: '备注', 
      dataIndex: 'notice', 
      key: 'notice', 
      align: 'center' as const,
      width: 200,
      fixed: 'left',
      sorter: (a, b) => (a.notice || '').localeCompare(b.notice || ''),
      render: (text: string, record: ProductRecord) => {
        // 如果正在编辑这个记录的备注
        if (editingNotice && editingNotice.id === record.id) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Input
                value={noticeInputValue}
                onChange={(e) => setNoticeInputValue(e.target.value)}
                onPressEnter={handleSaveNotice}
                autoFocus
                style={{ width: 100 }}
                size="small"
                placeholder="输入备注"
                disabled={isSavingNotice}
              />
              <Button
                type="text"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={handleSaveNotice}
                disabled={isSavingNotice}
                style={{ color: '#52c41a' }}
              />
              <Button
                type="text"
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={handleCancelNoticeEdit}
                disabled={isSavingNotice}
                style={{ color: '#ff4d4f' }}
              />
            </div>
          );
        }
        
        // 如果备注为空，显示可编辑的提示
        if (!text || text.trim() === '') {
          return (
            <div
              onDoubleClick={() => handleNoticeDoubleClick(record)}
              style={{
                cursor: 'pointer',
                color: '#999',
                fontStyle: 'italic',
                padding: '4px 8px',
                border: '1px dashed #d9d9d9',
                borderRadius: '4px',
                minHeight: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="双击编辑备注"
            >
              双击编辑
            </div>
          );
        }
        
        // 有值时显示可编辑的文本
        return (
          <div
            onDoubleClick={() => handleNoticeDoubleClick(record)}
            style={{
              cursor: 'pointer',
              color: '#1890ff',
              fontWeight: 'normal',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid transparent',
              transition: 'all 0.2s',
              minHeight: '24px',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f0f8ff';
              e.currentTarget.style.borderColor = '#d9d9d9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
            }}
            title={`双击编辑备注: ${text}`}
          >
            {text}
          </div>
        );
      }
    },
    { 
      title: 'Style Number', 
      dataIndex: 'model_number', 
      key: 'model_number', 
      align: 'center' as const,
      width: 120,
      sorter: (a, b) => (a.model_number || '').localeCompare(b.model_number || '')
    },
    { 
      title: '推荐年龄', 
      dataIndex: 'recommend_age', 
      key: 'recommend_age', 
      align: 'center' as const,
      width: 100,
      sorter: (a, b) => (a.recommend_age || '').localeCompare(b.recommend_age || '')
    },
    { 
      title: '竞争对手ASIN', 
      dataIndex: 'competitor_links', 
      key: 'competitor_links', 
      align: 'center' as const,
      width: 200,
      render: (text: string, record: ProductRecord) => {
        let asins: string[] = [];
        try {
          if (text) {
            asins = JSON.parse(text);
          }
        } catch {
          asins = [];
        }
        
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {asins.length > 0 ? (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                  {asins.map((asin, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: '#f0f0f0',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '12px'
                    }}>
                      <span style={{ marginRight: '4px' }}>{asin}</span>
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        style={{ 
                          width: '16px', 
                          height: '16px', 
                          minWidth: '16px',
                          color: '#ff4d4f',
                          padding: 0
                        }}
                        onClick={() => handleDeleteCompetitorAsin(record, index)}
                        title="删除此ASIN"
                      />
                    </div>
                  ))}
                </div>
                <Space size={4}>
                  <Button 
                    size="small" 
                    type="link"
                    onClick={() => handleAddCompetitorLinks(record)}
                    icon={<PlusOutlined />}
                  >
                    添加
                  </Button>
                  <Button 
                    size="small" 
                    type="primary"
                    onClick={() => handleBatchOpenCompetitorLinks(record)}
                    icon={<LinkOutlined />}
                  >
                    批量打开
                  </Button>
                </Space>
              </>
            ) : (
              <Button 
                size="small" 
                type="dashed"
                onClick={() => handleAddCompetitorLinks(record)}
                icon={<PlusOutlined />}
                style={{ fontSize: '12px' }}
              >
                添加ASIN
              </Button>
            )}
          </div>
        );
      }
    },
    { 
      title: '上传时间', 
      dataIndex: 'update_time', 
      key: 'update_time', 
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '', 
      align: 'center' as const,
      width: 160,
      sorter: (a, b) => dayjs(a.update_time).unix() - dayjs(b.update_time).unix(),
    },
    { 
      title: '检查时间', 
      dataIndex: 'check_time', 
      key: 'check_time', 
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '', 
      align: 'center' as const,
      width: 160,
      sorter: (a, b) => dayjs(a.check_time || 0).unix() - dayjs(b.check_time || 0).unix(),
    },
    { 
      title: '产品状态', 
      dataIndex: 'status', 
      key: 'status', 
      align: 'center' as const,
      width: 100,
      sorter: (a, b) => (a.status || '').localeCompare(b.status || '')
    },
    { 
      title: '重点款', 
      dataIndex: 'is_key_product', 
      key: 'is_key_product', 
      align: 'center' as const,
      width: 80,
      render: (value: boolean, record: ProductRecord) => (
        <div
          onClick={() => handleKeyProductToggle(record)}
          style={{
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '4px',
            textAlign: 'center',
            backgroundColor: value ? '#f6ffed' : '#fff2e8',
            border: `1px solid ${value ? '#52c41a' : '#d9d9d9'}`,
            color: value ? '#52c41a' : '#999',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = value ? '#e6f7ff' : '#fff7e6';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = value ? '#f6ffed' : '#fff2e8';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="单击切换重点款状态"
        >
          {value ? '是' : '否'}
        </div>
      ),
      sorter: (a, b) => (a.is_key_product ? 1 : 0) - (b.is_key_product ? 1 : 0)
    },
    { 
      title: '自定义类目', 
      dataIndex: 'custom_category', 
      key: 'custom_category', 
      align: 'center' as const,
      width: 120,
      render: (text: string, record: ProductRecord) => {
        if (!text || text.trim() === '') {
          return (
            <Button
              size="small"
              type="dashed"
              onClick={() => handleCustomCategoryEdit(record)}
              icon={<PlusOutlined />}
              style={{ fontSize: '12px' }}
            >
              添加类目
            </Button>
          );
        }
        
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tag
              color="blue"
              style={{ 
                cursor: 'pointer',
                maxWidth: '80px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              onClick={() => handleCustomCategoryEdit(record)}
              title={`点击编辑类目: ${text}`}
            >
              {text}
            </Tag>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleCustomCategoryEdit(record)}
              style={{ 
                width: '20px', 
                height: '20px', 
                minWidth: '20px',
                padding: 0
              }}
              title="编辑类目"
            />
          </div>
        );
      },
      sorter: (a, b) => (a.custom_category || '').localeCompare(b.custom_category || '')
    },
    { 
      title: 'CPC文件', 
      dataIndex: 'cpc_files', 
      key: 'cpc_files', 
      align: 'center' as const,
      width: 140,
      render: (text: string, record: ProductRecord) => {
        const fileCount = getCpcFileCount(record);
        const hasFiles = fileCount > 0;
        
        return (
          <Space direction="vertical" size={4}>
            <Badge 
              count={fileCount} 
              overflowCount={99} 
              size="small"
              style={{ 
                backgroundColor: hasFiles ? '#52c41a' : '#d9d9d9',
                color: hasFiles ? '#fff' : '#999'
              }}
            >
              <Button
                type={hasFiles ? "primary" : "default"}
                size="small"
                icon={<FilePdfOutlined />}
                onClick={() => handleCpcFileManage(record)}
                style={{
                  backgroundColor: hasFiles ? '#52c41a' : undefined,
                  borderColor: hasFiles ? '#52c41a' : undefined
                }}
              >
                {hasFiles ? `CPC文件(${fileCount})` : 'CPC文件'}
              </Button>
            </Badge>
            {hasFiles && (
              <div style={{ 
                fontSize: '10px', 
                color: '#52c41a',
                fontWeight: 'bold'
              }}>
                ✓ 已上传
              </div>
            )}
            {!hasFiles && (
              <div style={{ 
                fontSize: '10px', 
                color: '#999'
              }}>
                未上传
              </div>
            )}
          </Space>
        );
      }
    },
    { 
      title: 'CPC测试情况', 
      dataIndex: 'cpc_status', 
      key: 'cpc_status', 
      align: 'center' as const,
      width: 120,
      sorter: (a, b) => (a.cpc_status || '').localeCompare(b.cpc_status || '')
    },
    { 
      title: 'CPC提交情况', 
      dataIndex: 'cpc_submit', 
      key: 'cpc_submit', 
      align: 'center' as const,
      width: 120,
      sorter: (a, b) => (a.cpc_submit || '').localeCompare(b.cpc_submit || '')
    },
    { 
      title: '广告创建', 
      dataIndex: 'ads_add', 
      key: 'ads_add', 
      align: 'center' as const,
      width: 150,
      render: (value: string | { US: string; UK: string }, record: ProductRecord) => {
        const adsStatus = parseAdsAdd(value);
        const usStatus = adsStatus.US;
        const ukStatus = adsStatus.UK;
        
        return (
          <div
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              textAlign: 'center',
              backgroundColor: '#f6ffed',
              border: '1px solid #d9d9d9',
              fontSize: '12px',
              lineHeight: '1.4'
            }}
            title="点击站点切换广告状态，双击打开详细编辑"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span 
                onClick={() => handleAdsSiteToggle(record, 'US')}
                onDoubleClick={() => handleAdsAddToggle(record)}
                style={{ 
                  color: usStatus === '是' ? '#52c41a' : '#999',
                  fontWeight: usStatus === '是' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  borderRadius: '3px',
                  transition: 'background-color 0.2s',
                  flex: 1,
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e6f7ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="点击切换美国站点广告状态"
              >
                🇺🇸{usStatus}
              </span>
              <span 
                onClick={() => handleAdsSiteToggle(record, 'UK')}
                onDoubleClick={() => handleAdsAddToggle(record)}
                style={{ 
                  color: ukStatus === '是' ? '#52c41a' : '#999',
                  fontWeight: ukStatus === '是' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  borderRadius: '3px',
                  transition: 'background-color 0.2s',
                  flex: 1,
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e6f7ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="点击切换英国站点广告状态"
              >
                🇬🇧{ukStatus}
              </span>
            </div>
          </div>
        );
      },
      sorter: (a, b) => {
        const aStatus = parseAdsAdd(a.ads_add);
        const bStatus = parseAdsAdd(b.ads_add);
        const aStr = `${aStatus.US}${aStatus.UK}`;
        const bStr = `${bStatus.US}${bStatus.UK}`;
        return aStr.localeCompare(bStr);
      }
    },
    { 
      title: '上架母SKU', 
      dataIndex: 'list_parent_sku', 
      key: 'list_parent_sku', 
      align: 'center' as const,
      width: 120,
      sorter: (a, b) => (a.list_parent_sku || '').localeCompare(b.list_parent_sku || '')
    },
    { 
      title: '缺货率', 
      dataIndex: 'no_inventory_rate', 
      key: 'no_inventory_rate', 
      align: 'center' as const,
      width: 100,
      sorter: (a, b) => (parseFloat(a.no_inventory_rate) || 0) - (parseFloat(b.no_inventory_rate) || 0)
    },
    { 
      title: '30天销量', 
      dataIndex: 'sales_30days', 
      key: 'sales_30days', 
      align: 'center' as const,
      width: 100,
      sorter: (a, b) => (parseInt(a.sales_30days) || 0) - (parseInt(b.sales_30days) || 0)
    },
    { 
      title: '供应商', 
      dataIndex: 'seller_name', 
      key: 'seller_name', 
      align: 'center' as const,
      width: 120,
      sorter: (a, b) => (a.seller_name || '').localeCompare(b.seller_name || '')
    },
    {
      title: '编辑',
      key: 'actions',
      align: 'center' as const,
      width: 120,
      render: (text: any, record: ProductRecord) => (
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleRecordEdit(record)}
          >
            编辑
          </Button>
      )
    }
  ];

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    onSelectAll: (selected: boolean, selectedRows: ProductRecord[], changeRows: ProductRecord[]) => {
      if (selected) {
        // 全选时，确保选择所有当前页面的记录
        const allKeys = data.map(record => record.id);
        setSelectedRowKeys(allKeys);
      } else {
        // 取消全选
        setSelectedRowKeys([]);
      }
    },
    onSelect: (record: ProductRecord, selected: boolean) => {
      if (selected) {
        // 添加选择的记录
        setSelectedRowKeys(prev => [...prev, record.id]);
      } else {
        // 移除取消选择的记录
        setSelectedRowKeys(prev => prev.filter(key => Number(key) !== record.id));
      }
    },
    getCheckboxProps: (record: ProductRecord) => ({
      disabled: false,
      name: record.parent_sku,
    }),
  };

  // 亚马逊模板管理相关函数
  const fetchTemplateFiles = async (country: string, category?: string) => {
    try {
      setTemplateLoading(prev => ({ ...prev, [country]: true }));
      logger.template(`获取${country}站点模板列表...`);
      
      const url = new URL(`${API_BASE_URL}/api/product_weblink/amazon-templates`);
      url.searchParams.set('country', country);
      // 不传递category参数，获取全部文件
      
      const res = await fetch(url.toString());
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const result = await res.json();
      logger.template(`${country}站点模板列表获取成功: ${result.data?.length || 0} 个文件`);
      
      setAllTemplateFiles(prev => ({
        ...prev,
        [country]: result.data || []
      }));
    } catch (error) {
      console.error(`❌ 获取${country}站点模板列表失败:`, error);
      // 不显示太多错误消息，避免刷屏
      if (globalTemplateLoading) {
        console.warn(`${country}站点数据加载失败，将在模态框中显示空列表`);
      }
    } finally {
      setTemplateLoading(prev => ({ ...prev, [country]: false }));
    }
  };

  // 获取类目列表
  const fetchTemplateCategories = async (country: string) => {
    try {
      logger.template(`获取${country}站点类目列表...`);
      
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/amazon-templates/categories?country=${country}`);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const result = await res.json();
      logger.template(`${country}站点类目列表获取成功: ${result.data?.length || 0} 个类目`);
      
      setTemplateCategories(prev => ({
        ...prev,
        [country]: result.data || []
      }));
    } catch (error) {
      console.error(`❌ 获取${country}站点类目列表失败:`, error);
    }
  };


  // 批量获取所有站点的模板文件和类目
  const fetchAllTemplateFiles = async () => {
    const countries = ['US', 'CA', 'UK', 'AE', 'AU'];
    
    try {
      setGlobalTemplateLoading(true);
      logger.template('开始批量加载所有站点模板数据和类目...');
      
      const promises = countries.flatMap(country => [
        fetchTemplateFiles(country),
        fetchTemplateCategories(country)
      ]);
      await Promise.all(promises);
      
      logger.template('所有站点模板数据和类目加载完成');
    } catch (error) {
      logger.error('批量加载模板数据时发生错误:', error);
      message.error('加载模板数据失败，请重试');
    } finally {
      setGlobalTemplateLoading(false);
    }
  };

  const handleTemplateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 在上传前确保localStorage中没有损坏的数据
    try {
      const { cleanStorageForTemplateUpload } = await import('../../utils/storageUtils');
      const cleanResult = cleanStorageForTemplateUpload();
      if (cleanResult.success && cleanResult.cleanedKeys > 0) {
        console.log('🔧 模板上传前清理了存储问题:', cleanResult.message);
      }
    } catch (storageError) {
      console.warn('⚠️ localStorage诊断失败，继续上传流程:', storageError);
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('country', activeTabKey);
    formData.append('category', selectedCategory[activeTabKey] || 'default');
    formData.append('originalFileName', file.name);

    try {
      setTemplateLoading(prev => ({ ...prev, [activeTabKey]: true }));
      
      // 添加更详细的上传日志
      console.log('📤 开始上传亚马逊模板:', {
        fileName: file.name,
        fileSize: file.size,
        country: activeTabKey
      });
      
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/amazon-templates/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('上传请求失败:', { status: res.status, statusText: res.statusText, errorText });
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      logger.success('模板上传成功:', result);
      message.success(result.message);
      
      // 重新获取模板列表和类目列表
      await Promise.all([
        fetchTemplateFiles(activeTabKey), // 不传递category，获取全部文件
        fetchTemplateCategories(activeTabKey)
      ]);
      
    } catch (e) {
      console.error('上传模板失败:', e);
      
      // 根据错误类型提供更具体的错误信息
      let errorMessage = '上传模板失败';
      if (e instanceof Error) {
        if (e.message.includes('JSON')) {
          errorMessage = '数据格式错误，请刷新页面后重试';
        } else if (e.message.includes('Network')) {
          errorMessage = '网络连接失败，请检查网络后重试';
        } else if (e.message.includes('413')) {
          errorMessage = '文件太大，请选择较小的文件';
        } else if (e.message.includes('400')) {
          errorMessage = '文件格式不正确，请上传有效的Excel文件';
        }
      }
      
      message.error(errorMessage);
    } finally {
      setTemplateLoading(prev => ({ ...prev, [activeTabKey]: false }));
      // 清空文件选择
      if (templateFileInputRef.current) {
        templateFileInputRef.current.value = '';
      }
    }
  };

  const handleTemplateDelete = async (objectName: string) => {
    try {
      setTemplateLoading(prev => ({ ...prev, [activeTabKey]: true }));
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/amazon-templates/${encodeURIComponent(objectName)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      message.success(result.message);
      
      // 重新获取模板列表和类目列表
      await Promise.all([
        fetchTemplateFiles(activeTabKey), // 不传递category，获取全部文件
        fetchTemplateCategories(activeTabKey)
      ]);
      
    } catch (e) {
      console.error('删除模板失败:', e);
      message.error('删除模板失败');
    } finally {
      setTemplateLoading(prev => ({ ...prev, [activeTabKey]: false }));
    }
  };

  // 切换模板激活状态
  const handleToggleTemplateActive = async (templateId: number, isActive: boolean) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/amazon-templates/${templateId}/toggle-active`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const result = await res.json();
      logger.success('模板状态切换成功:', result);
      
      // 直接更新本地状态，然后重新获取数据
      setAllTemplateFiles(prev => {
        const newState = { ...prev };
        // 找到对应的模板并更新其状态
        Object.keys(newState).forEach(country => {
          if (newState[country]) {
            newState[country] = newState[country].map(file => 
              file.id === templateId ? { ...file, isActive } : file
            );
          }
        });
        return newState;
      });
      
      // 重新获取所有站点的模板列表和类目列表
      await fetchAllTemplateFiles();
      
      message.success(`模板已${isActive ? '激活' : '禁用'}`);
    } catch (error) {
      logger.error('切换模板状态失败:', error);
      message.error('操作失败: ' + (error as Error).message);
    }
  };

  const handleTemplateDownload = async (objectName: string, fileName: string) => {
    try {
      logger.template(`开始下载模板文件: ${fileName}`);
      
      const downloadUrl = `${API_BASE_URL}/api/product_weblink/amazon-templates/download/${encodeURIComponent(objectName)}`;
      
      // 使用fetch下载文件，这样可以处理错误响应
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 403) {
          message.error('下载失败：OSS访问权限不足，请联系管理员检查配置');
        } else if (response.status === 404) {
          message.error('下载失败：模板文件不存在');
        } else {
          message.error(`下载失败：${errorData.message || response.statusText}`);
        }
        return;
      }
      
      // 获取文件内容
      const blob = await response.blob();
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 清理URL对象
      window.URL.revokeObjectURL(url);
      
      message.success(`模板文件 ${fileName} 下载成功`);
      
    } catch (error) {
      logger.error('下载模板文件失败:', error);
      message.error('下载失败：网络错误，请稍后重试');
    }
  };



  const handleOpenTemplateModal = () => {
    setTemplateModalVisible(true);
    fetchAllTemplateFiles();
  };

  const handleTabChange = (key: string) => {
    setActiveTabKey(key);
  };

  // 处理类目选择变化
  const handleCategoryChange = async (country: string, category: string) => {
    setSelectedCategory(prev => ({
      ...prev,
      [country]: category
    }));
    
    // 不需要重新获取模板列表，因为列表显示全部文件
  };

  // 处理添加模板
  const handleAddTemplate = async (values: any) => {
    console.log('📤 开始处理添加模板，表单值:', values);
    
    const file = values.file?.fileList?.[0]?.originFileObj;
    if (!file) {
      message.error('请选择文件');
      return;
    }

    // 检查类目是否已选择
    if (!values.category) {
      logger.warn('类目未选择，当前表单值:', values);
      message.error('请选择或输入类目');
      return;
    }
    
    logger.success('表单验证通过，准备上传');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('country', values.country);
    formData.append('category', values.category);
    formData.append('originalFileName', file.name);

    try {
      setGlobalTemplateLoading(true);
      
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/amazon-templates/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('上传请求失败:', { status: res.status, statusText: res.statusText, errorText });
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      logger.success('模板上传成功:', result);
      message.success(result.message);
      
      // 重新获取所有站点的模板列表
      await fetchAllTemplateFiles();
      
      // 关闭模态框
      setAddTemplateModalVisible(false);
      addTemplateForm.resetFields();
      
    } catch (e) {
      console.error('上传模板失败:', e);
      message.error('上传模板失败');
    } finally {
      setGlobalTemplateLoading(false);
    }
  };

  // 渲染模板管理表格内容
  const renderTemplateTable = () => {
    // 准备表格数据 - 合并所有站点的模板文件
    const tableData: any[] = [];
    const countries = [
      { code: 'US', name: '美国' },
      { code: 'CA', name: '加拿大' },
      { code: 'UK', name: '英国' },
      { code: 'AE', name: '阿联酋' },
      { code: 'AU', name: '澳大利亚' }
    ];

    countries.forEach(country => {
      const files = allTemplateFiles[country.code] || [];
      files.forEach(file => {
        tableData.push({
          key: `${country.code}-${file.id}`,
          country: country.name,
          countryCode: country.code,
          category: file.category,
          categoryCode: file.category,
          fileName: file.fileName,
          fileSize: file.size,
          uploadTime: file.lastModified,
          url: file.url,
          objectName: file.name,
          id: file.id,
          isActive: file.isActive
        });
      });
    });

    const columns = [
      {
        title: '站点',
        dataIndex: 'country',
        key: 'country',
        width: 100,
        filters: countries.map(c => ({ text: c.name, value: c.name })),
        onFilter: (value: any, record: any) => record.country === value,
      },
      {
        title: '类目',
        dataIndex: 'category',
        key: 'category',
        width: 120,
        filters: Array.from(new Set(tableData.map(item => item.category))).map(cat => ({
          text: cat,
          value: cat
        })),
        onFilter: (value: any, record: any) => record.category === value,
      },
      {
        title: '文件名',
        dataIndex: 'fileName',
        key: 'fileName',
        width: 300,
        ellipsis: true,
      },
      {
        title: '文件大小',
        dataIndex: 'fileSize',
        key: 'fileSize',
        width: 100,
        render: (size: any) => `${(size / 1024).toFixed(1)} KB`,
      },
      {
        title: '上传时间',
        dataIndex: 'uploadTime',
        key: 'uploadTime',
        width: 180,
        render: (time: any) => new Date(time).toLocaleString(),
      },
      {
        title: '状态',
        dataIndex: 'isActive',
        key: 'isActive',
        width: 80,
        align: 'center' as const,
        render: (isActive: boolean, record: any) => (
          <Tag 
            color={isActive ? 'green' : 'default'}
            style={{ 
              cursor: 'pointer',
              userSelect: 'none'
            }}
            onClick={() => handleToggleTemplateActive(record.id, !isActive)}
            title={`点击${isActive ? '禁用' : '激活'}此模板`}
          >
            {isActive ? '激活' : '禁用'}
          </Tag>
        ),
      },
      {
        title: '操作',
        key: 'action',
        width: 150,
        render: (_: any, record: any) => (
          <Space>
            <Button
              type="link"
              icon={<DownloadOutlined />}
              onClick={() => handleTemplateDownload(record.objectName, record.fileName)}
            >
              下载
            </Button>
            <Popconfirm
              title="确定要删除这个模板吗？"
              onConfirm={() => handleTemplateDelete(record.objectName)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ];

    return (
      <div>
        {/* 添加模板按钮 */}
        <div style={{ marginBottom: '16px', textAlign: 'right' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              // 重置所有相关状态
              setSelectedUploadCountry('');
              setSelectedUploadCategory('');
              addTemplateForm.resetFields();
              setAddTemplateModalVisible(true);
            }}
            size="large"
          >
            添加模板
          </Button>
        </div>

        {/* 模板表格 */}
        <Table
          columns={columns}
          dataSource={tableData}
          loading={globalTemplateLoading}
          pagination={false}
          scroll={{ x: 1000 }}
        />
      </div>
    );
  };

  // 生成英国资料表处理函数
  const handleGenerateUkDataSheet = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要生成资料表的记录');
      return;
    }

    // 显示模板选择对话框
    setUkTemplateModalVisible(true);
    loadUkTemplates();
  };

  // 加载英国模板列表
  const loadUkTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/product_weblink/uk-templates`);
      const result = await response.json();
      
      if (result.data && result.data.length > 0) {
        setUkTemplates(result.data);
        // 默认选择第一个模板
        setSelectedTemplateId(result.data[0].id);
      } else {
        message.error('未找到英国模板文件，请先上传模板');
        setUkTemplateModalVisible(false);
      }
    } catch (error) {
      console.error('加载英国模板失败:', error);
      message.error('加载英国模板失败');
      setUkTemplateModalVisible(false);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // 确认生成英国资料表
  const confirmGenerateUkDataSheet = () => {
    if (!selectedTemplateId) {
      message.warning('请选择一个模板');
      return;
    }

    setUkTemplateModalVisible(false);

    // 创建后台任务
    const taskId = addTask({
      title: `生成英国资料表 (${selectedRowKeys.length}个SKU)`,
      progress: 0,
      currentStep: '正在准备生成英国资料表...',
      status: 'running'
    });

    // 开始后台执行生成任务
    generateUkDataSheetInBackground(taskId, selectedTemplateId);
    
    // 提示用户任务已开始
    message.info('英国资料表生成任务已在后台开始，您可以继续进行其他操作');
  };

  // 后台执行生成英国资料表
  const generateUkDataSheetInBackground = async (taskId: string, templateId: number) => {
    try {
      // 步骤1: 获取选中的记录信息
      updateTask(taskId, {
        progress: 10,
        currentStep: '获取选中记录的母SKU信息...'
      });
      
      const selectedRecords = data.filter(record => 
        selectedRowKeys.some(key => Number(key) === record.id)
      );
      const parentSkus = selectedRecords.map(record => record.parent_sku);

      // 步骤2: 调用后端API生成资料表
      updateTask(taskId, {
        progress: 30,
        currentStep: '查询子SKU信息...'
      });

      const generateRes = await fetch(`${API_BASE_URL}/api/product_weblink/generate-uk-data-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentSkus, templateId }),
      });

      if (!generateRes.ok) {
        throw new Error(`生成失败: ${generateRes.status} ${generateRes.statusText}`);
      }

      // 步骤4: 处理进度更新
      updateTask(taskId, {
        progress: 60,
        currentStep: '复制模板文件并填写数据...'
      });

      // 等待一段时间模拟处理
      await new Promise(resolve => setTimeout(resolve, 1000));

      updateTask(taskId, {
        progress: 80,
        currentStep: '准备下载文件...'
      });

      // 步骤5: 下载文件
      updateTask(taskId, {
        progress: 90,
        currentStep: '正在下载生成的资料表...'
      });

      const blob = await generateRes.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // 检查后端是否设置了文件名
      const contentDisposition = generateRes.headers.get('Content-Disposition');
      
      let fileName = `UK_${parentSkus.join('_')}.xlsx`;
      
      // 如果后端没有设置文件名，则使用前端设置
      if (!contentDisposition || !contentDisposition.includes('filename')) {
        link.download = fileName;
        console.log('📁 使用前端设置的文件名:', fileName);
      } else {
        console.log('📁 使用后端设置的文件名');
        // 尝试从Content-Disposition中提取文件名
        const matches = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (matches && matches[1]) {
          fileName = matches[1].replace(/['"]/g, '');
          link.download = fileName;
        }
      }
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 完成
      updateTask(taskId, {
        progress: 100,
        currentStep: '生成完成！文件已下载到本地',
        status: 'completed',
        resultData: {
          downloadUrl: url,
          fileName: fileName
        }
      });
      
      message.success(`成功生成英国资料表，包含 ${parentSkus.length} 个母SKU 的产品信息`);
      
      // 延迟清理URL对象
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 5000);

    } catch (error: any) {
      console.error('生成英国资料表失败:', error);
      updateTask(taskId, {
        progress: 0,
        currentStep: '生成失败',
        status: 'error',
        errorMessage: error.message
      });
      message.error('生成失败: ' + error.message);
    }
  };

  // 生成其他站点资料表处理函数
  const handleGenerateOtherSiteDataSheet = () => {
    setOtherSiteModalVisible(true);
    setActiveSiteTabKey('US');
  };

  // 处理其他站点弹窗确认
  const handleOtherSiteModalOk = async () => {
    const currentFile = uploadedExcelFiles[activeSiteTabKey];
    if (!activeSiteTabKey || !currentFile) {
      message.warning('请上传Excel文件');
      return;
    }

    setOtherSiteLoading(prev => ({ ...prev, [activeSiteTabKey]: true }));
    try {
      // 先检查列差异
      await checkTemplateColumnDifferences();
    } catch (error: any) {
      console.error('检查模板列差异失败:', error);
      message.error('检查模板失败: ' + error.message);
      setOtherSiteLoading(prev => ({ ...prev, [activeSiteTabKey]: false }));
    }
  };

  // 检查模板列差异
  const checkTemplateColumnDifferences = async () => {
    const currentFile = uploadedExcelFiles[activeSiteTabKey];
    const formData = new FormData();
    formData.append('file', currentFile!);
    formData.append('country', activeSiteTabKey);

    const response = await fetch(`${API_BASE_URL}/api/product_weblink/check-other-site-template`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorResult = await response.json();
      throw new Error(errorResult.message || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.hasMissingColumns) {
      // 有缺失列，显示确认对话框
      setMissingColumnsInfo({
        missingColumns: result.missingColumns,
        uploadedColumns: result.uploadedColumns,
        templateColumns: result.templateColumns
      });
      setMissingColumnsModalVisible(true);
      setOtherSiteLoading(prev => ({ ...prev, [activeSiteTabKey]: false }));
    } else {
      // 没有缺失列，直接生成
      await generateOtherSiteDataSheet();
    }
  };

  // 实际生成其他站点资料表
  const generateOtherSiteDataSheet = async () => {
    const currentFile = uploadedExcelFiles[activeSiteTabKey];
    try {
      const formData = new FormData();
      formData.append('file', currentFile!);
      formData.append('country', activeSiteTabKey);

      // 调用后端API处理上传和生成
      const response = await fetch(`${API_BASE_URL}/api/product_weblink/generate-other-site-datasheet`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        // 尝试解析错误信息
        try {
          const errorResult = await response.json();
          
          // 特殊处理feed_product_type检查错误
          if (errorResult.hasMultipleTypes && errorResult.feedProductTypes) {
            const types = errorResult.feedProductTypes.join('、');
            message.error({
              content: `检测到多个不同的商品类型：${types}。请按商品类型分开上传，每次只上传一种类型的商品。`,
              duration: 8,
              style: { marginTop: '20vh' }
            });
            return; // 不抛出错误，直接返回
          }
          
          // 特殊处理缺少feed_product_type列的错误
          if (errorResult.missingColumn === 'feed_product_type') {
            message.error({
              content: errorResult.message,
              duration: 8,
              style: { marginTop: '20vh' }
            });
            return; // 不抛出错误，直接返回
          }
          
          // 特殊处理缺少模板的错误
          if (errorResult.missingTemplate) {
            message.error({
              content: errorResult.message,
              duration: 8,
              style: { marginTop: '20vh' }
            });
            return; // 不抛出错误，直接返回
          }
          
          throw new Error(errorResult.message || `HTTP error! status: ${response.status}`);
        } catch {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }

      // 检查响应是否是文件流
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        // 直接处理文件下载
        const blob = await response.blob();
        
                  // 从响应头获取文件名
          const contentDisposition = response.headers.get('content-disposition');
          let fileName = `${activeSiteTabKey}_DATA.xlsx`; // 默认文件名（后端应该会提供正确的文件名）
          if (contentDisposition) {
            // 尝试匹配两种格式：filename="..." 和 filename*=UTF-8''...
            const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
            const filenameUtf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
            
            if (filenameMatch) {
              fileName = filenameMatch[1];
            } else if (filenameUtf8Match) {
              fileName = decodeURIComponent(filenameUtf8Match[1]);
            }
          }
        
        // 创建下载链接
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 清理URL对象
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 5000);
        
        message.success('成功生成其他站点资料表');
        setOtherSiteModalVisible(false);
        setUploadedExcelFiles(prev => ({ ...prev, [activeSiteTabKey]: null }));
      } else {
        // 如果不是文件流，尝试解析JSON
        const result = await response.json();
        throw new Error(result.message || '生成失败');
      }
    } catch (error: any) {
      console.error('生成其他站点资料表失败:', error);
      message.error('生成失败: ' + error.message);
    } finally {
      setOtherSiteLoading(prev => ({ ...prev, [activeSiteTabKey]: false }));
    }
  };

  // 确认继续生成（即使有缺失列）
  const handleContinueGenerate = async () => {
    setMissingColumnsModalVisible(false);
    await generateOtherSiteDataSheet();
  };

  // 新增：步骤1 - 上传源数据到数据库（优化版本）
  const handleUploadSourceData = async (file?: File) => {
    const fileToUpload = file || sourceFile;
    if (!fileToUpload || !sourceCountry) {
      message.warning('请选择源站点并上传Excel文件');
      return;
    }

    try {
      setOtherSiteLoading(prev => ({ ...prev, [sourceCountry]: true }));
      setIsUploading(true);
      setUploadProgress(0);
      setUploadStatus('正在准备上传...');
      
      // 显示文件信息
      const fileSize = (fileToUpload.size / 1024 / 1024).toFixed(2);
      console.log(`📤 开始上传文件: ${fileToUpload.name}, 大小: ${fileSize}MB`);
      
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('site', sourceCountry);

      // 使用XMLHttpRequest以支持进度监控
      const xhr = new XMLHttpRequest();
      
      const uploadPromise = new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percentComplete);
            if (percentComplete < 100) {
              setUploadStatus(`正在上传文件... ${percentComplete}%`);
            } else {
              setUploadStatus('文件上传完成，正在处理数据...');
            }
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            // 检查响应类型
            const contentType = xhr.getResponseHeader('content-type');
            
            if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
              // 如果是Excel文件，说明有验证错误
              const blob = new Blob([xhr.response], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
              });
              
              // 从响应头获取文件名
              const contentDisposition = xhr.getResponseHeader('content-disposition');
              let fileName = `${sourceCountry}_错误报告_${new Date().toISOString().slice(0, 10)}.xlsx`;
              if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/);
                if (fileNameMatch) {
                  fileName = fileNameMatch[1];
                }
              }
              
              // 自动下载错误报告
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = fileName;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
              
              // 显示错误提示
              message.error(`数据验证失败！发现错误，已生成错误报告并下载到本地。请检查并修正错误后重新上传。`);
              
              resolve({
                success: false,
                hasErrors: true,
                message: '数据验证失败，已下载错误报告',
                fileName: fileName
              });
            } else {
              // 如果是JSON响应，说明上传成功
              try {
                const result = JSON.parse(xhr.responseText);
                resolve(result);
              } catch (parseError) {
                reject(new Error('响应解析失败'));
              }
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.message || `HTTP错误: ${xhr.status}`));
            } catch {
              reject(new Error(`HTTP错误: ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('网络错误'));
        });

        xhr.addEventListener('timeout', () => {
          reject(new Error('请求超时'));
        });

        xhr.open('POST', `${API_BASE_URL}/api/product_weblink/upload-source-data`);
        xhr.timeout = 300000; // 5分钟超时
        xhr.send(formData);
      });

      const result = await uploadPromise as {
        success: boolean;
        hasErrors?: boolean;
        message: string;
        recordCount?: number;
        errorCount?: number;
        fileName?: string;
        processingTime?: number;
      };
      
      if (result.success) {
        setSourceDataUploaded(true);
        setCurrentStep(1); // 进入步骤2
        
        // 显示详细的上传结果
        const successMessage = `✅ 上传完成！成功导入 ${result.recordCount} 条记录`;
        const errorMessage = result.errorCount && result.errorCount > 0 ? `，${result.errorCount} 条记录有错误` : '';
        const timeMessage = result.processingTime ? `（耗时: ${(result.processingTime / 1000).toFixed(1)}秒）` : '';
        
        message.success(successMessage + errorMessage + timeMessage);
        
      } else if (result.hasErrors) {
        // 有验证错误，已下载错误报告
        setSourceDataUploaded(false); // 重置上传状态
        setCurrentStep(0); // 保持在步骤1
        
        // 显示错误提示
        Modal.error({
          title: '数据验证失败',
          width: 600,
          content: (
            <div>
              <p>❌ 数据验证失败，发现错误记录！</p>
              <p>已生成包含错误标记的Excel文件并自动下载到本地：</p>
              <div style={{ 
                background: '#fff2f0', 
                padding: '12px', 
                borderRadius: '6px',
                border: '1px solid #ffccc7',
                margin: '12px 0'
              }}>
                <p style={{ margin: 0, fontWeight: 'bold', color: '#cf1322' }}>
                  📁 {result.fileName}
                </p>
              </div>
              <p style={{ color: '#666', fontSize: '14px' }}>
                请按照以下步骤修复错误：
              </p>
              <ol style={{ color: '#666', fontSize: '14px', paddingLeft: '20px' }}>
                <li>打开下载的错误报告Excel文件</li>
                <li>查看"验证错误"列中的具体错误信息</li>
                <li>根据错误提示修正对应的数据</li>
                <li>删除"验证错误"列后重新上传</li>
              </ol>
            </div>
          ),
          okText: '我知道了'
        });
        
      } else {
        throw new Error(result.message || '上传失败');
      }
      
    } catch (error: any) {
      console.error('上传源数据失败:', error);
      message.error('上传失败: ' + error.message);
    } finally {
      setOtherSiteLoading(prev => ({ ...prev, [sourceCountry]: false }));
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  // 新增：步骤2 - 开始生成选定的目标站点资料
  const handleStartGeneration = async () => {
    if (selectedTargetCountries.length === 0) {
      message.warning('请至少选择一个目标站点');
      return;
    }

    setGenerationInProgress(true);
    setCurrentStep(2); // 进入步骤3
    setCompletedCountries([]);
    
    const newDownloadHistory: Record<string, { blob: Blob; fileName: string; generatedAt: string }> = {};

    try {
      // 逐个生成每个目标站点的资料表
      for (const targetCountry of selectedTargetCountries) {
        try {
          setBatchProgress(prev => ({ ...prev, [targetCountry]: 'processing' }));
          
          const formData = new FormData();
          formData.append('file', sourceFile!);
          formData.append('sourceCountry', sourceCountry);
          formData.append('targetCountry', targetCountry);

          const response = await fetch(`${API_BASE_URL}/api/product_weblink/generate-other-site-datasheet`, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`生成${targetCountry}站点资料表失败: ${response.statusText}`);
          }

          const blob = await response.blob();
          
          // 从响应头获取文件名
          const contentDisposition = response.headers.get('content-disposition');
          let fileName = `${targetCountry}_DATA.xlsx`; // 默认文件名（后端应该会提供正确的文件名）
          if (contentDisposition) {
            // 尝试匹配两种格式：filename="..." 和 filename*=UTF-8''...
            const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
            const filenameUtf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
            
            if (filenameMatch) {
              fileName = filenameMatch[1];
            } else if (filenameUtf8Match) {
              fileName = decodeURIComponent(filenameUtf8Match[1]);
            }
          }
          
          newDownloadHistory[targetCountry] = {
            blob,
            fileName,
            generatedAt: new Date().toISOString()
          };

          setBatchProgress(prev => ({ ...prev, [targetCountry]: 'completed' }));
          setCompletedCountries(prev => [...prev, targetCountry]);
          
        } catch (error: any) {
          console.error(`生成${targetCountry}站点资料表失败:`, error);
          setBatchProgress(prev => ({ ...prev, [targetCountry]: 'failed' }));
          message.error(`生成${targetCountry}站点失败: ${error.message}`);
        }
      }
      
      setDownloadHistory(newDownloadHistory);
      
      // 自动下载所有成功生成的文件
      setTimeout(() => {
        Object.entries(newDownloadHistory).forEach(([country, fileData], index) => {
          setTimeout(() => {
            const url = window.URL.createObjectURL(fileData.blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileData.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => {
              window.URL.revokeObjectURL(url);
            }, 5000);
          }, index * 200); // 错开下载时间
        });
        
        if (Object.keys(newDownloadHistory).length > 0) {
          message.success(`已自动下载${Object.keys(newDownloadHistory).length}个文件`);
        }
      }, 500);
      
    } catch (error: any) {
      console.error('批量生成失败:', error);
      message.error('批量生成失败: ' + error.message);
    } finally {
      setGenerationInProgress(false);
    }
  };

  // 新增：重新下载指定站点的文件
  const handleRedownload = (country: string) => {
    const fileData = downloadHistory[country];
    if (!fileData) {
      message.warning('文件不存在');
      return;
    }

    const url = window.URL.createObjectURL(fileData.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileData.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 5000);
    
    message.success(`正在下载${country}站点资料表`);
  };

  // 新增：批量重新下载所有文件
  const handleBatchRedownload = () => {
    const availableFiles = Object.entries(downloadHistory);
    
    if (availableFiles.length === 0) {
      message.warning('没有可下载的文件');
      return;
    }

    availableFiles.forEach(([country, fileData], index) => {
      setTimeout(() => {
        const url = window.URL.createObjectURL(fileData.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileData.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 5000);
      }, index * 200);
    });
    
    message.success(`开始下载${availableFiles.length}个文件`);
  };

  // 新增：重置3步流程状态
  const resetThreeStepFlow = () => {
    setCurrentStep(0);
    setSourceCountry('');
    setSourceFile(null);
    setSourceDataUploaded(false);
    setSelectedTargetCountries([]);
    setGenerationInProgress(false);
    setCompletedCountries([]);
    setDownloadHistory({});
    setBatchProgress({
      US: 'pending',
      CA: 'pending',
      UK: 'pending',
      AE: 'pending',
      AU: 'pending'
    });
  };

  // 批量生成其他站点资料表
  const handleBatchGenerateOtherSites = async () => {
    const sourceCountry = activeSiteTabKey;
    const sourceFile = uploadedExcelFiles[sourceCountry];
    
    if (!sourceFile) {
      message.warning('请先上传源站点的Excel文件');
      return;
    }

    setBatchGenerating(true);
    setGeneratedFiles({
      US: null,
      CA: null,
      UK: null,
      AE: null,
      AU: null
    });
    
    // 获取其他站点（除了当前选择的站点）
    const allCountries = ['US', 'CA', 'UK', 'AE', 'AU'];
    const otherCountries = allCountries.filter(country => country !== sourceCountry);
    
    // 重置进度状态
    const initialProgress: Record<string, 'pending' | 'processing' | 'completed' | 'failed'> = {};
    allCountries.forEach(country => {
      initialProgress[country] = country === sourceCountry ? 'completed' : 'pending';
    });
    setBatchProgress(initialProgress);

    let successCount = 0;
    const results: Record<string, { blob: Blob; fileName: string } | null> = {
      US: null, CA: null, UK: null, AE: null, AU: null
    };

    try {
      // 串行生成每个站点的资料表
      for (const targetCountry of otherCountries) {
        try {
          // 更新进度状态
          setBatchProgress(prev => ({ ...prev, [targetCountry]: 'processing' }));
          
          const formData = new FormData();
          formData.append('file', sourceFile);
          formData.append('sourceCountry', sourceCountry);
          formData.append('targetCountry', targetCountry);

          const response = await fetch(`${API_BASE_URL}/api/product_weblink/generate-batch-other-site-datasheet`, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            // 尝试解析错误信息
            try {
              const errorResult = await response.json();
              
              // 特殊处理feed_product_type检查错误
              if (errorResult.hasMultipleTypes && errorResult.feedProductTypes) {
                const types = errorResult.feedProductTypes.join('、');
                message.error({
                  content: `检测到多个不同的商品类型：${types}。请按商品类型分开上传，每次只上传一种类型的商品。`,
                  duration: 8,
                  style: { marginTop: '20vh' }
                });
                // 停止批量生成
                setBatchGenerating(false);
                return;
              }
              
              // 特殊处理缺少feed_product_type列的错误
              if (errorResult.missingColumn === 'feed_product_type') {
                message.error({
                  content: errorResult.message,
                  duration: 8,
                  style: { marginTop: '20vh' }
                });
                // 停止批量生成
                setBatchGenerating(false);
                return;
              }
              
              // 特殊处理缺少模板的错误
              if (errorResult.missingTemplate) {
                message.error({
                  content: errorResult.message,
                  duration: 8,
                  style: { marginTop: '20vh' }
                });
                // 停止批量生成
                setBatchGenerating(false);
                return;
              }
              
              throw new Error(errorResult.message || `生成${targetCountry}站点资料表失败: ${response.statusText}`);
            } catch {
              throw new Error(`生成${targetCountry}站点资料表失败: ${response.statusText}`);
            }
          }

          const blob = await response.blob();
          
          // 从响应头获取文件名
          const contentDisposition = response.headers.get('content-disposition');
          let fileName = `${targetCountry}_DATA.xlsx`; // 默认文件名（后端应该会提供正确的文件名）
          if (contentDisposition) {
            // 尝试匹配两种格式：filename="..." 和 filename*=UTF-8''...
            const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
            const filenameUtf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
            
            if (filenameMatch) {
              fileName = filenameMatch[1];
            } else if (filenameUtf8Match) {
              fileName = decodeURIComponent(filenameUtf8Match[1]);
            }
          }
          
          results[targetCountry] = { blob, fileName };
          setBatchProgress(prev => ({ ...prev, [targetCountry]: 'completed' }));
          successCount++;
          
        } catch (error: any) {
          console.error(`生成${targetCountry}站点资料表失败:`, error);
          setBatchProgress(prev => ({ ...prev, [targetCountry]: 'failed' }));
          message.error(`生成${targetCountry}站点资料表失败: ${error.message}`);
        }
      }

      setGeneratedFiles(results);
      
      if (successCount > 0) {
        message.success(`成功生成${successCount}个站点的资料表`);
      } else {
        message.error('所有站点资料表生成失败');
      }
      
    } catch (error: any) {
      console.error('批量生成失败:', error);
      message.error('批量生成失败: ' + error.message);
    } finally {
      setBatchGenerating(false);
    }
  };

  // 下载单个生成的文件
  const downloadGeneratedFile = (country: string) => {
    const fileData = generatedFiles[country];
    if (!fileData) {
      message.warning('该文件尚未生成');
      return;
    }

    const url = window.URL.createObjectURL(fileData.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileData.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 5000);
  };

  // 批量下载所有生成的文件
  const downloadAllGeneratedFiles = () => {
    const availableFiles = Object.entries(generatedFiles).filter(([_, fileData]) => fileData !== null);
    
    if (availableFiles.length === 0) {
      message.warning('没有可下载的文件');
      return;
    }

    availableFiles.forEach(([country, fileData]) => {
      if (fileData) {
        setTimeout(() => downloadGeneratedFile(country), 100); // 稍微错开下载时间
      }
    });
    
    message.success(`开始下载${availableFiles.length}个文件`);
  };

  // 处理Excel文件上传
  const handleExcelFileChange = (file: File) => {
    setUploadedExcelFiles(prev => ({ ...prev, [activeSiteTabKey]: file }));
    return false; // 阻止自动上传
  };

  // 站点标签页切换处理
  const handleSiteTabChange = (key: string) => {
    setActiveSiteTabKey(key);
  };

  // 渲染每个站点的标签页内容
  const renderSiteTabContent = (countryCode: string, countryName: string) => {
    const currentFile = uploadedExcelFiles[countryCode];
    const isLoading = otherSiteLoading[countryCode] || false;
    const progress = batchProgress[countryCode];

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 文件上传区域 */}
        <div style={{ marginBottom: '16px', padding: '16px', background: '#f8f9fa', borderRadius: '6px' }}>
          <Text strong style={{ color: '#1677ff' }}>上传 {countryName} 站点Excel文件：</Text>
          <div style={{ marginTop: '12px' }}>
            <Upload
              accept=".xlsx,.xls"
              beforeUpload={(file) => {
                setUploadedExcelFiles(prev => ({ ...prev, [countryCode]: file }));
                return false; // 阻止自动上传
              }}
              fileList={currentFile ? [{
                uid: '1',
                name: currentFile.name,
                status: 'done' as const,
                size: currentFile.size
              }] : []}
              onRemove={() => setUploadedExcelFiles(prev => ({ ...prev, [countryCode]: null }))}
              style={{ width: '100%' }}
            >
              <Button icon={<UploadOutlined />} block size="large">
                选择Excel文件
              </Button>
            </Upload>
            <Text type="secondary" style={{ marginTop: '8px', display: 'block' }}>
              支持 .xlsx 和 .xls 格式
            </Text>
          </div>
        </div>

        {/* 文件信息显示 */}
        {currentFile && (
          <div style={{ padding: '12px', backgroundColor: '#f6f6f6', borderRadius: '6px' }}>
            <Text strong>已选择文件：</Text>
            <br />
            <Text type="secondary">
              文件名: {currentFile.name}
            </Text>
            <br />
            <Text type="secondary">
              大小: {(currentFile.size / 1024).toFixed(1)} KB
            </Text>
          </div>
        )}

        {/* 批量生成提示和按钮 */}
        {currentFile && (
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#e6f7ff', 
            borderRadius: '6px',
            border: '1px solid #91d5ff'
          }}>
            <Text strong style={{ color: '#0958d9' }}>
              一键生成其他站点资料表
            </Text>
            <br />
            <Text type="secondary" style={{ marginTop: '8px', display: 'block' }}>
              上传 {countryName} 站点的数据后，可以一键生成其他4个站点的资料表
            </Text>
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <Button
                type="primary"
                size="large"
                icon={<CloudUploadOutlined />}
                loading={batchGenerating}
                disabled={!currentFile || batchGenerating}
                onClick={handleBatchGenerateOtherSites}
                style={{ minWidth: '300px' }}
              >
                {batchGenerating ? '正在生成其他站点资料表...' : '一键生成其他4个站点资料表'}
              </Button>
            </div>
          </div>
        )}

        {/* 批量生成进度显示 */}
        {batchGenerating && (
          <div style={{ padding: '16px', backgroundColor: '#fff2e8', borderRadius: '6px' }}>
            <Text strong>生成进度：</Text>
            <div style={{ marginTop: '12px' }}>
              {['US', 'CA', 'UK', 'AE', 'AU'].map(country => {
                const countryNames = { US: '美国', CA: '加拿大', UK: '英国', AE: '阿联酋', AU: '澳大利亚' };
                const status = batchProgress[country];
                const isSource = country === countryCode;
                
                let statusIcon = <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
                let statusColor = '#d9d9d9';
                let statusText = '等待中';
                
                if (isSource) {
                  statusIcon = <CheckCircleOutlined style={{ color: '#52c41a' }} />;
                  statusColor = '#52c41a';
                  statusText = '源文件';
                } else if (status === 'processing') {
                  statusIcon = <LoadingOutlined style={{ color: '#1890ff' }} />;
                  statusColor = '#1890ff';
                  statusText = '生成中...';
                } else if (status === 'completed') {
                  statusIcon = <CheckCircleOutlined style={{ color: '#52c41a' }} />;
                  statusColor = '#52c41a';
                  statusText = '已完成';
                } else if (status === 'failed') {
                  statusIcon = <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
                  statusColor = '#ff4d4f';
                  statusText = '失败';
                }
                
                return (
                  <div key={country} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #f0f0f0'
                  }}>
                    <Space>
                      {statusIcon}
                      <Text>{countryNames[country as keyof typeof countryNames]} ({country})</Text>
                    </Space>
                    <Text style={{ color: statusColor }}>{statusText}</Text>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 下载区域 */}
        {Object.values(generatedFiles).some(file => file !== null) && (
          <div style={{ padding: '16px', backgroundColor: '#f6ffed', borderRadius: '6px' }}>
            <Text strong style={{ color: '#389e0d' }}>📥 生成完成，可以下载文件：</Text>
            <div style={{ marginTop: '12px' }}>
              {['US', 'CA', 'UK', 'AE', 'AU'].map(country => {
                const countryNames = { US: '美国', CA: '加拿大', UK: '英国', AE: '阿联酋', AU: '澳大利亚' };
                const fileData = generatedFiles[country];
                const isSource = country === countryCode;
                
                if (isSource || !fileData) return null;
                
                return (
                  <div key={country} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #f0f0f0'
                  }}>
                    <Text>{countryNames[country as keyof typeof countryNames]} ({country}) 资料表</Text>
                    <Button 
                      type="link" 
                      icon={<DownloadOutlined />}
                      onClick={() => downloadGeneratedFile(country)}
                    >
                      下载
                    </Button>
                  </div>
                );
              })}
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <Button 
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={downloadAllGeneratedFiles}
                >
                  批量下载所有文件
                </Button>
              </div>
            </div>
          </div>
        )}


      </Space>
    );
  };

  // FBASKU生成相关处理函数
  const handleGenerateFbaSku = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要生成FBASKU资料的记录');
      return;
    }
    setFbaSkuModalVisible(true);
  };

  const handleFbaSkuModalOk = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要生成FBASKU资料的记录');
      return;
    }

    setFbaSkuLoading(true);
    
    try {
      // 获取选中记录的母SKU
      const selectedRecords = data.filter(record => 
        selectedRowKeys.some(key => Number(key) === record.id)
      );
      const parentSkus = selectedRecords.map(record => record.parent_sku);


      // 调用后端API生成FBASKU资料
      const response = await fetch(`${API_BASE_URL}/api/product_weblink/generate-fbasku-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          parentSkus: parentSkus,
          country: fbaSkuCountry
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // 处理数据缺失的情况
        if (errorData.errorType === 'DATA_MISSING') {
          setFbaSkuLoading(false);
          setFbaSkuModalVisible(false);
          
          // 显示数据缺失对话框
          showDataMissingModal(errorData, parentSkus);
          return;
        }
        
        throw new Error(errorData.message || '生成失败');
      }

      // 下载生成的文件
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // 从响应头获取文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      let fileName = `FBASKU_${fbaSkuCountry}_${parentSkus.join('_')}.xlsx`;
      
      if (contentDisposition) {
        const matches = contentDisposition.match(/filename="([^"]+)"/);
        if (matches && matches[1]) {
          fileName = matches[1];
        }
      }
      
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 清理URL对象
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 5000);

      message.success(`成功生成${fbaSkuCountry}站点的FBASKU资料，包含 ${parentSkus.length} 个母SKU`);
      setFbaSkuModalVisible(false);
      setSelectedRowKeys([]);

    } catch (error: any) {
      console.error('生成FBASKU资料失败:', error);
      message.error('生成失败: ' + error.message);
    } finally {
      setFbaSkuLoading(false);
    }
  };

  const handleFbaSkuModalCancel = () => {
    setFbaSkuModalVisible(false);
    setFbaSkuCountry('US');
  };

  // 显示数据缺失对话框
  const showDataMissingModal = (errorData: any, parentSkus?: string[]) => {
    setMissingDataInfo(errorData);
    setDataMissingModalVisible(true);
    
    // 保存当前选择的父SKU，用于后续重新生成
    if (parentSkus) {
      setCurrentSelectedParentSkus(parentSkus);
    } else {
      const selectedRecords = data.filter(record => 
        selectedRowKeys.some(key => Number(key) === record.id)
      );
      setCurrentSelectedParentSkus(selectedRecords.map(record => record.parent_sku));
    }

    // 如果有Amazon SKU映射缺失，初始化表单
    if (errorData.missingAmzSkuMappings && errorData.missingAmzSkuMappings.length > 0) {
      // 国家代码到Amazon网址的映射
      const countryToSiteMap: Record<string, string> = {
        'US': 'www.amazon.com',
        'CA': 'www.amazon.ca',
        'UK': 'www.amazon.co.uk',
        'AE': 'www.amazon.ae',
        'AU': 'www.amazon.com.au'
      };

      // 国家代码到中文名称的映射
      const countryToChineseMap: Record<string, string> = {
        'US': '美国',
        'CA': '加拿大',
        'UK': '英国',
        'AE': '阿联酋',
        'AU': '澳大利亚'
      };

      const initialValues: any = {};
      errorData.missingAmzSkuMappings.forEach((item: any, index: number) => {
        // Amazon SKU预填写：根据国家映射前缀 + 子SKU
        const countryToPrefixMap: Record<string, string> = {
          'US': 'US',    // 美国 → US前缀
          'CA': 'US',    // 加拿大 → US前缀
          'UK': 'UK',    // 英国 → UK前缀
          'AE': 'UK',    // 阿联酋 → UK前缀
          'AU': 'UK'     // 澳大利亚 → UK前缀
        };
        const countryPrefix = countryToPrefixMap[fbaSkuCountry] || 'US';
        initialValues[`amz_sku_${index}`] = `${countryPrefix}${item.childSku}`;
        initialValues[`site_${index}`] = countryToSiteMap[fbaSkuCountry] || 'www.amazon.com';
        initialValues[`country_${index}`] = countryToChineseMap[fbaSkuCountry] || fbaSkuCountry;
        initialValues[`local_sku_${index}`] = item.childSku;
        initialValues[`sku_type_${index}`] = 'Local SKU';  // SKU类型默认为"Local SKU"
      });
      amzSkuMappingForm.setFieldsValue(initialValues);
    }
  };

  // 处理数据缺失对话框的确认
  const handleDataMissingModalOk = () => {
    setDataMissingModalVisible(false);
    setMissingDataInfo(null);
    amzSkuMappingForm.resetFields();
  };

  // 处理Amazon SKU映射添加
  const handleAddAmzSkuMapping = async () => {
    if (!missingDataInfo?.missingAmzSkuMappings || missingDataInfo.missingAmzSkuMappings.length === 0) {
      return;
    }

    setMappingFormLoading(true);

    try {
      const formValues = await amzSkuMappingForm.validateFields();
      
      // 构建映射数据
      const mappings = missingDataInfo.missingAmzSkuMappings.map((item: any, index: number) => ({
        amz_sku: formValues[`amz_sku_${index}`],
        site: formValues[`site_${index}`],
        country: formValues[`country_${index}`],
        local_sku: formValues[`local_sku_${index}`],
        sku_type: formValues[`sku_type_${index}`] || 'Local SKU',
        weight: formValues[`weight_${index}`],
        weight_type: formValues[`weight_type_${index}`] || 'estimated'
      }));

      console.log('添加Amazon SKU映射:', mappings);

      // 调用后端API添加映射
      const response = await fetch(`${API_BASE_URL}/api/product_weblink/batch-add-amz-sku-mapping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mappings })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '添加映射失败');
      }

      const result = await response.json();
      message.success(result.message);

      // 关闭对话框
      setDataMissingModalVisible(false);
      setMissingDataInfo(null);
      amzSkuMappingForm.resetFields();

      // 自动重新生成FBASKU资料
      message.loading('正在重新生成FBASKU资料...', 1);
      setTimeout(() => {
        regenerateFbaSkuData();
      }, 500);

    } catch (error: any) {
      console.error('添加Amazon SKU映射失败:', error);
      message.error('添加映射失败: ' + error.message);
    } finally {
      setMappingFormLoading(false);
    }
  };

  // 重新生成FBASKU资料
  const regenerateFbaSkuData = async () => {
    if (currentSelectedParentSkus.length === 0) {
      message.warning('没有选择的SKU数据');
      return;
    }

    setFbaSkuLoading(true);

    try {

      // 调用后端API生成FBASKU资料
      const response = await fetch(`${API_BASE_URL}/api/product_weblink/generate-fbasku-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          parentSkus: currentSelectedParentSkus,
          country: fbaSkuCountry
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // 如果仍有数据缺失，再次显示对话框
        if (errorData.errorType === 'DATA_MISSING') {
          showDataMissingModal(errorData, currentSelectedParentSkus);
          return;
        }
        
        throw new Error(errorData.message || '生成失败');
      }

      // 下载生成的文件
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // 从响应头获取文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      let fileName = `FBASKU_${fbaSkuCountry}_${currentSelectedParentSkus.join('_')}.xlsx`;
      
      if (contentDisposition) {
        const matches = contentDisposition.match(/filename="([^"]+)"/);
        if (matches && matches[1]) {
          fileName = matches[1];
        }
      }
      
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 清理URL对象
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 5000);

      message.success(`成功生成${fbaSkuCountry}站点的FBASKU资料，包含 ${currentSelectedParentSkus.length} 个母SKU`);
      setSelectedRowKeys([]);

    } catch (error: any) {
      console.error('重新生成FBASKU资料失败:', error);
      message.error('生成失败: ' + error.message);
    } finally {
      setFbaSkuLoading(false);
    }
  };

  // SellerInventorySku相关函数
  const handleParentSkuClick = async (parentSku: string) => {
    setCurrentParentSku(parentSku);
    setSellerSkuModalVisible(true);
    // 重置批量选择状态
    setSelectedSkuIds([]);
    setBatchQtyPerBox(undefined);
    await loadSellerSkuData(parentSku);
  };

  const loadSellerSkuData = async (parentSku: string) => {
    setSellerSkuLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/seller-inventory-sku/${encodeURIComponent(parentSku)}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const result = await res.json();
      setSellerSkuData(result.data || []);
    } catch (error) {
      console.error('加载SellerInventorySku数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setSellerSkuLoading(false);
    }
  };

  const handleSellerSkuEdit = (record: SellerInventorySkuRecord) => {
    setSellerSkuEditingKey(record.skuid);
  };

  const handleSellerSkuSave = async (skuid: string) => {
    try {
      const updateData = {
        vendor_sku: vendorSkuInputRef.current?.input?.value || '',
        sellercolorname: colorInputRef.current?.input?.value || '',
        sellersizename: sizeInputRef.current?.input?.value || '',
        qty_per_box: parseInt(qtyInputRef.current?.input?.value) || 0,
        price: parseFloat(priceInputRef.current?.input?.value) || null,
        weight: parseFloat(weightInputRef.current?.value) || null,
        weight_type: weightTypeInputRef.current?.value || 'estimated'
      };
      
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/seller-inventory-sku/${encodeURIComponent(skuid)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      message.success('保存成功');
      setSellerSkuEditingKey('');
      await loadSellerSkuData(currentParentSku);
    } catch (error) {
      console.error('保存SellerInventorySku数据失败:', error);
      message.error('保存失败');
    }
  };

  const handleSellerSkuCancel = () => {
    setSellerSkuEditingKey('');
  };

  // 批量操作处理函数
  const handleBatchSelectAll = (checked: boolean) => {
    if (checked) {
      const allSkuIds = sellerSkuData.map(item => item.skuid);
      setSelectedSkuIds(allSkuIds);
    } else {
      setSelectedSkuIds([]);
    }
  };

  const handleBatchSelectRow = (skuId: string, checked: boolean) => {
    if (checked) {
      setSelectedSkuIds(prev => [...prev, skuId]);
    } else {
      setSelectedSkuIds(prev => prev.filter(id => id !== skuId));
    }
  };

  const handleBatchSetQtyPerBox = async () => {
    if (selectedSkuIds.length === 0) {
      message.warning('请先选择要设置的子SKU');
      return;
    }
    
    if (batchQtyPerBox === undefined || batchQtyPerBox <= 0) {
      message.warning('请输入有效的单箱产品数量');
      return;
    }

    setBatchLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-update-seller-inventory-sku`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skuIds: selectedSkuIds,
          updateData: { qty_per_box: batchQtyPerBox }
        }),
      });

      const result = await res.json();

      if (res.ok && result.code === 0) {
        message.success(`批量设置成功：${result.data.affectedRows} 条记录`);
        await loadSellerSkuData(currentParentSku);
        setSelectedSkuIds([]);
        setBatchQtyPerBox(undefined);
      } else {
        message.error(result.message || '批量设置失败');
      }
    } catch (error) {
      console.error('批量设置失败:', error);
      message.error('批量设置失败');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchSetVendorSku = async () => {
    if (selectedSkuIds.length === 0) {
      message.warning('请先选择要设置的子SKU');
      return;
    }
    
    if (!batchVendorSku.trim()) {
      message.warning('请输入卖家货号');
      return;
    }

    setBatchLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-update-seller-inventory-sku`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skuIds: selectedSkuIds,
          updateData: { vendor_sku: batchVendorSku }
        }),
      });

      const result = await res.json();

      if (res.ok && result.code === 0) {
        message.success(`批量设置成功：${result.data.affectedRows} 条记录`);
        await loadSellerSkuData(currentParentSku);
        setSelectedSkuIds([]);
        setBatchVendorSku('');
      } else {
        message.error(result.message || '批量设置失败');
      }
    } catch (error) {
      console.error('批量设置失败:', error);
      message.error('批量设置失败');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchSetWeight = async () => {
    if (selectedSkuIds.length === 0) {
      message.warning('请先选择要设置的子SKU');
      return;
    }
    
    if (batchWeight === undefined || batchWeight <= 0) {
      message.warning('请输入有效的重量（千克）');
      return;
    }

    setBatchLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-update-seller-inventory-sku`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skuIds: selectedSkuIds,
          updateData: { 
            weight: batchWeight,
            weight_type: 'measured' // 批量设置重量后，重量类型自动改为"实测"
          }
        }),
      });

      const result = await res.json();

      if (res.ok && result.code === 0) {
        message.success(`批量设置重量成功：${result.data.affectedRows} 条记录，重量类型已设为实测`);
        
        // 只有在真正有记录被更新时才发送钉钉通知
        if (result.data.affectedRows > 0) {
          try {
          const notificationRes = await fetch(`${API_BASE_URL}/api/dingtalk/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `📦 子SKU重量批量更新通知

母SKU: ${currentParentSku}
更新数量: ${result.data.affectedRows} 个子SKU
统一重量: ${batchWeight}kg (已设为实测重量)
操作时间: ${new Date().toLocaleString('zh-CN')}

子SKU:
${selectedSkuIds.map(skuId => {
          const skuRecord = sellerSkuData.find(record => record.skuid === skuId);
          return `• ${skuRecord?.child_sku || skuId}`;
        }).join('\n')}

所有选中的子SKU重量已统一更新，重量类型已自动设置为"实测"。`,
              type: 'weight_batch_update'
            }),
          });
          
          if (notificationRes.ok) {
            logger.success('钉钉通知发送成功');
          }
        } catch (error) {
          logger.error('钉钉通知发送失败:', error);
          // 钉钉通知失败不影响主要功能
        }
        }
        
        await loadSellerSkuData(currentParentSku);
        setSelectedSkuIds([]);
        setBatchWeight(undefined);
      } else {
        message.error(result.message || '批量设置重量失败');
      }
    } catch (error) {
      console.error('批量设置重量失败:', error);
      message.error('批量设置重量失败');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchSetPrice = async () => {
    if (selectedSkuIds.length === 0) {
      message.warning('请先选择要设置的子SKU');
      return;
    }
    
    if (batchPrice === undefined || batchPrice <= 0) {
      message.warning('请输入有效的价格');
      return;
    }

    setBatchLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-update-seller-inventory-sku`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skuIds: selectedSkuIds,
          updateData: { price: batchPrice }
        }),
      });

      const result = await res.json();

      if (res.ok && result.code === 0) {
        message.success(`批量设置价格成功：${result.data.affectedRows} 条记录`);
        await loadSellerSkuData(currentParentSku);
        setSelectedSkuIds([]);
        setBatchPrice(undefined);
      } else {
        message.error(result.message || '批量设置价格失败');
      }
    } catch (error) {
      console.error('批量设置价格失败:', error);
      message.error('批量设置价格失败');
    } finally {
      setBatchLoading(false);
    }
  };

  // 重点款相关处理函数
  const handleKeyProductToggle = async (record: ProductRecord) => {
    const newValue = !record.is_key_product;
    
    // 乐观更新：立即更新本地状态
    const updateLocalData = () => {
      setData(prevData => 
        prevData.map(item => 
          item.id === record.id 
            ? { ...item, is_key_product: newValue }
            : item
        )
      );
      
      setOriginalData(prevData => 
        prevData.map(item => 
          item.id === record.id 
            ? { ...item, is_key_product: newValue }
            : item
        )
      );
      
      setFilteredData(prevData => 
        prevData.map(item => 
          item.id === record.id 
            ? { ...item, is_key_product: newValue }
            : item
        )
      );
    };

    // 立即更新本地状态
    updateLocalData();
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/update/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_key_product: newValue }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      message.success(newValue ? '已设为重点款' : '已取消重点款');
      
      // 刷新统计信息
      fetchAllDataStatistics();
    } catch (e) {
      console.error('更新重点款状态失败:', e);
      message.error('更新失败，已回滚更改');
      
      // 回滚本地状态
      updateLocalData();
    }
  };

  // 自定义类目相关处理函数
  const handleCustomCategoryEdit = (record: ProductRecord) => {
    setCurrentCustomCategoryRecord(record);
    setCustomCategoryValue(record.custom_category || '');
    setCustomCategoryModalVisible(true);
  };

  // 保存自定义类目
  const handleSaveCustomCategory = async () => {
    if (!currentCustomCategoryRecord) return;

    const newValue = customCategoryValue.trim();
    
    // 乐观更新：立即更新本地状态
    const updateLocalData = () => {
      setData(prevData => 
        prevData.map(item => 
          item.id === currentCustomCategoryRecord.id 
            ? { ...item, custom_category: newValue }
            : item
        )
      );
      
      setOriginalData(prevData => 
        prevData.map(item => 
          item.id === currentCustomCategoryRecord.id 
            ? { ...item, custom_category: newValue }
            : item
        )
      );
      
      setFilteredData(prevData => 
        prevData.map(item => 
          item.id === currentCustomCategoryRecord.id 
            ? { ...item, custom_category: newValue }
            : item
        )
      );
    };

    // 立即更新本地状态
    updateLocalData();
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/update/${currentCustomCategoryRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_category: newValue }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      message.success(newValue ? '自定义类目已保存' : '自定义类目已清空');
      setCustomCategoryModalVisible(false);
    } catch (e) {
      console.error('更新自定义类目失败:', e);
      message.error('更新失败，已回滚更改');
      
      // 回滚本地状态
      updateLocalData();
    }
  };

  // 广告创建相关处理函数
  const handleAdsAddToggle = (record: ProductRecord) => {
    const currentStatus = parseAdsAdd(record.ads_add);
    setCurrentAdsRecord(record);
    setAdsUsStatus(currentStatus.US);
    setAdsUkStatus(currentStatus.UK);
    setAdsSiteModalVisible(true);
  };

  // 保存广告创建状态
  const handleSaveAdsStatus = async () => {
    if (!currentAdsRecord) return;

    const newAdsStatus = { US: adsUsStatus, UK: adsUkStatus };
    const newValue = formatAdsAdd(newAdsStatus);
    
    // 乐观更新：立即更新本地状态
    const updateLocalData = () => {
      setData(prevData => 
        prevData.map(item => 
          item.id === currentAdsRecord.id 
            ? { ...item, ads_add: newValue }
            : item
        )
      );
      
      setOriginalData(prevData => 
        prevData.map(item => 
          item.id === currentAdsRecord.id 
            ? { ...item, ads_add: newValue }
            : item
        )
      );
      
      setFilteredData(prevData => 
        prevData.map(item => 
          item.id === currentAdsRecord.id 
            ? { ...item, ads_add: newValue }
            : item
        )
      );
    };

    // 立即更新本地状态
    updateLocalData();
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/update/${currentAdsRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ads_add: newValue }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      message.success('广告创建状态已更新');
      setAdsSiteModalVisible(false);
      
      // 更新广告创建状态后刷新统计数据
      fetchAllDataStatistics();
    } catch (e) {
      console.error('更新广告创建状态失败:', e);
      message.error('更新失败，已回滚更改');
      
      // 回滚本地状态
      updateLocalData();
    }
  };

  // 处理单个站点广告状态切换
  const handleAdsSiteToggle = async (record: ProductRecord, site: 'US' | 'UK') => {
    const currentStatus = parseAdsAdd(record.ads_add);
    const newStatus = currentStatus[site] === '是' ? '否' : '是';
    const newAdsStatus = { ...currentStatus, [site]: newStatus };
    const newValue = formatAdsAdd(newAdsStatus);
    
    // 乐观更新：立即更新本地状态
    const updateLocalData = () => {
      setData(prevData => 
        prevData.map(item => 
          item.id === record.id 
            ? { ...item, ads_add: newValue }
            : item
        )
      );
      
      setOriginalData(prevData => 
        prevData.map(item => 
          item.id === record.id 
            ? { ...item, ads_add: newValue }
            : item
        )
      );
      
      setFilteredData(prevData => 
        prevData.map(item => 
          item.id === record.id 
            ? { ...item, ads_add: newValue }
            : item
        )
      );
    };

    // 立即更新本地状态
    updateLocalData();
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/update/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ads_add: newValue }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const siteName = site === 'US' ? '美国' : '英国';
      message.success(`${siteName}站点广告状态已更新为${newStatus === '是' ? '已创建' : '未创建'}`);
      
      // 更新广告创建状态后刷新统计数据
      fetchAllDataStatistics();
    } catch (e) {
      console.error('更新广告创建状态失败:', e);
      message.error('更新失败，已回滚更改');
      
      // 回滚本地状态
      updateLocalData();
    }
  };

  // 点击重点款卡片显示重点款记录
  const handleKeyProductsClick = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/filter-key-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      const filteredData = result.data || [];
      
      setData(filteredData);
      setOriginalData(filteredData);
      setFilteredData(filteredData);
      
      // 更新分页状态
      setPagination(prev => ({
        ...prev,
        current: 1,
        total: filteredData.length
      }));
      
      // 更新筛选状态
      setFilters({ 
        status: '',
        cpc_status: '',
        cpc_submit: '',
        seller_name: '',
        dateRange: null
      });
      
      message.success(`筛选完成，找到 ${filteredData.length} 条重点款记录`);
    } catch (e) {
      console.error('筛选重点款失败:', e);
      message.error('筛选重点款失败');
    }
  };

  // 点击自定义类目卡片显示有自定义类目的记录
  const handleCustomCategoriesClick = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/filter-custom-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      const filteredData = result.data || [];
      
      setData(filteredData);
      setOriginalData(filteredData);
      setFilteredData(filteredData);
      
      // 更新分页状态
      setPagination(prev => ({
        ...prev,
        current: 1,
        total: filteredData.length
      }));
      
      // 更新筛选状态
      setFilters({ 
        status: '',
        cpc_status: '',
        cpc_submit: '',
        seller_name: '',
        dateRange: null
      });
      
      message.success(`筛选完成，找到 ${filteredData.length} 条有自定义类目的记录`);
    } catch (e) {
      console.error('筛选自定义类目失败:', e);
      message.error('筛选自定义类目失败');
    }
  };

  // 点击具体类目卡片显示该类目的记录
  const handleCategoryClick = async (categoryName: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/filter-custom-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      const allFilteredData = result.data || [];
      
      // 筛选出指定类目的记录
      const filteredData = allFilteredData.filter((record: ProductRecord) => 
        record.custom_category === categoryName
      );
      
      setData(filteredData);
      setOriginalData(filteredData);
      setFilteredData(filteredData);
      
      // 更新分页状态
      setPagination(prev => ({
        ...prev,
        current: 1,
        total: filteredData.length
      }));
      
      // 更新筛选状态
      setFilters({ 
        status: '',
        cpc_status: '',
        cpc_submit: '',
        seller_name: '',
        dateRange: null
      });
      
      message.success(`筛选完成，找到 ${filteredData.length} 条"${categoryName}"类目的记录`);
    } catch (e) {
      console.error('筛选类目失败:', e);
      message.error('筛选类目失败');
    }
  };

  // 类目管理相关处理函数
  const fetchCategories = async () => {
    try {
      setCategoryManagerLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/custom-categories`);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const result = await res.json();
      setCategories(result.data || []);
    } catch (e) {
      console.error('获取类目列表失败:', e);
      message.error('获取类目列表失败');
    } finally {
      setCategoryManagerLoading(false);
    }
  };

  const handleCategoryManagerOpen = () => {
    setCategoryManagerVisible(true);
    fetchCategories();
  };

  const handleBatchCategoryOpen = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要操作的记录');
      return;
    }
    setBatchCategoryModalVisible(true);
    setBatchAction('set');
    setBatchCategoryName('');
  };

  const handleBatchCategorySubmit = async () => {
    if (batchAction !== 'clear' && !batchCategoryName.trim()) {
      message.warning('请输入类目名称');
      return;
    }

    try {
      setBatchLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/batch-update-custom-category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedRowKeys,
          action: batchAction,
          categoryName: batchCategoryName.trim()
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      message.success(result.message);
      
      // 刷新数据
      handleCanOrganizeDataClick();
      fetchAllDataStatistics();
      
      // 清空选择
      setSelectedRowKeys([]);
      setBatchCategoryModalVisible(false);
    } catch (e) {
      console.error('批量更新失败:', e);
      message.error('批量更新失败');
    } finally {
      setBatchLoading(false);
    }
  };

  // 类目编辑相关处理函数
  const handleEditCategory = (category: {name: string, count: number}) => {
    setEditingCategory(category);
    setEditCategoryName(category.name);
    setEditCategoryModalVisible(true);
  };

  const handleSaveCategoryEdit = async () => {
    if (!editingCategory || !editCategoryName.trim()) {
      message.warning('请输入类目名称');
      return;
    }

    if (editCategoryName.trim() === editingCategory.name) {
      message.warning('类目名称没有变化');
      return;
    }

    try {
      setEditCategoryLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/custom-categories/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldName: editingCategory.name,
          newName: editCategoryName.trim()
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      message.success(result.message);
      
      // 刷新类目列表和数据
      fetchCategories();
      fetchAllDataStatistics();
      handleCanOrganizeDataClick();
      
      setEditCategoryModalVisible(false);
      setEditingCategory(null);
      setEditCategoryName('');
    } catch (e) {
      console.error('重命名类目失败:', e);
      message.error('重命名类目失败');
    } finally {
      setEditCategoryLoading(false);
    }
  };

  const handleDeleteCategory = (category: {name: string, count: number}) => {
    Modal.confirm({
      title: '确认删除类目',
      content: (
        <div>
          <p>确定要删除类目 <strong>"{category.name}"</strong> 吗？</p>
          <p style={{ color: '#ff4d4f', marginTop: '8px' }}>
            ⚠️ 此操作将清空 {category.count} 条记录的自定义类目，但不会删除记录本身
          </p>
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/product_weblink/custom-categories/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              categoryName: category.name
            }),
          });

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }

          const result = await res.json();
          message.success(result.message);
          
          // 刷新类目列表和数据
          fetchCategories();
          fetchAllDataStatistics();
          handleCanOrganizeDataClick();
        } catch (e) {
          console.error('删除类目失败:', e);
          message.error('删除类目失败');
        }
      }
    });
  };

  // 竞争对手链接相关处理函数
  const handleAddCompetitorLinks = (record: ProductRecord) => {
    setCurrentCompetitorRecord(record);
    setCompetitorLinksInput('');
    setCompetitorLinksModalVisible(true);
  };


  const handleBatchOpenCompetitorLinks = (record: ProductRecord) => {
    let asins: string[] = [];
    try {
      if (record.competitor_links) {
        asins = JSON.parse(record.competitor_links);
      }
    } catch {
      asins = [];
    }

    if (asins.length === 0) {
      message.warning('没有竞争对手ASIN');
      return;
    }

    asins.forEach((asin, index) => {
      setTimeout(() => {
        window.open(`https://www.amazon.com/dp/${asin}`, '_blank', 'noopener,noreferrer');
      }, index * 100);
    });

    message.success(`正在打开 ${asins.length} 个竞争对手产品页面`);
  };

  const handleSaveCompetitorLinks = async () => {
    if (!currentCompetitorRecord) return;

    // 解析ASIN输入，支持多种格式
    const asins = competitorLinksInput
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        // 如果是完整的Amazon链接，提取ASIN
        const asinMatch = line.match(/\/dp\/([A-Z0-9]{10})/i);
        if (asinMatch) {
          return asinMatch[1].toUpperCase();
        }
        // 如果看起来像ASIN格式（10位字母数字）
        if (/^[A-Z0-9]{10}$/i.test(line)) {
          return line.toUpperCase();
        }
        return null;
      })
      .filter(Boolean) as string[];

    if (asins.length === 0) {
      message.warning('请输入有效的ASIN（10位字母数字组合）');
      return;
    }

    // 获取现有的ASIN
    let existingAsins: string[] = [];
    try {
      if (currentCompetitorRecord.competitor_links) {
        existingAsins = JSON.parse(currentCompetitorRecord.competitor_links);
      }
    } catch {
      existingAsins = [];
    }

    // 合并并去重
    const combinedAsins = [...existingAsins, ...asins];
    const allAsins = combinedAsins.filter((asin, index) => combinedAsins.indexOf(asin) === index);

    try {
      const res = await fetch(`${API_BASE_URL}/api/product_weblink/update/${currentCompetitorRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor_links: JSON.stringify(allAsins) }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      message.success(`成功添加 ${asins.length} 个竞争对手ASIN，总计 ${allAsins.length} 个`);
      setCompetitorLinksModalVisible(false);
      setCompetitorLinksInput('');
      
      // 更新本地数据
      const updateLocalData = (prevData: ProductRecord[]) => 
        prevData.map(item => 
          item.id === currentCompetitorRecord.id 
            ? { ...item, competitor_links: JSON.stringify(allAsins) }
            : item
        );
      
      setData(updateLocalData);
      setOriginalData(updateLocalData);
      setFilteredData(updateLocalData);
      
    } catch (e) {
      console.error('保存竞争对手ASIN失败:', e);
      message.error('保存失败');
    }
  };

  // 删除单个竞争对手ASIN
  const handleDeleteCompetitorAsin = async (record: ProductRecord, index: number) => {
    let asins: string[] = [];
    try {
      if (record.competitor_links) {
        asins = JSON.parse(record.competitor_links);
      }
    } catch {
      asins = [];
    }

    if (index < 0 || index >= asins.length) {
      message.error('无效的索引');
      return;
    }

    const deletedAsin = asins[index];

    // 显示确认对话框
    Modal.confirm({
      title: '确认删除竞争对手ASIN',
      content: `确定要删除竞争对手ASIN "${deletedAsin}" 吗？`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const updatedAsins = asins.filter((_, i) => i !== index);

          const res = await fetch(`${API_BASE_URL}/api/product_weblink/update/${record.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ competitor_links: JSON.stringify(updatedAsins) }),
          });

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }

          message.success(`已删除竞争对手ASIN: ${deletedAsin}`);
          
          // 更新本地数据
          const updateLocalData = (prevData: ProductRecord[]) => 
            prevData.map(item => 
              item.id === record.id 
                ? { ...item, competitor_links: JSON.stringify(updatedAsins) }
                : item
            );
          
          setData(updateLocalData);
          setOriginalData(updateLocalData);
          setFilteredData(updateLocalData);
          
        } catch (e) {
          console.error('删除竞争对手ASIN失败:', e);
          message.error('删除失败');
        }
      }
    });
  };

  const { Sider, Content } = Layout;

  return (
    <div style={{ 
      background: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        {/* 左侧边栏 */}
        <Sider
          collapsible
          collapsed={sidebarCollapsed}
          onCollapse={setSidebarCollapsed}
          width={320}
          collapsedWidth={80}
          style={{
            background: '#fff',
            borderRight: '1px solid #f0f0f0',
            boxShadow: '2px 0 8px rgba(0,0,0,0.06)'
          }}
          trigger={
            <div style={{ 
              textAlign: 'center', 
              padding: '12px',
              borderTop: '1px solid #f0f0f0',
              background: '#fafafa'
            }}>
              {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </div>
          }
        >
          <div style={{
            padding: '16px 8px 8px 8px',
            borderBottom: '1px solid #f0f0f0',
            background: '#fafafa'
          }}>
            <div style={{ 
              textAlign: 'center',
              fontSize: sidebarCollapsed ? '12px' : '14px',
              fontWeight: 'bold',
              color: '#1890ff'
            }}>
              {sidebarCollapsed ? '📊' : '📊 统计面板'}
            </div>
          </div>
          
          <SidebarStatsPanel
            statistics={statistics}
            cardGroupCollapsed={cardGroupCollapsed}
            setCardGroupCollapsed={setCardGroupCollapsed}
            handleCardClick={handleCardClick}
            handleCanOrganizeDataClick={handleCanOrganizeDataClick}
            handleCpcPendingListingClick={handleCpcPendingListingClick}
            handleCpcTestedButNoAdsClick={handleCpcTestedButNoAdsClick}
            handleKeyProductsClick={handleKeyProductsClick}
            handleCustomCategoriesClick={handleCustomCategoriesClick}
            handleCategoryClick={handleCategoryClick}
            categories={categories}
            collapsed={sidebarCollapsed}
          />
        </Sider>

        {/* 主要内容区域 */}
        <Content style={{ 
          background: '#f5f5f5',
          padding: '16px',
          overflow: 'auto'
        }}>

            <div style={{ marginBottom: '16px' }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          {/* 搜索和筛选区域 - 重新设计布局 */}
          <div style={{ 
            display: 'flex', 
            gap: '16px', 
            alignItems: 'flex-start',
            background: '#fff',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            border: '1px solid #f0f0f0'
          }}>
            {/* 左侧SKU输入区域 */}
            <div style={{ 
              width: '400px',
              background: '#fafafa',
              padding: '16px',
              borderRadius: '6px',
              border: '1px solid #e8e8e8'
            }}>
              
              <TextArea
                rows={4}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  searchType === 'sku' 
                    ? `请输入SKU (每行一个,支持${isFuzzySearch ? '模糊' : '精确'}查询)`
                    : searchType === 'weblink'
                    ? "请输入产品链接/ID（每行一个，支持模糊查询）"
                    : "请输入竞争对手ASIN（每行一个，支持模糊查询）"
                }
                style={{ 
                  width: '100%',
                  fontSize: '13px',
                  resize: 'vertical'
                }}
              />
              
              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                alignItems: 'center',
                marginTop: '12px',
                flexWrap: 'nowrap'
              }}>
                <Select
                  value={searchType}
                  onChange={(value) => {
                    setSearchType(value);
                    // 切换搜索类型时清空输入和结果
                    setInput('');
                    setData([]);
                    setOriginalData([]);
                    setFilteredData([]);
                    setSelectedRowKeys([]);
                  }}
                  style={{ width: 180 }}
                  size="small"
                  dropdownMatchSelectWidth={false}
                  dropdownStyle={{ minWidth: 180 }}
                >
                  <Option value="sku">搜索SKU</Option>
                  <Option value="weblink">搜索产品链接/ID</Option>
                  <Option value="competitor_asin">搜索竞争对手ASIN</Option>
                </Select>
                
                {searchType === 'sku' && (
                  <Checkbox
                    checked={isFuzzySearch}
                    onChange={e => setIsFuzzySearch(e.target.checked)}
                    style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
                  >
                    模糊搜索
                  </Checkbox>
                )}
                
                <Button 
                  type="primary" 
                  onClick={handleSearch} 
                  loading={loading}
                  size="small"
                  icon={<SearchOutlined />}
                >
                  搜索
                </Button>
                
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={() => {
                    setInput('');
                    setData([]);
                    setOriginalData([]);
                    setFilteredData([]);
                    setSelectedRowKeys([]);
                    // 重置搜索相关状态
                    setSearchType('sku');
                    setIsFuzzySearch(true);
                    // 清空筛选条件
                    setFilters({ status: '', cpc_status: '', cpc_submit: '', seller_name: '', dateRange: null });
                    // 重新获取统计数据
                    fetchAllDataStatistics();
                  }}
                  size="small"
                >
                  清空
                </Button>
              </div>
            </div>
            
            {/* 右侧筛选条件区域 */}
            <div style={{ flex: 1 }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '16px',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#262626'
              }}>
                <FilterOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                筛选条件
              </div>
              
              {/* 第一行筛选器：产品状态、CPC测试情况、CPC提交情况、供应商 */}
              <Row gutter={[16, 12]} align="middle">
                <Col span={5}>
                  <div style={{ 
                    marginBottom: '6px', 
                    fontSize: '13px',
                    color: '#595959',
                    fontWeight: '500'
                  }}>
                    产品状态：
                  </div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="选择状态"
                    value={filters.status}
                    onChange={(value) => handleFilterChange('status', value)}
                    allowClear
                    size="small"
                  >
                    {getUniqueStatuses().map(statusItem => (
                      <Option key={statusItem.value} value={statusItem.value}>
                        {statusItem.value} ({statusItem.count})
                      </Option>
                    ))}
                  </Select>
                </Col>
                
                <Col span={5}>
                  <div style={{ 
                    marginBottom: '6px', 
                    fontSize: '13px',
                    color: '#595959',
                    fontWeight: '500'
                  }}>
                    CPC测试情况：
                  </div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="选择CPC状态"
                    value={filters.cpc_status}
                    onChange={(value) => handleFilterChange('cpc_status', value)}
                    allowClear
                    size="small"
                  >
                    {getUniqueCpcStatuses().map(statusItem => (
                      <Option key={statusItem.value} value={statusItem.value}>
                        {statusItem.value} ({statusItem.count})
                      </Option>
                    ))}
                  </Select>
                </Col>
                
                <Col span={4}>
                  <div style={{ 
                    marginBottom: '6px', 
                    fontSize: '13px',
                    color: '#595959',
                    fontWeight: '500'
                  }}>
                    CPC提交情况：
                  </div>
                  <AutoComplete
                    style={{ width: '100%' }}
                    placeholder="选择或输入..."
                    value={filters.cpc_submit}
                    onChange={(value) => {
                      console.log('🔧 CPC提交情况筛选值改变:', value);
                      handleFilterChange('cpc_submit', value);
                    }}
                    allowClear
                    size="small"
                    filterOption={(inputValue, option) =>
                      option?.value?.toLowerCase().indexOf(inputValue.toLowerCase()) !== -1
                    }
                    options={getUniqueCpcSubmits().length > 0 ? 
                      getUniqueCpcSubmits().map(submitItem => ({
                        value: submitItem.value,
                        label: `${submitItem.value} (${submitItem.count})`
                      })) : 
                      []
                    }
                    notFoundContent={allDataStats.cpcSubmitStats?.length === 0 ? "暂无CPC提交情况数据" : "暂无匹配数据"}
                  />
                </Col>
                
                <Col span={10}>
                  <div style={{ 
                    marginBottom: '6px', 
                    fontSize: '13px',
                    color: '#595959',
                    fontWeight: '500'
                  }}>
                    供应商：
                  </div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="选择供应商"
                    value={filters.seller_name}
                    onChange={(value) => handleFilterChange('seller_name', value)}
                    allowClear
                    showSearch
                    size="small"
                    filterOption={(input, option) =>
                      (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    {getUniqueSuppliers().map(supplierItem => (
                      <Option key={supplierItem.value} value={supplierItem.value}>
                        {supplierItem.value} ({supplierItem.count})
                      </Option>
                    ))}
                  </Select>
                </Col>
              </Row>
              
              {/* 第二行筛选器：创建时间和筛选结果提示 */}
              <Row gutter={[16, 12]} align="middle" style={{ marginTop: '12px' }}>
                <Col span={10}>
                  <div style={{ 
                    marginBottom: '6px', 
                    fontSize: '13px',
                    color: '#595959',
                    fontWeight: '500'
                  }}>
                    创建时间：
                  </div>
                  <RangePicker
                    style={{ width: '100%' }}
                    placeholder={['开始日期', '结束日期']}
                    value={filters.dateRange ? [dayjs(filters.dateRange[0]), dayjs(filters.dateRange[1])] : null}
                    onChange={(dates) => {
                      const dateRange = dates && dates.length === 2 ? [dates[0]!.format('YYYY-MM-DD'), dates[1]!.format('YYYY-MM-DD')] as [string, string] : null;
                      handleFilterChange('dateRange', dateRange);
                    }}
                    allowClear
                    size="small"
                  />
                </Col>
                
                {/* 筛选结果提示 */}
                {(filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange) && (
                  <Col span={14}>
                    <div style={{ 
                      textAlign: 'left', 
                      padding: '8px 12px',
                      background: '#e6f7ff',
                      borderRadius: '4px',
                      border: '1px solid #91d5ff',
                      marginTop: '20px'
                    }}>
                      <span style={{ color: '#1890ff', fontSize: '13px' }}>
                        已筛选：显示 {(filteredData.length > 0 || filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange) ? filteredData.length : data.length} 条记录
                      </span>
                    </div>
                  </Col>
                )}
              </Row>
            </div>
          </div>

          {/* 批量操作区域 */}
          <Card 
            size="small" 
            title={
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#262626'
              }}>
                <span>批量操作</span>
                {selectedRowKeys.length > 0 && (
                  <span style={{ 
                    color: '#1890ff', 
                    fontSize: '13px', 
                    fontWeight: 'normal',
                    background: '#e6f7ff',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #91d5ff'
                  }}>
                    已选择 {selectedRowKeys.length} 条记录
                  </span>
                )}
              </div>
            }
            style={{ 
              marginBottom: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              border: '1px solid #f0f0f0'
            }}
            bodyStyle={{ 
              paddingTop: '16px', 
              paddingBottom: '16px',
              background: '#fafafa'
            }}
          >
            <Row gutter={[16, 16]}>
              {/* 数据管理 */}
              <Col xs={24} sm={12} lg={8}>
                <div style={{ 
                  padding: '16px', 
                  backgroundColor: '#fff', 
                  borderRadius: '12px',
                  border: '1px solid #e8e8e8',
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    fontWeight: 'bold', 
                    marginBottom: '16px', 
                    color: '#262626',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    paddingBottom: '8px',
                    borderBottom: '2px solid #f0f0f0'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '10px',
                      fontSize: '16px'
                    }}>
                      📊
                    </div>
                    数据管理
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* 状态修改选择器 */}
                    <div>
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#666', 
                        marginBottom: '6px',
                        fontWeight: '500'
                      }}>
                        批量修改状态
                      </div>
                      <Select
                        placeholder="选择状态"
                        style={{ width: '100%' }}
                        onSelect={(value) => handleBatchUpdateStatus(value)}
                        disabled={selectedRowKeys.length === 0}
                        size="small"
                      >
                        <Option value="新品一审">
                          新品一审 ({allDataStats.statusStats.find(item => item.value === '新品一审')?.count || 0})
                        </Option>
                        <Option value="待审核">
                          待审核 ({allDataStats.statusStats.find(item => item.value === '待审核')?.count || 0})
                        </Option>
                        <Option value="审核未通过">
                          审核未通过 ({allDataStats.statusStats.find(item => item.value === '审核未通过')?.count || 0})
                        </Option>
                        <Option value="待P图">
                          待P图 ({allDataStats.statusStats.find(item => item.value === '待P图')?.count || 0})
                        </Option>
                        <Option value="待上传">
                          待上传 ({allDataStats.statusStats.find(item => item.value === '待上传')?.count || 0})
                        </Option>
                        <Option value="已经上传">
                          已经上传 ({allDataStats.statusStats.find(item => item.value === '已经上传')?.count || 0})
                        </Option>
                        <Option value="临时下架">
                          临时下架 ({allDataStats.statusStats.find(item => item.value === '临时下架')?.count || 0})
                        </Option>
                        <Option value="商品已下架">
                          商品已下架 ({allDataStats.statusStats.find(item => item.value === '商品已下架')?.count || 0})
                        </Option>
                        <Option value="手动调库存">
                          手动调库存 ({allDataStats.statusStats.find(item => item.value === '手动调库存')?.count || 0})
                        </Option>
                      </Select>
                    </div>

                    {/* 操作按钮组 */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <Button 
                        icon={<UploadOutlined />}
                        onClick={() => setUploadModalVisible(true)}
                        loading={loading}
                        size="small"
                        style={{ 
                          borderRadius: '6px',
                          fontWeight: '500'
                        }}
                      >
                        批量上传
                      </Button>

                      <Button 
                        icon={<CalculatorOutlined />}
                        onClick={() => setProfitCalculatorVisible(true)}
                        size="small"
                        type="primary"
                        style={{ 
                          backgroundColor: '#52c41a', 
                          borderColor: '#52c41a',
                          borderRadius: '6px',
                          fontWeight: '500'
                        }}
                      >
                        利润推算
                      </Button>

                      <Button 
                        icon={<PlusOutlined />}
                        onClick={() => setNewLinksModalVisible(true)}
                        size="small"
                        style={{ 
                          backgroundColor: '#1890ff', 
                          borderColor: '#1890ff',
                          color: 'white',
                          borderRadius: '6px',
                          fontWeight: '500'
                        }}
                      >
                        新链接
                      </Button>

                      <Button 
                        icon={<GlobalOutlined />}
                        onClick={() => {
                          if (selectedRowKeys.length === 0) {
                            setProductStatusAction('数量调整');
                          }
                          setProductStatusModalVisible(true);
                        }}
                        size="small"
                        style={{ 
                          backgroundColor: '#722ed1', 
                          borderColor: '#722ed1',
                          color: 'white',
                          borderRadius: '6px',
                          fontWeight: '500'
                        }}
                      >
                        上下架
                      </Button>

                      <Popconfirm
                        title="确定要删除选中的记录吗？"
                        onConfirm={handleBatchDelete}
                        okText="确定"
                        cancelText="取消"
                        disabled={selectedRowKeys.length === 0}
                      >
                        <Button 
                          danger
                          icon={<DeleteOutlined />}
                          disabled={selectedRowKeys.length === 0}
                          size="small"
                          style={{ 
                            borderRadius: '6px',
                            fontWeight: '500'
                          }}
                        >
                          批量删除
                        </Button>
                      </Popconfirm>
                    </div>
                  </div>
                </div>
              </Col>

              {/* CPC相关操作 */}
              <Col xs={24} sm={12} lg={8}>
                <div style={{ 
                  padding: '16px', 
                  backgroundColor: '#fff', 
                  borderRadius: '12px',
                  border: '1px solid #e8e8e8',
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    fontWeight: 'bold', 
                    marginBottom: '16px', 
                    color: '#d46b08',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    paddingBottom: '8px',
                    borderBottom: '2px solid #fff2e8'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '10px',
                      fontSize: '16px'
                    }}>
                      🔬
                    </div>
                    CPC检测
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#666', 
                      marginBottom: '6px',
                      fontWeight: '500'
                    }}>
                      检测流程管理
                    </div>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <Button 
                        type="primary"
                        onClick={handleBatchSendCpcTest}
                        disabled={selectedRowKeys.length === 0}
                        size="small"
                        style={{ 
                          borderRadius: '6px',
                          fontWeight: '500'
                        }}
                      >
                        发送测试申请
                      </Button>

                      <Button 
                        type="primary"
                        style={{ 
                          backgroundColor: '#fa8c16', 
                          borderColor: '#fa8c16',
                          borderRadius: '6px',
                          fontWeight: '500'
                        }}
                        onClick={handleBatchCpcTestApproved}
                        disabled={selectedRowKeys.length === 0}
                        size="small"
                      >
                        申请通过
                      </Button>

                      <Button 
                        type="primary"
                        style={{ 
                          backgroundColor: '#52c41a', 
                          borderColor: '#52c41a',
                          borderRadius: '6px',
                          fontWeight: '500'
                        }}
                        onClick={handleBatchMarkCpcSampleSent}
                        disabled={selectedRowKeys.length === 0}
                        size="small"
                      >
                        标记已发
                      </Button>

                      <Button 
                        type="primary"
                        style={{ 
                          backgroundColor: '#1890ff', 
                          borderColor: '#1890ff',
                          borderRadius: '6px',
                          fontWeight: '500'
                        }}
                        onClick={handleBatchMarkCpcTested}
                        disabled={selectedRowKeys.length === 0}
                        size="small"
                        title="批量标记选中记录的CPC测试情况为已测试"
                      >
                        标记已测试
                      </Button>

                      <Button 
                        type="primary"
                        danger
                        onClick={handleBatchCancelCpcDetection}
                        disabled={selectedRowKeys.length === 0}
                        size="small"
                        title="只能取消CPC测试情况为'CPC样品待采购'的记录"
                        style={{ 
                          borderRadius: '6px',
                          fontWeight: '500'
                        }}
                      >
                        取消检测
                      </Button>
                    </div>
                  </div>
                </div>
              </Col>

              {/* 文档生成与管理 */}
              <Col xs={24} sm={12} lg={8}>
                <div style={{ 
                  padding: '16px', 
                  backgroundColor: '#fff', 
                  borderRadius: '12px',
                  border: '1px solid #e8e8e8',
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    fontWeight: 'bold', 
                    marginBottom: '16px', 
                    color: '#1d39c4',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    paddingBottom: '8px',
                    borderBottom: '2px solid #e6f7ff'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '10px',
                      fontSize: '16px'
                    }}>
                      📄
                    </div>
                    文档管理
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#666', 
                      marginBottom: '6px',
                      fontWeight: '500'
                    }}>
                      资料表生成
                    </div>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <Button 
                        icon={<FileExcelOutlined />}
                        onClick={handleOpenTemplateModal}
                        loading={globalTemplateLoading}
                        size="small"
                        style={{ 
                          borderRadius: '6px',
                          fontWeight: '500'
                        }}
                      >
                        管理模板
                      </Button>

                      <Button 
                        type="primary"
                        icon={<FileExcelOutlined />}
                        onClick={handleGenerateUkDataSheet}
                        disabled={selectedRowKeys.length === 0}
                        style={{ 
                          backgroundColor: '#52c41a', 
                          borderColor: '#52c41a',
                          borderRadius: '6px',
                          fontWeight: '500'
                        }}
                        size="small"
                      >
                        英国资料表
                      </Button>

                      <Button 
                        type="primary"
                        icon={<FileExcelOutlined />}
                        onClick={handleGenerateOtherSiteDataSheet}
                        style={{ 
                          backgroundColor: '#722ed1', 
                          borderColor: '#722ed1',
                          borderRadius: '6px',
                          fontWeight: '500'
                        }}
                        size="small"
                      >
                        其他站点
                      </Button>

                      <Button 
                        type="primary"
                        icon={<FileExcelOutlined />}
                        onClick={handleGenerateFbaSku}
                        disabled={selectedRowKeys.length === 0}
                        style={{ 
                          backgroundColor: '#fa8c16', 
                          borderColor: '#fa8c16',
                          borderRadius: '6px',
                          fontWeight: '500'
                        }}
                        size="small"
                      >
                        添加FBASKU
                      </Button>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Space>
      </div>



      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={filteredData.length > 0 || filters.status || filters.cpc_status || filters.cpc_submit || filters.seller_name || filters.dateRange ? filteredData : data}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        scroll={{ x: 'max-content' }}
        bordered
        onChange={handleTableChange}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
          pageSizeOptions: ['20', '50', '100', '200'],
        }}
        title={() => (
          <div style={{ textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontWeight: 'bold' }}>
                  采购链接管理 
                </span>
                <span style={{ marginLeft: '16px', color: '#666', fontSize: '12px' }}>
                  提示：点击"编辑"列可编辑记录，点击列名可排序
                </span>
              </div>
              <Space>
                <Button 
                  icon={<ExperimentOutlined />}
                  onClick={handleCategoryManagerOpen}
                  type="default"
                >
                  类目管理
                </Button>
                <Button 
                  icon={<EditOutlined />}
                  onClick={handleBatchCategoryOpen}
                  disabled={selectedRowKeys.length === 0}
                  type="default"
                >
                  批量设置类目
                </Button>
                <Button 
                  icon={<FileExcelOutlined />}
                  onClick={handleBatchExport}
                  disabled={selectedRowKeys.length === 0}
                  type="default"
                >
                  导出Excel
                </Button>
                <Button 
                  icon={<LinkOutlined />}
                  onClick={handleBatchOpenLinks}
                  disabled={selectedRowKeys.length === 0}
                  type="primary"
                >
                  批量打开链接
                </Button>
              </Space>
            </div>
          </div>
        )}
      />

      {/* 编辑对话框 */}
      <Modal
        title="编辑字段"
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingCell(null);
          (editForm as any).resetFields();
        }}
        okText="保存"
        cancelText="取消"
        width={400}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            label={`编辑 ${editingCell?.field ? getFieldDisplayName(editingCell.field) : ''}`}
            name="value"
            rules={[{ required: false }]}
          >
            {editingCell?.field === 'status' ? (
              <Select placeholder="请选择状态">
                {getUniqueStatuses().map(statusItem => (
                  <Option key={statusItem.value} value={statusItem.value}>
                    {statusItem.value} ({statusItem.count})
                  </Option>
                ))}
              </Select>
            ) : editingCell?.field === 'cpc_status' ? (
              <Select placeholder="请选择CPC测试情况">
                <Option key="" value="">清空</Option>
                {getUniqueCpcStatuses().map(statusItem => (
                  <Option key={statusItem.value} value={statusItem.value}>
                    {statusItem.value} ({statusItem.count})
                  </Option>
                ))}
              </Select>
            ) : editingCell?.field === 'cpc_submit' ? (
              <AutoComplete
                placeholder="选择或输入CPC提交情况"
                allowClear
                filterOption={(inputValue, option) =>
                  option?.value?.toLowerCase().indexOf(inputValue.toLowerCase()) !== -1
                }
                options={[
                  { value: '', label: '清空' },
                  ...getUniqueCpcSubmits().map(submitItem => ({
                    value: submitItem.value,
                    label: `${submitItem.value} (${submitItem.count})`
                  }))
                ]}
                notFoundContent={getUniqueCpcSubmits().length === 0 ? "暂无CPC提交情况数据" : "暂无匹配数据"}
              />
            ) : editingCell?.field === 'notice' ? (
              <TextArea rows={3} placeholder="请输入备注" />
            ) : editingCell?.field === 'weblink' ? (
              <Input placeholder="请输入产品链接" type="url" />
            ) : (
              <Input placeholder="请输入内容" />
            )}
          </Form.Item>
        </Form>
      </Modal>

      {/* 记录编辑对话框 */}
      <Modal
        title={`编辑记录 - ${editingRecord?.parent_sku || ''}`}
        open={recordEditModalVisible}
        onOk={handleSaveRecordEdit}
        onCancel={() => {
          setRecordEditModalVisible(false);
          setEditingRecord(null);
          recordEditForm.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        width={800}
      >
        <Form form={recordEditForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="母SKU" name="parent_sku">
                <Input placeholder="请输入母SKU" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="产品状态" name="status">
                <Select placeholder="请选择状态">
                  {getUniqueStatuses().map(statusItem => (
                    <Option key={statusItem.value} value={statusItem.value}>
                      {statusItem.value}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="产品链接" name="weblink">
                <Input placeholder="请输入产品链接" type="url" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="CPC测试情况" name="cpc_status">
                <Select placeholder="请选择CPC测试情况" allowClear>
                  {getUniqueCpcStatuses().map(statusItem => (
                    <Option key={statusItem.value} value={statusItem.value}>
                      {statusItem.value}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="CPC提交情况" name="cpc_submit">
                <AutoComplete
                  placeholder="选择或输入CPC提交情况"
                  allowClear
                  options={getUniqueCpcSubmits().map(submitItem => ({
                    value: submitItem.value,
                    label: submitItem.value
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Style Number" name="model_number">
                <Input placeholder="请输入Style Number" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="推荐年龄" name="recommend_age">
                <Input placeholder="请输入推荐年龄" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="广告创建" name="ads_add">
                <Select placeholder="请选择广告创建状态" allowClear>
                  <Option value='{"US":"是","UK":"是"}'>🇺🇸是 🇬🇧是</Option>
                  <Option value='{"US":"是","UK":"否"}'>🇺🇸是 🇬🇧否</Option>
                  <Option value='{"US":"否","UK":"是"}'>🇺🇸否 🇬🇧是</Option>
                  <Option value='{"US":"否","UK":"否"}'>🇺🇸否 🇬🇧否</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="上架母SKU" name="list_parent_sku">
                <Input placeholder="请输入上架母SKU" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="缺货率" name="no_inventory_rate">
                <Input placeholder="请输入缺货率" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="30天销量" name="sales_30days">
                <Input placeholder="请输入30天销量" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="供应商" name="seller_name">
                <Input placeholder="请输入供应商名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="备注" name="notice">
                <TextArea rows={2} placeholder="请输入备注" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 批量上传新品对话框 */}
      <Modal
        title="批量上传新品"
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          setEnableDingTalkNotification(true);
        }}
        footer={null}
        width={500}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ marginBottom: '16px' }}>
            <Text strong>Excel表格要求：</Text>
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li>A列：SKU</li>
              <li>B列：产品链接</li>
              <li>C列：备注</li>
              <li>从第一行开始，无需表头</li>
            </ul>
          </div>
          
          {/* 钉钉推送开关 */}
          <div style={{ 
            marginBottom: '16px', 
            padding: '12px', 
            backgroundColor: '#f6f8fa', 
            borderRadius: '6px',
            border: '1px solid #e1e4e8'
          }}>
            <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
              <div>
                <Text strong style={{ color: '#1890ff' }}>
                  推送钉钉通知
                </Text>
                <div style={{ marginTop: '4px' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    上传新品成功后推送消息到钉钉群
                  </Text>
                </div>
              </div>
              <Switch
                checked={enableDingTalkNotification}
                onChange={setEnableDingTalkNotification}
                checkedChildren="开"
                unCheckedChildren="关"
                style={{ backgroundColor: enableDingTalkNotification ? '#52c41a' : '#d9d9d9' }}
              />
            </Space>
          </div>
          
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              style={{ display: 'none' }}
            />
            <Button 
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => fileInputRef.current?.click()}
              loading={loading}
              block
            >
              选择Excel文件上传
            </Button>
          </div>
        </Space>
      </Modal>



      {/* CPC文件管理对话框 */}
      <Modal
        title={`CPC文件管理 - ${currentRecord?.parent_sku || ''}`}
        open={cpcModalVisible}
        onCancel={() => {
          setCpcModalVisible(false);
          setCurrentRecord(null);
          setCpcFiles([]);
          setExtractedDataVisible(false);
          setPendingExtractedData(null);
        }}
        footer={null}
        width={800}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {/* 自动识别结果确认区域 */}
          {extractedDataVisible && pendingExtractedData && (
            <Card 
              style={{ 
                border: '2px solid #52c41a', 
                backgroundColor: '#f6ffed',
                marginBottom: '16px'
              }}
              title={
                <Space>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <span style={{ color: '#52c41a', fontWeight: 'bold' }}>自动识别结果</span>
                </Space>
              }
              extra={
                <Space>
                  <Button type="primary" size="small" onClick={handleConfirmExtractedData}>
                    确认应用
                  </Button>
                  <Button size="small" onClick={handleCancelExtractedData}>
                    取消
                  </Button>
                </Space>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  🔍 从CPC证书文件中识别到以下信息：
                </div>
                <div style={{ padding: '12px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #d9f7be' }}>
                  {pendingExtractedData.styleNumber && (
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold', color: '#262626' }}>Style Number: </span>
                      <span style={{ color: '#52c41a', fontWeight: 'bold', fontSize: '16px' }}>
                        {pendingExtractedData.styleNumber}
                      </span>
                    </div>
                  )}
                  {pendingExtractedData.recommendAge && (
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#262626' }}>推荐年龄: </span>
                      <span style={{ color: '#52c41a', fontWeight: 'bold', fontSize: '16px' }}>
                        {pendingExtractedData.recommendAge}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                  💡 点击"确认应用"将更新产品的Style Number和推荐年龄信息
                </div>
              </Space>
            </Card>
          )}

          <div style={{ marginBottom: '16px' }}>
            <Upload.Dragger
              beforeUpload={(file, fileList) => {
                // 只在第一个文件时处理，避免重复触发
                if (fileList.indexOf(file) === 0) {
                  if (fileList.length === 1) {
                    // 单文件上传
                    handleCpcFileUpload(file);
                  } else {
                    // 多文件批量上传
                    handleMultipleFileUpload(fileList);
                  }
                }
                return false; // 阻止默认上传行为
              }}
              multiple
              showUploadList={false}
              accept=".pdf"
              disabled={cpcUploading}
              style={{
                padding: '20px',
                backgroundColor: '#fafafa'
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <FilePdfOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                <div style={{ marginBottom: '8px' }}>
                  <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    loading={cpcUploading}
                    size="large"
                  >
                    {cpcUploading ? '上传中...' : '选择CPC文件'}
                  </Button>
                </div>
                <div style={{ color: '#666', fontSize: '14px', marginBottom: '4px' }}>
                  或将文件拖拽到此区域
                </div>
                <div style={{ color: '#999', fontSize: '12px' }}>
                  支持PDF格式，最大10MB，支持多文件批量上传
                </div>
                <div style={{ color: '#999', fontSize: '12px', marginTop: '4px' }}>
                  仅对CHILDREN'S PRODUCT CERTIFICATE文件自动提取Style Number和推荐年龄信息
                </div>
                <div style={{ color: '#52c41a', fontSize: '12px', marginTop: '8px', fontWeight: 'bold' }}>
                  💡 智能识别：系统会自动筛选CPC证书文件进行信息提取
                </div>
              </div>
            </Upload.Dragger>
          </div>

          <List
            dataSource={cpcFiles}
            renderItem={(file) => (
              <List.Item
                actions={[
                  <Button
                    type="link"
                    icon={<SearchOutlined />}
                    onClick={async () => {
                      if (currentRecord && file.uid) {
                        let retryCount = 0;
                        const maxRetries = 2; // 最多重试2次
                        
                        while (retryCount <= maxRetries) {
                          try {
                            // 尝试使用签名URL直接查看
                            const response = await fetch(`${API_BASE_URL}/api/product_weblink/cpc-files/${currentRecord.id}/${file.uid}/signed-url?expires=3600`);
                            const result = await response.json();
                            
                            if (result.code === 0 && result.data.signedUrl) {
                              // 使用签名URL直接查看，用户直接从阿里云OSS查看
                              window.open(result.data.signedUrl, '_blank');
                              return; // 成功则退出
                            } else {
                              throw new Error(result.message || '获取查看链接失败');
                            }
                          } catch (error) {
                            retryCount++;
                            console.warn(`签名URL查看失败 (尝试 ${retryCount}/${maxRetries + 1}):`, error);
                            
                            if (retryCount <= maxRetries) {
                              // 等待1秒后重试
                              await new Promise(resolve => setTimeout(resolve, 1000));
                            } else {
                              // 所有重试都失败，回退到代理查看
                              console.warn('签名URL重试失败，回退到代理查看');
                              try {
                                const proxyUrl = `${API_BASE_URL}/api/product_weblink/cpc-files/${currentRecord.id}/${file.uid}/download`;
                                window.open(proxyUrl, '_blank');
                                message.info('使用备用查看方式...');
                              } catch (proxyError) {
                                console.error('代理查看也失败:', proxyError);
                                message.error('查看文件失败，请稍后重试');
                              }
                            }
                          }
                        }
                      } else {
                        message.error('无法获取文件信息，请重试');
                      }
                    }}
                    title="在新标签页查看文件（优先使用直接访问，失败时自动重试）"
                  >
                    查看
                  </Button>,
                  <Button
                    type="link"
                    icon={<DownloadOutlined />}
                    onClick={async () => {
                      if (currentRecord && file.uid) {
                        let retryCount = 0;
                        const maxRetries = 2; // 最多重试2次
                        
                        while (retryCount <= maxRetries) {
                          try {
                            // 尝试使用签名URL直接下载
                            const response = await fetch(`${API_BASE_URL}/api/product_weblink/cpc-files/${currentRecord.id}/${file.uid}/signed-url?expires=3600`);
                            const result = await response.json();
                            
                            if (result.code === 0 && result.data.signedUrl) {
                              // 使用签名URL直接下载，用户直接从阿里云OSS下载
                              const link = document.createElement('a');
                              link.href = result.data.signedUrl;
                              link.download = result.data.fileName;
                              link.target = '_blank';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              message.success('开始下载文件...');
                              return; // 成功则退出
                            } else {
                              throw new Error(result.message || '获取下载链接失败');
                            }
                          } catch (error) {
                            retryCount++;
                            console.warn(`签名URL下载失败 (尝试 ${retryCount}/${maxRetries + 1}):`, error);
                            
                            if (retryCount <= maxRetries) {
                              // 等待1秒后重试
                              await new Promise(resolve => setTimeout(resolve, 1000));
                            } else {
                              // 所有重试都失败，回退到代理下载
                              console.warn('签名URL重试失败，回退到代理下载');
                              try {
                                const proxyUrl = `${API_BASE_URL}/api/product_weblink/cpc-files/${currentRecord.id}/${file.uid}/download?download=true`;
                                const link = document.createElement('a');
                                link.href = proxyUrl;
                                link.download = file.name;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                message.info('使用备用下载方式...');
                              } catch (proxyError) {
                                console.error('代理下载也失败:', proxyError);
                                message.error('下载失败，请稍后重试');
                              }
                            }
                          }
                        }
                      } else {
                        message.error('无法获取文件信息，请重试');
                      }
                    }}
                    title="下载文件到本地（优先使用直接下载，失败时自动重试）"
                  >
                    下载
                  </Button>,
                  <Popconfirm
                    title="确定要删除这个文件吗？"
                    description="删除后将无法恢复，同时会从云存储中删除文件"
                    onConfirm={() => handleCpcFileDelete(file.uid)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button type="link" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                ]}
              >
                <List.Item.Meta
                  avatar={<FilePdfOutlined style={{ fontSize: '24px', color: '#ff4d4f' }} />}
                  title={
                    <Space>
                      <span style={{ fontWeight: 'bold' }}>{file.name}</span>
                      {file.extractedData && (file.extractedData.styleNumber || file.extractedData.recommendAge) ? (
                        <Tag color="green" icon={<CheckCircleOutlined />}>CPC证书已解析</Tag>
                      ) : (
                        <Tag color="default">其他文件</Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      <Text type="secondary">
                        大小: {(file.size / 1024 / 1024).toFixed(2)} MB
                      </Text>
                      <Text type="secondary">
                        上传时间: {dayjs(file.uploadTime).format('YYYY-MM-DD HH:mm:ss')}
                      </Text>
                      {file.extractedData && (file.extractedData.styleNumber || file.extractedData.recommendAge) && (
                        <div style={{ marginTop: '4px', padding: '4px 8px', backgroundColor: '#f0f9f0', borderRadius: '4px', border: '1px solid #d9f7be' }}>
                          <Text type="secondary" style={{ fontSize: '12px', fontWeight: 'bold', color: '#52c41a' }}>
                            📋 已提取信息：
                          </Text>
                          {file.extractedData.styleNumber && (
                            <Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>
                              Style Number: <span style={{ fontWeight: 'bold' }}>{file.extractedData.styleNumber}</span>
                            </Text>
                          )}
                          {file.extractedData.recommendAge && (
                            <Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>
                              推荐年龄: <span style={{ fontWeight: 'bold' }}>{file.extractedData.recommendAge}</span>
                            </Text>
                          )}
                        </div>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
            locale={{ emptyText: '暂无CPC文件' }}
          />
        </Space>
       </Modal>


             {/* 亚马逊模板管理对话框 */}
       <Modal
         title="亚马逊资料模板管理"
         open={templateModalVisible}
         onCancel={() => setTemplateModalVisible(false)}
         footer={null}
         width={1400}
       >
         {renderTemplateTable()}
       </Modal>

       {/* 添加模板对话框 */}
       <Modal
         title="添加模板"
         open={addTemplateModalVisible}
         onCancel={() => {
           setAddTemplateModalVisible(false);
           setSelectedUploadCountry('');
           setSelectedUploadCategory('');
           addTemplateForm.resetFields();
         }}
         footer={null}
         width={600}
       >
         <Form
           form={addTemplateForm}
           onFinish={handleAddTemplate}
           layout="vertical"
         >
           <Form.Item
             label="选择站点"
             name="country"
             rules={[{ required: true, message: '请选择站点' }]}
           >
             <Select
               placeholder="选择站点"
               onChange={async (value) => {
                 setSelectedUploadCountry(value);
                 // 当站点变化时，获取该类目的模板列表
                 if (value) {
                   await fetchTemplateCategories(value);
                   // 清空类目选择，让用户手动选择
                   addTemplateForm.setFieldValue('category', undefined);
                   setSelectedUploadCategory('');
                 } else {
                   // 清空类目选择
                   addTemplateForm.setFieldValue('category', undefined);
                   setSelectedUploadCategory('');
                 }
               }}
             >
               <Option value="US">美国 (US)</Option>
               <Option value="CA">加拿大 (CA)</Option>
               <Option value="UK">英国 (UK)</Option>
               <Option value="AE">阿联酋 (AE)</Option>
               <Option value="AU">澳大利亚 (AU)</Option>
             </Select>
           </Form.Item>

           <Form.Item
             label="选择类目"
             name="category"
             rules={[{ required: true, message: '请选择或输入类目' }]}
           >
             <div style={{ display: 'flex', gap: '8px' }}>
               <Select
                 placeholder="选择或输入类目"
                 showSearch
                 allowClear
                 value={selectedUploadCategory}
                 style={{ flex: 1 }}
                 filterOption={(input, option) => {
                   const label = typeof option?.label === 'string' ? option.label : String(option?.label || '');
                   return label.toLowerCase().includes(input.toLowerCase());
                 }}
                 onChange={(value) => {
                   // 更新状态变量
                   setSelectedUploadCategory(value || '');
                   // 确保表单值也被更新
                   addTemplateForm.setFieldValue('category', value);
                 }}
                onOpenChange={(open) => {
                  if (open && selectedUploadCountry) {
                    fetchTemplateCategories(selectedUploadCountry);
                  }
                }}
                 onSearch={(value) => {
                   // 当用户输入时，保存输入的值
                   if (value) {
                     addTemplateForm.setFieldValue('category', value);
                     setSelectedUploadCategory(value);
                   }
                 }}
                 onInputKeyDown={(e) => {
                   // 当用户按回车键时，保存当前输入的值
                   if (e.key === 'Enter') {
                     const inputValue = (e.target as HTMLInputElement).value;
                     if (inputValue) {
                       console.log('💾 onInputKeyDown 保存类目:', inputValue);
                       addTemplateForm.setFieldValue('category', inputValue);
                       setSelectedUploadCategory(inputValue);
                       // 强制更新Select的值
                       setTimeout(() => {
                         addTemplateForm.setFieldValue('category', inputValue);
                       }, 0);
                     }
                   }
                 }}
                 onBlur={(e) => {
                   // 当失焦时，获取当前输入的值并保存
                   const inputValue = (e.target as HTMLInputElement)?.value;
                   if (inputValue) {
                     console.log('💾 onBlur 保存类目:', inputValue);
                     addTemplateForm.setFieldValue('category', inputValue);
                     setSelectedUploadCategory(inputValue);
                     // 延迟再次设置值，确保不被清空
                     setTimeout(() => {
                       addTemplateForm.setFieldValue('category', inputValue);
                     }, 100);
                   }
                 }}
                 notFoundContent={null}
                popupRender={(menu) => (
                  <div>
                    {menu}
                    <Divider style={{ margin: '8px 0' }} />
                     <div style={{ padding: '0 8px 4px' }}>
                       <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>
                         提示：可以直接输入新的类目名称
                       </div>
                     </div>
                   </div>
                 )}
               >
                 {templateCategories[selectedUploadCountry]?.map(category => (
                   <Option key={category.value} value={category.value} label={category.label}>
                     {category.label}
                   </Option>
                 ))}
               </Select>
             </div>
           </Form.Item>

           <Form.Item
             label="选择文件"
             name="file"
             rules={[{ required: true, message: '请选择文件' }]}
           >
             <Upload
               beforeUpload={() => false}
               accept=".xlsx"
               maxCount={1}
             >
               <Button icon={<UploadOutlined />}>选择Excel文件</Button>
             </Upload>
           </Form.Item>

           <Form.Item>
             <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
               <Button onClick={() => {
                 setAddTemplateModalVisible(false);
                 addTemplateForm.resetFields();
               }}>
                 取消
               </Button>
               <Button type="primary" htmlType="submit" loading={globalTemplateLoading}>
                 上传
               </Button>
             </Space>
           </Form.Item>
         </Form>
       </Modal>

      {/* 生成其他站点资料表弹窗 - 新3步流程 */}
      <Modal
        title="生成其他站点资料表"
        open={otherSiteModalVisible}
        onCancel={() => {
          setOtherSiteModalVisible(false);
          resetThreeStepFlow();
        }}
        footer={null}
        width={1200}
        destroyOnClose={true}
      >
        <div style={{ padding: '20px 0' }}>
          {/* 步骤指示器 */}
          <Steps
            current={currentStep}
            style={{ marginBottom: '32px' }}
            items={[
              {
                title: '上传源数据',
                description: '选择站点并上传Excel文件',
                icon: currentStep > 0 ? <CheckCircleOutlined /> : <UploadOutlined />
              },
              {
                title: '选择目标站点',
                description: '选择需要生成的站点',
                icon: currentStep > 1 ? <CheckCircleOutlined /> : <GlobalOutlined />
              },
              {
                title: '下载管理',
                description: '下载生成的资料表',
                icon: currentStep > 2 ? <CheckCircleOutlined /> : <DownloadOutlined />
              }
            ]}
          />

          {/* 步骤1：上传源数据 */}
          {currentStep === 0 && (
            <div style={{ minHeight: '400px' }}>
              <Card title="步骤1：选择源站点并上传资料表" style={{ marginBottom: '20px' }}>
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  {/* 站点选择 */}
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: '12px' }}>
                      选择源站点：
                    </Text>
                    <Radio.Group 
                      value={sourceCountry} 
                      onChange={(e) => setSourceCountry(e.target.value)}
                      size="large"
                    >
                      <Space direction="horizontal" wrap>
                        <Radio.Button value="US">🇺🇸 美国 (US)</Radio.Button>
                        <Radio.Button value="CA">🇨🇦 加拿大 (CA)</Radio.Button>
                        <Radio.Button value="UK">🇬🇧 英国 (UK)</Radio.Button>
                        <Radio.Button value="AE">🇦🇪 阿联酋 (AE)</Radio.Button>
                        <Radio.Button value="AU">🇦🇺 澳大利亚 (AU)</Radio.Button>
                      </Space>
                    </Radio.Group>
                  </div>

                  {/* 文件上传 */}
                  {sourceCountry && (
                    <div>
                      <Text strong style={{ display: 'block', marginBottom: '12px' }}>
                        上传{sourceCountry === 'US' ? '美国' : sourceCountry === 'CA' ? '加拿大' : sourceCountry === 'UK' ? '英国' : sourceCountry === 'AE' ? '阿联酋' : '澳大利亚'}站点的Excel资料表：
                      </Text>
                      <Upload
                        accept=".xlsx,.xls"
                        beforeUpload={(file) => {
                          setSourceFile(file);
                          // 选择文件后直接上传
                          setTimeout(() => {
                            handleUploadSourceData(file);
                          }, 100);
                          return false;
                        }}
                        fileList={sourceFile ? [{
                          uid: '1',
                          name: sourceFile.name,
                          status: otherSiteLoading[sourceCountry] ? 'uploading' : 'done',
                          size: sourceFile.size
                        }] : []}
                        onRemove={() => {
                          setSourceFile(null);
                          setSourceDataUploaded(false);
                        }}
                        style={{ width: '100%' }}
                      >
                        <Button 
                          icon={<UploadOutlined />} 
                          size="large" 
                          block
                          loading={otherSiteLoading[sourceCountry]}
                        >
                          {otherSiteLoading[sourceCountry] ? '正在上传...' : '选择Excel文件'}
                        </Button>
                      </Upload>
                      <Text type="secondary" style={{ marginTop: '8px', display: 'block' }}>
                        支持 .xlsx 和 .xls 格式，选择文件后将自动上传到数据库
                      </Text>
                    </div>
                  )}

                  {/* 文件信息 */}
                  {sourceFile && (
                    <div style={{ padding: '16px', backgroundColor: '#f6f6f6', borderRadius: '8px' }}>
                      <Text strong>
                        {otherSiteLoading[sourceCountry] ? '正在上传文件：' : sourceDataUploaded ? '已成功上传文件：' : '已选择文件：'}
                      </Text>
                      <br />
                      <Text type="secondary">文件名: {sourceFile.name}</Text>
                      <br />
                      <Text type="secondary">大小: {(sourceFile.size / 1024).toFixed(1)} KB</Text>
                      {sourceDataUploaded && (
                        <>
                          <br />
                          <Text type="success">✓ 数据已成功上传到数据库</Text>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* 上传进度显示 */}
                  {isUploading && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong style={{ color: '#1677ff' }}>{uploadStatus}</Text>
                        <Text type="secondary">{uploadProgress}%</Text>
                      </div>
                      <Progress 
                        percent={uploadProgress} 
                        status={uploadProgress === 100 ? 'success' : 'active'}
                        strokeColor={{
                          '0%': '#108ee9',
                          '100%': '#87d068',
                        }}
                        showInfo={false}
                      />
                    </div>
                  )}
                </Space>
              </Card>
            </div>
          )}

          {/* 步骤2：选择目标站点 */}
          {currentStep === 1 && (
            <div style={{ minHeight: '400px' }}>
              <Card title="步骤2：选择需要生成资料的站点" style={{ marginBottom: '20px' }}>
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: '16px' }}>
                      源数据：{sourceCountry} 站点 ({sourceFile?.name})
                    </Text>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '24px' }}>
                      请选择需要生成资料表的目标站点（可多选）：
                    </Text>
                  </div>

                  <Checkbox.Group 
                    value={selectedTargetCountries} 
                    onChange={setSelectedTargetCountries}
                    style={{ width: '100%' }}
                  >
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      {['US', 'CA', 'UK', 'AE', 'AU']
                        .filter(country => country !== sourceCountry)
                        .map(country => {
                          const countryNames = { US: '美国', CA: '加拿大', UK: '英国', AE: '阿联酋', AU: '澳大利亚' };
                          const flags = { US: '🇺🇸', CA: '🇨🇦', UK: '🇬🇧', AE: '🇦🇪', AU: '🇦🇺' };
                          return (
                            <Card 
                              key={country}
                              size="small"
                              style={{ 
                                cursor: 'pointer',
                                backgroundColor: selectedTargetCountries.includes(country) ? '#e6f7ff' : '#fafafa'
                              }}
                              onClick={() => {
                                if (selectedTargetCountries.includes(country)) {
                                  setSelectedTargetCountries(prev => prev.filter(c => c !== country));
                                } else {
                                  setSelectedTargetCountries(prev => [...prev, country]);
                                }
                              }}
                            >
                              <Checkbox value={country} style={{ pointerEvents: 'none' }}>
                                <Text strong>{flags[country as keyof typeof flags]} {countryNames[country as keyof typeof countryNames]} ({country})</Text>
                              </Checkbox>
                            </Card>
                          );
                        })}
                    </Space>
                  </Checkbox.Group>

                  {selectedTargetCountries.length > 0 && (
                    <div style={{ padding: '16px', backgroundColor: '#f6ffed', borderRadius: '8px' }}>
                      <Text strong style={{ color: '#389e0d' }}>
                        已选择 {selectedTargetCountries.length} 个站点：
                      </Text>
                      <div style={{ marginTop: '8px' }}>
                        {selectedTargetCountries.map(country => {
                          const countryNames = { US: '美国', CA: '加拿大', UK: '英国', AE: '阿联酋', AU: '澳大利亚' };
                          return (
                            <Tag key={country} color="green" style={{ margin: '4px' }}>
                              {countryNames[country as keyof typeof countryNames]} ({country})
                            </Tag>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginTop: '24px' }}>
                    <Space>
                      <Button 
                        size="large"
                        onClick={() => setCurrentStep(0)}
                      >
                        返回上一步
                      </Button>
                      <Button
                        type="primary"
                        size="large"
                        icon={<PlayCircleOutlined />}
                        disabled={selectedTargetCountries.length === 0}
                        onClick={handleStartGeneration}
                        style={{ minWidth: '200px' }}
                      >
                        开始生成资料表
                      </Button>
                    </Space>
                  </div>
                </Space>
              </Card>
            </div>
          )}

          {/* 步骤3：下载管理 */}
          {currentStep === 2 && (
            <div style={{ minHeight: '400px' }}>
              <Card title="步骤3：生成进度与下载管理" style={{ marginBottom: '20px' }}>
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  {/* 生成进度 */}
                  {generationInProgress && (
                    <div style={{ padding: '16px', backgroundColor: '#fff2e8', borderRadius: '8px' }}>
                      <Text strong style={{ display: 'block', marginBottom: '16px' }}>
                        🔄 正在生成站点资料表...
                      </Text>
                      {selectedTargetCountries.map(country => {
                        const countryNames = { US: '美国', CA: '加拿大', UK: '英国', AE: '阿联酋', AU: '澳大利亚' };
                        const status = batchProgress[country];
                        
                        let statusIcon = <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
                        let statusColor = '#d9d9d9';
                        let statusText = '等待中';
                        
                        if (status === 'processing') {
                          statusIcon = <LoadingOutlined style={{ color: '#1890ff' }} />;
                          statusColor = '#1890ff';
                          statusText = '生成中...';
                        } else if (status === 'completed') {
                          statusIcon = <CheckCircleOutlined style={{ color: '#52c41a' }} />;
                          statusColor = '#52c41a';
                          statusText = '已完成';
                        } else if (status === 'failed') {
                          statusIcon = <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
                          statusColor = '#ff4d4f';
                          statusText = '生成失败';
                        }
                        
                        return (
                          <div key={country} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '12px 0',
                            borderBottom: '1px solid #f0f0f0'
                          }}>
                            <Space>
                              {statusIcon}
                              <Text>{countryNames[country as keyof typeof countryNames]} ({country})</Text>
                            </Space>
                            <Text style={{ color: statusColor }}>{statusText}</Text>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 下载历史 */}
                  {Object.keys(downloadHistory).length > 0 && (
                    <div style={{ padding: '16px', backgroundColor: '#f6ffed', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <Text strong style={{ color: '#389e0d' }}>
                          📥 已生成的资料表文件：
                        </Text>
                        <Button 
                          type="primary"
                          icon={<DownloadOutlined />}
                          onClick={handleBatchRedownload}
                        >
                          批量下载所有文件
                        </Button>
                      </div>
                      
                      {Object.entries(downloadHistory).map(([country, fileData]) => {
                        const countryNames = { US: '美国', CA: '加拿大', UK: '英国', AE: '阿联酋', AU: '澳大利亚' };
                        const generatedTime = new Date(fileData.generatedAt).toLocaleString('zh-CN');
                        
                        return (
                          <div key={country} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '12px 16px',
                            backgroundColor: '#fff',
                            borderRadius: '6px',
                            marginBottom: '8px',
                            border: '1px solid #d9d9d9'
                          }}>
                            <div>
                              <Text strong>{countryNames[country as keyof typeof countryNames]} ({country}) 资料表</Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                生成时间: {generatedTime} | 文件名: {fileData.fileName}
                              </Text>
                            </div>
                            <Button 
                              type="link" 
                              icon={<DownloadOutlined />}
                              onClick={() => handleRedownload(country)}
                            >
                              下载
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div style={{ textAlign: 'center', marginTop: '24px' }}>
                    <Space>
                      {!generationInProgress && (
                        <Button 
                          size="large"
                          onClick={() => setCurrentStep(1)}
                        >
                          返回上一步
                        </Button>
                      )}
                      <Button
                        size="large"
                        onClick={() => {
                          resetThreeStepFlow();
                        }}
                      >
                        开始新的生成流程
                      </Button>
                      <Button
                        type="primary"
                        size="large"
                        onClick={() => setOtherSiteModalVisible(false)}
                      >
                        完成
                      </Button>
                    </Space>
                  </div>
                </Space>
              </Card>
            </div>
          )}
        </div>
      </Modal>

      {/* 缺失列提示弹窗 */}
      <Modal
        title="列差异提示"
        open={missingColumnsModalVisible}
        onOk={handleContinueGenerate}
        onCancel={() => {
          setMissingColumnsModalVisible(false);
          setMissingColumnsInfo(null);
          setOtherSiteLoading(prev => ({ ...prev, [activeSiteTabKey]: false }));
        }}
        okText="确认继续"
        cancelText="取消"
        width={600}
      >
        {missingColumnsInfo && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Typography.Text strong style={{ color: '#faad14' }}>
                ⚠️ 检测到以下列在{activeSiteTabKey}模板中不存在：
              </Typography.Text>
              <div style={{ marginTop: 8, padding: 12, backgroundColor: '#fff7e6', borderRadius: 6 }}>
                {missingColumnsInfo.missingColumns.map((col: string, index: number) => (
                  <Tag key={index} color="orange" style={{ margin: '2px 4px' }}>
                    {col}
                  </Tag>
                ))}
              </div>
            </div>
            
            <div>
              <Typography.Text>
                这些列的数据将不会被填入{activeSiteTabKey}模板中。
              </Typography.Text>
            </div>
            
            <div>
              <Typography.Text strong>
                是否确认继续生成资料表？
              </Typography.Text>
            </div>
          </Space>
        )}
      </Modal>

      {/* 批量上传结果详情对话框 */}
      <Modal
        title="批量上传结果"
        open={uploadResultVisible}
        onOk={() => setUploadResultVisible(false)}
        onCancel={() => setUploadResultVisible(false)}
        okText="确定"
        cancelButtonProps={{ style: { display: 'none' } }}
        width={800}
      >
        {uploadResult && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* 总体统计 */}
            <div>
              <Row gutter={16}>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="总处理行数"
                      value={uploadResult.totalRows}
                      valueStyle={{ color: '#1890ff' }}
                      prefix={<FileExcelOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="成功上传"
                      value={uploadResult.successCount || 0}
                      valueStyle={{ color: '#52c41a' }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="成功更新"
                      value={uploadResult.updatedCount || 0}
                      valueStyle={{ color: '#1890ff' }}
                      prefix={<EditOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="跳过记录"
                      value={uploadResult.skippedCount}
                      valueStyle={{ color: '#faad14' }}
                      prefix={<ClockCircleOutlined />}
                    />
                  </Card>
                </Col>
              </Row>
            </div>

            {/* 结果说明 */}
            <div>
              {(uploadResult.successCount || 0) > 0 && (
                <Typography.Text type="success">
                  ✅ 成功上传 {uploadResult.successCount} 条新记录
                </Typography.Text>
              )}
              {(uploadResult.updatedCount || 0) > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Typography.Text style={{ color: '#1890ff' }}>
                    🔄 成功更新 {uploadResult.updatedCount} 条"新品一审"记录为"待审核"
                  </Typography.Text>
                </div>
              )}
              {uploadResult.skippedCount > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Typography.Text type="warning">
                    ⚠️ 跳过 {uploadResult.skippedCount} 条记录
                  </Typography.Text>
                </div>
              )}
            </div>

            {/* 更新记录详情 */}
            {uploadResult.updatedRecords && uploadResult.updatedRecords.length > 0 && (
              <div>
                <Typography.Text strong>更新记录详情：</Typography.Text>
                <Table
                  size="small"
                  dataSource={uploadResult.updatedRecords}
                  columns={[
                    {
                      title: '行号',
                      dataIndex: 'row',
                      key: 'row',
                      width: 80,
                    },
                    {
                      title: 'SKU',
                      dataIndex: 'sku',
                      key: 'sku',
                      width: 150,
                    },
                    {
                      title: '链接',
                      dataIndex: 'link',
                      key: 'link',
                      ellipsis: true,
                      render: (text: string) => (
                        <Tooltip title={text}>
                          {text ? (
                            <a href={text} target="_blank" rel="noopener noreferrer">
                              {text.length > 30 ? `${text.substring(0, 30)}...` : text}
                            </a>
                          ) : '-'}
                        </Tooltip>
                      ),
                    },
                    {
                      title: '状态变更',
                      key: 'statusChange',
                      render: (record: any) => (
                        <span>
                          <Tag color="orange">{record.oldStatus}</Tag>
                          →
                          <Tag color="blue">{record.newStatus}</Tag>
                        </span>
                      ),
                    },
                  ]}
                  pagination={false}
                  scroll={{ y: 300 }}
                  style={{ marginTop: 8 }}
                />
              </div>
            )}

            {/* 跳过记录详情 */}
            {uploadResult.skippedRecords && uploadResult.skippedRecords.length > 0 && (
              <div>
                <Typography.Text strong>跳过记录详情：</Typography.Text>
                <Table
                  size="small"
                  dataSource={uploadResult.skippedRecords}
                  columns={[
                    {
                      title: '行号',
                      dataIndex: 'row',
                      key: 'row',
                      width: 80,
                    },
                    {
                      title: 'SKU',
                      dataIndex: 'sku',
                      key: 'sku',
                      width: 150,
                    },
                    {
                      title: '链接',
                      dataIndex: 'link',
                      key: 'link',
                      ellipsis: true,
                      render: (text: string) => (
                        <Tooltip title={text}>
                          {text ? (
                            <a href={text} target="_blank" rel="noopener noreferrer">
                              {text.length > 30 ? `${text.substring(0, 30)}...` : text}
                            </a>
                          ) : '-'}
                        </Tooltip>
                      ),
                    },
                    {
                      title: '跳过原因',
                      dataIndex: 'reason',
                      key: 'reason',
                      render: (text: string) => (
                        <Tag color="orange">{text}</Tag>
                      ),
                    },
                  ]}
                  pagination={false}
                  scroll={{ y: 300 }}
                  style={{ marginTop: 8 }}
                />
              </div>
            )}
          </Space>
        )}
      </Modal>

      {/* FBASKU生成弹窗 */}
      <Modal
        title="生成FBASKU资料"
        open={fbaSkuModalVisible}
        onOk={handleFbaSkuModalOk}
        onCancel={handleFbaSkuModalCancel}
        confirmLoading={fbaSkuLoading}
        okText="生成资料"
        cancelText="取消"
        width={500}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text>已选择 <Text strong>{selectedRowKeys.length}</Text> 条记录生成FBASKU资料</Text>
          </div>
          
          <div>
            <Text>选择目标国家：</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={fbaSkuCountry}
              onChange={setFbaSkuCountry}
              placeholder="请选择国家"
            >
              <Option value="US">美国 (US)</Option>
              <Option value="CA">加拿大 (CA)</Option>
              <Option value="UK">英国 (UK)</Option>
              <Option value="AE">阿联酋 (AE)</Option>
              <Option value="AU">澳大利亚 (AU)</Option>
            </Select>
          </div>

          <div style={{ 
            padding: '12px', 
            backgroundColor: '#f6f6f6', 
            borderRadius: '6px',
            fontSize: '12px',
            lineHeight: '1.5'
          }}>
            <Text type="secondary">
              <strong>说明：</strong><br />
              • 将根据选定的母SKU批量生成对应的FBASKU资料<br />
              • 自动查询子SKU、Amazon SKU映射关系和价格信息<br />
              • 填写美国站点所需的各项字段信息<br />
              • 生成的Excel文件可直接用于Amazon后台上传
            </Text>
          </div>
        </Space>
      </Modal>

      {/* 数据缺失提示对话框 */}
      <Modal
        title="数据缺失处理"
        open={dataMissingModalVisible}
        onOk={missingDataInfo?.missingAmzSkuMappings?.length > 0 ? handleAddAmzSkuMapping : handleDataMissingModalOk}
        onCancel={handleDataMissingModalOk}
        confirmLoading={mappingFormLoading}
        okText={missingDataInfo?.missingAmzSkuMappings?.length > 0 ? "添加映射并生成资料" : "确定"}
        cancelText="取消"
        width={800}
        style={{ top: 20 }}
      >
        {missingDataInfo && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* Amazon SKU映射缺失 - 添加表单输入功能 */}
            {missingDataInfo.missingAmzSkuMappings && missingDataInfo.missingAmzSkuMappings.length > 0 && (
              <div>
                <div style={{ 
                  padding: '16px', 
                  backgroundColor: '#fff2e8', 
                  borderRadius: '8px',
                  marginBottom: '16px',
                  border: '2px solid #ffad33'
                }}>
                  <Text strong style={{ color: '#d46b08', fontSize: '18px' }}>
                    ⚠️ pbi_amzsku_sku数据库中缺少记录，请填写添加！
                  </Text>
                </div>
                
                <Form
                  form={amzSkuMappingForm}
                  layout="vertical"
                  style={{ marginBottom: '20px' }}
                >
                  <div style={{ marginBottom: '16px' }}>
                    <Text strong style={{ fontSize: '14px' }}>请为以下子SKU填写Amazon SKU映射信息：</Text>
                  </div>
                  
                  {/* 表格形式显示数据 */}
                  <div style={{ 
                    maxHeight: '500px', 
                    overflowY: 'auto', 
                    border: '1px solid #d9d9d9', 
                    borderRadius: '8px',
                    backgroundColor: '#fff'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      {/* 表头 */}
                      <thead>
                        <tr style={{ backgroundColor: '#fafafa' }}>
                          <th style={{
                            padding: '12px 16px',
                            borderBottom: '2px solid #e8e8e8',
                            borderRight: '1px solid #e8e8e8',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            color: '#262626'
                          }}>母SKU</th>
                          <th style={{
                            padding: '12px 16px',
                            borderBottom: '2px solid #e8e8e8',
                            borderRight: '1px solid #e8e8e8',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            color: '#262626'
                          }}>本地SKU</th>
                          <th style={{
                            padding: '12px 16px',
                            borderBottom: '2px solid #e8e8e8',
                            borderRight: '1px solid #e8e8e8',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            color: '#262626'
                          }}>站点</th>
                          <th style={{
                            padding: '12px 16px',
                            borderBottom: '2px solid #e8e8e8',
                            borderRight: '1px solid #e8e8e8',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            color: '#262626'
                          }}>国家</th>
                          <th style={{
                            padding: '12px 16px',
                            borderBottom: '2px solid #e8e8e8',
                            borderRight: '1px solid #e8e8e8',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            color: '#262626'
                          }}>SKU类型</th>
                          <th style={{
                            padding: '12px 16px',
                            borderBottom: '2px solid #e8e8e8',
                            borderRight: '1px solid #e8e8e8',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            color: '#262626'
                          }}>重量(kg)</th>
                          <th style={{
                            padding: '12px 16px',
                            borderBottom: '2px solid #e8e8e8',
                            borderRight: '1px solid #e8e8e8',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            color: '#262626'
                          }}>重量类型</th>
                          <th style={{
                            padding: '12px 16px',
                            borderBottom: '2px solid #e8e8e8',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            color: '#1890ff'
                          }}>Amazon SKU</th>
                        </tr>
                      </thead>
                      
                      {/* 数据行 */}
                      <tbody>
                        {missingDataInfo.missingAmzSkuMappings.map((item: any, index: number) => {
                          // 预设数据映射
                          const countryToSiteMap: Record<string, string> = {
                            'US': 'www.amazon.com',
                            'CA': 'www.amazon.ca',
                            'UK': 'www.amazon.co.uk',
                            'AE': 'www.amazon.ae',
                            'AU': 'www.amazon.com.au'
                          };
                          const countryToChineseMap: Record<string, string> = {
                            'US': '美国',
                            'CA': '加拿大',
                            'UK': '英国',
                            'AE': '阿联酋',
                            'AU': '澳大利亚'
                          };
                          const countryToPrefixMap: Record<string, string> = {
                            'US': 'US', 'CA': 'US', 'UK': 'UK', 'AE': 'UK', 'AU': 'UK'
                          };
                          
                          const site = countryToSiteMap[fbaSkuCountry] || 'www.amazon.com';
                          const country = countryToChineseMap[fbaSkuCountry] || fbaSkuCountry;
                          const prefix = countryToPrefixMap[fbaSkuCountry] || 'US';
                          
                          return (
                            <tr key={index} style={{ 
                              backgroundColor: index % 2 === 0 ? '#fafafa' : '#fff',
                              borderBottom: '1px solid #f0f0f0'
                            }}>
                              {/* 母SKU */}
                              <td style={{
                                padding: '12px 16px',
                                borderRight: '1px solid #f0f0f0',
                                fontSize: '14px',
                                color: '#262626',
                                fontWeight: '500',
                                textAlign: 'center'
                              }}>
                                {item.parentSku}
                              </td>
                              
                              {/* 本地SKU */}
                              <td style={{
                                padding: '12px 16px',
                                borderRight: '1px solid #f0f0f0',
                                fontSize: '14px',
                                color: '#595959',
                                textAlign: 'center'
                              }}>
                                {item.childSku}
                                <Form.Item name={`local_sku_${index}`} style={{ display: 'none' }}>
                                  <Input />
                                </Form.Item>
                              </td>
                              
                              {/* 站点 */}
                              <td style={{
                                padding: '12px 16px',
                                borderRight: '1px solid #f0f0f0',
                                fontSize: '14px',
                                color: '#595959',
                                textAlign: 'center'
                              }}>
                                {site}
                                <Form.Item name={`site_${index}`} style={{ display: 'none' }}>
                                  <Input />
                                </Form.Item>
                              </td>
                              
                              {/* 国家 */}
                              <td style={{
                                padding: '12px 16px',
                                borderRight: '1px solid #f0f0f0',
                                fontSize: '14px',
                                color: '#595959',
                                textAlign: 'center'
                              }}>
                                {country}
                                <Form.Item name={`country_${index}`} style={{ display: 'none' }}>
                                  <Input />
                                </Form.Item>
                              </td>
                              
                              {/* SKU类型 */}
                              <td style={{
                                padding: '12px 16px',
                                borderRight: '1px solid #f0f0f0',
                                fontSize: '14px',
                                color: '#595959',
                                textAlign: 'center'
                              }}>
                                Local SKU
                                <Form.Item name={`sku_type_${index}`} style={{ display: 'none' }}>
                                  <Input />
                                </Form.Item>
                              </td>
                              
                              {/* 重量 - 可编辑 */}
                              <td style={{
                                padding: '8px 16px',
                                borderRight: '1px solid #f0f0f0',
                                fontSize: '14px',
                                textAlign: 'center'
                              }}>
                                <Form.Item
                                  name={`weight_${index}`}
                                  style={{ margin: 0 }}
                                >
                                  <InputNumber 
                                    placeholder="重量"
                                    min={0}
                                    max={50}
                                    precision={3}
                                    style={{ 
                                      width: '100%',
                                      fontSize: '14px'
                                    }}
                                  />
                                </Form.Item>
                              </td>
                              
                              {/* 重量类型 - 可选择 */}
                              <td style={{
                                padding: '8px 16px',
                                borderRight: '1px solid #f0f0f0',
                                fontSize: '14px',
                                textAlign: 'center'
                              }}>
                                <Form.Item
                                  name={`weight_type_${index}`}
                                  style={{ margin: 0 }}
                                  initialValue="estimated"
                                >
                                  <Select 
                                    style={{ 
                                      width: '100%',
                                      fontSize: '14px'
                                    }}
                                    placeholder="选择类型"
                                  >
                                    <Option value="estimated">预估</Option>
                                    <Option value="measured">实测</Option>
                                  </Select>
                                </Form.Item>
                              </td>
                              
                              {/* Amazon SKU - 可编辑 */}
                              <td style={{
                                padding: '8px 16px',
                                fontSize: '14px',
                                textAlign: 'center'
                              }}>
                                <Form.Item
                                  name={`amz_sku_${index}`}
                                  style={{ margin: 0 }}
                                  rules={[{ required: true, message: '请输入Amazon SKU' }]}
                                >
                                  <Input 
                                    placeholder={`${prefix}${item.childSku}`}
                                    style={{ 
                                      fontSize: '14px', 
                                      borderColor: '#1890ff',
                                      borderWidth: '2px'
                                    }}
                                  />
                                </Form.Item>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* 操作提示 */}
                  <div style={{ 
                    marginTop: '12px',
                    padding: '8px 12px', 
                    backgroundColor: '#e6f7ff', 
                    borderRadius: '4px',
                    fontSize: '12px',
                    textAlign: 'center'
                  }}>
                    <Text type="secondary">
                      💡 Amazon SKU已预填写建议格式，可根据需要修改 | SKU类型将自动设置为 "Local SKU" | 重量可填写产品重量（千克），重量类型默认为预估
                    </Text>
                  </div>
                </Form>
              </div>
            )}

            {/* 只有当没有Amazon SKU映射缺失时，才显示Listings数据缺失 */}
            {(!missingDataInfo.missingAmzSkuMappings || missingDataInfo.missingAmzSkuMappings.length === 0) && 
             missingDataInfo.missingListingsData && missingDataInfo.missingListingsData.length > 0 && (
              <div>
                <div style={{ 
                  padding: '16px', 
                  backgroundColor: '#f6ffed', 
                  borderRadius: '8px',
                  marginBottom: '16px',
                  border: '2px solid #52c41a'
                }}>
                  <Text strong style={{ color: '#389e0d', fontSize: '18px' }}>
                    ⚠️ listings_sku数据库中没有记录，需要添加！
                  </Text>
                </div>
                
                <div>
                  <Text strong style={{ fontSize: '14px' }}>缺少ASIN和价格信息的Amazon SKU：</Text>
                  <div style={{ 
                    maxHeight: '250px', 
                    overflowY: 'auto', 
                    border: '1px solid #d9d9d9', 
                    borderRadius: '6px',
                    padding: '12px',
                    marginTop: '8px',
                    backgroundColor: '#f9fff9'
                  }}>
                    {missingDataInfo.missingListingsData.map((item: any, index: number) => (
                      <div key={index} style={{ 
                        padding: '8px 12px',
                        backgroundColor: '#fff',
                        borderRadius: '4px',
                        marginBottom: '6px',
                        border: '1px solid #f0f0f0'
                      }}>
                        <div>
                          <Text>
                            <Text strong style={{ color: '#fa8c16' }}>子SKU:</Text> {item.childSku} 
                            <span style={{ margin: '0 8px', color: '#999' }}>→</span> 
                            <Text strong style={{ color: '#1890ff' }}>Amazon SKU:</Text> {item.amzSku}
                          </Text>
                        </div>
                        <div style={{ marginLeft: '16px', fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          <Text type="secondary">
                            缺少: {!item.hasAsin && 'ASIN'} {!item.hasAsin && !item.hasPrice && '、'} {!item.hasPrice && '价格'}
                          </Text>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ 
              padding: '16px', 
              backgroundColor: '#e6f7ff', 
              borderRadius: '8px',
              fontSize: '13px',
              border: '1px solid #91d5ff'
            }}>
              <Text type="secondary">
                <strong>📋 处理说明：</strong><br />
                {missingDataInfo.missingAmzSkuMappings && missingDataInfo.missingAmzSkuMappings.length > 0 ? (
                  <>• 请填写上述子SKU对应的Amazon SKU映射信息<br />
                  • 点击"添加映射并生成资料"按钮将自动保存映射并生成FBASKU资料表</>
                ) : (
                  <>• 请先在 listings_sku 数据库中添加上述Amazon SKU的ASIN和价格信息<br />
                  • 添加完成后，重新点击"添加FBASKU"按钮即可正常生成资料表</>
                )}
              </Text>
            </div>
          </Space>
        )}
      </Modal>

      {/* 新链接（采购用）对话框 */}
      <Modal
        title="新链接（采购用）"
        open={newLinksModalVisible}
        onOk={handleBatchAddNewLinks}
        onCancel={() => {
          setNewLinksModalVisible(false);
          setNewLinksInput('');
          setNewLinksResult(null);
        }}
        confirmLoading={newLinksLoading}
        okText="确认添加"
        cancelText="取消"
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>请输入产品链接（每行一个）：</Text>
            <Text type="secondary" style={{ marginLeft: 8 }}>
              状态将统一设置为"新品一审"
            </Text>
          </div>
          <div style={{ 
            marginBottom: '12px', 
            padding: '8px', 
            backgroundColor: '#e6f7ff', 
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            <Text type="secondary">
              💡 <strong>智能处理：</strong><br />
              • 自动提取链接中https到.html的部分<br />
              • 自动跳过数据库中已存在的重复链接<br />
              • 处理完成后将显示详细的处理结果
            </Text>
          </div>
          <TextArea
            value={newLinksInput}
            onChange={(e) => setNewLinksInput(e.target.value)}
            placeholder="请每行输入一个产品链接，例如：&#10;@https://detail.1688.com/offer/966426530233.html?spm=a2615.pc_new_goods.wp_pc_new_product_list.0&#10;https://example.com/product2.html&#10;..."
            rows={8}
            style={{ fontFamily: 'monospace' }}
          />
          <div>
            <Text type="secondary">
              {newLinksInput.split('\n').filter(line => line.trim()).length} 个有效输入行
            </Text>
          </div>
        </Space>
      </Modal>

             {/* 新链接批量添加结果对话框 */}
       <Modal
         title="新链接添加结果"
         open={newLinksResultVisible}
         onOk={() => {
           setNewLinksResultVisible(false);
           setNewLinksResult(null);
         }}
         onCancel={() => {
           setNewLinksResultVisible(false);
           setNewLinksResult(null);
         }}
         okText="确定"
         cancelButtonProps={{ style: { display: 'none' } }}
         width={750}
       >
        {newLinksResult && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* 总体统计 */}
            <div>
              <Row gutter={16}>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="总处理链接数"
                      value={newLinksResult.totalCount}
                      valueStyle={{ color: '#1890ff' }}
                      prefix={<LinkOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="成功添加"
                      value={newLinksResult.successCount}
                      valueStyle={{ color: '#52c41a' }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="重复跳过"
                      value={newLinksResult.duplicateCount}
                      valueStyle={{ color: '#faad14' }}
                      prefix={<ClockCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="格式错误"
                      value={newLinksResult.errorCount}
                      valueStyle={{ color: '#ff4d4f' }}
                      prefix={<CloseCircleOutlined />}
                    />
                  </Card>
                </Col>
              </Row>
            </div>

            {/* 结果说明 */}
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#f6ffed', 
              borderRadius: '6px',
              border: '1px solid #b7eb8f'
            }}>
              <Text style={{ fontSize: '16px', fontWeight: 'bold', color: '#389e0d' }}>
                {newLinksResult.message}
              </Text>
            </div>

            {/* 重复链接详情 */}
            {newLinksResult.duplicates && newLinksResult.duplicates.length > 0 && (
              <div>
                <Text strong style={{ color: '#faad14' }}>🔄 跳过的重复链接：</Text>
                <Table
                   size="small"
                   dataSource={newLinksResult.duplicates}
                   columns={[
                     {
                       title: '行号',
                       dataIndex: 'line',
                       key: 'line',
                       width: 60,
                       align: 'center' as const
                     },
                     {
                       title: '提取的链接',
                       dataIndex: 'extractedLink',
                       key: 'extractedLink',
                       width: 350,
                       ellipsis: true,
                       render: (text: string) => (
                         <Tooltip title={text}>
                           <a href={text} target="_blank" rel="noopener noreferrer">
                             {text.length > 50 ? `${text.substring(0, 50)}...` : text}
                           </a>
                         </Tooltip>
                       ),
                     },
                     {
                       title: '状态',
                       dataIndex: 'error',
                       key: 'error',
                       width: 120,
                       render: (text: string) => (
                         <Tag color="orange">{text}</Tag>
                       ),
                     },
                   ]}
                   pagination={false}
                   scroll={{ y: 200 }}
                   style={{ marginTop: 8 }}
                 />
              </div>
            )}

            {/* 格式错误详情 */}
            {newLinksResult.errors && newLinksResult.errors.filter(err => err.error !== '链接已存在于数据库中').length > 0 && (
              <div>
                <Text strong style={{ color: '#ff4d4f' }}>❌ 格式错误的链接：</Text>
                <Table
                  size="small"
                  dataSource={newLinksResult.errors.filter(err => err.error !== '链接已存在于数据库中')}
                  columns={[
                    {
                      title: '行号',
                      dataIndex: 'line',
                      key: 'line',
                      width: 60,
                      align: 'center' as const
                    },
                    {
                      title: '原始输入',
                      dataIndex: 'originalLink',
                      key: 'originalLink',
                      width: 350,
                      ellipsis: true,
                      render: (text: string) => (
                        <Tooltip title={text}>
                          <Text code>{text.length > 50 ? `${text.substring(0, 50)}...` : text}</Text>
                        </Tooltip>
                      ),
                    },
                    {
                      title: '错误原因',
                      dataIndex: 'error',
                      key: 'error',
                      width: 180,
                      render: (text: string) => (
                        <Tag color="red">{text}</Tag>
                      ),
                    },
                  ]}
                  pagination={false}
                  scroll={{ y: 200 }}
                  style={{ marginTop: 8 }}
                />
              </div>
            )}
          </Space>
        )}
      </Modal>

      {/* SellerInventorySku Modal */}
      <Modal
        title={`母SKU: ${currentParentSku} - 子SKU明细`}
        visible={sellerSkuModalVisible}
        onCancel={() => {
          setSellerSkuModalVisible(false);
          setSelectedSkuIds([]);
          setBatchQtyPerBox(undefined);
          setBatchVendorSku('');
          setBatchWeight(undefined);
          setBatchPrice(undefined);
        }}
        width={1400}
        bodyStyle={{ maxHeight: '80vh', overflowY: 'auto' }}
        footer={null}
      >
        {/* 批量操作区域 - 简化版 */}
        <div style={{ marginBottom: 16, padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '6px' }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {selectedSkuIds.length > 0 && (
              <Text strong style={{ color: '#1890ff', fontSize: '13px' }}>
                已选择 {selectedSkuIds.length} 项 - 批量操作
              </Text>
            )}
            <Space align="center" wrap size="middle">
              <InputNumber
                placeholder="数量"
                value={batchQtyPerBox}
                onChange={(value) => setBatchQtyPerBox(value ?? undefined)}
                min={1}
                style={{ width: 80 }}
                size="small"
              />
              <Button
                size="small"
                onClick={handleBatchSetQtyPerBox}
                loading={batchLoading}
                disabled={selectedSkuIds.length === 0}
              >
                设置数量
              </Button>
              
              <Input
                placeholder="货号"
                value={batchVendorSku}
                onChange={(e) => setBatchVendorSku(e.target.value)}
                style={{ width: 120 }}
                size="small"
              />
              <Button
                size="small"
                onClick={handleBatchSetVendorSku}
                loading={batchLoading}
                disabled={selectedSkuIds.length === 0}
              >
                设置货号
              </Button>
              
              <InputNumber
                placeholder="重量(kg)"
                value={batchWeight}
                onChange={(value) => setBatchWeight(value ?? undefined)}
                min={0}
                max={50}
                step={0.001}
                precision={3}
                style={{ width: 100 }}
                size="small"
              />
              <Button
                size="small"
                type="primary"
                onClick={handleBatchSetWeight}
                loading={batchLoading}
                disabled={selectedSkuIds.length === 0}
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              >
                设实测重量
              </Button>
              
              <InputNumber
                placeholder="价格(¥)"
                value={batchPrice}
                onChange={(value) => setBatchPrice(value ?? undefined)}
                min={0}
                step={0.01}
                precision={2}
                style={{ width: 90 }}
                size="small"
              />
              <Button
                size="small"
                onClick={handleBatchSetPrice}
                loading={batchLoading}
                disabled={selectedSkuIds.length === 0}
              >
                设置价格
              </Button>
              
              <Button
                size="small"
                onClick={() => {
                  setSelectedSkuIds([]);
                  setBatchQtyPerBox(undefined);
                  setBatchVendorSku('');
                  setBatchWeight(undefined);
                  setBatchPrice(undefined);
                }}
                disabled={selectedSkuIds.length === 0}
              >
                清除
              </Button>
            </Space>
          </Space>
        </div>

        <Table
          dataSource={sellerSkuData}
          loading={sellerSkuLoading}
          rowKey="skuid"
          size="small"
          pagination={false}
          scroll={{ x: 1200 }}
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selectedSkuIds,
            onSelect: (record, selected) => {
              handleBatchSelectRow(record.skuid, selected);
            },
            onSelectAll: (selected, selectedRows, changeRows) => {
              handleBatchSelectAll(selected);
            },
            getCheckboxProps: (record) => ({
              disabled: record.skuid === sellerSkuEditingKey, // 编辑状态下不能选择
            }),
            columnWidth: 60,
            fixed: 'left',
          }}
          columns={[
            {
              title: 'SKU ID',
              dataIndex: 'skuid',
              key: 'skuid',
              width: 180,
              align: 'center' as const,
            },
            {
              title: '子SKU',
              dataIndex: 'child_sku',
              key: 'child_sku',
              width: 150,
              align: 'center' as const,
            },
            {
              title: '卖家货号',
              dataIndex: 'vendor_sku',
              key: 'vendor_sku',
              width: 150,
              align: 'center' as const,
              render: (text: string, record: SellerInventorySkuRecord) => {
                const isEditing = record.skuid === sellerSkuEditingKey;
                return isEditing ? (
                  <Input 
                    ref={vendorSkuInputRef}
                    size="small" 
                    defaultValue={record.vendor_sku || ''}
                    key={`vendor_sku-${record.skuid}`}
                    style={{ textAlign: 'center' }}
                  />
                ) : (
                  <span>{text || '-'}</span>
                );
              },
            },
            {
              title: '卖家颜色名称',
              dataIndex: 'sellercolorname',
              key: 'sellercolorname',
              width: 200,
              align: 'center' as const,
              render: (text: string, record: SellerInventorySkuRecord) => {
                const isEditing = record.skuid === sellerSkuEditingKey;
                return isEditing ? (
                  <Input 
                    ref={colorInputRef}
                    size="small" 
                    defaultValue={record.sellercolorname || ''}
                    key={`sellercolorname-${record.skuid}`}
                    style={{ textAlign: 'center' }}
                  />
                ) : (
                  <span>{text || '-'}</span>
                );
              },
            },
            {
              title: '卖家尺寸名称',
              dataIndex: 'sellersizename',
              key: 'sellersizename',
              width: 150,
              align: 'center' as const,
              render: (text: string, record: SellerInventorySkuRecord) => {
                const isEditing = record.skuid === sellerSkuEditingKey;
                return isEditing ? (
                  <Input 
                    ref={sizeInputRef}
                    size="small" 
                    defaultValue={record.sellersizename || ''}
                    key={`sellersizename-${record.skuid}`}
                    style={{ textAlign: 'center' }}
                  />
                ) : (
                  <span>{text || '-'}</span>
                );
              },
            },
            {
              title: '单箱产品数量',
              dataIndex: 'qty_per_box',
              key: 'qty_per_box',
              width: 120,
              align: 'center' as const,
              render: (text: number, record: SellerInventorySkuRecord) => {
                const isEditing = record.skuid === sellerSkuEditingKey;
                return isEditing ? (
                  <Input 
                    ref={qtyInputRef}
                    size="small" 
                    type="number" 
                    defaultValue={record.qty_per_box?.toString() || '0'}
                    key={`qty_per_box-${record.skuid}`}
                    style={{ textAlign: 'center' }}
                  />
                ) : (
                  <span>{text || '-'}</span>
                );
              },
            },
            {
              title: '价格',
              dataIndex: 'price',
              key: 'price',
              width: 120,
              align: 'center' as const,
              render: (value: number, record: SellerInventorySkuRecord) => {
                const isEditing = record.skuid === sellerSkuEditingKey;
                return isEditing ? (
                  <Input 
                    ref={priceInputRef}
                    size="small" 
                    type="number" 
                    step="0.01"
                    defaultValue={record.price?.toString() || ''}
                    key={`price-${record.skuid}`}
                    style={{ textAlign: 'center' }}
                    placeholder="输入价格"
                  />
                ) : (
                  <span>{value ? `¥${value}` : '-'}</span>
                );
              },
            },
            {
              title: '重量(kg)',
              dataIndex: 'weight',
              key: 'weight',
              width: 120,
              align: 'center' as const,
              render: (value: number, record: SellerInventorySkuRecord) => {
                const isEditing = record.skuid === sellerSkuEditingKey;
                return isEditing ? (
                  <InputNumber 
                    ref={weightInputRef}
                    size="small" 
                    min={0}
                    max={50}
                    step="0.001"
                    precision={3}
                    defaultValue={record.weight || undefined}
                    key={`weight-${record.skuid}`}
                    style={{ width: '100%', textAlign: 'center' }}
                    placeholder="重量"
                  />
                ) : (
                  <span>{value ? `${value}kg` : '-'}</span>
                );
              },
            },
            {
              title: '重量类型',
              dataIndex: 'weight_type',
              key: 'weight_type',
              width: 100,
              align: 'center' as const,
              render: (value: string, record: SellerInventorySkuRecord) => {
                const isEditing = record.skuid === sellerSkuEditingKey;
                return isEditing ? (
                  <Select 
                    ref={weightTypeInputRef}
                    size="small" 
                    defaultValue={record.weight_type || 'estimated'}
                    key={`weight_type-${record.skuid}`}
                    style={{ width: '100%' }}
                    placeholder="类型"
                  >
                    <Option value="estimated">预估</Option>
                    <Option value="measured">实测</Option>
                  </Select>
                ) : (
                  <Tag color={value === 'measured' ? 'green' : 'orange'} style={{ fontSize: 11 }}>
                    {value === 'measured' ? '实测' : '预估'}
                  </Tag>
                );
              },
            },
            {
              title: '操作',
              key: 'action',
              width: 120,
              align: 'center' as const,
              render: (text: any, record: SellerInventorySkuRecord) => {
                const isEditing = record.skuid === sellerSkuEditingKey;
                return isEditing ? (
                  <Space>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => handleSellerSkuSave(record.skuid)}
                    >
                      保存
                    </Button>
                    <Button size="small" onClick={handleSellerSkuCancel}>
                      取消
                    </Button>
                  </Space>
                ) : (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => handleSellerSkuEdit(record)}
                  >
                    编辑
                  </Button>
                );
              },
            },
          ]}
        />
      </Modal>

      {/* 利润推算器弹窗 */}
      <ProfitCalculator 
        visible={profitCalculatorVisible}
        onClose={() => setProfitCalculatorVisible(false)}
      />

      {/* 竞争对手ASIN管理弹窗 */}
      <Modal
        title={`管理竞争对手ASIN - ${currentCompetitorRecord?.parent_sku || ''}`}
        open={competitorLinksModalVisible}
        onOk={handleSaveCompetitorLinks}
        onCancel={() => {
          setCompetitorLinksModalVisible(false);
          setCurrentCompetitorRecord(null);
          setCompetitorLinksInput('');
        }}
        okText="添加"
        cancelText="取消"
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>请输入竞争对手ASIN（每行一个）：</Text>
          </div>
          <div style={{ 
            marginBottom: '12px', 
            padding: '8px', 
            backgroundColor: '#e6f7ff', 
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            <Text type="secondary">
              💡 <strong>使用说明：</strong><br />
              • 每行输入一个ASIN（10位字母数字组合）<br />
              • 也可以粘贴完整的Amazon产品链接，系统会自动提取ASIN<br />
              • 支持批量打开功能，方便对比分析<br />
              • 可以在表格中单独删除不需要的ASIN
            </Text>
          </div>
          <TextArea
            value={competitorLinksInput}
            onChange={(e) => setCompetitorLinksInput(e.target.value)}
            placeholder="请每行输入一个ASIN，例如：&#10;B08XXXX123&#10;B09YYYY456&#10;或完整链接：https://www.amazon.com/dp/B08XXXX123&#10;..."
            rows={8}
            style={{ fontFamily: 'monospace' }}
          />
          <div>
            <Text type="secondary">
              {competitorLinksInput.split('\n').filter(line => line.trim()).length} 个输入行
            </Text>
          </div>
        </Space>
      </Modal>

      {/* 广告创建站点选择弹窗 */}
      <Modal
        title={`设置广告创建状态 - ${currentAdsRecord?.parent_sku || ''}`}
        open={adsSiteModalVisible}
        onOk={handleSaveAdsStatus}
        onCancel={() => {
          setAdsSiteModalVisible(false);
          setCurrentAdsRecord(null);
        }}
        okText="保存"
        cancelText="取消"
        width={500}
      >
        <div style={{ padding: '20px 0' }}>
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>🇺🇸 美国站点：</Text>
            <Select
              value={adsUsStatus}
              onChange={setAdsUsStatus}
              style={{ width: '100%' }}
              size="large"
            >
              <Option value="是">已创建</Option>
              <Option value="否">未创建</Option>
            </Select>
          </div>
          
          <div>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>🇬🇧 英国站点：</Text>
            <Select
              value={adsUkStatus}
              onChange={setAdsUkStatus}
              style={{ width: '100%' }}
              size="large"
            >
              <Option value="是">已创建</Option>
              <Option value="否">未创建</Option>
            </Select>
          </div>
        </div>
      </Modal>

      {/* 自定义类目编辑模态框 */}
      <Modal
        title={`编辑自定义类目 - ${currentCustomCategoryRecord?.parent_sku || ''}`}
        open={customCategoryModalVisible}
        onOk={handleSaveCustomCategory}
        onCancel={() => {
          setCustomCategoryModalVisible(false);
          setCurrentCustomCategoryRecord(null);
          setCustomCategoryValue('');
        }}
        width={500}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ padding: '20px 0' }}>
          <Form layout="vertical">
            <Form.Item label="自定义类目">
              <Input
                value={customCategoryValue}
                onChange={(e) => setCustomCategoryValue(e.target.value)}
                placeholder="请输入自定义类目名称"
                maxLength={100}
                showCount
              />
            </Form.Item>
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#f6f8fa', 
              borderRadius: '6px',
              fontSize: '12px',
              color: '#666'
            }}>
              <div>💡 提示：</div>
              <div>• 自定义类目用于对产品进行分类标记</div>
              <div>• 类目名称最多100个字符</div>
              <div>• 留空将清空自定义类目</div>
            </div>
          </Form>
        </div>
      </Modal>

      {/* 类目管理模态框 */}
      <Modal
        title="自定义类目管理"
        open={categoryManagerVisible}
        onCancel={() => setCategoryManagerVisible(false)}
        footer={[
          <Button key="refresh" onClick={fetchCategories} loading={categoryManagerLoading}>
            刷新
          </Button>,
          <Button key="close" onClick={() => setCategoryManagerVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {categoryManagerLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <LoadingOutlined style={{ fontSize: '24px' }} />
              <div style={{ marginTop: '16px' }}>加载中...</div>
            </div>
          ) : categories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              <ExperimentOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
              <div>暂无自定义类目</div>
              <div style={{ fontSize: '12px', marginTop: '8px' }}>
                在表格中为产品添加自定义类目后，这里会显示统计信息
              </div>
            </div>
          ) : (
            <Table
              dataSource={categories}
              columns={[
                {
                  title: '类目名称',
                  dataIndex: 'name',
                  key: 'name',
                  render: (text: string) => (
                    <Tag color="blue" style={{ fontSize: '14px', padding: '4px 8px' }}>
                      {text}
                    </Tag>
                  )
                },
                {
                  title: '产品数量',
                  dataIndex: 'count',
                  key: 'count',
                  width: 100,
                  align: 'center' as const,
                  render: (count: number) => (
                    <Badge count={count} style={{ backgroundColor: '#52c41a' }} />
                  )
                },
                {
                  title: '操作',
                  key: 'actions',
                  width: 120,
                  align: 'center' as const,
                  render: (_, record: {name: string, count: number}) => (
                    <Space size="small">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEditCategory(record)}
                        title="编辑类目名称"
                        style={{ color: '#1890ff' }}
                      />
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteCategory(record)}
                        title="删除类目"
                        style={{ color: '#ff4d4f' }}
                      />
                    </Space>
                  )
                }
              ]}
              pagination={false}
              size="small"
              rowKey="name"
            />
          )}
        </div>
      </Modal>

      {/* 编辑类目名称模态框 */}
      <Modal
        title={`编辑类目名称 - ${editingCategory?.name || ''}`}
        open={editCategoryModalVisible}
        onOk={handleSaveCategoryEdit}
        onCancel={() => {
          setEditCategoryModalVisible(false);
          setEditingCategory(null);
          setEditCategoryName('');
        }}
        confirmLoading={editCategoryLoading}
        width={500}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ padding: '20px 0' }}>
          <Form layout="vertical">
            <Form.Item label="原类目名称">
              <Input
                value={editingCategory?.name || ''}
                disabled
                style={{ backgroundColor: '#f5f5f5' }}
              />
            </Form.Item>
            <Form.Item label="新类目名称">
              <Input
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
                placeholder="请输入新的类目名称"
                maxLength={100}
                showCount
              />
            </Form.Item>
            <div style={{
              padding: '12px',
              backgroundColor: '#f6f8fa',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#666'
            }}>
              <div>💡 提示：</div>
              <div>• 重命名后，所有使用该类目的产品记录都会更新</div>
              <div>• 类目名称最多100个字符</div>
              <div>• 新名称不能与现有类目重复</div>
            </div>
          </Form>
        </div>
      </Modal>

      {/* 批量设置类目模态框 */}
      <Modal
        title={`批量设置自定义类目 (已选择 ${selectedRowKeys.length} 条记录)`}
        open={batchCategoryModalVisible}
        onOk={handleBatchCategorySubmit}
        onCancel={() => {
          setBatchCategoryModalVisible(false);
          setBatchAction('set');
          setBatchCategoryName('');
        }}
        confirmLoading={batchLoading}
        width={500}
      >
        <div style={{ padding: '20px 0' }}>
          <Form layout="vertical">
            <Form.Item label="操作方式">
              <Radio.Group 
                value={batchAction} 
                onChange={(e) => setBatchAction(e.target.value)}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Radio value="set">
                    <div>
                      <div style={{ fontWeight: 'bold' }}>设置为新类目</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        将选中记录的自定义类目设置为指定的新类目
                      </div>
                    </div>
                  </Radio>
                  <Radio value="add">
                    <div>
                      <div style={{ fontWeight: 'bold' }}>添加到现有类目</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        将选中记录添加到已存在的类目中（会保留原有类目）
                      </div>
                    </div>
                  </Radio>
                  <Radio value="clear">
                    <div>
                      <div style={{ fontWeight: 'bold' }}>清空自定义类目</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        清空选中记录的自定义类目
                      </div>
                    </div>
                  </Radio>
                </Space>
              </Radio.Group>
            </Form.Item>
            
            {batchAction !== 'clear' && (
              <Form.Item label="类目名称">
                {batchAction === 'add' ? (
                  <Select
                    value={batchCategoryName}
                    onChange={setBatchCategoryName}
                    placeholder="选择要添加到的类目"
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={categories.map(cat => ({
                      value: cat.name,
                      label: `${cat.name} (${cat.count}个产品)`
                    }))}
                  />
                ) : (
                  <Input
                    value={batchCategoryName}
                    onChange={(e) => setBatchCategoryName(e.target.value)}
                    placeholder="请输入新类目名称"
                    maxLength={100}
                    showCount
                  />
                )}
              </Form.Item>
            )}
            
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#f6f8fa', 
              borderRadius: '6px',
              fontSize: '12px',
              color: '#666'
            }}>
              <div>💡 提示：</div>
              <div>• 设置为新类目：会覆盖现有的自定义类目</div>
              <div>• 添加到现有类目：会保留原有类目，追加新类目</div>
              <div>• 清空自定义类目：会删除所有自定义类目</div>
            </div>
          </Form>
        </div>
      </Modal>

      {/* 产品上下架模态框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GlobalOutlined style={{ color: '#1890ff', fontSize: '18px' }} />
            <span style={{ fontSize: '16px', fontWeight: '600' }}>产品上下架操作</span>
          </div>
        }
        open={productStatusModalVisible}
        onCancel={() => {
          setProductStatusModalVisible(false);
          setProductStatusAction(null);
          setQuantityAdjustmentText('');
        }}
        footer={null}
        width={600}
        style={{ top: '20vh' }}
        bodyStyle={{ padding: '24px' }}
      >
        <div style={{ minHeight: '400px' }}>
          {!productStatusAction ? (
            // 操作选择界面
            <div>
              <div style={{ 
                textAlign: 'center', 
                marginBottom: '32px',
                padding: '20px',
                backgroundColor: selectedRowKeys.length === 0 ? '#fff7e6' : '#f8f9fa',
                borderRadius: '8px',
                border: selectedRowKeys.length === 0 ? '1px solid #ffd591' : '1px solid #e9ecef'
              }}>
                <Text style={{ fontSize: '16px', color: '#495057' }}>
                  {selectedRowKeys.length === 0 ? '没有选择数据，直接进入数量调整操作' : '请选择您要执行的操作类型'}
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: '14px' }}>
                  {selectedRowKeys.length === 0 ? '您可以输入SKU及数量信息进行数量调整' : `已选择 ${selectedRowKeys.length} 条记录`}
                </Text>
              </div>
              
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                {selectedRowKeys.length > 0 ? (
                  // 有选中记录时显示上架和下架选项
                  <>
                    <Button
                      type="primary"
                      size="large"
                      icon={<CheckCircleOutlined />}
                      style={{ 
                        width: '100%', 
                        height: '60px',
                        fontSize: '16px',
                        fontWeight: '500',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(24, 144, 255, 0.2)'
                      }}
                      onClick={handleDirectProductOnline}
                    >
                      产品上架
                    </Button>
                    
                    <Button
                      danger
                      size="large"
                      icon={<CloseCircleOutlined />}
                      style={{ 
                        width: '100%', 
                        height: '60px',
                        fontSize: '16px',
                        fontWeight: '500',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(255, 77, 79, 0.2)'
                      }}
                      onClick={handleDirectProductOffline}
                    >
                      产品下架
                    </Button>
                  </>
                ) : null}
                
                <Button
                  size="large"
                  icon={<CalculatorOutlined />}
                  style={{ 
                    width: '100%', 
                    height: '60px',
                    fontSize: '16px',
                    fontWeight: '500',
                    backgroundColor: '#52c41a',
                    borderColor: '#52c41a',
                    color: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(82, 196, 26, 0.2)'
                  }}
                  onClick={() => setProductStatusAction('数量调整')}
                >
                  数量调整
                </Button>
              </Space>
            </div>
          ) : (
            // 操作确认界面
            <div>
              <div style={{ 
                marginBottom: '24px',
                padding: '16px',
                backgroundColor: productStatusAction === '上架' ? '#f6ffed' : 
                               productStatusAction === '下架' ? '#fff2f0' : '#f0f9ff',
                border: `1px solid ${productStatusAction === '上架' ? '#b7eb8f' : 
                                        productStatusAction === '下架' ? '#ffccc7' : '#91d5ff'}`,
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {productStatusAction === '上架' && <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px' }} />}
                  {productStatusAction === '下架' && <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: '16px' }} />}
                  {productStatusAction === '数量调整' && <CalculatorOutlined style={{ color: '#1890ff', fontSize: '16px' }} />}
                  <Text strong style={{ fontSize: '16px' }}>
                    {productStatusAction === '上架' ? '产品上架操作' : 
                     productStatusAction === '下架' ? '产品下架操作' : '数量调整操作'}
                  </Text>
                </div>
                {productStatusAction === '数量调整' && selectedRowKeys.length === 0 ? (
                  <div style={{ 
                    padding: '12px 16px',
                    backgroundColor: '#fff7e6',
                    border: '2px solid #ffa940',
                    borderRadius: '6px',
                    marginTop: '8px'
                  }}>
                    <Text style={{ 
                      fontSize: '15px',
                      fontWeight: '600',
                      color: '#d46b08',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ fontSize: '18px' }}>⚠️</span>
                      没有选择数据，直接进入数量调整操作。请输入SKU及数量信息
                    </Text>
                  </div>
                ) : (
                  <Text type="secondary">
                    {productStatusAction === '数量调整' ? '请输入SKU及数量信息' : '将发送邮件通知相关人员'}
                  </Text>
                )}
              </div>

              {productStatusAction === '数量调整' ? (
                <div>
                  <div style={{ marginBottom: '12px' }}>
                    <Text strong style={{ fontSize: '14px' }}>SKU及数量信息</Text>
                    <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
                      （每行一个，格式：SKU 数量）
                    </Text>
                  </div>
                  <TextArea
                    value={quantityAdjustmentText}
                    onChange={(e) => setQuantityAdjustmentText(e.target.value)}
                    placeholder="请输入SKU及数量，例如：&#10;BTX-001 100&#10;BTX-002 50&#10;BTX-003 200"
                    rows={8}
                    style={{ 
                      fontFamily: 'monospace',
                      fontSize: '14px',
                      borderRadius: '6px'
                    }}
                  />
                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      {(() => {
                        const lines = quantityAdjustmentText.split('\n').filter(line => line.trim());
                        const invalidLines = lines.filter(line => {
                          const parts = line.trim().split(/\s+/);
                          return parts.length < 2 || isNaN(Number(parts[1])) || Number(parts[1]) < 0;
                        });
                        
                        if (invalidLines.length > 0) {
                          return (
                            <Text type="danger" style={{ fontSize: '12px' }}>
                              ⚠️ {invalidLines.length} 行格式不正确
                            </Text>
                          );
                        }
                        
                        return (
                          <Text type="success" style={{ fontSize: '12px' }}>
                            ✅ 格式正确
                          </Text>
                        );
                      })()}
                    </div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {quantityAdjustmentText.split('\n').filter(line => line.trim()).length} 行数据
                    </Text>
                  </div>
                </div>
              ) : (
                selectedRowKeys.length > 0 ? (
                  <div style={{ 
                    padding: '16px',
                    backgroundColor: '#fafafa',
                    borderRadius: '6px',
                    border: '1px solid #d9d9d9'
                  }}>
                    <div style={{ marginBottom: '12px' }}>
                      <Text strong style={{ color: '#1890ff' }}>📧 邮件信息</Text>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <Text strong>收件人：</Text>
                      <Text code style={{ marginLeft: '8px' }}>
                        {emailConfig.receiver || '加载中...'}
                      </Text>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <Text strong>标题：</Text>
                      <Text style={{ marginLeft: '8px' }}>
                        {emailConfig.subject || '加载中...'}
                      </Text>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <Text strong>内容：</Text>
                      <Text style={{ marginLeft: '8px' }}>{productStatusAction}</Text>
                    </div>
                    <div>
                      <Text strong>包含：</Text>
                      <Tag color="blue" style={{ marginLeft: '8px' }}>
                        {selectedRowKeys.length} 个母SKU
                      </Tag>
                    </div>
                  </div>
                ) : (
                  <div style={{ 
                    padding: '16px',
                    backgroundColor: '#f0f9ff',
                    borderRadius: '6px',
                    border: '1px solid #91d5ff'
                  }}>
                    <div style={{ marginBottom: '12px' }}>
                      <Text strong style={{ color: '#1890ff' }}>📧 邮件信息</Text>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <Text strong>收件人：</Text>
                      <Text code style={{ marginLeft: '8px' }}>
                        {emailConfig.receiver || '加载中...'}
                      </Text>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <Text strong>标题：</Text>
                      <Text style={{ marginLeft: '8px' }}>
                        {emailConfig.subject || '加载中...'}
                      </Text>
                    </div>
                    <div>
                      <Text strong>内容：</Text>
                      <Text style={{ marginLeft: '8px' }}>产品数量调整</Text>
                    </div>
                  </div>
                )
              )}
              
              <div style={{ 
                marginTop: '32px', 
                paddingTop: '20px',
                borderTop: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: selectedRowKeys.length === 0 ? 'flex-end' : 'space-between',
                alignItems: 'center'
              }}>
                {selectedRowKeys.length > 0 && (
                  <Button 
                    size="large"
                    onClick={() => setProductStatusAction(null)}
                    style={{ borderRadius: '6px' }}
                  >
                    返回选择
                  </Button>
                )}
                <Button
                  type="primary"
                  size="large"
                  icon={isProcessing ? <LoadingOutlined /> : <CheckCircleOutlined />}
                  onClick={() => handleProductStatusAction(productStatusAction)}
                  disabled={
                    isProcessing || 
                    (productStatusAction === '数量调整' && (
                      !quantityAdjustmentText.trim() || 
                      (() => {
                        const lines = quantityAdjustmentText.split('\n').filter(line => line.trim());
                        return lines.some(line => {
                          const parts = line.trim().split(/\s+/);
                          return parts.length < 2 || isNaN(Number(parts[1])) || Number(parts[1]) < 0;
                        });
                      })()
                    ))
                  }
                  loading={isProcessing}
                  style={{ 
                    borderRadius: '6px',
                    minWidth: '120px'
                  }}
                >
                  {isProcessing ? '处理中...' : '确认发送'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 英国模板选择对话框 */}
      <Modal
        title={
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            fontSize: '18px',
            fontWeight: '600',
            color: '#262626'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#1890ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              🇬🇧
            </div>
            选择英国资料表模板
          </div>
        }
        open={ukTemplateModalVisible}
        onCancel={() => setUkTemplateModalVisible(false)}
        onOk={confirmGenerateUkDataSheet}
        okText="确认生成"
        cancelText="取消"
        width={700}
        style={{ top: '10vh' }}
        okButtonProps={{
          size: 'large',
          style: { 
            height: '44px',
            fontSize: '16px',
            fontWeight: '600',
            borderRadius: '8px',
            minWidth: '120px'
          }
        }}
        cancelButtonProps={{
          size: 'large',
          style: { 
            height: '44px',
            fontSize: '16px',
            borderRadius: '8px',
            minWidth: '120px'
          }
        }}
      >
        <div style={{ 
          marginBottom: '24px',
          padding: '16px 20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '12px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            marginBottom: '8px'
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#52c41a'
            }}></div>
            <Text style={{ 
              fontSize: '16px', 
              fontWeight: '600',
              color: '#262626'
            }}>
              请选择要使用的英国资料表模板
            </Text>
          </div>
          <Text style={{ 
            fontSize: '14px', 
            color: '#8c8c8c',
            lineHeight: '1.5'
          }}>
            系统将根据您选择的模板类型自动填写对应的 feed_product_type 字段
          </Text>
        </div>
        
        {loadingTemplates ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 20px',
            backgroundColor: '#fafafa',
            borderRadius: '12px',
            border: '1px solid #f0f0f0'
          }}>
            <Spin size="large" />
            <div style={{ 
              marginTop: '20px',
              fontSize: '16px',
              color: '#8c8c8c',
              fontWeight: '500'
            }}>
              正在加载模板列表...
            </div>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px',
            marginBottom: '8px'
          }}>
            {ukTemplates.map((template) => (
              <div
                key={template.id}
                onClick={() => setSelectedTemplateId(template.id)}
                style={{
                  padding: '24px',
                  border: selectedTemplateId === template.id ? '2px solid #1890ff' : '2px solid #e8e8e8',
                  borderRadius: '16px',
                  backgroundColor: selectedTemplateId === template.id ? '#f0f8ff' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: selectedTemplateId === template.id 
                    ? '0 8px 24px rgba(24, 144, 255, 0.15)' 
                    : '0 2px 8px rgba(0, 0, 0, 0.06)',
                  transform: selectedTemplateId === template.id ? 'translateY(-2px)' : 'translateY(0)'
                }}
              >
                {/* 选中状态指示器 */}
                {selectedTemplateId === template.id && (
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#1890ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>
                    ✓
                  </div>
                )}
                
                {/* 类目图标和名称 */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: selectedTemplateId === template.id ? '#1890ff' : '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    color: selectedTemplateId === template.id ? 'white' : '#8c8c8c',
                    fontWeight: 'bold'
                  }}>
                    {template.category === 'handbag' ? '👜' : '🎒'}
                  </div>
                  <div>
                    <div style={{ 
                      fontSize: '20px', 
                      fontWeight: 'bold', 
                      color: selectedTemplateId === template.id ? '#1890ff' : '#262626',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
                    }}>
                      {template.category}
                    </div>
                    <div style={{ 
                      fontSize: '12px',
                      color: '#8c8c8c',
                      fontWeight: '500',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Template Type
                    </div>
                  </div>
                </div>
                
                {/* 文件名 */}
                <div style={{ 
                  marginBottom: '12px',
                  padding: '12px',
                  backgroundColor: selectedTemplateId === template.id ? 'rgba(24, 144, 255, 0.05)' : '#fafafa',
                  borderRadius: '8px',
                  border: `1px solid ${selectedTemplateId === template.id ? '#d6e4ff' : '#f0f0f0'}`
                }}>
                  <div style={{ 
                    fontSize: '14px',
                    color: '#8c8c8c',
                    marginBottom: '4px',
                    fontWeight: '500'
                  }}>
                    文件名
                  </div>
                  <div style={{ 
                    fontSize: '13px',
                    color: selectedTemplateId === template.id ? '#1890ff' : '#595959',
                    fontWeight: '500',
                    wordBreak: 'break-all'
                  }}>
                    {template.fileName}
                  </div>
                </div>
                
                {/* 上传时间 */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  fontSize: '12px',
                  color: '#bfbfbf'
                }}>
                  <div style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: '#d9d9d9'
                  }}></div>
                  <span>上传于 {new Date(template.uploadTime).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
        </Content>
      </Layout>
    </div>
  );
};

export default Purchase; 