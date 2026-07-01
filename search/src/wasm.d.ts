declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}

declare module "jieba-wasm/web" {
  export type SyncInitInput = BufferSource | WebAssembly.Module;
  export function initSync(module: { module: SyncInitInput } | SyncInitInput): unknown;
  export function cut_for_search(text: string, hmm?: boolean | null): string[];
}
