import { describe, expect, it, mock, spyOn } from 'bun:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';
import { OmniFocus } from '../omnifocus.js';
import { AutomationPermissionError } from '../consent.js';
import { mockJxaEnvironment } from './fixtures/mock-jxa.js';
import { createDoctorCommand } from '../../commands/doctor.js';

const execFileAsync = promisify(execFile);

describe('Automation consent', () => {
  for (const status of [-1744, -1743, -600]) {
    it(`blocks Apple events on preflight status ${status}`, async () => {
      const application = mock(() => ({ evaluateJavascript: () => '[]' }));
      const determine = mock(() => status);
      const of = new OmniFocus();
      of['executeJXA'] = async (script) =>
        runInNewContext(script, {
          ObjC: { import() {}, bindFunction() {} },
          $: {
            NSAppleEventDescriptor: {
              descriptorWithBundleIdentifier: (id: string) => {
                expect(id).toBe('com.omnigroup.OmniFocus4');
                return { aeDesc: 'target' };
              },
            },
            AEDeterminePermissionToAutomateTarget: determine,
          },
          Application: application,
        });
      await expect(of.listPerspectives()).rejects.toThrow(`OF_AUTOMATION_PERMISSION:${status}`);
      expect(determine).toHaveBeenCalledWith('target', 0x2a2a2a2a, 0x2a2a2a2a, false);
      expect(application).not.toHaveBeenCalled();
    });
  }

  it('allows the requested operation when preflight grants access', async () => {
    const of = new OmniFocus();
    const evaluate = mock(() => '[{"id":"Inbox","name":"Inbox"}]');
    of['executeJXA'] = async (script) =>
      runInNewContext(script, {
        ObjC: { import() {}, bindFunction() {} },
        $: {
          NSAppleEventDescriptor: { descriptorWithBundleIdentifier: () => ({ aeDesc: {} }) },
          AEDeterminePermissionToAutomateTarget: () => 0,
        },
        Application: () => ({ evaluateJavascript: evaluate }),
      });
    expect(await of.listPerspectives()).toEqual([{ id: 'Inbox', name: 'Inbox' }]);
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  for (const requestConsent of [false, true]) {
    it(`doctor passes askUserIfNeeded=${requestConsent} without creating an application`, async () => {
      const of = new OmniFocus();
      const application = mock(() => {
        throw new Error('Unexpected Apple event');
      });
      const determine = mock(() => 0);
      of['executeJXA'] = async (script) =>
        runInNewContext(script, {
          ObjC: { import() {}, bindFunction() {} },
          $: {
            NSAppleEventDescriptor: {
              descriptorWithBundleIdentifier: () => ({ aeDesc: 'target' }),
            },
            AEDeterminePermissionToAutomateTarget: determine,
          },
          Application: application,
        });
      expect(await of.checkConsent(requestConsent)).toEqual({
        status: 'granted',
        osStatus: 0,
        execPath: process.execPath,
        target: 'com.omnigroup.OmniFocus4',
        promptRequested: requestConsent,
      });
      expect(determine).toHaveBeenCalledWith('target', 0x2a2a2a2a, 0x2a2a2a2a, requestConsent);
      expect(application).not.toHaveBeenCalled();
    });
  }

  for (const [status, name] of [
    [-1744, 'automation_consent_required'],
    [-1743, 'automation_denied'],
  ] as const) {
    it(`doctor emits typed JSON and exits unsuccessfully for ${status} (mock executable)`, async () => {
      const fixture = await mockJxaEnvironment();
      try {
        const result = await execFileAsync('node', ['dist/cli.js', 'doctor'], {
          env: { ...fixture.env, OF_TEST_PERMISSION_STATUS: String(status) },
        }).then(
          () => {
            throw new Error('Expected failure');
          },
          (error) => error
        );
        expect(result.code).toBe(1);
        const parsed = JSON.parse(result.stdout);
        expect(parsed.error).toMatchObject({ name, osStatus: status, statusCode: 403 });
        expect(parsed.error.execPath).toMatch(/node/);
        expect(parsed.error.detail).toContain(parsed.error.execPath);
      } finally {
        await fixture.cleanup();
      }
    });
  }

  it('models consent failures as typed errors naming the current executable', () => {
    const error = new AutomationPermissionError(-1744);
    expect(error.name).toBe('automation_consent_required');
    expect(error.execPath).toBe(process.execPath);
    expect(error.message).toContain(process.execPath);
  });

  for (const args of [[], ['--request-consent']]) {
    it(`doctor command requests consent only with the explicit flag (${args.length} args)`, async () => {
      const check = spyOn(OmniFocus.prototype, 'checkConsent').mockResolvedValue({
        status: 'granted',
        osStatus: 0,
        execPath: process.execPath,
        target: 'com.omnigroup.OmniFocus4',
        promptRequested: args.length > 0,
      });
      const output = spyOn(console, 'log').mockImplementation(() => {});
      try {
        await createDoctorCommand().parseAsync(args, { from: 'user' });
        expect(check).toHaveBeenCalledWith(args.length > 0);
        expect(JSON.parse(String(output.mock.calls[0][0])).promptRequested).toBe(args.length > 0);
      } finally {
        check.mockRestore();
        output.mockRestore();
      }
    });
  }

  it('doctor reports a grant without sending an Apple event (mock executable)', async () => {
    const fixture = await mockJxaEnvironment();
    try {
      const { stdout } = await execFileAsync('node', ['dist/cli.js', 'doctor'], {
        env: { ...fixture.env, OF_TEST_PERMISSION_STATUS: '0' },
      });
      expect(JSON.parse(stdout)).toMatchObject({
        status: 'granted',
        osStatus: 0,
        target: 'com.omnigroup.OmniFocus4',
        promptRequested: false,
      });
    } finally {
      await fixture.cleanup();
    }
  });
});
