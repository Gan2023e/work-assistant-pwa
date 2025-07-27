// 调试混合箱号处理逻辑的测试脚本
console.log('🔍 开始调试混合箱号处理逻辑...\n');

// 模拟从后端返回的混合箱数据
const mockMixedBoxData = [
  { box_num: "MIX1753529314489_1", sku: "MK024A4", amz_sku: "UWMK024A4", quantity: 80 },
  { box_num: "MIX1753529314489_1", sku: "MK025B5", amz_sku: "UWMK025B5", quantity: 60 },
  { box_num: "MIX1753529314489_2", sku: "MK026C6", amz_sku: "UWMK026C6", quantity: 45 },
  { box_num: "MIX2053529314490_1", sku: "MK027D7", amz_sku: "UWMK027D7", quantity: 30 },
  { box_num: "MIX2053529314490_1", sku: "MK028E8", amz_sku: "UWMK028E8", quantity: 25 },
];

console.log('📊 模拟的原始混合箱数据:');
console.log(JSON.stringify(mockMixedBoxData, null, 2));
console.log('\n');

// 模拟前端当前的处理逻辑
console.log('🔧 当前前端处理逻辑：');
const currentUniqueBoxNums = Array.from(new Set(mockMixedBoxData.map(item => item.box_num)));
console.log('提取到的唯一箱号:', currentUniqueBoxNums);
console.log('箱号数量:', currentUniqueBoxNums.length);
console.log('\n');

// 分析每个箱号的结构
console.log('🔍 箱号结构分析:');
currentUniqueBoxNums.forEach((boxNum, index) => {
  console.log(`第${index + 1}个箱号: "${boxNum}"`);
  console.log(`  - 长度: ${boxNum.length} 字符`);
  console.log(`  - 是否包含下划线: ${boxNum.includes('_')}`);
  if (boxNum.includes('_')) {
    const parts = boxNum.split('_');
    console.log(`  - 基础部分: "${parts[0]}"`);
    console.log(`  - 序号部分: "${parts[1]}"`);
  }
  console.log('');
});

// 模拟可能的后端数据问题
console.log('❓ 可能的问题情况：');

// 情况1：后端返回不完整箱号
const mockIncompleteData = [
  { box_num: "MIX1753529314489", sku: "MK024A4", amz_sku: "UWMK024A4", quantity: 80 },
  { box_num: "MIX1753529314489", sku: "MK025B5", amz_sku: "UWMK025B5", quantity: 60 },
  { box_num: "MIX2053529314490", sku: "MK026C6", amz_sku: "UWMK026C6", quantity: 45 },
];

console.log('情况1 - 后端返回不完整箱号:');
const incompleteUniqueBoxNums = Array.from(new Set(mockIncompleteData.map(item => item.box_num)));
console.log('不完整箱号:', incompleteUniqueBoxNums);
console.log('\n');

// 分析startsWith匹配逻辑
console.log('🔎 startsWith匹配测试:');
const testBoxNum = "MIX1753529314489"; // 不完整箱号
const completeBoxNums = ["MIX1753529314489_1", "MIX1753529314489_2", "MIX2053529314490_1"];

console.log(`测试箱号: "${testBoxNum}"`);
console.log('匹配结果:');
completeBoxNums.forEach(completeBox => {
  const matches = completeBox.startsWith(testBoxNum);
  console.log(`  "${completeBox}".startsWith("${testBoxNum}") = ${matches}`);
});
console.log('\n');

// 提出修复方案
console.log('💡 修复方案分析:');
console.log('方案1: 如果后端返回不完整箱号，需要在后端修复');
console.log('方案2: 如果前端需要处理这种情况，可以：');

// 方案2的实现
console.log('\n🔧 前端修复方案实现:');

function extractUniqueBoxBaseNumbers(mixedBoxData) {
  // 提取基础箱号（去掉_后缀）
  const baseBoxNums = mixedBoxData.map(item => {
    if (item.box_num.includes('_')) {
      return item.box_num.split('_')[0]; // 提取基础部分
    }
    return item.box_num;
  });
  
  return Array.from(new Set(baseBoxNums));
}

function extractUniqueCompleteBoxNumbers(mixedBoxData) {
  // 提取完整箱号
  return Array.from(new Set(mixedBoxData.map(item => item.box_num)));
}

// 测试两种方案
console.log('使用基础箱号方案:');
const baseBoxNums = extractUniqueBoxBaseNumbers(mockMixedBoxData);
console.log('基础箱号:', baseBoxNums);

console.log('\n使用完整箱号方案:');
const completeBoxNumbers = extractUniqueCompleteBoxNumbers(mockMixedBoxData);
console.log('完整箱号:', completeBoxNumbers);

console.log('\n🎯 推荐方案:');
console.log('1. 检查后端API返回的实际数据格式');
console.log('2. 如果后端返回完整箱号，前端应该使用完整箱号');
console.log('3. 如果需要按基础箱号分组，应该在前端进行额外处理');

console.log('\n✅ 调试完成！'); 