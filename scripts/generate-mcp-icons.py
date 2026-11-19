import base64
import binascii
import json
from pathlib import Path
import struct
import zlib


def segment_distance(x, y, start, end):
    dx, dy = end[0] - start[0], end[1] - start[1]
    t = max(0, min(1, ((x - start[0]) * dx + (y - start[1]) * dy) / (dx * dx + dy * dy)))
    return ((x - start[0] - t * dx) ** 2 + (y - start[1] - t * dy) ** 2) ** 0.5


def pixel(x, y):
    dx, dy = max(abs(x - 64) - 34, 0), max(abs(y - 64) - 34, 0)
    if dx * dx + dy * dy > 24 * 24:
        return (0, 0, 0, 0)
    check = min(
        segment_distance(x, y, (36, 65), (55, 84)),
        segment_distance(x, y, (55, 84), (94, 44)),
    )
    return (255, 255, 255, 255) if check <= 6 else (124, 58, 237, 255)


def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', binascii.crc32(kind + data))


def png(size):
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            samples = [pixel((x + (sx + 0.5) / 4) * 128 / size,
                             (y + (sy + 0.5) / 4) * 128 / size)
                       for sy in range(4) for sx in range(4)]
            alpha = sum(p[3] for p in samples)
            rgb = [round(sum(p[c] * p[3] for p in samples) / alpha) if alpha else 0
                   for c in range(3)]
            rows.extend([*rgb, round(alpha / 16)])
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(bytes(rows), 9)) + chunk(b'IEND', b''))


icons = [{'src': 'data:image/png;base64,' + base64.b64encode(png(size)).decode(),
          'mimeType': 'image/png', 'sizes': [f'{size}x{size}']} for size in (128, 64)]
target = Path(__file__).resolve().parents[1] / 'src/mcp/default-icons.ts'
target.write_text("import type { Icon } from '@modelcontextprotocol/sdk/types.js';\n\n"
                  + 'export const defaultIcons: Icon[] = ' + json.dumps(icons, indent=2) + ';\n')
