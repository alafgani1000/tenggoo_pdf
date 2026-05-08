/// <reference lib="webworker" />
import createGhostscriptModule from '@jspawn/ghostscript-wasm/gs.js';
import ghostscriptWasmUrl from '@jspawn/ghostscript-wasm/gs.wasm?url';

type Quality = 'low' | 'medium' | 'high' | 'pro';

type CompressRequest = {
  type: 'compress';
  fileBuffer: ArrayBuffer;
  quality: Quality;
};

type WorkerProgress = {
  type: 'progress';
  progress: number;
};

type WorkerSuccess = {
  type: 'success';
  outputBuffer: ArrayBuffer;
};

type WorkerError = {
  type: 'error';
  message: string;
  details?: string;
};

const QUALITY_ARGS: Record<Quality, { pdfSetting: '/screen' | '/ebook' | '/printer' | '/prepress'; imageDpi: number }> =
  {
    low: { pdfSetting: '/screen', imageDpi: 96 },
    medium: { pdfSetting: '/ebook', imageDpi: 150 },
    high: { pdfSetting: '/printer', imageDpi: 220 },
    pro: { pdfSetting: '/prepress', imageDpi: 300 },
  };

const postProgress = (progress: number) => {
  const payload: WorkerProgress = { type: 'progress', progress };
  workerScope.postMessage(payload);
};

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = async (event: MessageEvent<CompressRequest>) => {
  if (event.data.type !== 'compress') return;

  const { fileBuffer, quality } = event.data;
  const cfg = QUALITY_ARGS[quality];
  const outputFileName = 'output.pdf';
  const stderrLogs: string[] = [];

  try {
    postProgress(10);

    const gsModule = await createGhostscriptModule({
      locateFile: (path: string) => (path.endsWith('.wasm') ? ghostscriptWasmUrl : path),
      noInitialRun: true,
      printErr: (text: string) => {
        if (text) stderrLogs.push(text);
      },
    } as any);

    postProgress(35);
    gsModule.FS.writeFile('input.pdf', new Uint8Array(fileBuffer));

    const args = [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      `-dPDFSETTINGS=${cfg.pdfSetting}`,
      '-dNOPAUSE',
      '-dBATCH',
      '-dQUIET',
      '-dDetectDuplicateImages=true',
      '-dCompressFonts=true',
      '-dSubsetFonts=true',
      '-dDownsampleColorImages=true',
      '-dDownsampleGrayImages=true',
      '-dDownsampleMonoImages=true',
      '-dColorImageDownsampleType=/Bicubic',
      '-dGrayImageDownsampleType=/Bicubic',
      '-dMonoImageDownsampleType=/Subsample',
      `-dColorImageResolution=${cfg.imageDpi}`,
      `-dGrayImageResolution=${cfg.imageDpi}`,
      `-dMonoImageResolution=${Math.max(150, cfg.imageDpi)}`,
      `-sOutputFile=${outputFileName}`,
      'input.pdf',
    ];

    postProgress(60);
    gsModule.callMain(args);

    postProgress(90);
    const outputBytes = gsModule.FS.readFile(outputFileName);
    const outputCopy = new Uint8Array(outputBytes.byteLength);
    outputCopy.set(outputBytes);

    const payload: WorkerSuccess = { type: 'success', outputBuffer: outputCopy.buffer };
    workerScope.postMessage(payload, [outputCopy.buffer]);
  } catch (error) {
    const details =
      `${error instanceof Error ? error.message : String(error)} ${stderrLogs.join(' ')}`.trim() || 'Unknown error';
    const payload: WorkerError = {
      type: 'error',
      message: 'Ghostscript worker failed to process this PDF.',
      details,
    };
    workerScope.postMessage(payload);
  }
};
