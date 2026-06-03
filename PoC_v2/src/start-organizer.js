import { createOrganizerServer } from './organizer-server.js';

const port = Number(process.env.ARY_POC_V2_ORGANIZER_PORT || 4401);
const server = createOrganizerServer(port);

server.on('listening', () => {
  console.log(`ARY Organizer: http://127.0.0.1:${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`组织方服务启动失败：端口 ${port} 已被占用。`);
    console.error('可以先关闭占用该端口的服务，或使用 ARY_POC_V2_ORGANIZER_PORT 指定其他端口。');
    process.exit(1);
  }
  throw error;
});
