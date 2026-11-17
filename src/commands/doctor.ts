import { Command } from 'commander';
import { withErrorHandling } from '../lib/command-utils.js';
import { OmniFocus } from '../lib/omnifocus.js';
import { outputJson } from '../lib/output.js';

export function createDoctorCommand(): Command {
  return new Command('doctor')
    .description('Check OmniFocus Automation consent without sending an Apple event')
    .option('--request-consent', 'Allow macOS to prompt for consent (attended use only)')
    .action(
      withErrorHandling(async (options) => {
        outputJson(await new OmniFocus().checkConsent(options.requestConsent === true));
      })
    );
}
