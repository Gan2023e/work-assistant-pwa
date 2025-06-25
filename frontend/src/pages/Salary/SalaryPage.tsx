import React, { useEffect, useState } from 'react';
import { Table, Card, Row, Col, Button, Radio, DatePicker, Space, message, Select, Input, ConfigProvider } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';
import zhCN from 'antd/locale/zh_CN';
import './SalaryPage.css';
dayjs.locale('zh-cn');

interface SalaryRecord {
  sku: string;
  total_quantity: number;
  total_boxes: number;
  country: string;
  time: string;
  记录号: string;
  打包员: string;
  mix_box_num: string;
 打包单价: number;
}

type DateType = 'today' | '7days' | '30days' | 'custom';

const SalaryPage: React.FC = () => {
  const [data, setData] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateType, setDateType] = useState<DateType>('today');
  const [customRange, setCustomRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [queried, setQueried] = useState(false);
  const [packers, setPackers] = useState<string[]>([]);
  const [selectedPacker, setSelectedPacker] = useState<string | undefined>(undefined);
  const [otherSalary, setOtherSalary] = useState<Record<string, number>>({});
  const [otherSalaryInput, setOtherSalaryInput] = useState<Record<string, string>>({});
  const [otherSalaryEditing, setOtherSalaryEditing] = useState<Record<string, boolean>>({});
  const [unreimbursedWages, setUnreimbursedWages] = useState<any[]>([]);
  const [unreimbursedLoading, setUnreimbursedLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedMainRowKeys, setSelectedMainRowKeys] = useState<React.Key[]>([]);
  const [mainActionLoading, setMainActionLoading] = useState(false);

  useEffect(() => {
    // 获取打包员下拉项
    fetch('/api/salary/packers').then(res => res.json()).then(res => {
      setPackers(res.data || []);
    });
    fetchUnreimbursedWages();
  }, []);

  const getDateRange = () => {
    let startDate: string | undefined;
    let endDate: string | undefined;
    const today = dayjs().startOf('day');
    if (dateType === 'today') {
      startDate = today.format('YYYY-MM-DD');
      endDate = today.endOf('day').format('YYYY-MM-DD');
    } else if (dateType === '7days') {
      startDate = today.subtract(6, 'day').format('YYYY-MM-DD');
      endDate = today.endOf('day').format('YYYY-MM-DD');
    } else if (dateType === '30days') {
      startDate = today.subtract(29, 'day').format('YYYY-MM-DD');
      endDate = today.endOf('day').format('YYYY-MM-DD');
    } else if (dateType === 'custom' && customRange[0] && customRange[1]) {
      startDate = customRange[0].startOf('day').format('YYYY-MM-DD');
      endDate = customRange[1].endOf('day').format('YYYY-MM-DD');
    }
    return { startDate, endDate };
  };

  const fetchData = async () => {
    setLoading(true);
    const { startDate, endDate } = getDateRange();
    try {
      const res = await fetch('/api/salary/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, packer: selectedPacker })
      });
      const result = await res.json();
      setData(result.data || []);
      setQueried(true);
    } catch (e) {
      message.error('数据加载失败');
      setData([]);
      setQueried(true);
    }
    setLoading(false);
  };

  const columns: ColumnsType<SalaryRecord> = [
    { title: '记录号', dataIndex: '记录号', key: '记录号', align: 'center' },
    { title: '打包员', dataIndex: '打包员', key: '打包员', align: 'center' },
    {
      title: '录入时间',
      dataIndex: 'time',
      key: 'time',
      align: 'center',
      render: (v: string) => v ? dayjs(v).format('YYYY年M月D日 HH:mm:ss') : '-'
    },
    { title: '目的国', dataIndex: 'country', key: 'country', align: 'center' },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', align: 'center' },
    { title: '箱数', dataIndex: 'total_boxes', key: 'total_boxes', align: 'center' },
    { title: '产品数量', dataIndex: 'total_quantity', key: 'total_quantity', align: 'center' },
    { title: '混合箱号', dataIndex: 'mix_box_num', key: 'mix_box_num', align: 'center' },
    {
      title: '打包单价',
      dataIndex: '打包单价',
      key: '打包单价',
      align: 'center',
      render: (v: any) => v !== null && v !== undefined ? Number(v).toFixed(2) : '-'
    },
    {
      title: '打包工资',
      key: '打包工资',
      align: 'center',
      render: (_: any, row: any) => {
        if (row.打包单价 === null || row.打包单价 === undefined) {
          return '录入打包单价';
        }
        return (Number(row.打包单价) * Number(row.total_quantity)).toFixed(2);
      }
    },
  ];

  // 统计整箱和混合箱工资
  const getSalaryStats = () => {
    // 整箱：箱数不为空，混合箱：混合箱号不为空
    const packerMap: Record<string, any> = {};
    let totalZhengxiangBoxes = 0;
    let totalZhengxiangSalary = 0;
    let totalZhengxiangFengxiangSalary = 0;
    let totalMixBoxes = 0;
    let totalMixSalary = 0;
    let totalMixFengxiangSalary = 0;
    const mixBoxNumSet = new Set();
    data.forEach(row => {
      const packer = row.打包员 || '未指定';
      if (!packerMap[packer]) {
        packerMap[packer] = {
          zhengxiangBoxes: 0,
          zhengxiangSalary: 0,
          zhengxiangFengxiangSalary: 0,
          mixBoxNums: new Set(),
          mixSalary: 0,
          mixFengxiangSalary: 0
        };
      }
      // 整箱
      if ((row.total_boxes !== null && row.total_boxes !== undefined && String(row.total_boxes).trim() !== '') && (row.mix_box_num === null || row.mix_box_num === undefined)) {
        packerMap[packer].zhengxiangBoxes += Number(row.total_boxes) || 0;
        packerMap[packer].zhengxiangSalary += (row.打包单价 !== null && row.打包单价 !== undefined) ? Number(row.打包单价) * Number(row.total_quantity) : 0;
        packerMap[packer].zhengxiangFengxiangSalary += (Number(row.total_boxes) || 0) * 5;
        totalZhengxiangBoxes += Number(row.total_boxes) || 0;
        totalZhengxiangSalary += (row.打包单价 !== null && row.打包单价 !== undefined) ? Number(row.打包单价) * Number(row.total_quantity) : 0;
        totalZhengxiangFengxiangSalary += (Number(row.total_boxes) || 0) * 5;
      }
      // 混合箱
      if (row.mix_box_num) {
        packerMap[packer].mixBoxNums.add(row.mix_box_num);
        packerMap[packer].mixSalary += (row.打包单价 !== null && row.打包单价 !== undefined) ? Number(row.打包单价) * Number(row.total_quantity) : 0;
        mixBoxNumSet.add(row.mix_box_num);
        totalMixSalary += (row.打包单价 !== null && row.打包单价 !== undefined) ? Number(row.打包单价) * Number(row.total_quantity) : 0;
      }
    });
    
    // 确保选择的打包员即使没有打包封箱数据也要包含在packerMap中
    if (selectedPacker && !packerMap[selectedPacker]) {
      packerMap[selectedPacker] = {
        zhengxiangBoxes: 0,
        zhengxiangSalary: 0,
        zhengxiangFengxiangSalary: 0,
        mixBoxNums: new Set(),
        mixSalary: 0,
        mixFengxiangSalary: 0
      };
    }
    
    // 统计混合箱封箱工资
    totalMixBoxes = mixBoxNumSet.size;
    totalMixFengxiangSalary = totalMixBoxes * 5;
    Object.values(packerMap).forEach((v: any, idx) => {
      v.mixFengxiangSalary = v.mixBoxNums.size * 5;
      // 叠加其他工资
      const packerName = Object.keys(packerMap)[idx];
      v.otherSalary = otherSalary[packerName] || 0;
    });
    return {
      packerMap,
      totalZhengxiangBoxes,
      totalZhengxiangSalary,
      totalZhengxiangFengxiangSalary,
      totalMixBoxes,
      totalMixSalary,
      totalMixFengxiangSalary,
      totalOtherSalary: Object.values(otherSalary).reduce((a, b) => a + b, 0)
    };
  };

  const salaryStats = getSalaryStats();

  // 计算未报销工资总额
  const getUnreimbursedTotal = () => {
    return unreimbursedWages.reduce((total, wage) => {
      return total + Number(wage.wage || 0);
    }, 0);
  };

  const fetchUnreimbursedWages = async () => {
    setUnreimbursedLoading(true);
    try {
      const res = await fetch('/api/salary/unreimbursed_wages');
      const result = await res.json();
      setUnreimbursedWages(result.data || []);
    } catch (e) {
      setUnreimbursedWages([]);
    }
    setUnreimbursedLoading(false);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  const isToday = (dateStr: string) => {
    return dayjs(dateStr).isSame(dayjs(), 'day');
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await fetch('/api/salary/delete_wages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedRowKeys }),
      });
      message.success('删除成功');
      setSelectedRowKeys([]);
      fetchUnreimbursedWages();
    } catch {
      message.error('删除失败');
    }
    setActionLoading(false);
  };

  const handleMarkReimbursed = async () => {
    setActionLoading(true);
    try {
      await fetch('/api/salary/mark_reimbursed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedRowKeys }),
      });
      message.success('标记成功');
      setSelectedRowKeys([]);
      fetchUnreimbursedWages();
    } catch {
      message.error('标记失败');
    }
    setActionLoading(false);
  };

  const mainRowSelection: TableRowSelection<SalaryRecord> = {
    type: 'radio',
    selectedRowKeys: selectedMainRowKeys,
    onChange: (keys: React.Key[], rows: any[]) => setSelectedMainRowKeys(keys),
  };

  const handleMainDelete = async () => {
    if (selectedMainRowKeys.length !== 1) return;
    setMainActionLoading(true);
    try {
      await fetch('/api/salary/delete_box_record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 记录号: selectedMainRowKeys[0] }),
      });
      message.success('删除成功');
      setSelectedMainRowKeys([]);
      fetchData();
    } catch {
      message.error('删除失败');
    }
    setMainActionLoading(false);
  };

  return (
    <ConfigProvider locale={zhCN}>
      <div style={{ padding: 24 }}>
        <Card style={{ marginBottom: 16 }}>
          <Space>
            <span>打包员：</span>
            <Select
              showSearch
              allowClear
              style={{ minWidth: 160 }}
              placeholder="全部打包员"
              value={selectedPacker}
              onChange={v => setSelectedPacker(v)}
              options={packers.map(p => ({ label: p, value: p }))}
              optionFilterProp="label"
            />
            <span>统计日期：</span>
            <Radio.Group
              value={dateType}
              onChange={e => setDateType(e.target.value)}
            >
              <Radio.Button value="today">今天</Radio.Button>
              <Radio.Button value="7days">过去7天</Radio.Button>
              <Radio.Button value="30days">过去30天</Radio.Button>
              <Radio.Button value="custom">自定义</Radio.Button>
            </Radio.Group>
            {dateType === 'custom' && (
              <DatePicker.RangePicker
                value={customRange}
                onChange={v => setCustomRange(v as [Dayjs, Dayjs])}
                allowClear={false}
                style={{ minWidth: 240 }}
                format="YYYY-MM-DD"
                placeholder={["开始日期", "结束日期"]}
              />
            )}
            <Button type="primary" onClick={fetchData} loading={loading} style={{ marginLeft: 16 }}>计算工资</Button>
            {selectedPacker && !queried && (
              <span style={{ marginLeft: 16, fontSize: 13, color: '#1890ff' }}>
                选择打包员后点击"计算工资"可录入其他工资
              </span>
            )}
            <Button
              danger
              disabled={selectedMainRowKeys.length !== 1}
              loading={mainActionLoading}
              onClick={handleMainDelete}
              style={{ marginLeft: 8 }}
            >删除</Button>
          </Space>
        </Card>
      <Row gutter={16}>
        <Col span={18}>
          {queried && (
            data.length > 0 ? (
              <Table
                columns={columns}
                dataSource={data}
                rowKey="记录号"
                loading={loading}
                bordered
                rowSelection={mainRowSelection}
                pagination={{ defaultPageSize: 20, showTotal: t => `共 ${t} 条` }}
              />
            ) : (
              <div style={{ padding: 48, textAlign: 'center', color: '#888' }}>没有数据</div>
            )
          )}
        </Col>
        <Col span={6}>
          <Card 
            title="未报销工资总额" 
            bordered={false} 
            style={{ marginBottom: 16, backgroundColor: '#fff2e8', borderColor: '#ffc53d' }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#d46b08', marginBottom: 4 }}>
                ¥{getUnreimbursedTotal().toFixed(2)}
              </div>
              <div style={{ fontSize: 14, color: '#8c8c8c' }}>
                共 {unreimbursedWages.length} 条未报销记录
              </div>
            </div>
          </Card>
          <Card title="工资统计" bordered={false}>
            {selectedPacker ? (
              <>
                <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#1890ff' }}>
                  {selectedPacker} 的工资统计
                </div>
                <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f0f8ff', borderRadius: 6, border: '1px dashed #1890ff' }}>
                  <div style={{ fontWeight: 500, marginBottom: 8, color: '#333' }}>其他工资录入</div>
                  <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                    用于录入非打包封箱工资，如：搬运费、加班费、临时工作等
                  </div>
                  {otherSalaryEditing[selectedPacker] ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Input
                        style={{ width: 120 }}
                        value={otherSalaryInput[selectedPacker] || ''}
                        onChange={e => setOtherSalaryInput(s => ({ ...s, [selectedPacker]: e.target.value }))}
                        type="number"
                        min={0}
                        placeholder="输入金额"
                        addonAfter="元"
                      />
                      <Button size="small" type="primary"
                        onClick={() => {
                          const val = Number(otherSalaryInput[selectedPacker] || 0);
                          setOtherSalary(s => ({ ...s, [selectedPacker]: val }));
                          setOtherSalaryEditing(s => ({ ...s, [selectedPacker]: false }));
                          message.success(`已为 ${selectedPacker} 添加其他工资 ¥${val.toFixed(2)}`);
                        }}>
                        确认
                      </Button>
                      <Button size="small" onClick={() => {
                        setOtherSalaryInput(s => ({ ...s, [selectedPacker]: '' }));
                        setOtherSalaryEditing(s => ({ ...s, [selectedPacker]: false }));
                      }}>取消</Button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>
                        当前其他工资：
                        <span style={{ fontWeight: 500, color: '#1890ff' }}>
                          {otherSalary[selectedPacker] ? `¥${otherSalary[selectedPacker].toFixed(2)}` : '¥0.00'}
                        </span>
                      </span>
                      <Button size="small" type="primary" ghost
                        onClick={() => setOtherSalaryEditing(s => ({ ...s, [selectedPacker]: true }))}>
                        {otherSalary[selectedPacker] ? '修改' : '添加'}
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>按打包员统计</div>
            )}
            {Object.entries(salaryStats.packerMap)
              .filter(([packer]) => !selectedPacker || packer === selectedPacker)
              .map(([packer, v]: any) => (
              <div key={packer} style={{ marginBottom: 12, borderBottom: '1px solid #eee', paddingBottom: 4 }}>
                <div style={{ fontWeight: 500 }}>{packer}</div>
                {v.zhengxiangSalary > 0 && (
                  <div style={{ fontSize: 13, color: '#666', marginLeft: 8 }}>
                    整箱工资：{v.zhengxiangSalary.toFixed(2)} 元（打包工资），{v.zhengxiangFengxiangSalary.toFixed(2)} 元（封箱工资），箱数：{v.zhengxiangBoxes}
                  </div>
                )}
                {v.mixSalary > 0 && (
                  <div style={{ fontSize: 13, color: '#666', marginLeft: 8 }}>
                    混合箱工资：{v.mixSalary.toFixed(2)} 元（打包工资），{v.mixFengxiangSalary.toFixed(2)} 元（封箱工资），混合箱数：{v.mixBoxNums.size}
                  </div>
                )}
                <div style={{ margin: '8px 0 4px 8px', fontSize: 13, color: '#333' }}>
                  <span style={{ fontWeight: 500 }}>其他工资：</span>
                  <span style={{ marginLeft: 8 }}>{v.otherSalary ? v.otherSalary.toFixed(2) + ' 元' : '0.00 元'}</span>
                  {selectedPacker && selectedPacker === packer && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#1890ff' }}>
                      ↑ 可在上方录入区域修改
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 500, color: '#1a1a1a', marginLeft: 8, marginTop: 4 }}>
                  小计：{(v.zhengxiangSalary + v.zhengxiangFengxiangSalary + v.mixSalary + v.mixFengxiangSalary + (v.otherSalary || 0)).toFixed(2)} 元
                </div>
                {/* 只有在总工资大于0时才显示录入系统按钮 */}
                {(v.zhengxiangSalary + v.zhengxiangFengxiangSalary + v.mixSalary + v.mixFengxiangSalary + (v.otherSalary || 0)) > 0 && (
                  <div style={{ marginLeft: 8, marginTop: 8 }}>
                    <Button size="small" type="primary"
                      onClick={async () => {
                        const wage = (v.zhengxiangSalary + v.zhengxiangFengxiangSalary + v.mixSalary + v.mixFengxiangSalary + (v.otherSalary || 0));
                        
                        // 显示 loading 提示
                        const loadingMessage = message.loading('正在录入工资数据...', 0);
                        
                        try {
                          const res = await fetch('/api/salary/record_wage', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: packer, wage })
                          });
                          
                          // 关闭 loading 提示
                          loadingMessage();
                          
                          const result = await res.json();
                          if (result.code === 0) {
                            message.success(`工资录入成功！${packer}: ¥${wage.toFixed(2)}`, 3);
                            fetchUnreimbursedWages();
                          } else {
                            message.error(result.message || '录入失败，请重试', 3);
                          }
                        } catch (e) {
                          // 关闭 loading 提示
                          loadingMessage();
                          message.error('网络错误，录入失败', 3);
                          console.error('录入工资失败:', e);
                        }
                      }}
                    >录入系统</Button>
                  </div>
                )}
              </div>
            ))}
            <div style={{ fontWeight: 'bold', marginTop: 16 }}>全部汇总</div>
            <div style={{ fontSize: 14, color: '#333', marginLeft: 8 }}>
              工资总计：{(salaryStats.totalZhengxiangSalary + salaryStats.totalZhengxiangFengxiangSalary + salaryStats.totalMixSalary + salaryStats.totalMixFengxiangSalary + salaryStats.totalOtherSalary).toFixed(2)} 元
            </div>
          </Card>
          <Card title="未报销工资记录" bordered={false} style={{ marginTop: 24 }}>
            <div style={{ marginBottom: 12 }}>
              <Button
                type="primary"
                danger
                disabled={selectedRowKeys.length === 0}
                loading={actionLoading}
                onClick={handleDelete}
                style={{ marginRight: 8 }}
              >删除</Button>
              <Button
                type="primary"
                disabled={selectedRowKeys.length === 0}
                loading={actionLoading}
                onClick={handleMarkReimbursed}
                style={{ marginRight: 8 }}
              >标记已报销</Button>
              <Button onClick={fetchUnreimbursedWages}>刷新</Button>
            </div>
            <Table
              dataSource={unreimbursedWages}
              loading={unreimbursedLoading}
              rowKey={record => record.id || `${record.name}_${record.time}`}
              size="small"
              pagination={false}
              rowSelection={rowSelection}
              rowClassName={record => isToday(record.time) ? 'highlight-today-row' : ''}
              columns={[
                { title: '记录号', dataIndex: 'id', key: 'id', align: 'center' },
                { title: '姓名', dataIndex: 'name', key: 'name', align: 'center' },
                { title: '工资', dataIndex: 'wage', key: 'wage', align: 'center', render: (v: any) => Number(v).toFixed(2) },
                { title: '录入时间', dataIndex: 'time', key: 'time', align: 'center', render: (v: string) => v ? dayjs(v).format('YYYY年M月D日 HH:mm:ss') : '-' },
                { title: '报销状态', dataIndex: 'return', key: 'return', align: 'center' }
              ]}
              locale={{ emptyText: '暂无未报销记录' }}
            />
          </Card>
        </Col>
      </Row>
      </div>
    </ConfigProvider>
  );
};

export default SalaryPage; 