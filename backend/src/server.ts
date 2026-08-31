import express from 'express';

const port = Number(process.env.PORT || 80);

console.log('REAL-BOOT: server.ts started');
console.log(`REAL-BOOT: PORT=${port}`);
console.log(`REAL-BOOT: NODE_ENV=${process.env.NODE_ENV}`);

const app = express();

app.get('/api/backend/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    realBackend: true,
    stage: 'minimal-express',
    port,
  });
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    realBackend: true,
    stage: 'minimal-express',
    port,
  });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`REAL-BOOT: HTTP server listening on ${port}`);
});

server.on('error', (error) => {
  console.error('REAL-BOOT: HTTP SERVER ERROR', error);
});

process.on('uncaughtException', (error) => {
  console.error('REAL-BOOT: UNCAUGHT EXCEPTION', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('REAL-BOOT: UNHANDLED REJECTION', reason);
});
