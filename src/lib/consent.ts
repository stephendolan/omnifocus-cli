export const OMNIFOCUS_BUNDLE_ID = 'com.omnigroup.OmniFocus4';

export class AutomationPermissionError extends Error {
  readonly execPath = process.execPath;
  readonly statusCode: number;

  constructor(public readonly osStatus: number) {
    const status =
      osStatus === -1744 ? 'consent required' : osStatus === -1743 ? 'denied' : 'preflight failed';
    super(
      `OmniFocus Automation ${status} (${osStatus}) for ${process.execPath}. TCC responsibility may be inherited from an ancestor process. Run of doctor --request-consent only in an attended, intended client context.`
    );
    this.statusCode = osStatus === -1744 || osStatus === -1743 ? 403 : 503;
    this.name =
      osStatus === -1744
        ? 'automation_consent_required'
        : osStatus === -1743
          ? 'automation_denied'
          : 'automation_preflight_failed';
  }
}

export function consentPreflight(requestConsent = false): string {
  return `
    ObjC.import('Cocoa');
    ObjC.import('CoreServices');
    ObjC.bindFunction('AEDeterminePermissionToAutomateTarget', ['int', ['void *', 'uint', 'uint', 'bool']]);
    const target = $.NSAppleEventDescriptor.descriptorWithBundleIdentifier('${OMNIFOCUS_BUNDLE_ID}');
    const permissionStatus = $.AEDeterminePermissionToAutomateTarget(target.aeDesc, 0x2a2a2a2a, 0x2a2a2a2a, ${requestConsent});
    if (permissionStatus !== 0) throw new Error('OF_AUTOMATION_PERMISSION:' + permissionStatus);
  `;
}
