interface UploadTask {
  id: string;
  fileName: string;
  status: 'uploading' | 'processing' | 'cancelling' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  result?: any;
  error?: string;
  startTime: Date;
  endTime?: Date;
  ossPath?: string; // OSS文件路径，用于取消时删除
}

// WebSocket消息类型定义
interface TaskProgressMessage {
  type: 'taskProgress';
  taskId: string;
  progress: number;
  message: string;
  timestamp: string;
}

interface TaskCompletedMessage {
  type: 'taskCompleted';
  taskId: string;
  result: any;
  timestamp: string;
}

interface TaskFailedMessage {
  type: 'taskFailed';
  taskId: string;
  error: string;
  timestamp: string;
}

interface UploadProgressCallback {
  (task: UploadTask): void;
}

class UploadProgressManager {
  private tasks = new Map<string, UploadTask>();
  private callbacks = new Set<UploadProgressCallback>();
  private wsManager: any = null;

  constructor() {
    this.initializeWebSocket();
  }

  // 初始化WebSocket连接
  private async initializeWebSocket() {
    try {
      const { getWebSocketManager } = await import('./websocketManager');
      this.wsManager = getWebSocketManager();
      
      // 监听任务进度更新
      this.wsManager.onTaskProgress((message: TaskProgressMessage) => {
        this.updateTaskProgress(message.taskId, message.progress, message.message);
      });

      // 监听任务完成
      this.wsManager.onTaskCompleted((message: TaskCompletedMessage) => {
        this.completeTask(message.taskId, message.result);
      });

      // 监听任务失败
      this.wsManager.onTaskFailed((message: TaskFailedMessage) => {
        this.failTask(message.taskId, message.error);
      });

      // 连接WebSocket
      await this.wsManager.connect();
    } catch (error) {
      console.error('❌ WebSocket初始化失败:', error);
    }
  }

  // 添加上传任务
  addTask(id: string, fileName: string, ossPath?: string): UploadTask {
    const task: UploadTask = {
      id,
      fileName,
      status: 'uploading',
      progress: 0,
      message: '开始上传...',
      startTime: new Date(),
      ossPath
    };

    this.tasks.set(id, task);
    this.notifyCallbacks(task);
    return task;
  }

  // 更新任务进度
  updateTaskProgress(taskId: string, progress: number, message: string) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'processing';
      task.progress = progress;
      task.message = message;
      this.notifyCallbacks(task);
    }
  }

  // 完成任务
  completeTask(taskId: string, result: any) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.progress = 100;
      task.message = '处理完成';
      task.result = result;
      task.endTime = new Date();
      this.notifyCallbacks(task);
    }
  }

  // 任务失败
  failTask(taskId: string, error: string) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'failed';
      task.message = `处理失败: ${error}`;
      task.error = error;
      task.endTime = new Date();
      this.notifyCallbacks(task);
    }
  }

  // 取消任务
  async cancelTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (task) {
      // 立即更新状态为取消中
      task.status = 'cancelling';
      task.message = '正在取消...';
      this.notifyCallbacks(task);
      
      // 如果有OSS文件路径，尝试删除OSS文件
      if (task.ossPath) {
        try {
          await this.deleteOssFile(task.ossPath);
          console.log(`✅ 已删除OSS文件: ${task.ossPath}`);
        } catch (error) {
          console.error(`❌ 删除OSS文件失败: ${task.ossPath}`, error);
        }
      }
      
      // 更新为已取消状态
      task.status = 'cancelled';
      task.message = '已取消';
      task.progress = 0; // 重置进度为0
      task.endTime = new Date();
      this.notifyCallbacks(task);
      
      // 立即清理已取消的任务，不延迟
      setTimeout(() => {
        this.tasks.delete(taskId);
        this.notifyCallbacks(task); // 通知UI更新
      }, 1000); // 缩短到1秒
    }
  }

  // 删除OSS文件
  private async deleteOssFile(ossPath: string): Promise<void> {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001'}/api/product_weblink/delete-oss-file`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath: ossPath }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.code !== 0) {
        throw new Error(result.message || '删除文件失败');
      }
    } catch (error) {
      console.error('删除OSS文件失败:', error);
      throw error;
    }
  }

  // 获取任务
  getTask(taskId: string): UploadTask | undefined {
    return this.tasks.get(taskId);
  }

  // 获取所有任务
  getAllTasks(): UploadTask[] {
    return Array.from(this.tasks.values());
  }

  // 获取进行中的任务
  getActiveTasks(): UploadTask[] {
    return this.getAllTasks().filter(task => 
      task.status === 'uploading' || task.status === 'processing'
    );
  }

  // 清理已完成的任务
  cleanupCompletedTasks() {
    const completedTasks = this.getAllTasks().filter(task => 
      task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'
    );

    // 保留最近50个已完成的任务
    if (completedTasks.length > 50) {
      const sortedTasks = completedTasks.sort((a, b) => 
        (b.endTime?.getTime() || 0) - (a.endTime?.getTime() || 0)
      );
      
      const toRemove = sortedTasks.slice(50);
      toRemove.forEach(task => {
        this.tasks.delete(task.id);
      });
    }
  }

  // 添加进度回调
  addProgressCallback(callback: UploadProgressCallback) {
    this.callbacks.add(callback);
  }

  // 移除进度回调
  removeProgressCallback(callback: UploadProgressCallback) {
    this.callbacks.delete(callback);
  }

  // 通知所有回调
  private notifyCallbacks(task: UploadTask) {
    this.callbacks.forEach(callback => {
      try {
        callback(task);
      } catch (error) {
        console.error('❌ 进度回调执行失败:', error);
      }
    });
  }

  // 获取统计信息
  getStats() {
    const allTasks = this.getAllTasks();
    const activeTasks = this.getActiveTasks();
    
    return {
      total: allTasks.length,
      active: activeTasks.length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      failed: allTasks.filter(t => t.status === 'failed').length,
      cancelled: allTasks.filter(t => t.status === 'cancelled').length
    };
  }

  // 清理单个任务
  clearTask(taskId: string) {
    this.tasks.delete(taskId);
  }

  // 清理所有任务
  clearAllTasks() {
    this.tasks.clear();
  }
}

// 创建全局上传进度管理器实例
let uploadProgressManagerInstance: UploadProgressManager | null = null;

export const getUploadProgressManager = (): UploadProgressManager => {
  if (!uploadProgressManagerInstance) {
    uploadProgressManagerInstance = new UploadProgressManager();
  }
  return uploadProgressManagerInstance;
};

export default UploadProgressManager;
