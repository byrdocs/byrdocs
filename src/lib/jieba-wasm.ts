import init from "jieba-wasm";

let wasmInit: Promise<void> | null = null;
let wasmReady = false;

export function getWasmInit() {
    if (!wasmInit) {
        wasmInit = init("/jieba_rs_wasm_bg_2.2.0.wasm").then(() => {
            wasmReady = true;
        });
    }
    return wasmInit;
}

export function isWasmReady() {
    return wasmReady;
}
