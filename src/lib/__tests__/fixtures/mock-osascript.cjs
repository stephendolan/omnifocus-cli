#!/usr/bin/env node
const { runInNewContext } = require('node:vm');

let script = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { script += chunk; });
process.stdin.on('end', () => {
  try {
    const status = Number(process.env.OF_TEST_PERMISSION_STATUS || 0);
    const result = runInNewContext(script, {
      ObjC: {
        import() {},
        bindFunction(name, signature) {
          const expected = ['int', ['void *', 'unsigned int', 'unsigned int', 'bool']];
          if (name !== 'AEDeterminePermissionToAutomateTarget' || JSON.stringify(signature) !== JSON.stringify(expected)) {
            throw new Error('Invalid native Automation permission ABI');
          }
        },
      },
      $: {
        NSAppleEventDescriptor: { descriptorWithBundleIdentifier: () => ({ aeDesc: {} }) },
        AEDeterminePermissionToAutomateTarget: () => status,
        NSThread: { sleepForTimeInterval: (seconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000) },
      },
      Application: () => { throw new Error('Mock forbids live OmniFocus events'); },
    });
    process.stdout.write(String(result) + '\n');
  } catch (error) {
    process.stderr.write(String(error) + '\n');
    process.exitCode = 1;
  }
});
