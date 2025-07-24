import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  InputNumber, 
  message, 
  Space, 
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Popconfirm,
  Tooltip,
  Tabs,
  Badge,
  Collapse,
  Divider,
  Select
} from 'antd';
import { 
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ExportOutlined,
  InboxOutlined,
  BoxPlotOutlined,
  GlobalOutlined,
  EyeOutlined,
  AppstoreOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';

const { Option } = Select;
const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Panel } = Collapse;

// 混合箱数据接口
interface MixedBoxData {
  mix_box_num: string;
  country: string;
  total_quantity: number;
  sku_count: number;
  skus: Array<{
    sku: string;
    quantity: number;
    record_num: string;
  }>;
  created_at: string;
  operator: string;
  marketplace: string;
}

// 整箱数据接口
interface WholeBoxData {
  sku: string;
  country: string;
  total_quantity: number;
  total_boxes: number;
  created_at: string;
  operator: string;
  marketplace: string;
  records: Array<{
    record_num: string;
    quantity: number;
    boxes: number;
  }>;
}

// 混合箱详情接口
interface MixedBoxDetail {
  记录号: string;
  sku: string;
  amz_sku: string;
  total_quantity: number;
  site: string;
  time: string;
  操作员: string;
  marketPlace: string;
}

// 国家库存汇总接口
interface CountryInventory {
  country: string;
  whole_box_quantity: number;
  whole_box_count: number;
  mixed_box_quantity: number;
  mixed_box_count: number;
  total_quantity: number;
}

const PendingInventoryPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mixedBoxData, setMixedBoxData] = useState<MixedBoxData[]>([]);
  const [wholeBoxData, setWholeBoxData] = useState<WholeBoxData[]>([]);
  const [countryInventory, setCountryInventory] = useState<CountryInventory[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('mixed-boxes');

  // 混合箱详情相关状态
  const [mixedBoxDetailVisible, setMixedBoxDetailVisible] = useState(false);
  const [mixedBoxDetails, setMixedBoxDetails] = useState<MixedBoxDetail[]>([]);
  const [currentMixedBoxNum, setCurrentMixedBoxNum] = useState<string>('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MixedBoxDetail | null>(null);
  const [editForm] = Form.useForm();

  // 分页状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  // 获取混合箱库存数据
  const fetchMixedBoxInventory = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });
      
      if (selectedCountry) {
        queryParams.append('country', selectedCountry);
      }

      const response = await fetch(`${API_BASE_URL}/api/shipping/mixed-box-inventory?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.code === 0) {
        setMixedBoxData(result.data.mixed_boxes || []);
        setWholeBoxData(result.data.whole_boxes || []);
        setPagination(prev => ({
          ...prev,
          current: page,
          total: result.data.pagination?.total || 0
        }));
        
        message.success(`加载了 ${result.data.mixed_boxes?.length || 0} 个混合箱，${result.data.whole_boxes?.length || 0} 个整箱SKU`);
      } else {
        message.error(result.message || '获取数据失败');
      }
    } catch (error) {
      console.error('获取库存数据失败:', error);
      message.error(`获取数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setMixedBoxData([]);
      setWholeBoxData([]);
    } finally {
      setLoading(false);
    }
  };

  // 获取国家库存汇总数据
  const fetchCountryInventory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/inventory-by-country`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.code === 0) {
        setCountryInventory(result.data || []);
      } else {
        console.error('获取国家库存数据失败:', result.message);
      }
    } catch (error) {
      console.error('获取国家库存数据失败:', error);
    }
  };

  // 获取混合箱详情
  const fetchMixedBoxDetails = async (mixBoxNum: string, country?: string) => {
    try {
      const queryParams = new URLSearchParams();
      if (country) {
        queryParams.append('country', country);
      }

      const response = await fetch(`${API_BASE_URL}/api/shipping/mixed-box-details/${encodeURIComponent(mixBoxNum)}?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.code === 0) {
        setMixedBoxDetails(result.data.items || []);
        setCurrentMixedBoxNum(mixBoxNum);
        setMixedBoxDetailVisible(true);
      } else {
        message.error(result.message || '获取混合箱详情失败');
      }
    } catch (error) {
      console.error('获取混合箱详情失败:', error);
      message.error(`获取混合箱详情失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 修改混合箱SKU数量
  const handleEditMixedBoxItem = async () => {
    if (!editingRecord) return;
    
    try {
      const values = await editForm.validateFields();
      
      const response = await fetch(`${API_BASE_URL}/api/shipping/mixed-box-item/${editingRecord.记录号}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
        body: JSON.stringify({
          total_quantity: values.total_quantity,
          operator: user?.username || '系统修改'
        }),
      });

      const result = await response.json();
      
      if (result.code === 0) {
        message.success('修改成功');
        setEditModalVisible(false);
        setEditingRecord(null);
        editForm.resetFields();
        // 重新获取混合箱详情
        if (currentMixedBoxNum) {
          await fetchMixedBoxDetails(currentMixedBoxNum);
        }
        // 重新获取主列表数据
        await fetchMixedBoxInventory();
      } else {
        message.error(result.message || '修改失败');
      }
    } catch (error) {
      console.error('修改失败:', error);
      message.error('修改失败');
    }
  };

  // 删除混合箱SKU
  const handleDeleteMixedBoxItem = async (recordNum: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/mixed-box-item/${recordNum}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
        },
      });

      const result = await response.json();
      
      if (result.code === 0) {
        message.success('删除成功');
        // 重新获取混合箱详情
        if (currentMixedBoxNum) {
          await fetchMixedBoxDetails(currentMixedBoxNum);
        }
        // 重新获取主列表数据
        await fetchMixedBoxInventory();
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 导出数据
  const exportData = () => {
    if (activeTab === 'mixed-boxes' && mixedBoxData.length === 0) {
      message.warning('没有混合箱数据可导出');
      return;
    }
    if (activeTab === 'whole-boxes' && wholeBoxData.length === 0) {
      message.warning('没有整箱数据可导出');
      return;
    }

    let exportData: any[] = [];
    let fileName = '';

    if (activeTab === 'mixed-boxes') {
      exportData = mixedBoxData.map(item => ({
        '混合箱号': item.mix_box_num,
        '国家': item.country,
        '总数量': item.total_quantity,
        'SKU种类数': item.sku_count,
        '平台': item.marketplace,
        '操作员': item.operator,
        '创建时间': new Date(item.created_at).toLocaleString('zh-CN')
      }));
      fileName = `混合箱库存_${new Date().toISOString().split('T')[0]}.xlsx`;
    } else {
      exportData = wholeBoxData.map(item => ({
        'SKU': item.sku,
        '国家': item.country,
        '总数量': item.total_quantity,
        '总箱数': item.total_boxes,
        '平台': item.marketplace,
        '操作员': item.operator,
        '创建时间': new Date(item.created_at).toLocaleString('zh-CN')
      }));
      fileName = `整箱库存_${new Date().toISOString().split('T')[0]}.xlsx`;
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab === 'mixed-boxes' ? '混合箱库存' : '整箱库存');
    XLSX.writeFile(wb, fileName);
    message.success('导出成功');
  };

  useEffect(() => {
    fetchMixedBoxInventory();
    fetchCountryInventory();
  }, [selectedCountry]);

  // 混合箱表格列定义
  const mixedBoxColumns: ColumnsType<MixedBoxData> = [
    {
      title: '混合箱号',
      dataIndex: 'mix_box_num',
      key: 'mix_box_num',
      width: 150,
      fixed: 'left',
      render: (text: string, record: MixedBoxData) => (
        <Button 
          type="link" 
          style={{ padding: 0, height: 'auto', fontSize: 'inherit' }}
          onClick={() => fetchMixedBoxDetails(text, record.country)}
        >
          <Text strong>{text}</Text>
        </Button>
      ),
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 80,
      align: 'center',
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 100,
      align: 'center',
      sorter: (a: MixedBoxData, b: MixedBoxData) => a.total_quantity - b.total_quantity,
      render: (value: number) => <Text strong>{value}</Text>
    },
    {
      title: 'SKU种类',
      dataIndex: 'sku_count',
      key: 'sku_count',
      width: 100,
      align: 'center',
      sorter: (a: MixedBoxData, b: MixedBoxData) => a.sku_count - b.sku_count,
      render: (value: number) => <Badge count={value} showZero color="green" />
    },
    {
      title: '平台',
      dataIndex: 'marketplace',
      key: 'marketplace',
      width: 100,
      render: (text: string) => <Tag color="orange">{text || '未知'}</Tag>
    },
    {
      title: '操作员',
      dataIndex: 'operator',
      key: 'operator',
      width: 100,
      render: (text: string) => text || '-'
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      sorter: (a: MixedBoxData, b: MixedBoxData) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return aTime - bTime;
      },
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    }
  ];

  // 整箱表格列定义
  const wholeBoxColumns: ColumnsType<WholeBoxData> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 150,
      fixed: 'left',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 80,
      align: 'center',
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 100,
      align: 'center',
      sorter: (a: WholeBoxData, b: WholeBoxData) => a.total_quantity - b.total_quantity,
      render: (value: number) => <Text strong>{value}</Text>
    },
    {
      title: '总箱数',
      dataIndex: 'total_boxes',
      key: 'total_boxes',
      width: 100,
      align: 'center',
      sorter: (a: WholeBoxData, b: WholeBoxData) => a.total_boxes - b.total_boxes,
      render: (value: number) => <Badge count={value} showZero color="blue" />
    },
    {
      title: '平台',
      dataIndex: 'marketplace',
      key: 'marketplace',
      width: 100,
      render: (text: string) => <Tag color="orange">{text || '未知'}</Tag>
    },
    {
      title: '操作员',
      dataIndex: 'operator',
      key: 'operator',
      width: 100,
      render: (text: string) => text || '-'
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      sorter: (a: WholeBoxData, b: WholeBoxData) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return aTime - bTime;
      },
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    }
  ];

  // 混合箱详情表格列定义
  const mixedBoxDetailColumns: ColumnsType<MixedBoxDetail> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: 'Amazon SKU',
      dataIndex: 'amz_sku',
      key: 'amz_sku',
      width: 120,
      render: (text: string) => text || '-'
    },
    {
      title: '数量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 80,
      align: 'center',
      render: (value: number) => <Text strong>{value}</Text>
    },
    {
      title: '站点',
      dataIndex: 'site',
      key: 'site',
      width: 100,
      render: (text: string) => text || '-'
    },
    {
      title: '平台',
      dataIndex: 'marketPlace',
      key: 'marketPlace',
      width: 80,
      render: (text: string) => <Tag color="orange">{text || '未知'}</Tag>
    },
    {
      title: '操作员',
      dataIndex: '操作员',
      key: 'operator',
      width: 80,
    },
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      width: 120,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="link"
              icon={<EditOutlined />}
              size="small"
              onClick={() => {
                setEditingRecord(record);
                editForm.setFieldsValue({
                  total_quantity: record.total_quantity
                });
                setEditModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确认删除"
              description="删除后无法恢复，确认删除这个SKU吗？"
              onConfirm={() => handleDeleteMixedBoxItem(record.记录号)}
              okText="确认"
              cancelText="取消"
            >
              <Button
                type="link"
                icon={<DeleteOutlined />}
                size="small"
                danger
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 计算统计数据
  const stats = {
    mixedBoxCount: mixedBoxData.length,
    mixedBoxTotalQuantity: mixedBoxData.reduce((sum, item) => sum + item.total_quantity, 0),
    wholeBoxCount: wholeBoxData.length,
    wholeBoxTotalQuantity: wholeBoxData.reduce((sum, item) => sum + item.total_quantity, 0),
    wholeBoxTotalBoxes: wholeBoxData.reduce((sum, item) => sum + item.total_boxes, 0)
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <InboxOutlined /> 待发货库存管理
      </Title>
      
      {/* 国家库存统计卡片 */}
      <Card 
        title={
          <span>
            <GlobalOutlined style={{ marginRight: 8 }} />
            按国家库存汇总
            <Text type="secondary" style={{ fontSize: '12px', marginLeft: 8 }}>
              (不含已发货记录，点击卡片筛选对应国家数据)
            </Text>
          </span>
        } 
        size="small" 
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 16]}>
          {countryInventory.map(item => (
            <Col key={item.country}>
              <div 
                style={{ 
                  cursor: 'pointer',
                  padding: '8px 16px',
                  border: `2px solid ${selectedCountry === item.country ? '#1677ff' : '#d9d9d9'}`,
                  borderRadius: '6px',
                  backgroundColor: selectedCountry === item.country ? '#f0f6ff' : '#fff',
                  transition: 'all 0.3s',
                  minWidth: '120px'
                }} 
                onClick={() => {
                  const newCountry = selectedCountry === item.country ? '' : item.country;
                  setSelectedCountry(newCountry);
                }}
              >
                <Statistic
                  title={
                    <div>
                      <Text strong>{item.country}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: '10px' }}>
                        整箱: {item.whole_box_count}箱 | 混合箱: {item.mixed_box_count}箱
                      </Text>
                    </div>
                  }
                  value={item.total_quantity}
                  valueStyle={{ 
                    color: selectedCountry === item.country ? '#1677ff' : '#666',
                    fontSize: '18px'
                  }}
                  suffix="件"
                />
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 操作栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  fetchMixedBoxInventory();
                  fetchCountryInventory();
                }}
                loading={loading}
              >
                刷新
              </Button>
              <Button
                icon={<ExportOutlined />}
                onClick={exportData}
              >
                导出Excel
              </Button>
              {selectedCountry && (
                <Button 
                  onClick={() => setSelectedCountry('')}
                  type="dashed"
                >
                  清除国家筛选: {selectedCountry}
                </Button>
              )}
            </Space>
          </Col>
          <Col>
            <Space>
              <Text type="secondary">
                当前显示: 混合箱{stats.mixedBoxCount}个, 整箱SKU{stats.wholeBoxCount}个
              </Text>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="混合箱数量"
              value={stats.mixedBoxCount}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="混合箱总产品数"
              value={stats.mixedBoxTotalQuantity}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="整箱SKU数"
              value={stats.wholeBoxCount}
              prefix={<BoxPlotOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="整箱总产品数"
              value={stats.wholeBoxTotalQuantity}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="整箱总箱数"
              value={stats.wholeBoxTotalBoxes}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 主要内容 - Tab页 */}
      <Card>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          tabBarExtraContent={
            <Space>
              <Text type="secondary">
                {selectedCountry ? `筛选国家: ${selectedCountry}` : '全部国家'}
              </Text>
            </Space>
          }
        >
          <TabPane 
            tab={
              <span>
                <AppstoreOutlined />
                混合箱管理 <Badge count={stats.mixedBoxCount} showZero />
              </span>
            } 
            key="mixed-boxes"
          >
            <Table
              columns={mixedBoxColumns}
              dataSource={mixedBoxData}
              rowKey={(record) => `${record.mix_box_num}_${record.country}`}
              loading={loading}
              pagination={{
                ...pagination,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                onChange: (page, pageSize) => {
                  setPagination(prev => ({ ...prev, current: page, pageSize: pageSize || 20 }));
                  fetchMixedBoxInventory(page, pageSize);
                }
              }}
              scroll={{ x: 1000, y: 500 }}
              size="small"
            />
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <BoxPlotOutlined />
                整箱管理 <Badge count={stats.wholeBoxCount} showZero />
              </span>
            } 
            key="whole-boxes"
          >
            <Table
              columns={wholeBoxColumns}
              dataSource={wholeBoxData}
              rowKey={(record) => `${record.sku}_${record.country}`}
              loading={loading}
              pagination={{
                ...pagination,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                onChange: (page, pageSize) => {
                  setPagination(prev => ({ ...prev, current: page, pageSize: pageSize || 20 }));
                  fetchMixedBoxInventory(page, pageSize);
                }
              }}
              scroll={{ x: 1000, y: 500 }}
              size="small"
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* 混合箱详情模态框 */}
      <Modal
        title={
          <span>
            <AppstoreOutlined style={{ marginRight: 8 }} />
            混合箱详情: {currentMixedBoxNum}
          </span>
        }
        open={mixedBoxDetailVisible}
        onCancel={() => {
          setMixedBoxDetailVisible(false);
          setMixedBoxDetails([]);
          setCurrentMixedBoxNum('');
        }}
        footer={[
          <Button key="close" onClick={() => setMixedBoxDetailVisible(false)}>
            关闭
          </Button>
        ]}
        width={1000}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            该混合箱包含 {mixedBoxDetails.length} 个SKU，总数量 {mixedBoxDetails.reduce((sum, item) => sum + item.total_quantity, 0)} 件
          </Text>
        </div>
        
        <Table
          columns={mixedBoxDetailColumns}
          dataSource={mixedBoxDetails}
          rowKey="记录号"
          pagination={false}
          scroll={{ x: 800, y: 400 }}
          size="small"
        />
      </Modal>

      {/* 编辑混合箱SKU模态框 */}
      <Modal
        title="编辑SKU数量"
        open={editModalVisible}
        onOk={handleEditMixedBoxItem}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingRecord(null);
          editForm.resetFields();
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={editForm}
          layout="vertical"
        >
          {editingRecord && (
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
              <Text strong>SKU: {editingRecord.sku}</Text>
              <br />
              <Text>Amazon SKU: {editingRecord.amz_sku}</Text>
              <br />
              <Text>混合箱号: {currentMixedBoxNum}</Text>
              <br />
              <Text type="secondary">当前数量: {editingRecord.total_quantity}</Text>
            </div>
          )}
          
          <Form.Item
            label="新数量"
            name="total_quantity"
            rules={[
              { required: true, message: '请输入数量' },
              { type: 'number', min: 1, message: '数量必须大于0' }
            ]}
          >
            <InputNumber 
              min={1}
              style={{ width: '100%' }}
              placeholder="请输入新的数量"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PendingInventoryPage; 