import { createServerApp } from './server.js';

const port = Number(process.env.ARY_GRS001_PORT || 4400);
const organizerPort = Number(process.env.ARY_GRS001_ORGANIZER_PORT || 4401);
const app = createServerApp(port, organizerPort);

app.on('listening', () => {
  console.log(`ARY GRS001: http://127.0.0.1:${port}`);
  console.log(`Organizer evaluator port: ${organizerPort}`);
});

app.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`ARY GRS001 启动失败：端口 ${port} 已被占用。`);
    console.error('可以先关闭占用该端口的旧服务，或使用 ARY_GRS001_PORT 指定其他端口。');
    process.exit(1);
  }
  throw error;
});
