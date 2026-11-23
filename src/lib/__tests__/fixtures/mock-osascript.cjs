#!/usr/bin/env node
// Stands in for /usr/bin/osascript. It runs the JXA it receives on stdin in a
// vm, never sends an Apple event, and reaches a database only when
// OF_TEST_OMNI_CONTEXT names a module that exports fake Omni Automation globals.
const { runInNewContext } = require('node:vm');

let script = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { script += chunk; });
process.stdin.on('end', () => {
  try {
    const status = Number(process.env.OF_TEST_PERMISSION_STATUS || 0);
    const contextPath = process.env.OF_TEST_OMNI_CONTEXT;
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
      Application: () => {
        if (!contextPath) throw new Error('Mock forbids live OmniFocus events');
        const { context } = require(contextPath);
        return { evaluateJavascript: (omniScript) => runInNewContext(omniScript, context) };
      },
    });
    process.stdout.write(String(result) + '\n');
  } catch (error) {
    process.stderr.write(String(error) + '\n');
    process.exitCode = 1;
  }
});
