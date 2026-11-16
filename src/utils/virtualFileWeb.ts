import { getTool } from '../core/registry.ts';
import { guessMimeType } from '../core/types.ts';
import type { VirtualFile } from '../core/types.ts';

export async function filesToVirtualFiles(files: File[]): Promise<VirtualFile[]> {
  const result: VirtualFile[] = [];
  for (const file of files) {
    const buffer = await file.arrayBuffer();
    result.push({
      name: file.name,
      mimeType: file.type || guessMimeType(file.name),
      bytes: new Uint8Array(buffer),
    });
  }
  return result;
}

export function virtualFileToBlob(file: VirtualFile): Blob {
  const copy = new Uint8Array(file.bytes.byteLength);
  copy.set(file.bytes);
  return new Blob([copy], { type: file.mimeType || 'application/octet-stream' });
}

export function virtualFileToBlobUrl(file: VirtualFile): string {
  return URL.createObjectURL(virtualFileToBlob(file));
}

export function downloadVirtualFile(file: VirtualFile): void {
  const url = virtualFileToBlobUrl(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadVirtualFiles(
  files: VirtualFile[],
  zipArchiveName: string = 'tenggoo_outputs.zip',
): Promise<void> {
  if (files.length === 0) return;
  if (files.length === 1) {
    downloadVirtualFile(files[0]);
    return;
  }
  const zipTool = getTool('util.zip_pack');
  if (!zipTool) {
    downloadVirtualFile(files[0]);
    return;
  }
  const packed = await zipTool.execute(files, { archiveName: zipArchiveName });
  if (packed.files[0]) {
    downloadVirtualFile(packed.files[0]);
  }
}
