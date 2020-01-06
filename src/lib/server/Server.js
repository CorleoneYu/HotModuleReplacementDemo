const express = require('express');
const http = require('http');

// 根据文件后缀 生成对应的Content-Type
const mime = require('mime');

const path = require('path');
const socket = require('socket.io');

// 将编译后的文件打包到内存 通过server让浏览器访问
const MemoryFileSystem = require('memory-fs');

const updateCompiler = require('./updateCompiler');

class Server {
  constructor(compiler) {
    this.compiler = compiler;

    // [3] entry增加 websocket客户端的两个文件 注入到客户端代码中
    updateCompiler(compiler);

    this.currentHash; // 每次编译的hash
    this.clientSocketList = []; // 所有的websocket客户端
    this.fs; // 指向内存文件系统
    this.server; // webserver服务器
    this.app; // express实例
    this.middleware; // 文件系统中间件

    // [4] 添加webpack的done回调 编译完成触发：websocket通知客户端(浏览器)拉取新代码
    this.setupHooks();

    // [5] 创建express实例
    this.setupApp();

    // [6] webpack-dev-middle完成的工作：本地文件的监听、启动webpack编译、设置文件系统为内存文件系统
    this.setupDevMiddleware();

    // [7] app使用webpack-dev-middleware返回的中间件
    this.routes();

    // [8] 创建webserver服务器 让浏览器可以访问编译的文件
    this.createServer();

    // [9] 创建websocket服务器 监听connection事件 与客户端通信
    this.createSocketServer();
  }

  // 编译完成触发：websocket通知(hash、ok事件)客户端(浏览器)拉取新代码
  setupHooks() {
    const {
      compiler
    } = this;
    compiler.hooks.done.tap('webpack-dev-server', (stats) => {
      this.currentHash = stats.hash;
      this.clientSocketList.forEach(socket => {
        socket.emit('hash', this.currentHash);
        socket.emit('ok');
      })
    })
  }

  setupApp() {
    this.app = new express();
  }

  // webpack-dev-middle完成的工作：本地文件的监听、启动webpack编译、设置文件系统为内存文件系统
  setupDevMiddleware() {
    const {
      compiler
    } = this;

    // 监听文件的变化 每当有文件改变的时候重新编译打包
    // 编译输出的过程中，会生成两个补丁文件 hash.hot-update.json 和 chunkName.hash.hot-update.js
    compiler.watch({}, () => {
      console.log('Compiled successfully!');
    })

    const fs = new MemoryFileSystem();
    this.fs = compiler.outputFileSystem = fs;

    // express中间件 将编译后的文件返回
    const staticMiddleWare = (fileDir) => {
      return (req, res, next) => {
        let {
          url
        } = req;
        console.log('url', url);
        if (url === '/favicon.ico') {
          return res.sendStatus(404);
        }

        url === '/' ? url = '/index.html' : null;
        const filePath = path.join(fileDir, url);

        try {
          const statObj = this.fs.statSync(filePath);
          if (!statObj.isFile()) {
            // 判断是否是文件 不是文件则返回404
            res.sendStatus(404);
            return;
          }

          const content = this.fs.readFileSync(filePath);
          res.setHeader('Content-Type', mime.getType(filePath));
          res.send(content);
        } catch (error) {
          res.sendStatus(404);
        }
      }
    }

    // 挂载中间件
    this.middleware = staticMiddleWare;
  }

  routes() {
    const {
      compiler
    } = this;
    const config = compiler.options;
    this.app.use(this.middleware(config.output.path));
  }

  createServer() {
    this.server = http.createServer(this.app);
  }

  createSocketServer() {
    const io = socket(this.server);
    io.on('connection', (socket) => {
      console.log('a new client connect server');
      this.clientSocketList.push(socket);

      socket.on('disconnect', () => {
        const idx = this.clientSocketList.indexOf(socket);
        this.clientSocketList.splice(idx, 1);
      });

      socket.emit('hash', this.currentHash);
      socket.emit('ok');
    })
  }

  listen(port, host = 'localhost', cb = new Function()) {
    this.server.listen(port, host, cb);
  }
}

module.exports = Server;