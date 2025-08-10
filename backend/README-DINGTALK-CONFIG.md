# 钉钉通知配置说明

## 概述

本系统支持钉钉群通知功能，包括：
- **库存入库通知**：新增库存记录后自动发送钉钉群通知
- **海外仓补货需求通知**：创建补货需求时发送通知
- **其他业务通知**：各种业务场景的实时通知

## 环境变量配置

### 必需的环境变量

在后端项目根目录创建或编辑 `.env` 文件，添加以下配置：

```bash
# 钉钉机器人配置
DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=your_access_token
SECRET_KEY=your_secret_key

# 钉钉@人员手机号配置
MOBILE_NUM_GERRY=186********   # Gerry的手机号，用于库存相关通知
MOBILE_NUM_MOM=138********     # Mom的手机号，用于补货需求通知
```

### 配置说明

#### 1. DINGTALK_WEBHOOK
- **作用**：钉钉群机器人的Webhook地址
- **获取方式**：
  1. 在钉钉群中添加"自定义机器人"
  2. 选择"自定义关键词"或"加签"安全设置
  3. 复制生成的Webhook地址

#### 2. SECRET_KEY
- **作用**：钉钉机器人的加签密钥（可选）
- **获取方式**：在创建机器人时选择"加签"安全设置，系统会生成密钥
- **注意**：如果不使用加签，可以留空

#### 3. MOBILE_NUM_GERRY
- **作用**：Gerry的手机号，用于库存入库通知时@提醒
- **格式**：11位手机号，如：18676689673

#### 4. MOBILE_NUM_MOM
- **作用**：Mom的手机号，用于海外仓补货需求通知时@提醒
- **格式**：11位手机号

## 功能说明

### 库存入库通知

当系统成功创建库存记录时，会自动发送钉钉通知，包含：
- 批次信息（记录数量）
- 入库时间
- 目的国、操作员、打包员信息
- 详细的SKU及数量列表
- 自动@MOBILE_NUM_GERRY指定的人员

通知示例：
```
📦 库存入库通知

🆔 批次信息：共创建 3 条库存记录
📅 入库时间：2024-01-15 14:30:25
🌍 目的国：美国
👤 操作员：admin
📦 打包员：老杜

📋 入库SKU及数量：
XB362D1: 120件/12箱
MK048A4: 80件/8箱
LV123A5: 45件 (混合箱: MIX1705234567_1)
```

### 海外仓补货需求通知

创建补货需求时，会自动@MOBILE_NUM_MOM指定的人员。

## 配置验证

### 1. 检查配置
创建测试脚本验证配置是否正确：

```javascript
// 在backend目录创建 test-dingtalk.js
const axios = require('axios');
const crypto = require('crypto');

async function testDingTalkConfig() {
    const webhookUrl = process.env.DINGTALK_WEBHOOK;
    const secretKey = process.env.SECRET_KEY;
    const mobileNumGerry = process.env.MOBILE_NUM_GERRY;
    
    if (!webhookUrl) {
        console.error('❌ DINGTALK_WEBHOOK 未配置');
        return;
    }
    
    console.log('✅ DINGTALK_WEBHOOK 已配置');
    
    if (secretKey) {
        console.log('✅ SECRET_KEY 已配置（加签模式）');
    } else {
        console.log('⚠️ SECRET_KEY 未配置（关键词模式）');
    }
    
    if (mobileNumGerry) {
        console.log(`✅ MOBILE_NUM_GERRY 已配置: ${mobileNumGerry}`);
    } else {
        console.log('⚠️ MOBILE_NUM_GERRY 未配置，无法@人员');
    }
    
    // 发送测试消息
    try {
        let url = webhookUrl;
        
        if (secretKey) {
            const timestamp = Date.now();
            const stringToSign = `${timestamp}\n${secretKey}`;
            const sign = crypto
                .createHmac('sha256', secretKey)
                .update(stringToSign)
                .digest('base64');
            
            url += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
        }

        const testMessage = {
            msgtype: 'text',
            text: {
                content: '🧪 钉钉配置测试消息\n\n如果您看到这条消息，说明钉钉机器人配置成功！'
            },
            at: {
                atMobiles: mobileNumGerry ? [mobileNumGerry] : [],
                isAtAll: false
            }
        };

        const response = await axios.post(url, testMessage);
        
        if (response.data.errcode === 0) {
            console.log('✅ 钉钉测试消息发送成功');
        } else {
            console.error('❌ 钉钉测试消息发送失败:', response.data);
        }
    } catch (error) {
        console.error('❌ 钉钉配置测试失败:', error.message);
    }
}

testDingTalkConfig();
```

### 2. 运行测试
```bash
node test-dingtalk.js
```

## 故障排除

### 常见问题

#### 1. 发送失败："签名不匹配"
- 检查SECRET_KEY是否正确
- 确认机器人设置中选择的是"加签"模式
- 验证系统时间是否正确

#### 2. 发送失败：关键词不匹配
- 如果使用关键词模式，确保消息内容包含设置的关键词
- 建议改用加签模式，更稳定

#### 3. @人员无效
- 确认手机号格式正确（11位数字）
- 确认被@的人员已在群内
- 检查机器人是否有@权限

#### 4. 网络连接失败
- 检查服务器网络是否能访问钉钉API
- 确认防火墙设置

### 调试建议

1. **查看服务器日志**：
   ```bash
   # 查看应用日志
   tail -f logs/application.log
   ```

2. **手动测试Webhook**：
   使用curl命令测试Webhook是否正常：
   ```bash
   curl -H "Content-Type: application/json" \
        -d '{"msgtype":"text","text":{"content":"测试消息"}}' \
        $DINGTALK_WEBHOOK
   ```

## 安全建议

1. **保护敏感信息**：
   - 不要将Webhook地址和密钥提交到代码仓库
   - 使用环境变量或配置文件管理

2. **权限控制**：
   - 定期检查机器人权限
   - 仅授予必要的权限

3. **监控使用**：
   - 监控机器人消息发送频率
   - 避免频繁发送导致限流

## 技术支持

如遇问题，请：
1. 检查环境变量配置
2. 运行配置测试脚本
3. 查看服务器错误日志
4. 参考钉钉开放平台文档

更多帮助请联系技术支持团队。 