import { type Context, Hono } from 'hono'
import { OAuth } from '../objects/oauth';
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { setCookie } from '..';
import { byrdocs_login } from '@byrdocs/bupt-auth';

const OAUTH_SERVICES: Record<string, { redirect_uri: string }> = {
    "byrdocs-publish": {
        "redirect_uri": "https://publish.byrdocs.org/callback"
    }
}

export default new Hono<{
    Bindings: Cloudflare.Env,
    Variables: {
        auth: DurableObjectStub<OAuth>
    }
}>()
    .use(async (c, next) => {
        const id: DurableObjectId = c.env.OAUTH.idFromName("oauth");
        const stub: DurableObjectStub<OAuth> = c.env.OAUTH.get(id);
        c.set("auth", stub)
        await next()
    })
    .get("/github/:uuid", async c => {
        const uuid = c.req.param("uuid")
        const state = await c.get('auth').get(uuid)
        const origin = new URL(c.req.url).origin
        return c.redirect("https://github.com/login/oauth/authorize?" + new URLSearchParams({
            client_id: c.env.GITHUB_CLIENT_ID,
            redirect_uri: origin + "/callback/" + (state.service || "byrdocs"),
            state: uuid,
            // scope: "read:org"
        }))
    })
    // cli 登录
    .post("/login", async c => {
        const uuid = await c.get('auth').begin("byrdocs-cli")
        const origin = new URL(c.req.url).origin
        return c.json({
            tokenURL: origin + "/api/auth/token/" + uuid,
            loginURL: origin + "/auth/" + uuid + "/byrdocs-cli",
            success: true
        })
    })
    // 第三方登录
    .get("/oauth", async c => {
        const service = c.req.query("service")
        if (!service || !OAUTH_SERVICES[service])
            return c.json({ error: "service not found", success: false })
        const uuid = await c.get('auth').begin(service)
        const origin = new URL(c.req.url).origin
        return c.redirect(origin + "/auth/" + uuid + "/" + service)
    })
    // 主站登录
    .get("/login", async c => {
        const uuid = await c.get('auth').begin("byrdocs", c.req.query("to"))
        const origin = new URL(c.req.url).origin
        return c.redirect(origin + "/auth/" + uuid + "/byrdocs")
    })
    .get("/token/:uuid", async c => {
        const uuid = c.req.param("uuid")
        try {
            const token = await c.get('auth').listen(uuid)
            if (token) {
                return c.json({ token, success: true })
            } else {
                return c.json({ error: "会话过期，请重新登录", success: false })
            }
        } catch (e) {
            return c.json({ error: (e as Error).message || e?.toString() || "未知错误", success: false })
        }
    })
    // GitHub 回调
    .post("/callback", zValidator('json', z.object({
        code: z.string(),
        state: z.string(),
    })), async c => {
        const { code, state } = c.req.valid("json")
        try {
            return afterLogin(c, await c.get('auth').login(code, state))
        } catch (e) {
            return c.json({ error: (e as Error).message || e?.toString() || "未知错误", success: false })
        }
    })
    // 北邮登录
    .post("/bupt_login", zValidator('json', z.object({
        username: z.string(),
        password: z.string(),
        uuid: z.string(),
    })), async c => {
        const { username, password, uuid } = c.req.valid("json")
        try {
            await byrdocs_login(username, password, c.env.OCR_TOKEN)
            return afterLogin(c, await c.get('auth').loginBUPT(username, uuid))
        } catch (e) {
            return c.json({ error: (e as Error).message || e?.toString() || "未知错误", success: false })
        }
    })

async function afterLogin(c: Context, { service, token, data }: { service: string, token: string, data?: any }) {
    if (service === 'byrdocs') await setCookie(c)
    if (service === 'byrdocs' || service === 'byrdocs-cli') {
        return c.json({ token, data, success: true })
    }
    const serivice_info = OAUTH_SERVICES[service]
    if (!serivice_info) return c.json({ error: "service not found", success: false })
    const payload: Record<string, string> = { token }
    if (data) {
        payload.data = typeof data === 'string' ? data : JSON.stringify(data)
    }
    return c.json({
        redirect: serivice_info.redirect_uri + "?" + new URLSearchParams(payload),
        success: true
    })
}
