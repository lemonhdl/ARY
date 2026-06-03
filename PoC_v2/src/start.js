import { createServerApp } from './server.js';

const port = Number(process.env.ARY_POC_V2_PORT || 4400);
const organizerPort = Number(process.env.ARY_POC_V2_ORGANIZER_PORT || 4401);
const app = createServerApp(port, organizerPort);

app.on('listening', () => {
  console.log(`ARY: http://127.0.0.1:${port}`);
  console.log(`Organizer evaluator port: ${organizerPort}`);
});

app.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`ARY PoC_v2 启动失败：端口 ${port} 已被占用。`);
    console.error('可以先关闭占用该端口的旧服务，或使用 ARY_POC_V2_PORT 指定其他端口。');
    console.error('例如：ARY_POC_V2_PORT=4401 npm start');
    process.exit(1);
  }
  throw error;
});
