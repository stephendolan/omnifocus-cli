export interface OutputOptions {
  compact?: boolean;
}

let globalOutputOptions: OutputOptions = {};

export function setOutputOptions(options: OutputOptions): void {
  globalOutputOptions = options;
}

export function outputJson(data: unknown, options: OutputOptions = {}): void {
  const mergedOptions = { ...globalOutputOptions, ...options };
  const jsonString = mergedOptions.compact
    ? JSON.stringify(data)
    : JSON.stringify(data, null, 2);

  console.log(jsonString);
}
