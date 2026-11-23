import { mock } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { OmniFocus } from '../../omnifocus.js';
import { fakeDatabase } from './fake-database.js';

/** JXA globals for a granted consent preflight, with `evaluate` standing in for OmniFocus. */
export function jxaGlobals(evaluate: (omniScript: string) => unknown) {
  return {
    ObjC: { import() {}, bindFunction() {} },
    $: {
      NSAppleEventDescriptor: { descriptorWithBundleIdentifier: () => ({ aeDesc: {} }) },
      AEDeterminePermissionToAutomateTarget: () => 0,
    },
    Application: () => ({ evaluateJavascript: evaluate }),
  };
}

/** An OmniFocus client whose bridge runs each composed script against a fake database. */
export function fakeOmniFocus() {
  const database = fakeDatabase();
  const of = new OmniFocus();
  const execute = mock(async (script: string) =>
    runInNewContext(
      script,
      jxaGlobals((omniScript) => runInNewContext(omniScript, database.context))
    )
  );
  of['executeJXA'] = execute;
  return { of, execute, ...database };
}
