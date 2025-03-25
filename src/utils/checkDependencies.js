const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * 检查并安装缺少的依赖
 * @returns {Promise<boolean>} 是否所有依赖都已安装
 */
exports.checkAndInstallDependencies = async () => {
  try {
    console.log('检查项目依赖...');
    
    // 检查package.json是否存在
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.error('未找到package.json文件');
      return false;
    }
    
    // 读取package.json
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);
    
    // 所需的依赖列表
    const requiredDependencies = {
      'express': '4.x',
      'cors': '2.x',
      'morgan': '1.x',
      'helmet': '7.x',
      'compression': '1.x',
      'dotenv': '16.x',
      'jsonwebtoken': '9.x',
      'bcrypt': '5.x',
      'sequelize': '6.x',
      'mysql2': '3.x',
      'express-rate-limit': '7.x'
    };
    
    // 检查依赖
    const missingDependencies = [];
    for (const [dep, version] of Object.entries(requiredDependencies)) {
      if (!packageJson.dependencies || !packageJson.dependencies[dep]) {
        missingDependencies.push(`${dep}@${version}`);
      }
    }
    
    // 如果有缺少的依赖，提示安装
    if (missingDependencies.length > 0) {
      console.log(`检测到缺少以下依赖: ${missingDependencies.join(', ')}`);
      
      // 自动安装缺少的依赖
      const shouldInstall = true; // 在实际应用中可以改为询问用户是否安装
      
      if (shouldInstall) {
        console.log('正在安装缺少的依赖...');
        const installCommand = `npm install ${missingDependencies.join(' ')}`;
        
        try {
          execSync(installCommand, { stdio: 'inherit' });
          console.log('依赖安装完成');
          return true;
        } catch (installError) {
          console.error('依赖安装失败，请手动安装:', installError.message);
          return false;
        }
      } else {
        console.log('请手动安装以上依赖后重新启动应用');
        return false;
      }
    }
    
    console.log('所有依赖检查通过');
    return true;
  } catch (error) {
    console.error('检查依赖时出错:', error);
    return false;
  }
}; 