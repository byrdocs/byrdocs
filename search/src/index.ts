import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import { StreamableHTTPTransport } from "@hono/mcp";
import { z } from "zod";
import { InvalidJmespathError, runSearch } from "./search";
import { buildMcpServer } from "./mcp";
import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

const searchSchema = z.object({
    keyword: z.string().optional(),
    jmespath: z.string().optional(),
    type: z.enum(["book", "doc", "test", "all"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
});

app.use("/api/*", cors({
    origin: "*",
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
}));

app.post("/api/search", zValidator("json", searchSchema), async (c) => {
    const params = c.req.valid("json");
    try {
        const result = await runSearch(c.env, params);
        return c.json(result);
    } catch (error) {
        if (error instanceof InvalidJmespathError) {
            return c.json({ error: "invalid_jmespath", message: error.message }, 400);
        }
        console.error("search failed", error);
        return c.json({ error: "internal_error", message: (error as Error).message }, 500);
    }
});

app.all("/mcp", async (c) => {
    const server = buildMcpServer(c.env);
    const transport = new StreamableHTTPTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
    });
    await server.connect(transport);
    const response = await transport.handleRequest(c);
    return response ?? c.body(null, 204);
});

export default app;
