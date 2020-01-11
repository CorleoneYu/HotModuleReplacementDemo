# HotModuleReplacementDemo

实现简易 HMR

## 项目结构

```file
├── package-lock.json
├── package.json
├── src
│   ├── content.js   测试代码
│   ├── index.js     测试代码入口
│   ├── lib
│   │   ├── client   热更新客户端实现逻辑
│   │   │   ├── index.js   等价于源码中的webpack-dev-server/client/index.js
│   │   │   ├── emitter.js
│   │   │   └── hot
│   │   │       └── dev-server.js   等价于源码中的webpack/hot/dev-server.js 和 HMR runtime
│   │   └── server   热更新服务端实现逻辑
│   │       ├── Server.js
│   │       └── updateCompiler.js
│   └── myHMR-webpack-dev-server.js   热更新服务端主入口
└── webpack.config.js   webpack配置文件
```

## 服务端

### updateCompiler

修改 webpack 配置项 entry, 向客户端注入代码

- src/client/index.js
- src/client/hot/dev-server.js

### Server

- 与 webpack 结合, 获取 webpack 对象实例
- 调用 updateCompiler(需 webpack 对象实例)
- 使用 webpack 监听本地文件修改, 并获取 webpack 重新编译后的文件, 输出到内存文件系统
- 构建 express 实例, 使用中间件解析 webpack 输出的文件, 作为静态文件服务器
- socket 服务, 与客户端 socket 通信, 在 webpack 每次构建完毕后, 推送 ok, hash 事件

## 客户端

### src/client/index.js

等价于源码中的 webpack-dev-server/client/index.js  
客户端 socket, 接收服务端 socket 的 hash, ok 事件推送, 并使用 EventEmitter 与 src/client/hot/dev-server.js 通信, 触发 webpackHotUpdate 事件

### src/client/hot/dev-server.js

等价于源码中的 webpack/hot/dev-server.js 和 HMR runtime

#### webpack/hot/dev-server.js

- 接收 webpackHotUpdate 事件, 调用 hotCheck()
- hotCheck() => hotDownloadManifest() 发送 ajax 请求 lastHash.hot-update.json

```json
"h": "cecf780cbfdebe62f880"
"c": {
  "main": true
}
```

更新 hash 后, 调用 hotDownloadUpdateChunk(chunkId), chunkId = c ( c 为更新的模块名 在这里为 main)

- hotCheck() => hotDownloadUpdateChunk 发送 jsonp 请求 chunkId.lastHash.hot-update.js

```javascript
webpackHotUpdate('index', {
  './src/lib/content.js': function(
    module,
    __webpack_exports__,
    __webpack_require__
  ) {
    eval('');
  },
});
```

可以看出, 拉下来的 js 文件调用了 webpackHotUpdate

#### HMR runtime

- webpackHotUpdate

在 webpack 模块缓存 _webpack_require_.c 对象中更新旧模块  
找到模块的父模块, 执行 accept 回调

```javascript
// 业务代码中 render 即为 父模块中 key 为 ./content.js 的 accept 回调
if (module.hot) {
  module.hot.accept(['./content.js'], render);
}
```

- hotCreateModule

```typescript
const hotCreateModule = moduleID => {
  const hot = {
    accept(deps = [], callback) {
      deps.forEach(dep => {
        // 调用accept将回调 保存在 module.hot._acceptedDependencies中
        hot._acceptedDependencies[dep] = callback || function() {};
      });
    },
    check: hotCheck, // module.hot.check === hotCheck
  };
  return hot;
};
```

使 module 拥有 hot 对象, 可以调用 check 检测更新, accept 注册回调
