const axios = require('axios');
const { execSync } = require('child_process');
const { setTimeout } = require('timers/promises');

async function runTestWithDelay() {
  try {
    // 尝试终止可能存在的Node进程
    try {
      console.log('尝试终止现有Node进程...');
      execSync('taskkill /F /FI "IMAGENAME eq node.exe" /FI "PID ne ' + process.pid + '"', { stdio: 'pipe' });
    } catch (e) {
      console.log('没有找到需要终止的进程');
    }

    // 启动服务器
    console.log('启动服务器...');
    const startTime = Date.now();
    
    // 使用spawn启动服务器并分离进程
    const { spawn } = require('child_process');
    const server = spawn('node', ['start.js'], {
      detached: true,
      stdio: 'ignore'
    });
    
    // 不等待子进程结束
    server.unref();
    
    // 等待12秒（8秒延迟 + 4秒启动时间）
    console.log('等待12秒让服务器完全启动...');
    await setTimeout(12000);
    
    // 测试服务器是否响应
    try {
      console.log('测试服务器响应...');
      const response = await axios.get('http://localhost:3002/api/test');
      console.log('服务器响应:', response.data);
      console.log(`服务器启动耗时: ${(Date.now() - startTime) / 1000}秒`);
      
      // 运行测试脚本
      console.log('\n运行test-base.js...');
      const testResult = execSync('node test-base.js', { stdio: 'pipe' });
      console.log(testResult.toString());
      
    } catch (error) {
      console.error('测试服务器响应失败:', error.message);
    }
    
  } catch (error) {
    console.error('执行过程中出错:', error);
  } finally {
    // 测试完成后不终止服务器，让它继续运行
    console.log('测试完成');
  }
}

runTestWithDelay(); 