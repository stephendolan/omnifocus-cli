import { OmniFocus } from '../../../lib/omnifocus.js';
import { runMcpHttpServer } from '../../http.js';
import type { AddressInfo } from 'node:net';

const pending: Array<() => void> = [];
const of = new OmniFocus();
of.listPerspectives = async () => {
  await new Promise<void>((resolve) => {
    pending.push(resolve);
    process.send?.({ started: pending.length });
  });
  return [{ id: 'Inbox', name: 'Inbox' }];
};
process.on('message', () => {
  pending.splice(0).forEach((resolve) => resolve());
  setImmediate(() => process.send?.({ released: true }));
});
const server = await runMcpHttpServer(0, [], { omniFocus: of });
process.send?.({ port: (server.address() as AddressInfo).port });
