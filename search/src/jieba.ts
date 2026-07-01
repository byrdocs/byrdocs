import wasmModule from "../node_modules/jieba-wasm/pkg/web/jieba_rs_wasm_bg.wasm";
import { initSync, cut_for_search } from "jieba-wasm/web";

initSync({ module: wasmModule });

export { cut_for_search };
