const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('=== OSS配置向导 ===\n');
console.log('此工具将帮助您设置OSS环境变量');
console.log('如果您还没有OSS服务，请先参考 OSS_CONFIG.md 文档\n');

const config = {};

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function setupOSS() {
  try {
    console.log('请输入您的OSS配置信息:\n');
    
    config.OSS_REGION = await askQuestion('OSS地域 (如: oss-cn-hangzhou): ');
    config.OSS_ACCESS_KEY_ID = await askQuestion('AccessKey ID: ');
    config.OSS_ACCESS_KEY_SECRET = await askQuestion('AccessKey Secret: ');
    config.OSS_BUCKET = await askQuestion('Bucket名称: ');
    config.OSS_ENDPOINT = await askQuestion('OSS端点 (如: oss-cn-hangzhou.aliyuncs.com): ');
    
    console.log('\n✅ 配置信息收集完成！');
    console.log('\n📝 您的配置信息:');
    console.log(`OSS_REGION=${config.OSS_REGION}`);
    console.log(`OSS_ACCESS_KEY_ID=${config.OSS_ACCESS_KEY_ID}`);
    console.log(`OSS_ACCESS_KEY_SECRET=${config.OSS_ACCESS_KEY_SECRET.substring(0, 8)}...`);
    console.log(`OSS_BUCKET=${config.OSS_BUCKET}`);
    console.log(`OSS_ENDPOINT=${config.OSS_ENDPOINT}`);
    
    const confirm = await askQuestion('\n是否要创建 .env 文件？(y/n): ');
    
    if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
      const envPath = path.join(__dirname, '../.env');
      
      let envContent = '';
      
      // 如果 .env 文件已存在，读取现有内容
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
        console.log('\n⚠️ .env 文件已存在，将更新OSS配置...');
      }
      
      // 更新或添加OSS配置
      Object.keys(config).forEach(key => {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        const newLine = `${key}=${config[key]}`;
        
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, newLine);
        } else {
          envContent += `\n${newLine}`;
        }
      });
      
      fs.writeFileSync(envPath, envContent);
      console.log(`✅ 配置已保存到 ${envPath}`);
      console.log('\n🔄 请重启后端服务以使配置生效：');
      console.log('   npm run dev  或  npm start');
    } else {
      console.log('\n📋 请手动创建 .env 文件并添加以上配置');
    }
    
  } catch (error) {
    console.error('\n❌ 配置过程中出现错误:', error.message);
  } finally {
    rl.close();
  }
}

// 显示帮助信息
console.log('💡 提示:');
console.log('1. 确保您已经在阿里云创建了OSS服务');
console.log('2. 建议使用RAM用户而不是主账号');
console.log('3. 配置完成后可以运行 node scripts/checkOSSConfig.js 测试');
console.log('4. 详细配置说明请参考项目根目录的 OSS_CONFIG.md');
console.log('');

setupOSS(); 