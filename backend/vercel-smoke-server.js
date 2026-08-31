const http = require('http');

const port = Number(process.env.PORT || 80);

console.log('SMOKE: process started');
console.log(`SMOKE: PORT=${port}`);
console.log(`SMOKE: NODE_ENV=${process.env.NODE_ENV}`);

const server = http.createServer((req, res) => {
  console.log(`SMOKE: request ${req.method} ${req.url}`);

  res.writeHead(200, {
    'Content-Type': 'application/json',
  });

  res.end(
    JSON.stringify({
      success: true,
      smokeTest: true,
      path: req.url,
      method: req.method,
      port,
      timestamp: new Date().toISOString(),
    })
  );
});

server.on('error', (error) => {
  console.error('SMOKE: SERVER_ERROR', error);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`SMOKE: HTTP_SERVER_LISTENING port=${port}`);
});
