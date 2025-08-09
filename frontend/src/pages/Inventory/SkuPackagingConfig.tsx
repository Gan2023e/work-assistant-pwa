import React, { useState, useEffect } from 'react';
import { Table, Card, Input, Button, message, Space, InputNumber, Popconfirm, Tag, Statistic, Row, Col } from 'antd';
import { SearchOutlined, SaveOutlined, EditOutlined, UndoOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { API_BASE_URL } from '../../config/api';

interface SkuPackagingRecord {
  skuid: number;
  parent_sku: string;
  child_sku: string;
  sellercolorname?: string;
  sellersizename?: string;
  qty_per_box?: number;
}

interface EditingRecord {
  [key: number]: {
    qty_per_box?: number;
  };
}

const SkuPackagingConfig: React.FC = () => {
  const [data, setData] = useState<SkuPackagingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [editing, setEditing] = useState<EditingRecord>({});
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });

  // 统计数据
  const [stats, setStats] = useState({
    totalSkus: 0,
    configuredSkus: 0,
    unconfiguredSkus: 0,
  });

  // 通用API调用函数
  const apiCall = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  };

  useEffect(() => {
    fetchData();
  }, [pagination.current, pagination.pageSize, searchValue]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.current.toString(),
        limit: pagination.pageSize.toString(),
        ...(searchValue && { search: searchValue }),
      });

      const result = await apiCall(`${API_BASE_URL}/api/inventory/sku-packaging?${params}`);

      if (result.code === 0) {
        setData(result.data.list);
        setPagination(prev => ({
          ...prev,
          total: result.data.total,
        }));

        // 计算统计数据
        const configured = result.data.list.filter((item: SkuPackagingRecord) => item.qty_per_box && item.qty_per_box > 0).length;
        setStats({
          totalSkus: result.data.total,
          configuredSkus: configured,
          unconfiguredSkus: result.data.total - configured,
        });
      } else {
        message.error(result.message || '获取数据失败');
      }
    } catch (error) {
      console.error('获取SKU装箱配置失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: SkuPackagingRecord) => {
    setEditing({
      ...editing,
      [record.skuid]: {
        qty_per_box: record.qty_per_box || 1,
      },
    });
  };

  const handleCancel = (skuid: number) => {
    const newEditing = { ...editing };
    delete newEditing[skuid];
    setEditing(newEditing);
  };

  const handleSave = async (record: SkuPackagingRecord) => {
    const editData = editing[record.skuid];
    if (!editData || !editData.qty_per_box || editData.qty_per_box < 1) {
      message.error('装箱数量必须大于0');
      return;
    }

    try {
      const result = await apiCall(`${API_BASE_URL}/api/inventory/sku-packaging/${record.skuid}`, {
        method: 'PUT',
        body: JSON.stringify({
          qty_per_box: editData.qty_per_box,
        }),
      });
      if (result.code === 0) {
        message.success('保存成功');
        handleCancel(record.skuid);
        fetchData();
      } else {
        message.error(result.message || '保存失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    }
  };

  const handleBatchSave = async () => {
    const updates = Object.entries(editing).map(([skuid, data]) => ({
      skuid: parseInt(skuid),
      qty_per_box: data.qty_per_box,
    }));

    if (updates.length === 0) {
      message.warning('没有需要保存的修改');
      return;
    }

    try {
      const result = await apiCall(`${API_BASE_URL}/api/inventory/sku-packaging/batch`, {
        method: 'PUT',
        body: JSON.stringify({ updates }),
      });
      if (result.code === 0) {
        message.success(result.message);
        setEditing({});
        fetchData();
      } else {
        message.error(result.message || '批量保存失败');
      }
    } catch (error) {
      console.error('批量保存失败:', error);
      message.error('批量保存失败');
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchData();
  };

  const columns: ColumnsType<SkuPackagingRecord> = [
    {
      title: '父SKU',
      dataIndex: 'parent_sku',
      key: 'parent_sku',
      width: 150,
      fixed: 'left',
    },
    {
      title: '子SKU',
      dataIndex: 'child_sku',
      key: 'child_sku',
      width: 150,
      fixed: 'left',
    },
    {
      title: '颜色',
      dataIndex: 'sellercolorname',
      key: 'sellercolorname',
      width: 100,
      render: (value) => value || '-',
    },
    {
      title: '尺寸',
      dataIndex: 'sellersizename',
      key: 'sellersizename',
      width: 100,
      render: (value) => value || '-',
    },
    {
      title: '装箱数量',
      dataIndex: 'qty_per_box',
      key: 'qty_per_box',
      width: 150,
      render: (value, record) => {
        const isEditing = editing[record.skuid];
        
        if (isEditing) {
          return (
            <InputNumber
              min={1}
              value={isEditing.qty_per_box}
              onChange={(val) => setEditing({
                ...editing,
                [record.skuid]: { qty_per_box: val || 1 }
              })}
              style={{ width: '100%' }}
            />
          );
        }

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {value ? (
              <Tag color="blue">{value} 个/箱</Tag>
            ) : (
              <Tag color="red">未配置</Tag>
            )}
          </div>
        );
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => {
        const hasConfig = record.qty_per_box && record.qty_per_box > 0;
        return (
          <Tag color={hasConfig ? 'green' : 'orange'}>
            {hasConfig ? '已配置' : '待配置'}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => {
        const isEditing = editing[record.skuid];
        
        if (isEditing) {
          return (
            <Space>
              <Button
                type="primary"
                size="small"
                icon={<SaveOutlined />}
                onClick={() => handleSave(record)}
              >
                保存
              </Button>
              <Button
                size="small"
                icon={<UndoOutlined />}
                onClick={() => handleCancel(record.skuid)}
              >
                取消
              </Button>
            </Space>
          );
        }

        return (
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic title="总SKU数量" value={stats.totalSkus} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="已配置" value={stats.configuredSkus} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="待配置" value={stats.unconfiguredSkus} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      <Card title="SKU装箱数量配置">
        {/* 工具栏 */}
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Input
              placeholder="搜索SKU"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 200 }}
              suffix={<SearchOutlined />}
            />
            <Button onClick={handleSearch}>搜索</Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => {
                setSearchValue('');
                setPagination(prev => ({ ...prev, current: 1 }));
                fetchData();
              }}
            >
              重置
            </Button>
            {Object.keys(editing).length > 0 && (
              <>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleBatchSave}
                >
                  批量保存 ({Object.keys(editing).length})
                </Button>
                <Button
                  onClick={() => setEditing({})}
                >
                  取消所有编辑
                </Button>
              </>
            )}
          </Space>
        </div>

        {/* 表格 */}
        <Table
          columns={columns}
          dataSource={data}
          rowKey="skuid"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination(prev => ({
                ...prev,
                current: page,
                pageSize: pageSize || 50,
              }));
            },
          }}
          scroll={{ x: 800 }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default SkuPackagingConfig; 