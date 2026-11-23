// Declared apart from globals.ts because the root TypeScript project also loads
// browser types, whose `document` would clash. Only src/omni/tsconfig.json
// includes this file.
declare global {
  const document: Database['document'];
}

export {};
