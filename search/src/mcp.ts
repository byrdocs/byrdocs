import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { InvalidJmespathError, runSearch } from "./search";
import type { Env } from "./env";

const TOOL_DESCRIPTION = `搜索 BYR Docs（北邮资料共享站）收录的文件：教材（book）、资料（doc）、试题（test）。

工作流程：先按 keyword 做关键词/精确匹配，再（可选）用 JMESPath 对结果数组做结构化查询与投影，最后按 limit 截断。

## keyword
- 普通词：中文分词后按相关度检索标题、作者、出版社、课程名等字段（多词 AND）。
- ISBN（13 位，可含连字符）：在 book 的 data.isbn 中精确匹配。
- MD5（32 位十六进制，即文件 id）：精确匹配单个文件。
- 留空：返回全部（配合 type / jmespath 使用）。

## type
限定文件类型：book | doc | test | all（默认 all）。

## shorten（可选，短链接）
设为 true 时，把返回结果中的 url（以及 test 的 data.wiki.url）转换为 go.byrdocs.org 短链后返回，不返回原始链接。需在连接 MCP 时通过 HTTP 头 Authorization: Bearer <token> 提供 go.byrdocs.org 短链服务的 token（mcp-remote 用 --header 传入）。缺少 token 或个别链接转换失败时，该条回退为原始链接。相同链接自动去重。转换发生在 limit 截断之后、且原链接已带 filename/f 统计参数。默认 false。

## 返回结构
工具返回 JSON 文本：{ total: number, results: Item[] }。
- total：JMESPath 求值后数组的长度（未截断）。
- results：其前 limit 项。
- 每个 Item 形如 { type, id, url, data }：id 为文件 MD5（wiki 条目为 "wiki-N"）；url 为下载/查看地址（/files/ 下载链接已含统计参数 filename、f，wiki 外链已 percent-encode，可直接使用）；data 随 type 分为三类：

type BookItem = {
  type: "book"
  id: string                 // 文件 MD5
  url: string                // 下载链接（已含统计参数）
  data: {
    title: string
    authors: string[]
    translators?: string[]
    edition?: string
    publisher?: string
    publish_year?: string    // 字符串，比较时用单引号
    isbn: string[]
    filetype: "pdf"
    filesize?: number        // 字节
  }
}

type DocItem = {
  type: "doc"
  id: string
  url: string
  data: {
    title: string
    filetype: "pdf" | "zip"
    course: { type?: "本科" | "研究生"; name?: string }[]
    content: ("思维导图" | "题库" | "答案" | "知识点" | "课件")[]
    filesize?: number
  }
}

type TestItem = {
  type: "test"
  id: string                 // 文件 MD5；wiki 条目为 "wiki-N"
  url: string
  data: {
    title: string            // 自动拼接：年份+学期+课程+(阶段)+试卷/答案
    college?: string[]
    course: { type?: "本科" | "研究生"; name: string }
    time: {
      start: string
      end: string
      semester?: "First" | "Second"
      stage?: "期中" | "期末"
    }
    content: ("原题" | "答案")[]
    filetype: "pdf" | "wiki"
    filesize?: number        // wiki 条目无此字段
    wiki?: {                 // 关联 wiki（部分 pdf 试卷有），data 结构同上但 filetype 为 "wiki"
      url: string
      data: object
    }
  }
}

## jmespath（可选）
JMESPath（https://jmespath.org）是 JSON 查询语言，作用于上一步得到的**结果数组**（每项形如 { type, id, url, data }），可做过滤、字段投影、排序、计数。执行顺序：keyword/type 过滤 → jmespath 求值 → limit 截断；total 为求值后数组长度。

语法约定（易错，务必遵守）：
- 嵌套字段用点号：data.title、data.course.name、data.time.stage。
- 字符串字面量用单引号：'book'、'期末'。
- 数字 / 布尔 / null 用反引号包裹：\`10000000\`、\`true\`、\`null\`（不要给数字加引号）。
- 过滤 [?表达式]：对每项求布尔值并保留为真者；比较 == != < <= > >=；逻辑 && || !。
- 投影 [].field 展开数组取字段；multiselect [].{a: x, b: y} 把每项重组为新对象。
- 管道 | 把左侧结果作为右侧新输入（如先过滤再切片）。
- 切片 [0:5]、[:10]、[::-1]；索引 [0]；@ 表示当前元素。
- 常用函数：length、contains、starts_with、ends_with、sort_by、max_by/min_by、reverse、keys、to_number。

示例：
- 取每项标题（字符串数组）：[].data.title
- 每项重组为标题+链接：[].{title: data.title, url: url}
- 只保留 book：[?type=='book']
- 过滤后再投影书名：[?type=='book'].data.title
- 字符串比较（publish_year 是字符串）：[?data.publish_year >= '2020']
- 数字比较（> 10MB，数字用反引号）：[?data.filesize > \`10000000\`]
- 逻辑与（期末试题）：[?type=='test' && data.time.stage=='期末']
- 函数：标题含子串：[?contains(data.title, '高等数学')]
- 切片 / 反转：[0:5]、[:10]、[::-1]
- 计数：length([?type=='book'])
- 先过滤再取前 3 个：[?type=='book'] | [0:3]
- 按出版年排序后倒序：sort_by([?type=='book'], &data.publish_year) | reverse(@)

非法表达式会以 isError 返回。若只想要下载链接，直接读每项的 url 字段即可（已含统计参数）。`;

const inputSchema = {
    keyword: z.string().optional().describe("关键词，可为普通词 / ISBN / 文件 MD5；留空表示不做关键词过滤"),
    jmespath: z.string().optional().describe("JMESPath 表达式，作用于结果数组做结构化查询/投影"),
    type: z.enum(["book", "doc", "test", "all"]).optional().describe("限定文件类型，默认 all"),
    limit: z.number().int().min(1).max(100).optional().describe("返回条数上限，默认 20，最大 100"),
    shorten: z.boolean().optional().describe("设为 true 且连接时提供了 Authorization: Bearer <token>（go.byrdocs.org 短链服务 token），则把结果中的 url（及 test 的 data.wiki.url）转换为短链后返回；缺少 token 或转换失败的链接回退为原始链接。默认 false"),
};

export function buildMcpServer(env: Env, shortenToken?: string): McpServer {
    const server = new McpServer({
        name: "byrdocs-search",
        version: "1.0.0",
    });

    server.registerTool(
        "search_files",
        {
            title: "搜索 BYR Docs 文件",
            description: TOOL_DESCRIPTION,
            inputSchema,
        },
        async ({ keyword, jmespath, type, limit, shorten }) => {
            try {
                const result = await runSearch(env, { keyword, jmespath, type, limit, shorten, shortenToken });
                return {
                    content: [{ type: "text", text: JSON.stringify(result) }],
                };
            } catch (error) {
                if (error instanceof InvalidJmespathError) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: `无效的 JMESPath 表达式：${error.message}` }],
                    };
                }
                return {
                    isError: true,
                    content: [{ type: "text", text: `搜索失败：${(error as Error).message}` }],
                };
            }
        },
    );

    return server;
}
