import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Card, 
  Progress, 
  Typography, 
  Space, 
  Badge,
  Popover,
  List,
  Tag
} from 'antd';
import { 
  LoadingOutlined, 
  CheckCircleOutlined, 
  CloseOutlined,
  MinusOutlined,
  FileExcelOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import './BackgroundTaskManager.css';

const { Text } = Typography;

export interface BackgroundTask {
  id: string;
  title: string;
  progress: number;
  currentStep: string;
  status: 'running' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
  errorMessage?: string;
  resultData?: any;
}

interface BackgroundTaskManagerProps {
  tasks: BackgroundTask[];
  onRemoveTask: (taskId: string) => void;
  onMinimize?: () => void;
}

const BackgroundTaskManager: React.FC<BackgroundTaskManagerProps> = ({
  tasks,
  onRemoveTask,
  onMinimize
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [visible, setVisible] = useState(false);

  // 如果有运行中的任务，自动显示管理器
  useEffect(() => {
    const hasRunningTasks = tasks.some(task => task.status === 'running');
    if (hasRunningTasks && !visible) {
      setVisible(true);
    }
  }, [tasks, visible]);

  const runningTasks = tasks.filter(task => task.status === 'running');
  const completedTasks = tasks.filter(task => task.status === 'completed');
  const errorTasks = tasks.filter(task => task.status === 'error');

  if (tasks.length === 0 || !visible) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <LoadingOutlined spin style={{ color: '#1890ff' }} />;
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'error':
        return <CloseOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return '#1890ff';
      case 'completed':
        return '#52c41a';
      case 'error':
        return '#ff4d4f';
      default:
        return '#666';
    }
  };

  const formatDuration = (startTime: number, endTime?: number) => {
    const duration = (endTime || Date.now()) - startTime;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}分${seconds % 60}秒`;
    }
    return `${seconds}秒`;
  };

  const taskContent = (
    <div style={{ width: 350, maxHeight: 400, overflow: 'auto' }}>
      <List
        dataSource={tasks}
        renderItem={(task) => (
          <List.Item
            actions={[
              task.status !== 'running' && (
                <Button
                  type="link"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => onRemoveTask(task.id)}
                  title="移除任务"
                />
              )
            ].filter(Boolean)}
          >
            <List.Item.Meta
              avatar={getStatusIcon(task.status)}
              title={
                <Space>
                  <span>{task.title}</span>
                  <Tag color={getStatusColor(task.status)}>
                    {task.status === 'running' ? '运行中' : 
                     task.status === 'completed' ? '已完成' : '失败'}
                  </Tag>
                </Space>
              }
              description={
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  {task.status === 'running' && (
                    <>
                      <Progress
                        percent={task.progress}
                        size="small"
                        status="active"
                        strokeColor={{
                          '0%': '#108ee9',
                          '100%': '#87d068',
                        }}
                      />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {task.currentStep}
                      </Text>
                    </>
                  )}
                  {task.status === 'completed' && (
                    <Space>
                      <Text type="success" style={{ fontSize: '12px' }}>
                        任务完成，用时 {formatDuration(task.startTime, task.endTime)}
                      </Text>
                      {task.resultData?.downloadUrl && (
                        <Button
                          type="link"
                          size="small"
                          icon={<DownloadOutlined />}
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = task.resultData.downloadUrl;
                            link.download = task.resultData.fileName || '下载文件';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                        >
                          重新下载
                        </Button>
                      )}
                    </Space>
                  )}
                  {task.status === 'error' && (
                    <Text type="danger" style={{ fontSize: '12px' }}>
                      {task.errorMessage || '任务执行失败'}
                    </Text>
                  )}
                  <Text type="secondary" style={{ fontSize: '10px' }}>
                    开始时间: {new Date(task.startTime).toLocaleTimeString()}
                  </Text>
                </Space>
              }
            />
          </List.Item>
        )}
        locale={{ emptyText: '暂无后台任务' }}
      />
    </div>
  );

  // 浮动图标模式
  if (collapsed) {
    return (
      <Popover
        content={taskContent}
        title={
          <Space>
            <FileExcelOutlined />
            <span>后台任务</span>
            <Button
              type="link"
              size="small"
              onClick={() => setCollapsed(false)}
              title="展开面板"
            >
              展开
            </Button>
          </Space>
        }
        trigger="click"
        placement="bottomRight"
        overlayStyle={{ zIndex: 1050 }}
      >
        <div className="background-task-float-icon">
          <Badge count={runningTasks.length} size="small" offset={[-5, 5]}>
            <Button
              type="primary"
              shape="circle"
              icon={runningTasks.length > 0 ? <LoadingOutlined spin /> : <FileExcelOutlined />}
              size="large"
            />
          </Badge>
        </div>
      </Popover>
    );
  }

  // 展开面板模式
  return (
    <div className="background-task-panel">
      <Card
        size="small"
        title={
          <Space>
            <FileExcelOutlined />
            <span>后台任务</span>
            <Badge count={runningTasks.length} size="small">
              <Tag color="blue">运行中</Tag>
            </Badge>
            {completedTasks.length > 0 && (
              <Badge count={completedTasks.length} size="small">
                <Tag color="green">已完成</Tag>
              </Badge>
            )}
            {errorTasks.length > 0 && (
              <Badge count={errorTasks.length} size="small">
                <Tag color="red">失败</Tag>
              </Badge>
            )}
          </Space>
        }
        extra={
          <Space>
            <Button
              type="link"
              size="small"
              icon={<MinusOutlined />}
              onClick={() => setCollapsed(true)}
              title="最小化面板"
            >
              最小化
            </Button>
            <Button
              type="link"
              size="small"
              icon={<CloseOutlined />}
              onClick={() => setVisible(false)}
              title="隐藏面板"
            >
              隐藏
            </Button>
          </Space>
        }
        style={{ width: 380 }}
      >
        {taskContent}
      </Card>
    </div>
  );
};

export default BackgroundTaskManager; 