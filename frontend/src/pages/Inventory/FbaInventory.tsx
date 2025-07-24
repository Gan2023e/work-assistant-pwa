import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, 
  Button, 
  Select, 
  message, 
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Form,
  Input,
  Tooltip,
  Badge
} from 'antd';
import { 
  DownloadOutlined,
  ReloadOutlined,
  FileExcelOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';

const { Option } = Select;
const { Title, Text } = Typography;

// 根据实际数据库表结构定义接口
interface FbaInventoryRecord {
  sku: string;
  fnsku?: string;
  asin?: string;
  'product-name'?: string;
  condition?: string;
  'your-price'?: number;
  'mfn-listing-exists'?: string;
  'mfn-fulfillable-quantity'?: string;
  'afn-listing-exists'?: string;
  'afn-warehouse-quantity'?: number;
  'afn-fulfillable-quantity'?: number;
  'afn-unsellable-quantity'?: number;
  'afn-reserved-quantity'?: number;
  'afn-total-quantity'?: number;
  'per-unit-volume'?: number;
  'afn-inbound-working-quantity'?: number;
  'afn-inbound-shipped-quantity'?: number;
  'afn-inbound-receiving-quantity'?: number;
  'afn-researching-quantity'?: number;
  'afn-reserved-future-supply'?: number;
  'afn-future-supply-buyable'?: number;
  site: string;
  'afn-fulfillable-quantity-local'?: number;
  'afn-fulfillable-quantity-remote'?: number;
  store?: string;
}

interface FbaInventoryStats {
  total_skus: number;
  total_afn_fulfillable: number;
  total_afn_reserved: number;
  total_afn_inbound: number;
  by_site: Array<{
    site: string;
    sku_count: number;
    total_afn_fulfillable: number;
    total_afn_reserved: number;
    total_afn_inbound: number;
  }>;
  by_store: Array<{
    store: string;
    sku_count: number;
    total_afn_fulfillable: number;
    total_afn_reserved: number;
    total_afn_inbound: number;
  }>;
}

const FbaInventory: React.FC = () => {
  const [records, setRecords] = useState<FbaInventoryRecord[]>([]);
  const [stats, setStats] = useState<FbaInventoryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // 搜索和筛选状态
  const [searchFilters, setSearchFilters] = useState({
    sku: '',
    site: ''
  });

  // 分页状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  // 站点列表
  const [sites, setSites] = useState<string[]>([]);

  // 加载数据
  const fetchData = useCallback(async (page: number = 1, pageSize: number = 20) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...searchFilters
      });

      const response = await fetch(`${API_BASE_URL}/api/fba-inventory?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        setRecords(result.data.records);
        setPagination({
          current: result.data.current,
          pageSize: result.data.pageSize,
          total: result.data.total
        });
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error('获取FBA库存数据失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [searchFilters]);

  // 加载统计数据
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/fba-inventory/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  }, []);

  // 加载站点列表
  const fetchSites = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/fba-inventory/sites-stores`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.code === 0) {
        setSites(result.data.sites || []);
      }
    } catch (error) {
      console.error('获取站点数据失败:', error);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    fetchData();
    fetchStats();
    fetchSites();
  }, [fetchData, fetchStats, fetchSites]);

  // 表格列定义 - 删除商品状态和店铺列
  const columns: ColumnsType<FbaInventoryRecord> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      fixed: 'left',
      sorter: (a: FbaInventoryRecord, b: FbaInventoryRecord) => {
        const aValue = a.sku || '';
        const bValue = b.sku || '';
        return aValue.localeCompare(bValue);
      },
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'FNSKU',
      dataIndex: 'fnsku',
      key: 'fnsku',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: 'ASIN',
      dataIndex: 'asin',
      key: 'asin',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '产品名称',
      dataIndex: 'product-name',
      key: 'product-name',
      width: 200,
      ellipsis: {
        showTitle: false,
      },
      render: (text) => (
        <Tooltip placement="topLeft" title={text}>
          {text || '-'}
        </Tooltip>
      )
    },
    {
      title: '售价',
      dataIndex: 'your-price',
      key: 'your-price',
      width: 100,
      align: 'right',
      render: (value) => value ? `$${Number(value).toFixed(2)}` : '-'
    },
    {
      title: '站点',
      dataIndex: 'site',
      key: 'site',
      width: 80,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: 'AFN可售数量',
      dataIndex: 'afn-fulfillable-quantity',
      key: 'afn-fulfillable-quantity',
      width: 120,
      align: 'right',
      render: (value) => (
        <Badge 
          count={value || 0} 
          overflowCount={9999}
          style={{ backgroundColor: value > 0 ? '#52c41a' : '#f5222d' }}
        />
      )
    },
    {
      title: 'AFN仓库数量',
      dataIndex: 'afn-warehouse-quantity',
      key: 'afn-warehouse-quantity',
      width: 120,
      align: 'right',
      render: (value) => value || 0
    },
    {
      title: 'AFN预留数量',
      dataIndex: 'afn-reserved-quantity',
      key: 'afn-reserved-quantity',
      width: 120,
      align: 'right',
      render: (value) => value || 0
    },
    {
      title: 'AFN不可售数量',
      dataIndex: 'afn-unsellable-quantity',
      key: 'afn-unsellable-quantity',
      width: 130,
      align: 'right',
      render: (value) => value || 0
    },
    {
      title: 'AFN总数量',
      dataIndex: 'afn-total-quantity',
      key: 'afn-total-quantity',
      width: 100,
      align: 'right',
      render: (value) => <Text strong>{value || 0}</Text>
    },
    {
      title: '入库处理中',
      dataIndex: 'afn-inbound-working-quantity',
      key: 'afn-inbound-working-quantity',
      width: 100,
      align: 'right',
      render: (value) => value || 0
    },
    {
      title: '入库运输中',
      dataIndex: 'afn-inbound-shipped-quantity',
      key: 'afn-inbound-shipped-quantity',
      width: 100,
      align: 'right',
      render: (value) => value || 0
    },
    {
      title: '入库接收中',
      dataIndex: 'afn-inbound-receiving-quantity',
      key: 'afn-inbound-receiving-quantity',
      width: 100,
      align: 'right',
      render: (value) => value || 0
    },
    {
      title: '单位体积',
      dataIndex: 'per-unit-volume',
      key: 'per-unit-volume',
      width: 100,
      align: 'right',
      render: (value) => value ? `${Number(value).toFixed(2)}` : '-'
    },
    {
      title: 'MFN Listing',
      dataIndex: 'mfn-listing-exists',
      key: 'mfn-listing-exists',
      width: 100,
      render: (text) => {
        const color = text === 'Yes' ? 'green' : text === 'No' ? 'red' : 'default';
        return text ? <Tag color={color}>{text}</Tag> : '-';
      }
    },
    {
      title: 'AFN Listing',
      dataIndex: 'afn-listing-exists',
      key: 'afn-listing-exists',
      width: 100,
      render: (text) => {
        const color = text === 'Yes' ? 'green' : text === 'No' ? 'red' : 'default';
        return text ? <Tag color={color}>{text}</Tag> : '-';
      }
    }
  ];

  // 分页处理
  const handleTableChange = (pag: any) => {
    fetchData(pag.current, pag.pageSize);
  };

  // 搜索处理
  const handleSearch = (changedValues: any) => {
    setSearchFilters(prev => ({ ...prev, ...changedValues }));
  };

  // 导出Excel
  const handleExport = () => {
    if (records.length === 0) {
      message.warning('没有数据可导出');
      return;
    }

    try {
      const exportData = records.map(record => ({
        'SKU': record.sku,
        'FNSKU': record.fnsku || '',
        'ASIN': record.asin || '',
        '产品名称': record['product-name'] || '',
        '售价': record['your-price'] || '',
        '站点': record.site,
        'AFN可售数量': record['afn-fulfillable-quantity'] || 0,
        'AFN仓库数量': record['afn-warehouse-quantity'] || 0,
        'AFN预留数量': record['afn-reserved-quantity'] || 0,
        'AFN不可售数量': record['afn-unsellable-quantity'] || 0,
        'AFN总数量': record['afn-total-quantity'] || 0,
        '入库处理中': record['afn-inbound-working-quantity'] || 0,
        '入库运输中': record['afn-inbound-shipped-quantity'] || 0,
        '入库接收中': record['afn-inbound-receiving-quantity'] || 0,
        '单位体积': record['per-unit-volume'] || '',
        'MFN Listing': record['mfn-listing-exists'] || '',
        'AFN Listing': record['afn-listing-exists'] || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'FBA库存');
      
      const fileName = `FBA库存_${new Date().toLocaleDateString()}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    }
  };

  // 生成SHEIN库存同步文件
  const handleGenerateSheinSync = async () => {
    // 创建一个可控制的加载提示
    const hideLoading = message.loading('正在查询SHEIN产品信息...', 0);
    
    try {
      // 设置超时控制器
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 120000); // 2分钟超时

      // 更新加载状态
      setTimeout(() => {
        hideLoading();
        message.loading('正在处理SKU映射关系...', 0);
      }, 1000);

      setTimeout(() => {
        message.destroy();
        message.loading('正在查询FBA库存数据...', 0);
      }, 3000);

      setTimeout(() => {
        message.destroy();
        message.loading('正在生成Excel文件...', 0);
      }, 5000);
      
      const response = await fetch(`${API_BASE_URL}/api/fba-inventory/generate-shein-sync`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      message.destroy();

      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.message || `HTTP ${response.status}`);
      }

      // 获取文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'SHEIN库存同步.xlsx';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
        }
      }

      // 下载文件
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      message.success('SHEIN库存同步文件生成并下载完成！');
    } catch (error) {
      message.destroy();
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          message.error('生成超时，请稍后重试。如果数据量很大，这个过程可能需要较长时间。');
        } else if (error.message.includes('fetch')) {
          message.error('网络连接错误，请检查网络后重试');
        } else {
          message.error(`生成失败: ${error.message}`);
        }
      } else {
        message.error('生成失败: 未知错误');
      }
      
      console.error('生成SHEIN库存同步文件失败:', error);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <BarChartOutlined /> FBA库存管理
      </Title>

      {/* 统计卡片 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总SKU数量"
                value={stats.total_skus}
                prefix={<FileExcelOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="可用库存"
                value={stats.total_afn_fulfillable}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="预留库存"
                value={stats.total_afn_reserved}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="入库中库存"
                value={stats.total_afn_inbound}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 操作按钮 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
            disabled={records.length === 0}
          >
            导出Excel
          </Button>
        </Col>
        <Col>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              fetchData();
              fetchStats();
            }}
          >
            刷新
          </Button>
        </Col>
        <Col>
          <Tooltip title="根据SHEIN产品信息与FBA库存进行同步，生成Excel文件。数据量大时可能需要1-2分钟处理时间。">
            <Button
              type="primary"
              icon={<FileExcelOutlined />}
              onClick={handleGenerateSheinSync}
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
              生成SHEIN库存同步文件
            </Button>
          </Tooltip>
        </Col>
      </Row>

      {/* 搜索过滤器 */}
      <Card style={{ marginBottom: 16 }}>
        <Form layout="inline" onValuesChange={handleSearch}>
          <Form.Item name="sku" label="SKU">
            <Input 
              placeholder="输入SKU搜索" 
              allowClear
              style={{ width: 150 }}
            />
          </Form.Item>
          <Form.Item name="site" label="站点">
            <Select 
              placeholder="选择站点" 
              allowClear
              style={{ width: 200 }}
            >
              {sites.map(option => (
                <Option key={option} value={option}>{option}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Card>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={records}
        rowKey="sku"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
        }}
        onChange={handleTableChange}
        scroll={{ x: 1400 }}
        size="small"
      />
    </div>
  );
};

export default FbaInventory; 