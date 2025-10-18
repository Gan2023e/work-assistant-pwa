const EventEmitter = require('events');

class TaskQueue extends EventEmitter {
  constructor() {
    super();
    this.tasks = new Map();
    this.isProcessing = false;
    this.maxConcurrentTasks = 3; // 最大并发任务数
    this.activeTasks = new Set(); // 当前活跃任务
    this.taskTimeouts = new Map(); // 任务超时管理
  }

  // 添加任务到队列
  addTask(taskId, taskData) {
    const task = {
      id: taskId,
      data: taskData,
      status: 'pending',
      progress: 0,
      result: null,
      error: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null
    };

    this.tasks.set(taskId, task);
    this.emit('taskAdded', task);
    
    // 如果当前没有处理任务，立即开始处理
    if (!this.isProcessing) {
      this.processNext();
    }

    return task;
  }

  // 处理下一个任务（支持并发）
  async processNext() {
    // 检查是否还有空闲槽位
    if (this.activeTasks.size >= this.maxConcurrentTasks) {
      return;
    }

    const pendingTask = Array.from(this.tasks.values())
      .find(task => task.status === 'pending');

    if (!pendingTask) {
      return;
    }

    // 标记任务为活跃状态
    this.activeTasks.add(pendingTask.id);
    
    // 设置任务超时（5分钟）
    const timeout = setTimeout(() => {
      this.failTask(pendingTask.id, '任务处理超时');
    }, 5 * 60 * 1000);
    this.taskTimeouts.set(pendingTask.id, timeout);

    // 异步执行任务，不阻塞其他任务
    this.executeTask(pendingTask).finally(() => {
      this.activeTasks.delete(pendingTask.id);
      this.taskTimeouts.delete(pendingTask.id);
      // 继续处理下一个任务
      this.processNext();
    });
  }

  // 执行任务
  async executeTask(task) {
    try {
      task.status = 'processing';
      task.startedAt = new Date();
      this.emit('taskStarted', task);

      // 根据任务类型执行不同的处理逻辑
      const result = await this.processTaskByType(task);
      
      task.status = 'completed';
      task.progress = 100;
      task.result = result;
      task.completedAt = new Date();
      
      // 清除超时定时器
      const timeout = this.taskTimeouts.get(task.id);
      if (timeout) {
        clearTimeout(timeout);
        this.taskTimeouts.delete(task.id);
      }
      
      this.emit('taskCompleted', task);

    } catch (error) {
      task.status = 'failed';
      task.error = error.message || error;
      task.completedAt = new Date();
      
      // 清除超时定时器
      const timeout = this.taskTimeouts.get(task.id);
      if (timeout) {
        clearTimeout(timeout);
        this.taskTimeouts.delete(task.id);
      }
      
      // 从活跃任务中移除
      this.activeTasks.delete(task.id);
      
      this.emit('taskFailed', task);
      
      // 继续处理下一个任务
      this.processNext();
    }
  }

  // 根据任务类型处理
  async processTaskByType(task) {
    const { type, data } = task.data;

    switch (type) {
      case 'cpc-db-update':
        return await this.processCpcDbUpdate(data);
      default:
        throw new Error(`未知的任务类型: ${type}`);
    }
  }


  // 处理CPC数据库更新任务（优化版本）
  async processCpcDbUpdate(data) {
    const { recordId, fileInfo, extractedData } = data;
    
    try {
      this.updateTaskProgress(data.taskId, 20, '准备数据库更新...');
      
      const { ProductWeblink } = require('../models');
      
      // 使用事务确保数据一致性
      const result = await ProductWeblink.sequelize.transaction(async (transaction) => {
        // 查询记录并锁定行，避免并发更新冲突
        const record = await ProductWeblink.findByPk(recordId, {
          lock: true,
          transaction
        });
        
        if (!record) {
          throw new Error('记录不存在');
        }

        this.updateTaskProgress(data.taskId, 40, '解析现有文件列表...');

        // 获取现有的CPC文件列表
        let existingFiles = [];
        if (record.cpc_files) {
          try {
            existingFiles = JSON.parse(record.cpc_files);
            if (!Array.isArray(existingFiles)) {
              existingFiles = [];
            }
          } catch (e) {
            console.warn('解析现有CPC文件列表失败:', e);
            existingFiles = [];
          }
        }

        this.updateTaskProgress(data.taskId, 60, '添加新文件...');

        // 添加新文件
        existingFiles.push(fileInfo);

        // 检查是否已经有提取过的信息
        const hasExistingExtractedData = existingFiles.some(file => 
          file.extractedData && (file.extractedData.styleNumber || file.extractedData.recommendAge)
        );

        this.updateTaskProgress(data.taskId, 80, '更新数据库记录...');

        // 准备更新数据
        const updateData = {
          cpc_files: JSON.stringify(existingFiles)
        };

        // 如果CPC文件数量达到2个或以上，自动更新CPC测试情况为"已测试"
        if (existingFiles.length >= 2) {
          updateData.cpc_status = '已测试';
        }

        // 执行更新
        await ProductWeblink.update(updateData, {
          where: { id: recordId },
          transaction
        });

        return {
          success: true,
          extractedData,
          cpcStatusUpdated: existingFiles.length >= 2,
          totalFileCount: existingFiles.length,
          isFirstExtraction: !hasExistingExtractedData && (extractedData.styleNumber || extractedData.recommendAge),
          hasExistingData: hasExistingExtractedData
        };
      });

      this.updateTaskProgress(data.taskId, 100, '数据库更新完成');
      return result;

    } catch (error) {
      console.error(`数据库更新失败 (记录ID: ${recordId}):`, error);
      throw error;
    }
  }

  // 更新任务进度
  updateTaskProgress(taskId, progress, message) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.progress = progress;
      task.message = message;
      this.emit('taskProgress', task);
    }
  }

  // 获取任务状态
  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  // 获取所有任务
  getAllTasks() {
    return Array.from(this.tasks.values());
  }

  // 清理已完成的任务（保留最近100个）
  cleanup() {
    const allTasks = this.getAllTasks();
    if (allTasks.length > 100) {
      const completedTasks = allTasks
        .filter(task => task.status === 'completed' || task.status === 'failed')
        .sort((a, b) => b.completedAt - a.completedAt);
      
      const toRemove = completedTasks.slice(100);
      toRemove.forEach(task => {
        this.tasks.delete(task.id);
      });
    }
  }

  // 获取性能统计
  getPerformanceStats() {
    const allTasks = this.getAllTasks();
    const completedTasks = allTasks.filter(task => task.status === 'completed');
    const failedTasks = allTasks.filter(task => task.status === 'failed');
    const activeTasks = allTasks.filter(task => task.status === 'processing');
    
    const avgProcessingTime = completedTasks.length > 0 
      ? completedTasks.reduce((sum, task) => {
          const duration = task.completedAt - task.startedAt;
          return sum + duration;
        }, 0) / completedTasks.length
      : 0;

    return {
      totalTasks: allTasks.length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      activeTasks: activeTasks.length,
      avgProcessingTime: Math.round(avgProcessingTime),
      maxConcurrentTasks: this.maxConcurrentTasks,
      currentActiveTasks: this.activeTasks.size
    };
  }
}

// 创建全局任务队列实例
const taskQueue = new TaskQueue();

// 定期清理已完成的任务
setInterval(() => {
  taskQueue.cleanup();
}, 5 * 60 * 1000); // 每5分钟清理一次

module.exports = taskQueue;
