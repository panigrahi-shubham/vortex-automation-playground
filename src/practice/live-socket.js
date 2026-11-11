const { WebSocketServer, WebSocket } = require('ws');

function attachPracticeSocket(server) {
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: 1024,
    perMessageDeflate: false,
  });
  server.on('upgrade', (req, socket, head) => {
    const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const origin = 'http://' + req.headers.host;
    if (req.url !== '/vortex-lab/socket' || !loopback || req.headers.origin !== origin) {
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(req, socket, head, connection => sockets.emit('connection', connection));
  });
  sockets.on('connection', socket => {
    const send = (type, value) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, value }));
    };
    const prices = [49.95, 50.25, 49.75];
    let tick = 0;
    send('price', prices[tick++]);
    const timer = setInterval(() => send('price', prices[tick++ % prices.length]), 1000);
    socket.on('close', () => clearInterval(timer));
    socket.on('error', () => clearInterval(timer));
    socket.on('message', (data, binary) => {
      if (binary) return;
      const message = data.toString().trim();
      if (message && message.length <= 120) send('echo', message);
    });
  });
}

module.exports = { attachPracticeSocket };
