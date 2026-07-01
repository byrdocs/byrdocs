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

## 返回的 item 结构
每个结果形如 { type, id, url, data }：
- type: "book" | "doc" | "test"
- id: 文件 md5（wiki 类为 "wiki-N"）
- url: 文件下载/查看地址
- data 因 type 而异：
  - book: { title, authors[], translators?[], edition?, publisher?, publish_year?, isbn[], filetype:"pdf", filesize? }
  - doc:  { title, filetype:"pdf"|"zip", course:[{type?,name?}], content:[...], filesize? }
  - test: { title, college?[], course:{type?,name}, time:{start,end,semester?,stage?}, content:[...], filetype:"pdf", filesize, wiki?:{url,data} }

## jmespath（可选）
JMESPath（https://jmespath.org）是 JSON 查询语言，作用于上一步得到的**结果数组**（每项形如 { type, id, url, data }），可做过滤、字段投影、排序、计数。执行顺序：keyword/type 过滤 → jmespath 求值 → limit 截断；total 为求值后数组长度。

语法约定（易错，务必遵守）：
- 嵌套字段用点号：data.title、data.course.name、data.time.stage。
- 字符串字面量用单引号：'book'、'期末'。
- 数字 / 布尔 / null 用反引号包裹：\`10000000\`、\`true\`、\`null\`（不要给数字加引号）。
- 过滤 [?表达式]：对每项求布尔值并保留为真者；比较 == != < <= > >=；逻辑 && || !。
- 投影 [].field 展开数组取字段；multiselect [].{a: x, b: y} 把每项重组为新对象。
- 管道 | 把左侧结果作为右侧新输入（如先过滤再切片）。
- 切片 [0:5]、[:10]、[::-1]；索引 [0]。
- 常用函数：length、contains、starts_with、ends_with、sort_by、max_by/min_by、reverse、keys、to_number。

示例：
- 只取标题：[].data.title
- 每项重组为标题+链接：[].{title: data.title, url: url}
- 近年教材的书名：[?type=='book' && data.publish_year >= '2020'].data.title
- 大于 10MB 的文件：[?data.filesize > \`10000000\`]
- 期末试题的标题/课程/链接：[?type=='test' && data.time.stage=='期末'].{title: data.title, course: data.course.name, url: url}
- 标题含“高等数学”：[?contains(data.title, '高等数学')]
- 先过滤再取前 3 个：[?type=='book'] | [0:3]
- 按出版年倒序：sort_by([?type=='book'], &data.publish_year) | reverse(@)
- 计数：length([?type=='book'])

非法表达式会以 isError 返回。若只想要下载链接，直接读每项的 url 字段即可（已含统计参数）。`;

const inputSchema = {
    keyword: z.string().optional().describe("关键词，可为普通词 / ISBN / 文件 MD5；留空表示不做关键词过滤"),
    jmespath: z.string().optional().describe("JMESPath 表达式，作用于结果数组做结构化查询/投影"),
    type: z.enum(["book", "doc", "test", "all"]).optional().describe("限定文件类型，默认 all"),
    limit: z.number().int().min(1).max(100).optional().describe("返回条数上限，默认 20，最大 100"),
};

export function buildMcpServer(env: Env): McpServer {
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
        async ({ keyword, jmespath, type, limit }) => {
            try {
                const result = await runSearch(env, { keyword, jmespath, type, limit });
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
