const webpack = require('webpack');
const Server = require('./lib/server/Server');
const config = require('../webpack.config');

// [1] 创建webpack实例 并在下面传递给Server(在Server会对config的entry做修改)
const compiler = webpack(config);

// [2] 启动webserver服务
const server = new Server(compiler);
server.listen(8000, 'localhost', () => {
  console.log('Project is running at http://localhost:8000/');
})