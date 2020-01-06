const hotEmitter = require('../emitter');
let currentHash;
let lastHash; // 表示上一次编译生成的hash

// [4] 监听webpackHotUpdate事件, 执行hotCheck()
hotEmitter.on('webpackHotUpdate', (hash) => {
  currentHash = hash;
  if (!lastHash) {
    // 说明是第一次请求
    return lastHash = currentHash;
  }
  hotCheck();
})

// [5] 调用hotCheck拉取两个补丁文件
const hotCheck = () => {
  hotDownloadManifest().then(hotUpdate => {
    // 类似于 => { "h": "dfadfafdaf", "c": { "main": true }}
    const chunkIdList = Object.keys(hotUpdate.c);

    chunkIdList.forEach(chunkID => {
      hotDownloadUpdateChunk(chunkID);
    });

    lastHash = currentHash;
  }).catch(err => {
    window.location.reload();
  })
}

// [6] 拉取 lastHash.hot-update.json 向 server 端发送 ajax 请求
// 服务端返回一个 Manifest文件（lastHash.hot-update.json)
// 包含了 本次编译hash值、更新的模块chunk名
const hotDownloadManifest = () => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const hotUpdatePath = `${lastHash}.hot-update.json`;
    xhr.open('get', hotUpdatePath);
    xhr.onload = () => {
      const hotUpdate = JSON.parse(xhr.responseText);
      resolve(hotUpdate);
    };

    xhr.onerror = (error) => {
      reject(error);
    }

    xhr.send();
  })
}

// [7] 拉取更新的模块chunkName.lashHash.hot-update.js 通过 Jsonp 请求获取到更新的模块代码
const hotDownloadUpdateChunk = (chunkID) => {
  const script = document.createElement('script');
  script.charset = 'utf-8';
  script.src = `${chunkID}.${lastHash}.hot-update.js`;
  document.head.appendChild(script);

  // 拉来的代码长这样
  // webpackHotUpdate("index", {
  //   "./src/lib/content.js":
  //     (function (module, __webpack_exports__, __webpack_require__) {
  //       eval("");
  //     })
  // })
};

// [8.0] 
const hotCreateModule = (moduleID) => {
  const hot = {
    accept(deps = [], callback) {
      deps.forEach(dep => {
        // 调用accept将回调 保存在 module.hot._acceptedDependencies中
        hot._acceptedDependencies[dep] = callback || function () {};
      });
    },
    check: hotCheck, // module.hot.check === hotCheck
  };
  return hot;
}

// [8.1] 补丁js取回来后调用webpackHotUpdate方法
window.webpackHotUpdate = (chunkID, moreModules) => {
  // [9] 热更新的重点代码实现
  // 循环新拉来的模块
  Object.keys(moreModules).forEach(moduleID => {
    // 1. 通过 __webpack_require__.c 模块缓存来找到旧模块
    const oldModule = __webpack_require__.c[moduleID];

    // 2. 更新__webpack_require__.c，利用moduleID将新的拉来的模块覆盖原来的模块
    const newModule = __webpack_require__.c[moduleID] = {
      i: moduleID,
      l: false,
      exports: {},
      hot: hotCreateModule(moduleID),
      parents: oldModule.parents,
      children: oldModule.children,
    };

    // 3. 执行最新编译生成的模块代码
    moreModules[moduleID].call(newModule.exports, newModule, newModule.exports, __webpack_require__);
    newModule.l = true;

    // 4. 让父模块中存储的_acceptedDependencies执行
    newModule.parents && newModule.parents.forEach(parentID => {
      const parentModule = __webpack_require__[parentID];
      parentModule.hot._acceptedDependencies[moduleID] && parentModule.hot._acceptedDependencies[moduleID]();
    })
  })
}