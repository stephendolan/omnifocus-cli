import { readFileSync } from 'node:fs';
import type { Icon } from '@modelcontextprotocol/sdk/types.js';
import { defaultIcons } from './default-icons.js';

export function loadMcpIcons(iconPath = process.env.OMNIFOCUS_MCP_ICON_PNG): Icon[] {
  if (!iconPath) return defaultIcons;
  const png = readFileSync(iconPath);
  if (
    png.length < 33 ||
    !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    png.readUInt32BE(8) !== 13 ||
    png.toString('ascii', 12, 16) !== 'IHDR' ||
    png.readUInt32BE(16) === 0 ||
    png.readUInt32BE(20) === 0
  ) {
    throw new Error(
      `OMNIFOCUS_MCP_ICON_PNG must name a PNG file with valid dimensions: ${iconPath}`
    );
  }
  return [
    {
      src: `data:image/png;base64,${png.toString('base64')}`,
      mimeType: 'image/png',
      sizes: [`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`],
    },
  ];
}
