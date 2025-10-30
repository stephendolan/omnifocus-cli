import ora from 'ora';
import chalk from 'chalk';
import { OmniFocus } from './omnifocus.js';

export async function executeCommand<T>(
  loadingMessage: string,
  action: () => Promise<T>,
  onSuccess?: (result: T) => void,
  failureMessage?: string
): Promise<T> {
  const spinner = ora(loadingMessage).start();

  try {
    const result = await action();
    spinner.stop();
    onSuccess?.(result);
    return result;
  } catch (error) {
    spinner.fail(failureMessage || 'Command failed');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}

export async function executeOmniFocusCommand<T>(
  loadingMessage: string,
  action: (of: OmniFocus) => Promise<T>,
  onSuccess?: (result: T) => void,
  failureMessage?: string
): Promise<T> {
  const of = new OmniFocus();
  return executeCommand(loadingMessage, () => action(of), onSuccess, failureMessage);
}
