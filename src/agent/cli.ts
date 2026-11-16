import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getTool, listTools } from '../core/registry.ts';
import { runPipeline } from '../core/pipeline.ts';
import { formatByteSize } from '../core/types.ts';
import type { PipelineStep, ToolCategory } from '../core/types.ts';
import { readInputPaths, writeOutputFiles } from './fileIO.ts';

function parsePrimitive(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return raw;
}

function parseStepSpec(spec: string): PipelineStep {
  const colonIdx = spec.indexOf(':');
  if (colonIdx === -1) {
    return { tool: spec.trim(), params: {} };
  }

  const tool = spec.slice(0, colonIdx).trim();
  const rest = spec.slice(colonIdx + 1).trim();
  if (!rest) {
    return { tool, params: {} };
  }

  if (rest.startsWith('{')) {
    return { tool, params: JSON.parse(rest) as Record<string, unknown> };
  }

  const params: Record<string, unknown> = {};
  const pairs: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    if ((ch === '"' || ch === "'") && rest[i - 1] !== '\\') {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = ch;
      } else if (quoteChar === ch) {
        inQuotes = false;
      }
      current += ch;
    } else if (ch === ',' && !inQuotes) {
      if (current.trim()) pairs.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) pairs.push(current.trim());

  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    const valRaw = pair.slice(eqIdx + 1).trim();
    params[key] = parsePrimitive(valRaw);
  }

  return { tool, params };
}

function printHelp(): void {
  console.log(`Tenggoo Agent CLI — Headless PDF, Image, Utility & Pipeline Toolkit

Usage:
  npm run tenggoo -- list [--category pdf|image|utility] [--json]
  npm run tenggoo -- describe <tool-id> [--json]
  npm run tenggoo -- run <tool-id> [-i <files...>] [-o <path-or-dir>] [--params '<json>'] [--<key> <val>] [--json]
  npm run tenggoo -- pipeline [-i <files...>] [-o <path-or-dir>] [--steps '<json>'] [--step "<tool>:<k=v,...>"] [--json]

Examples:
  npm run tenggoo -- list --json
  npm run tenggoo -- run pdf.merge -i a.pdf b.pdf -o merged.pdf --json
  npm run tenggoo -- run util.qr_generate --text "https://tenggoo.my.id" -o qr.png --json
  npm run tenggoo -- pipeline -i doc.md --step "util.md_to_pdf:pageSize=A4" --step "util.qr_generate:text=https://tenggoo.my.id" --step "pdf.stamp_image:position=bottom-right" --step "pdf.page_numbers:position=bottom-center" -o final.pdf --json
`);
}

interface ParsedCliArgs {
  positionals: string[];
  inputs: string[];
  output?: string;
  json: boolean;
  category?: ToolCategory;
  paramsJson?: string;
  stepsJson?: string;
  stepsFile?: string;
  stepSpecs: string[];
  extraParams: Record<string, unknown>;
}

function parseCliArgs(argv: string[]): ParsedCliArgs {
  const result: ParsedCliArgs = {
    positionals: [],
    inputs: [],
    json: process.env.npm_config_json === 'true',
    stepSpecs: [],
    extraParams: {},
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '-i' || arg === '--input' || arg === '--inputs') {
      i++;
      while (i < argv.length && !argv[i].startsWith('-')) {
        result.inputs.push(argv[i]);
        i++;
      }
      continue;
    }
    if (arg === '-o' || arg === '--output') {
      result.output = argv[i + 1];
      i += 2;
      continue;
    }
    if (arg === '--json' || arg === '--json-output') {
      result.json = true;
      i++;
      continue;
    }
    if (arg === '--output-format' && argv[i + 1] === 'json') {
      result.json = true;
      i += 2;
      continue;
    }
    if (arg === '--category') {
      const cat = argv[i + 1] as ToolCategory | undefined;
      if (cat === 'pdf' || cat === 'image' || cat === 'utility') {
        result.category = cat;
      }
      i += 2;
      continue;
    }
    if (arg === '--params') {
      result.paramsJson = argv[i + 1];
      i += 2;
      continue;
    }
    if (arg === '--steps') {
      result.stepsJson = argv[i + 1];
      i += 2;
      continue;
    }
    if (arg === '--steps-file') {
      result.stepsFile = argv[i + 1];
      i += 2;
      continue;
    }
    if (arg === '--step') {
      if (argv[i + 1]) result.stepSpecs.push(argv[i + 1]);
      i += 2;
      continue;
    }
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        const key = arg.slice(2, eqIdx);
        const val = arg.slice(eqIdx + 1);
        result.extraParams[key] = parsePrimitive(val);
        i++;
      } else {
        const key = arg.slice(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('-')) {
          result.extraParams[key] = true;
          i++;
        } else {
          result.extraParams[key] = parsePrimitive(next);
          i += 2;
        }
      }
      continue;
    }
    result.positionals.push(arg);
    i++;
  }

  return result;
}

function isInspectionOnlyOutput(toolId: string, params: Record<string, unknown>): boolean {
  if (
    toolId === 'pdf.extract_text' ||
    toolId === 'pdf.extract_tables' ||
    toolId === 'pdf.form_inspect' ||
    toolId === 'pdf.diff_text' ||
    toolId === 'image.info' ||
    toolId === 'util.hash_checksum'
  ) {
    return true;
  }
  if (toolId === 'pdf.metadata' && (params.action ?? 'inspect') === 'inspect') return true;
  return false;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    printHelp();
    return;
  }

  const parsed = parseCliArgs(argv);
  const command = parsed.positionals[0];

  if (command === 'list') {
    const tools = listTools(parsed.category);
    if (parsed.json) {
      console.log(
        JSON.stringify(
          {
            count: tools.length,
            tools: tools.map((t) => ({
              id: t.id,
              mcpName: t.mcpName,
              category: t.category,
              name: t.name,
              description: t.description,
              minInputs: t.minInputs,
              maxInputs: t.maxInputs,
              acceptsMimeTypes: t.acceptsMimeTypes,
              producesMimeTypes: t.producesMimeTypes,
              parameterSchema: t.parameterSchema,
            })),
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(`Available Tenggoo Tools (${tools.length}):\n`);
    for (const tool of tools) {
      console.log(`  [${tool.category.toUpperCase()}] ${tool.id} (${tool.mcpName}) — ${tool.description}`);
    }
    return;
  }

  if (command === 'describe') {
    const toolId = parsed.positionals[1];
    if (!toolId) throw new Error('Usage: describe <tool-id>');
    const tool = getTool(toolId);
    if (!tool) throw new Error(`Unknown tool "${toolId}".`);

    const info = {
      id: tool.id,
      mcpName: tool.mcpName,
      category: tool.category,
      name: tool.name,
      description: tool.description,
      minInputs: tool.minInputs,
      maxInputs: tool.maxInputs,
      acceptsMimeTypes: tool.acceptsMimeTypes,
      producesMimeTypes: tool.producesMimeTypes,
      parameterSchema: tool.parameterSchema,
    };
    console.log(JSON.stringify(info, null, 2));
    return;
  }

  if (command === 'run') {
    const toolId = parsed.positionals[1];
    if (!toolId) throw new Error('Usage: run <tool-id> [-i <files...>] [-o <output>]');
    const tool = getTool(toolId);
    if (!tool) throw new Error(`Unknown tool "${toolId}".`);

    const jsonParams = parsed.paramsJson
      ? (JSON.parse(parsed.paramsJson) as Record<string, unknown>)
      : {};
    const mergedParams = { ...jsonParams, ...parsed.extraParams };
    const inputFiles = await readInputPaths(parsed.inputs);

    const start = Date.now();
    const res = await tool.execute(inputFiles, mergedParams);
    const durationMs = Date.now() - start;

    const shouldSkipDiskWrite = !parsed.output && isInspectionOnlyOutput(tool.id, mergedParams);
    const writtenPaths = shouldSkipDiskWrite
      ? []
      : await writeOutputFiles(res.files, parsed.output);

    if (parsed.json) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            tool: tool.id,
            summary: res.summary,
            durationMs,
            outputs: res.files.map((f, idx) => ({
              name: f.name,
              mimeType: f.mimeType,
              bytes: f.bytes.byteLength,
              sizeFormatted: formatByteSize(f.bytes.byteLength),
              path: writtenPaths[idx] ?? null,
              metadata: f.metadata ?? null,
            })),
            metadata: res.metadata ?? null,
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(res.summary);
    if (writtenPaths.length > 0) {
      for (const p of writtenPaths) console.log(`  -> ${p}`);
    } else if (res.metadata) {
      console.log(JSON.stringify(res.metadata, null, 2));
    }
    return;
  }

  if (command === 'pipeline') {
    let steps: PipelineStep[] = [];
    if (parsed.stepsFile) {
      const rawFile = await readFile(resolve(parsed.stepsFile), 'utf-8');
      steps = JSON.parse(rawFile) as PipelineStep[];
    } else if (parsed.stepsJson) {
      steps = JSON.parse(parsed.stepsJson) as PipelineStep[];
    } else if (parsed.stepSpecs.length > 0) {
      steps = parsed.stepSpecs.map(parseStepSpec);
    }

    if (steps.length === 0) {
      throw new Error('pipeline requires --steps <json>, --steps-file <path>, or --step "<tool>:<k=v>"');
    }

    const inputFiles = await readInputPaths(parsed.inputs);
    const res = await runPipeline(inputFiles, steps);
    const lastStepTool = steps[steps.length - 1]?.tool ?? '';
    const lastStepParams = steps[steps.length - 1]?.params ?? {};
    const shouldSkipDiskWrite =
      !parsed.output && isInspectionOnlyOutput(lastStepTool, lastStepParams);
    const writtenPaths = shouldSkipDiskWrite
      ? []
      : await writeOutputFiles(res.files, parsed.output);

    if (parsed.json) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            totalDurationMs: res.totalDurationMs,
            steps: res.steps,
            outputs: res.files.map((f, idx) => ({
              name: f.name,
              mimeType: f.mimeType,
              bytes: f.bytes.byteLength,
              sizeFormatted: formatByteSize(f.bytes.byteLength),
              path: writtenPaths[idx] ?? null,
              metadata: f.metadata ?? null,
            })),
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(`Pipeline finished (${res.steps.length} steps, ${res.totalDurationMs}ms):`);
    for (const st of res.steps) {
      console.log(`  [${st.stepIndex}] ${st.tool}: ${st.summary} (${st.durationMs}ms)`);
    }
    if (writtenPaths.length > 0) {
      console.log('Outputs:');
      for (const p of writtenPaths) console.log(`  -> ${p}`);
    }
    return;
  }

  throw new Error(`Unknown command "${command}". Run with --help to see usage.`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  if (
    process.argv.includes('--json') ||
    process.argv.includes('--json-output') ||
    process.env.npm_config_json === 'true'
  ) {
    console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  } else {
    console.error(`Error: ${message}`);
  }
  process.exitCode = 1;
});
