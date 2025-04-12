const { exec } = require('child_process');
const http = require('http');

console.log('启动测试 - 测试服务器启动和8秒延迟特性');

// 记录开始时间
const startTime = Date.now();

// 杀掉可能占用3002端口的进程（Windows系统）
exec('taskkill /F /FI "PID ne 0" /IM node.exe', async (error, stdout, stderr) => {
  console.log('尝试终止现有Node进程');
  if (error) {
    console.log('终止进程时出错或没有找到进程:', error.message);
  }
  if (stdout) console.log('终止进程输出:', stdout);
  if (stderr) console.log('终止进程错误:', stderr);

  console.log('启动服务器...');
  
  // 启动服务器
  const server = exec('node start.js');
  
  server.stdout.on('data', (data) => {
    console.log(`服务器输出: ${data}`);
    
    // 如果看到服务器成功启动的消息
    if (data.includes('服务器运行在端口 3002')) {
      const endTime = Date.now();
      const timeTaken = (endTime - startTime) / 1000;
      console.log(`服务器成功启动，总耗时: ${timeTaken}秒`);
      
      // 测试服务器响应
      setTimeout(() => {
        testServerResponse();
      }, 1000);
    }
  });
  
  server.stderr.on('data', (data) => {
    console.log(`服务器错误: ${data}`);
  });
  
  server.on('close', (code) => {
    console.log(`服务器进程退出，退出码: ${code}`);
  });
});

// 测试服务器响应
function testServerResponse() {
  console.log('测试服务器响应...');
  
  http.get('http://localhost:3002/api/test', (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('服务器响应状态码:', res.statusCode);
      console.log('响应数据:', data);
      
      // 在成功测试API后，运行test-base.js
      console.log('\n准备运行test-base.js...');
      
      // 通过子进程运行test-base.js
      const testProcess = exec('node test-base.js');
      
      testProcess.stdout.on('data', (testData) => {
        console.log(`test-base.js输出: ${testData}`);
      });
      
      testProcess.stderr.on('data', (testError) => {
        console.log(`test-base.js错误: ${testError}`);
      });
      
      testProcess.on('close', (testCode) => {
        console.log(`test-base.js进程退出，退出码: ${testCode}`);
        // 测试完成后，终止服务器
        exec('taskkill /F /FI "PID ne 0" /IM node.exe');
      });
    });
  }).on('error', (error) => {
    console.log('请求服务器时出错:', error.message);
  });
} 