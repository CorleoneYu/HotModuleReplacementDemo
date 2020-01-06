const io = require('socket.io-client/dist/socket.io');
const hotEmitter = require('./emitter');

let currentHash;

// [1] 链接websocket
const URL = '/';
const socket = io(URL);

const reloadApp = () => {
  const hot = true;
  // webpack实际会进行判断是否支持热更新
  // 这里简单的设置为true
  if (hot) {
    hotEmitter.emit('webpackHotUpdate', currentHash);
  } else {
    // 回退：直接刷新
    window.location.reload();
  }
}

// [2] websocket客户端监听事件
const onSocketMessage = {
  // [2.1] hash事件
  hash(hash) {
    console.log('hash', hash);
    currentHash = hash;
  },

  // [2.2] ok事件
  ok() {
    console.log('ok');
    reloadApp();
  },

  connect() {
    console.log('client connect successfully!');
  }
}

// 注册事件
Object.keys(onSocketMessage).forEach(eventName => {
  const handler = onSocketMessage[eventName];
  socket.on(eventName, handler);
});