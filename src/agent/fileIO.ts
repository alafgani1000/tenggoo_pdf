import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import { guessMimeType } from '../core/types.ts';
import type { VirtualFile } from '../core/types.ts';

export async function readInputPaths(inputPaths: string[]): Promise<VirtualFile[]> {
  const loaded: VirtualFile[] = [];
  for (const rawPath of inputPaths) {
    const absPath = resolve(rawPath);
    const buffer = await readFile(absPath);
    const name = basename(absPath);
    loaded.push({
      name,
      mimeType: guessMimeType(name),
      bytes: new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
      metadata: { sourcePath: absPath },
    });
  }
  return loaded;
}

export async function writeOutputFiles(
  files: VirtualFile[],
  outputTarget?: string,
): Promise<string[]> {
  if (files.length === 0) return [];

  const writtenPaths: string[] = [];

  if (!outputTarget) {
    for (const file of files) {
      const target = resolve(process.cwd(), file.name);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.bytes);
      writtenPaths.push(target);
    }
    return writtenPaths;
  }

  const absTarget = resolve(outputTarget);
  let treatAsDir = files.length > 1 || outputTarget.endsWith('/') || outputTarget.endsWith('\\');

  if (!treatAsDir) {
    try {
      const info = await stat(absTarget);
      if (info.isDirectory()) {
        treatAsDir = true;
      }
    } catch {
      // Target does not exist yet: treat as file if it has an extension
      treatAsDir = extname(absTarget) === '';
    }
  }

  if (treatAsDir) {
    await mkdir(absTarget, { recursive: true });
    for (const file of files) {
      const dest = resolve(absTarget, file.name);
      await writeFile(dest, file.bytes);
      writtenPaths.push(dest);
    }
  } else {
    await mkdir(dirname(absTarget), { recursive: true });
    await writeFile(absTarget, files[0].bytes);
    writtenPaths.push(absTarget);
  }

  return writtenPaths;
}
