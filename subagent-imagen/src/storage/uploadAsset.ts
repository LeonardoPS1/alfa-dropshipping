import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_PATH = process.env.ASSET_STORAGE_PATH ?? '/data/assets';
const PUBLIC_BASE_URL = process.env.ASSET_PUBLIC_BASE_URL ?? 'http://localhost:4003/assets';

export function saveAsset(tenantId: string, buffer: Buffer, extension = 'png'): string {
  const dir = path.join(STORAGE_PATH, tenantId);
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${uuidv4()}.${extension}`;
  fs.writeFileSync(path.join(dir, filename), buffer);

  return `${PUBLIC_BASE_URL}/${tenantId}/${filename}`;
}
