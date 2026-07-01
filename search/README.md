# byrdocs-search

BYR Docs 文件搜索服务，一个独立的 Cloudflare Worker，提供三件事：

- **HTTP API** — `POST /api/search`，供程序直接调用。
- **MCP server** — `/mcp`（无状态 Streamable HTTP），供 Claude Desktop 等 AI 客户端调用。
- **文档首页** — `/`，带交互式 playground 的 API / MCP 文档；`/llms.txt` 为面向 LLM 的纯文本文档。

线上地址：<https://search.byrdocs.org>（同时可用 <https://search-byrdocs.youx.am>）。

## 工作原理

数据来自公开静态文件，无需认证、不绑定 R2/D1：

- `metadata.json`（教材 / 资料 / 试题元数据）
- `wiki.json`（wiki 试题）

一次查询按顺序执行：`keyword` / `type` 过滤 → 可选的 JMESPath 求值 → `limit` 截断。

- **关键词检索**：`MiniSearch` + `jieba-wasm`（`cut_for_search` 中文分词），与主站前端搜索语义对齐。ISBN / MD5 走精确匹配。
- **结构化查询**：`@jmespath-community/jmespath`，作用于关键词结果数组。

搜索核心（`src/search.ts`）复用主仓库 `../src/lib` 与 `../src/types.ts` 的纯函数与类型，保证与前端一致。

## 目录结构

```
search/
  wrangler.toml        # Worker 配置：自定义域名、assets、run_worker_first
  package.json
  src/
    index.ts           # Hono app：POST /api/search、ALL /mcp
    search.ts          # 搜索核心：加载/缓存 metadata、MiniSearch(jieba)、JMESPath 叠加、URL 处理
    jieba.ts           # jieba wasm 顶层 initSync + cut_for_search
    mcp.ts             # McpServer + search_files 工具
    env.ts             # Env 类型
    wasm.d.ts          # *.wasm import 声明
  public/
    index.html         # 文档首页
    style.css
    app.js             # playground 交互
    llms.txt           # 面向 LLM 的文档
```

## 开发

```bash
pnpm install
pnpm dev          # wrangler dev --config ./wrangler.toml
pnpm typecheck
pnpm deploy       # wrangler deploy --config ./wrangler.toml
```

> 所有 wrangler 命令都带 `--config ./wrangler.toml`：主站 `vite build` 会在仓库根写入 `.wrangler/deploy/config.json` 重定向，若不显式指定 config，在本子目录跑 wrangler 会误用祖先配置。

## API

见 [`/llms.txt`](public/llms.txt) 或线上文档首页。请求体：

```jsonc
{
  "keyword": "高等数学",   // 可选：普通词 / ISBN / MD5
  "type": "book",          // 可选：book | doc | test | all（默认 all）
  "jmespath": "[].data.title", // 可选：对结果数组做结构化查询
  "limit": 10              // 可选：默认 20，最大 100
}
```

响应 `{ total, results }`。非法 JMESPath 返回 `400`。

## 部署说明

- 部署在 **youx.am** Cloudflare 账户，自定义域名 `search-byrdocs.youx.am`。
- `search.byrdocs.org` 属于另一个账户（byrdocs.org），通过 Cloudflare for SaaS 自定义主机名 + youx.am zone 内的 Worker Route（`pattern = "search.byrdocs.org/*"`）接入，Worker Route 优先级高于 fallback origin。

### jieba-wasm 导入（易踩）

JS glue 用包导出路径，wasm 二进制用相对路径（specifier 以 `.wasm` 结尾才会触发 wrangler 的 wasm loader，不能用 alias）：

```ts
import { initSync, cut_for_search } from "jieba-wasm/web";
import wasm from "../node_modules/jieba-wasm/pkg/web/jieba_rs_wasm_bg.wasm";
initSync({ module: wasm });
```
