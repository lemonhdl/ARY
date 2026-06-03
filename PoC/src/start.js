import { createAryServer } from './ary-server.js';

const aryPort = Number(process.env.ARY_PORT || 4100);
const organizerPort = Number(process.env.ORGANIZER_PORT || 4101);

createAryServer(aryPort, organizerPort);

console.log(`ARY PoC Demo:        http://127.0.0.1:${aryPort}`);
console.log(`Organizer port:      ${organizerPort}`);
console.log('Open /records to view Agent Riding Records.');
console.log('Open /evidence to run the Organizer availability experiment.');
console.log('Start Organizer in another terminal with: npm run start:organizer');
