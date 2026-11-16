import { getTool } from './registry.ts';
import { isImageFile, isPdfFile } from './types.ts';
import type {
  PipelineExecutionResult,
  PipelineStep,
  PipelineStepSummary,
  VirtualFile,
} from './types.ts';

export type PipelineProgressCallback = (
  stepIndex: number,
  totalSteps: number,
  stepTool: string,
  stepPercent: number,
  message?: string,
) => void;

export async function runPipeline(
  initialFiles: VirtualFile[],
  steps: PipelineStep[],
  onProgress?: PipelineProgressCallback,
): Promise<PipelineExecutionResult> {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('Pipeline requires at least one step.');
  }

  const pipelineStart = Date.now();
  let currentFiles: VirtualFile[] = [...initialFiles];
  let latestPdf: VirtualFile | undefined = initialFiles.find(isPdfFile);
  let latestImage: VirtualFile | undefined = initialFiles.find(isImageFile);
  const stepSummaries: PipelineStepSummary[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const toolDef = getTool(step.tool);
    if (!toolDef) {
      throw new Error(`Unknown tool "${step.tool}" at pipeline step ${i + 1}.`);
    }

    let stepInputs = [...currentFiles];

    // Smart combinator wiring for pdf.stamp_image when chained after QR generation or watermark steps
    if (toolDef.id === 'pdf.stamp_image') {
      const hasPdf = stepInputs.some(isPdfFile);
      const hasImage = stepInputs.some(isImageFile);
      if (!hasPdf && latestPdf) {
        stepInputs = [latestPdf, ...stepInputs];
      }
      if (!hasImage && latestImage) {
        stepInputs = [...stepInputs, latestImage];
      }
    }

    if (stepInputs.length < toolDef.minInputs) {
      throw new Error(
        `Step ${i + 1} (${toolDef.id}) requires at least ${toolDef.minInputs} input file(s), but received ${stepInputs.length}.`,
      );
    }

    onProgress?.(i, steps.length, toolDef.id, 0, `Running ${toolDef.name}`);
    const stepStart = Date.now();
    const result = await toolDef.execute(stepInputs, step.params ?? {}, {
      onProgress: (pct, msg) => {
        onProgress?.(i, steps.length, toolDef.id, pct, msg);
      },
    });
    const durationMs = Date.now() - stepStart;

    currentFiles = result.files;
    const producedPdf = result.files.find(isPdfFile);
    const producedImage = result.files.find(isImageFile);
    if (producedPdf) latestPdf = producedPdf;
    if (producedImage) latestImage = producedImage;

    stepSummaries.push({
      stepIndex: i + 1,
      tool: toolDef.id,
      summary: result.summary,
      inputCount: stepInputs.length,
      outputCount: result.files.length,
      durationMs,
      ...(result.metadata ? { metadata: result.metadata } : {}),
    });
  }

  return {
    files: currentFiles,
    steps: stepSummaries,
    totalDurationMs: Date.now() - pipelineStart,
  };
}
