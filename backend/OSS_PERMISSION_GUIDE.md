# 阿里云OSS权限配置指南

## 问题描述
当前OSS配置可以正常上传文件，但删除文件时遇到权限问题：
```
AccessDenied: You have no right to access this object because of bucket acl.
```

## 解决方案

### 方案一：调整AccessKey权限（推荐）

1. **登录阿里云RAM控制台**
   - 访问：https://ram.console.aliyun.com/
   - 选择"用户管理"

2. **找到当前使用的AccessKey用户**
   - 在用户列表中找到对应的用户
   - 点击用户名进入详情页

3. **添加权限**
   - 点击"添加权限"
   - 选择权限类型：系统策略
   - 搜索并选择：`AliyunOSSFullAccess`
   - 点击"确定"

### 方案二：自定义权限策略

如果不想给予完全权限，可以创建自定义策略：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "oss:PutObject",
        "oss:GetObject",
        "oss:DeleteObject",
        "oss:ListObjects"
      ],
      "Resource": [
        "acs:oss:*:*:your-bucket-name/*"
      ]
    }
  ]
}
```

### 方案三：检查Bucket ACL设置

1. **登录阿里云OSS控制台**
   - 访问：https://oss.console.aliyun.com/
   - 选择您的存储桶

2. **检查权限设置**
   - 点击"权限管理"
   - 检查"Bucket ACL"设置
   - 确保允许删除操作

## 当前配置状态

✅ **正常功能**：
- 环境变量配置完整
- OSS连接成功
- 文件上传正常

⚠️ **权限问题**：
- 文件删除权限不足
- 需要添加删除权限

## 验证修复

配置完成后，可以运行测试脚本验证：

```bash
cd backend
node scripts/testOSS.js
```

## 系统已优化

系统已经针对这个问题进行了优化：

1. **删除功能容错**：即使删除失败，系统也会正常运行
2. **友好错误提示**：前端会显示权限不足的提示
3. **不影响核心功能**：上传功能正常，发票管理系统可以正常使用

## 临时解决方案

如果暂时无法解决权限问题，系统仍然可以正常使用：
- 发票文件上传正常
- 数据库记录正常
- 只是无法通过系统删除OSS文件（可以手动在OSS控制台删除） 