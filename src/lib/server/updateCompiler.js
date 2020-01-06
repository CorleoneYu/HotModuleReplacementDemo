const path = require('path');

const updateCompiler = (compiler) => {
  const config = compiler.options;
  config.entry = {
    main: [
      // 注入client文件
      path.resolve(__dirname, '../client/index.js'),
      path.resolve(__dirname, '../client/hot/dev-server.js'),
      config.entry, // 原入口
    ]
  }
  compiler.hooks.entryOption.call(config.context, config.entry);
}

module.exports = updateCompiler;