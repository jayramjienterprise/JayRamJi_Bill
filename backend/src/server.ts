import app from './app';

const port = Number(process.env.PORT || 80);

console.log('REAL-BOOT: server.ts started');
console.log(`REAL-BOOT: PORT=${port}`);

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`REAL-BOOT: Express app listening on ${port}`);
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
