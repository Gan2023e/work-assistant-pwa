import React, { useState, useEffect } from 'react';
import { Card, Statistic, Progress, Table, Tag, Space, Button, message } from 'antd';
import { 
  DashboardOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  SyncOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { API_BASE_URL } from '../config/api';

interface TaskStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  activeTasks: number;
  avgProcessingTime: number;
  maxConcurrentTasks: number;
  currentActiveTasks: number;
}

interface Task {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

const PerformanceMonitor: React.FC = () => {
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/product_weblink/task-stats`);
      const result = await response.json();
      if (result.code === 0) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('获取性能统计失败:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/product_weblink/tasks`);
      const result = await response.json();
      if (result.code === 0) {
        setTasks(result.data);
      }
    } catch (error) {
      console.error('获取任务列表失败:', error);
    }
  };

  const refreshData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchStats(), fetchTasks()]);
      message.success('数据已刷新');
    } catch (error) {
      message.error('刷新失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    // 每5秒自动刷新
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'processing': return 'processing';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'failed': return '失败';
      case 'processing': return '处理中';
      case 'pending': return '等待中';
      default: return '未知';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const columns = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 200,
      render: (id: string) => (
        <code style={{ fontSize: '12px' }}>{id.substring(0, 20)}...</code>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 150,
      render: (progress: number, record: Task) => (
        <Progress 
          percent={progress} 
          size="small" 
          status={record.status === 'failed' ? 'exception' : 'normal'}
        />
      ),
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (time: string) => new Date(time).toLocaleTimeString(),
    },
    {
      title: '耗时',
      key: 'duration',
      width: 100,
      render: (record: Task) => {
        if (record.status === 'processing' && record.startedAt) {
          const duration = Date.now() - new Date(record.startedAt).getTime();
          return formatDuration(duration);
        }
        if (record.status === 'completed' && record.startedAt && record.completedAt) {
          const duration = new Date(record.completedAt).getTime() - new Date(record.startedAt).getTime();
          return formatDuration(duration);
        }
        return '-';
      },
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Card 
        title={
          <Space>
            <DashboardOutlined />
            <span>后台处理性能监控</span>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={refreshData} 
              loading={loading}
              size="small"
            >
              刷新
            </Button>
          </Space>
        }
        style={{ marginBottom: '20px' }}
      >
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            <Statistic
              title="总任务数"
              value={stats.totalTasks}
              prefix={<DashboardOutlined />}
            />
            <Statistic
              title="已完成"
              value={stats.completedTasks}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
            <Statistic
              title="处理中"
              value={stats.activeTasks}
              valueStyle={{ color: '#1890ff' }}
              prefix={<SyncOutlined spin />}
            />
            <Statistic
              title="失败"
              value={stats.failedTasks}
              valueStyle={{ color: '#cf1322' }}
              prefix={<CloseCircleOutlined />}
            />
            <Statistic
              title="平均处理时间"
              value={formatDuration(stats.avgProcessingTime)}
              prefix={<ClockCircleOutlined />}
            />
            <Statistic
              title="最大并发数"
              value={stats.maxConcurrentTasks}
              suffix={`/ ${stats.currentActiveTasks} 当前`}
            />
          </div>
        )}
      </Card>

      <Card title="任务列表" style={{ marginBottom: '20px' }}>
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
          scroll={{ x: 800 }}
        />
      </Card>

      <Card title="性能优化说明" size="small">
        <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
          <p><strong>🚀 性能优化措施：</strong></p>
          <ul>
            <li><strong>并发处理：</strong>支持最多3个任务同时处理，提升整体吞吐量</li>
            <li><strong>智能解析：</strong>大文件（&gt;2MB）只解析前5页，小文件解析前10页</li>
            <li><strong>数据库优化：</strong>使用事务和行锁避免并发冲突</li>
            <li><strong>超时保护：</strong>任务处理超时5分钟自动失败，避免资源浪费</li>
            <li><strong>错误恢复：</strong>PDF解析失败不影响文件上传，返回空结果继续处理</li>
          </ul>
          <p><strong>📊 监控指标：</strong></p>
          <ul>
            <li><strong>平均处理时间：</strong>显示所有已完成任务的平均处理时间</li>
            <li><strong>并发状态：</strong>显示当前活跃任务数和最大并发限制</li>
            <li><strong>任务状态：</strong>实时显示每个任务的处理进度和状态</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default PerformanceMonitor;
