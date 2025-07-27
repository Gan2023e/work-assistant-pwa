// 测试真实的后端API数据格式
console.log('🔍 测试真实后端API数据格式...\n');

// 模拟前端发送的请求数据
const testRequestData = {
  records: [
    {
      record_num: 1,
      local_sku: "MK024A4",
      amz_sku: "UWMK024A4",
      country: "美国"
    }
  ]
};

async function testRealAPI() {
  try {
    console.log('📤 尝试发送请求到后端API...');
    console.log('请求数据:', JSON.stringify(testRequestData, null, 2));
    
    // 尝试使用原生fetch（Node.js 18+）
    const response = await fetch('http://localhost:3001/api/shipping/mixed-boxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testRequestData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log('\n📥 后端返回的原始数据:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.code === 0 && result.data && result.data.mixed_boxes) {
      const mixedBoxData = result.data.mixed_boxes;
      
      console.log('\n🔍 分析混合箱数据:');
      console.log('混合箱数量:', mixedBoxData.length);
      
      // 分析箱号格式
      console.log('\n📊 箱号格式分析:');
      mixedBoxData.forEach((item, index) => {
        console.log(`第${index + 1}条数据:`);
        console.log(`  - 箱号: "${item.box_num}"`);
        console.log(`  - SKU: "${item.sku}"`);
        console.log(`  - 数量: ${item.quantity}`);
        
        if (item.box_num.includes('_')) {
          const parts = item.box_num.split('_');
          console.log(`  - 基础箱号: "${parts[0]}"`);
          console.log(`  - 序号: "${parts[1]}"`);
        } else {
          console.log(`  - ⚠️ 不包含下划线，可能是基础箱号`);
        }
        console.log('');
      });
      
      // 模拟前端当前的处理逻辑
      console.log('🔧 前端当前处理逻辑结果:');
      const uniqueBoxNums = Array.from(new Set(mixedBoxData.map(item => item.box_num)));
      console.log('uniqueMixedBoxNums:', uniqueBoxNums);
      
      // 分析是否需要修复
      console.log('\n🎯 问题分析:');
      const hasUnderscore = uniqueBoxNums.some(boxNum => boxNum.includes('_'));
      if (hasUnderscore) {
        console.log('✅ 后端返回了完整箱号，前端逻辑应该正常');
      } else {
        console.log('❌ 后端返回了基础箱号，需要修复处理逻辑');
        
        // 提供修复建议
        console.log('\n💡 修复建议:');
        console.log('1. 检查后端是否应该返回完整箱号');
        console.log('2. 或者前端需要改进处理逻辑以适应基础箱号');
      }
      
    } else {
      console.log('❌ API返回格式异常或无混合箱数据');
    }
    
  } catch (error) {
    console.error('❌ API测试失败:', error.message);
    
    // 如果API不可用，使用模拟数据进行分析
    console.log('\n🔄 API不可用，基于用户截图进行模拟分析...');
    
    // 基于用户截图，模拟可能的实际后端数据
    const mockRealData = [
      { box_num: "MIX1753529314489", sku: "MK024A4", amz_sku: "UWMK024A4", quantity: 80 }
    ];
    
    console.log('📊 模拟的真实数据格式:');
    console.log(JSON.stringify(mockRealData, null, 2));
    
    const uniqueBoxNums = Array.from(new Set(mockRealData.map(item => item.box_num)));
    console.log('\n🔧 前端处理结果:');
    console.log('uniqueMixedBoxNums:', uniqueBoxNums);
    
    console.log('\n❌ 问题确认: 后端返回的是不完整的基础箱号');
    console.log('📋 箱号分析:');
    console.log(`  - 实际箱号: "${mockRealData[0].box_num}"`);
    console.log(`  - 长度: ${mockRealData[0].box_num.length} 字符`);
    console.log(`  - 包含下划线: ${mockRealData[0].box_num.includes('_')}`);
    
    console.log('\n💡 修复方案:');
    console.log('1. 最佳方案: 修改后端返回完整箱号 (如 "MIX1753529314489_1")');
    console.log('2. 临时方案: 前端适配基础箱号的处理逻辑');
    
    console.log('\n🛠️ 前端修复实现:');
    analyzeAndFixFrontend();
  }
}

function analyzeAndFixFrontend() {
  console.log('正在分析前端修复方案...\n');
  
  // 当前问题的根源
  console.log('🔍 问题根源分析:');
  console.log('1. uniqueMixedBoxNums包含基础箱号: ["MIX1753529314489"]');
  console.log('2. 但实际可能有多个子箱: MIX1753529314489_1, MIX1753529314489_2');
  console.log('3. startsWith匹配无法区分具体是哪个子箱');
  
  // 提供具体的修复代码
  console.log('\n💻 修复代码建议:');
  console.log(`
// 修复方案1: 改进 uniqueMixedBoxNums 的生成逻辑
function generateUniqueBoxGroups(mixedBoxData) {
  const boxGroups = new Map();
  
  mixedBoxData.forEach(item => {
    const baseBoxNum = item.box_num.includes('_') ? 
      item.box_num.split('_')[0] : item.box_num;
    
    if (!boxGroups.has(baseBoxNum)) {
      boxGroups.set(baseBoxNum, []);
    }
    boxGroups.get(baseBoxNum).push(item);
  });
  
  return Array.from(boxGroups.keys());
}

// 修复方案2: 改进数据过滤逻辑
function getBoxDataByIndex(mixedBoxData, uniqueBoxNums, index) {
  const baseBoxNum = uniqueBoxNums[index];
  return mixedBoxData.filter(item => 
    item.box_num === baseBoxNum || 
    item.box_num.startsWith(baseBoxNum + '_')
  );
}
`);

  console.log('\n🎯 推荐修复策略:');
  console.log('1. 保持uniqueMixedBoxNums为基础箱号数组');
  console.log('2. 在数据过滤时使用更智能的匹配逻辑');
  console.log('3. 在显示时获取第一个匹配项的完整箱号');
}

// 运行测试
testRealAPI(); 