import init from "jieba-wasm";

const WASM_DECODED_SIZE = 4015140;

let wasmInit: Promise<void> | null = null;
let wasmReady = false;
let progressCallback: ((received: number, total: number) => void) | null = null;

export function setWasmProgressCallback(cb: (received: number, total: number) => void) {
    progressCallback = cb;
}

export function getWasmInit() {
    if (!wasmInit) {
        wasmInit = (async () => {
            const response = await fetch("/jieba_rs_wasm_bg_2.4.0.wasm");
            const contentEncoding = response.headers.get("content-encoding");
            const sizeHeader = response.headers.get("content-length");
            const totalSize = contentEncoding
                ? WASM_DECODED_SIZE
                : (sizeHeader ? parseInt(sizeHeader, 10) : WASM_DECODED_SIZE);
            const canTrack = response.body !== null;

            if (canTrack) {
                progressCallback?.(0, totalSize);
            }

            let wasmBytes: ArrayBuffer;
            if (canTrack) {
                const reader = response.body!.getReader();
                const chunks: Uint8Array[] = [];
                let received = 0;
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (value) {
                        chunks.push(value);
                        received += value.length;
                        progressCallback?.(received, totalSize);
                    }
                }
                const merged = new Uint8Array(received);
                let offset = 0;
                for (const chunk of chunks) {
                    merged.set(chunk, offset);
                    offset += chunk.length;
                }
                wasmBytes = merged.buffer;
            } else {
                wasmBytes = await response.arrayBuffer();
                if (canTrack) {
                    progressCallback?.(totalSize, totalSize);
                }
            }

            await init(wasmBytes);
            wasmReady = true;
        })();
    }
    return wasmInit;
}

export function isWasmReady() {
    return wasmReady;
}
