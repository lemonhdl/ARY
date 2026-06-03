import { createOrganizerServer } from './organizer-server.js';

const organizerPort = Number(process.env.ORGANIZER_PORT || 4101);

createOrganizerServer(organizerPort);

console.log(`Organizer local data processor: http://127.0.0.1:${organizerPort}`);
console.log('Keep this terminal open while demonstrating the available state.');
console.log('Stop it with Ctrl+C to prove ARY does not persist Organizer data.');
