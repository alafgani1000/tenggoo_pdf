declare module '@jspawn/ghostscript-wasm/gs.mjs' {
  type GhostscriptModule = {
    FS: {
      writeFile(path: string, data: Uint8Array): void;
      readFile(path: string): Uint8Array;
    };
    callMain(args?: string[]): void;
  };

  type GhostscriptModuleFactory = (options?: {
    locateFile?: (path: string) => string;
    noInitialRun?: boolean;
    print?: (text: string) => void;
    printErr?: (text: string) => void;
    instantiateWasm?: (
      imports: WebAssembly.Imports,
      receiveInstance: (instance: WebAssembly.Instance) => void,
    ) => Record<string, unknown>;
  }) => Promise<GhostscriptModule>;

  const createGhostscriptModule: GhostscriptModuleFactory;
  export default createGhostscriptModule;
}

declare module '@jspawn/ghostscript-wasm/gs.js' {
  type GhostscriptModule = {
    FS: {
      writeFile(path: string, data: Uint8Array): void;
      readFile(path: string): Uint8Array;
    };
    callMain(args?: string[]): void;
  };

  type GhostscriptModuleFactory = (options?: {
    locateFile?: (path: string) => string;
    noInitialRun?: boolean;
    print?: (text: string) => void;
    printErr?: (text: string) => void;
    instantiateWasm?: (
      imports: WebAssembly.Imports,
      receiveInstance: (instance: WebAssembly.Instance) => void,
    ) => Record<string, unknown>;
  }) => Promise<GhostscriptModule>;

  const createGhostscriptModule: GhostscriptModuleFactory;
  export default createGhostscriptModule;
}
