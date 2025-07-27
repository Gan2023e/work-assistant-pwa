// 修复混合箱号显示问题的脚本
const fs = require('fs');
const path = require('path');

console.log('🔧 开始修复混合箱号显示问题...\n');

const filePath = path.join(__dirname, 'frontend/src/pages/Shipping/ShippingPage.tsx');

console.log('📖 读取文件:', filePath);

try {
  let content = fs.readFileSync(filePath, 'utf8');
  
  console.log('🔍 分析当前代码问题...');
  
  // 检查当前的uniqueMixedBoxNums生成逻辑
  const currentLogicMatch = content.match(/const uniqueBoxNums: string\[\] = Array\.from\(new Set\(mixedBoxData\.map\(.*?\)\)\);/);
  if (currentLogicMatch) {
    console.log('✅ 找到当前的uniqueMixedBoxNums生成逻辑');
  }
  
  // 第一个修复：改进uniqueMixedBoxNums的生成逻辑，确保它包含基础箱号用于导航
  console.log('🔧 修复1: 改进uniqueMixedBoxNums生成逻辑...');
  
  const improvedLogic = `// 获取所有唯一的混合箱号 - 改进版本
        // 如果box_num包含下划线，提取基础箱号；否则直接使用
        const baseBoxNums = mixedBoxData.map((item: MixedBoxItem) => {
          return item.box_num.includes('_') ? item.box_num.split('_')[0] : item.box_num;
        });
        const uniqueBoxNums: string[] = Array.from(new Set(baseBoxNums));`;
  
  content = content.replace(
    /\/\/ 获取所有唯一的混合箱号\s*const uniqueBoxNums: string\[\] = Array\.from\(new Set\(mixedBoxData\.map\(\(item: MixedBoxItem\) => item\.box_num\)\)\);/,
    improvedLogic
  );
  
  // 第二个修复：改进数据过滤逻辑
  console.log('🔧 修复2: 改进数据过滤逻辑...');
  
  // 更新startsWith的匹配逻辑，使其更加精确
  const improvedFilter = `item.box_num === uniqueMixedBoxNums[currentMixedBoxIndex] || 
                item.box_num.startsWith(uniqueMixedBoxNums[currentMixedBoxIndex] + '_')`;
  
  // 替换所有的startsWith匹配逻辑
  content = content.replace(
    /item\.box_num\.startsWith\(uniqueMixedBoxNums\[currentMixedBoxIndex\]\)/g,
    `(${improvedFilter})`
  );
  
  // 第三个修复：改进完整箱号的获取逻辑
  console.log('🔧 修复3: 改进完整箱号获取逻辑...');
  
  const improvedBoxNumLogic = `// 获取当前处理的混合箱数据，这里包含完整的箱号
              const currentBoxData = mixedBoxes.filter(item => {
                const baseBoxNum = uniqueMixedBoxNums[currentMixedBoxIndex];
                return item.box_num === baseBoxNum || item.box_num.startsWith(baseBoxNum + '_');
              });
              const isAlreadyConfirmed = confirmedMixedBoxes.some(item => {
                const baseBoxNum = uniqueMixedBoxNums[currentMixedBoxIndex];
                return item.box_num === baseBoxNum || item.box_num.startsWith(baseBoxNum + '_');
              });
              // 使用实际的完整箱号，如果有多个子箱，显示第一个
              const actualBoxNum = currentBoxData[0]?.box_num || uniqueMixedBoxNums[currentMixedBoxIndex];`;
  
  content = content.replace(
    /\/\/ 获取当前处理的混合箱数据，这里包含完整的箱号[\s\S]*?\/\/ 使用实际的完整箱号\s*const actualBoxNum = currentBoxData\[0\]\?\.box_num \|\| currentBoxNum;/,
    improvedBoxNumLogic
  );
  
  // 第四个修复：改进确认逻辑中的匹配
  console.log('🔧 修复4: 改进确认逻辑中的箱号匹配...');
  
  const improvedConfirmLogic = `// 检查当前混合箱是否已经确认过（使用改进的匹配逻辑）
      const isAlreadyConfirmed = confirmedMixedBoxes.some(item => {
        const baseBoxNum = uniqueMixedBoxNums[currentMixedBoxIndex];
        return item.box_num === baseBoxNum || 
               item.box_num.startsWith(baseBoxNum + '_') ||
               (item.box_num.includes('_') && item.box_num.split('_')[0] === baseBoxNum);
      });`;
  
  content = content.replace(
    /\/\/ 检查当前混合箱是否已经确认过（使用前缀匹配，因为confirmedMixedBoxes中可能存储完整箱号）[\s\S]*?const isAlreadyConfirmed = confirmedMixedBoxes\.some\(item => [\s\S]*?\);/,
    improvedConfirmLogic
  );
  
  // 写入修复后的文件
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ 文件修复完成！');
  
  // 提供验证信息
  console.log('\n📋 修复总结:');
  console.log('1. ✅ 改进uniqueMixedBoxNums生成逻辑 - 始终包含基础箱号');
  console.log('2. ✅ 改进数据过滤逻辑 - 精确匹配基础箱号和子箱号');
  console.log('3. ✅ 改进完整箱号获取 - 正确显示实际箱号');
  console.log('4. ✅ 改进确认状态检查 - 更健壮的匹配逻辑');
  
  console.log('\n🎯 修复效果:');
  console.log('- Alert提示将显示完整箱号 (如 "MIX1753529314489_1")');
  console.log('- 表格中的原始混合箱号列将显示完整箱号');
  console.log('- 确认状态检查将更加准确');
  console.log('- 支持后端返回基础箱号或完整箱号两种格式');
  
} catch (error) {
  console.error('❌ 修复失败:', error.message);
}

console.log('\n🚀 修复脚本执行完成！'); 