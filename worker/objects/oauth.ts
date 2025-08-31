import { DurableObject } from "cloudflare:workers";
import { v4 as uuidv4 } from 'uuid';
import { sign } from 'hono/jwt'

type State = {
    service: string,
    login: boolean,
    data?: string,
    createdAt: number,
    token?: string,
}

export class OAuth extends DurableObject {
    listeners: Map<string, Array<(_: string) => void>> = new Map();
    env: Cloudflare.Env;
    constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
        super(ctx, env);
        this.env = env;
        // 1h
        this.ctx.storage.setAlarm(Date.now() + 3600 * 1000);
    }

    async alarm() {
        const now = Date.now();
        for (const [key, value] of await this.ctx.storage.list<State>()) {
            if (now - value.createdAt > 3600 * 1000) {
                await this.ctx.storage.delete(key);
            }
        }
        this.ctx.storage.setAlarm(Date.now() + 3600 * 1000);
    }

    async begin(service: string, data?: string) {
        const uuid = uuidv4();
        this.ctx.storage.put<State>(uuid, {
            login: false,
            service,
            data,
            createdAt: Date.now(),
        });
        return uuid;
    }

    async get(uuid: string) {
        const state = await this.ctx.storage.get<State>(uuid);
        if (!state) {
            throw new Error('您的会话已过期，请重新登录');
        }
        return state;
    }

    async login(code: string, uuid: string) {
        const state = await this.ctx.storage.get<State>(uuid);
        if (!state) {
            throw new Error('您的会话已过期，请重新登录');
        }
        const tokenRes = await fetch("https://github.com/login/oauth/access_token?" + new URLSearchParams({
            client_id: this.env.GITHUB_CLIENT_ID,
            client_secret: this.env.GITHUB_CLIENT_SECRET,
            code,
        }), {
            method: "POST",
            headers: {
                Accept: "application/json"
            }
        });
        if (!tokenRes.ok) {
            throw new Error(await tokenRes.text());
        }
        const ghToken = await tokenRes.json() as {
            access_token?: string,
            error_description?: string
        };
        if (!ghToken.access_token) {
            if (ghToken.error_description) {
                throw new Error(ghToken.error_description);
            } else {
                throw new Error('未知错误');
            }
        }
        const res = await fetch("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${ghToken.access_token}`,
                Accept: "application/json",
                "User-Agent": "ByrDocs"
            }
        });
        if (!res.ok) {
            throw new Error(await res.text());
        }
        const { id, login } = await res.json() as { login: string, id: number };
        if (state.service === 'byrdocs') {
            const orgRes = await fetch(`https://api.github.com/orgs/byrdocs/members/${login}`, {
                headers: {
                    Authorization: `Bearer ${ghToken.access_token}`,
                    Accept: "application/json",
                    "User-Agent": "ByrDocs"
                }
            })
            if (orgRes.status !== 204) {
                throw new Error('您不是 byrdocs 组织的成员');
            }
        }
        const token = await sign({
            id: `GitHub-${id}`,
            iat: Math.floor(Date.now() / 1000),
        }, this.env.JWT_SECRET);
        state.login = true;
        state.token = token;
        await this.ctx.storage.put(uuid, state);
        const listeners = this.listeners.get(uuid) || [];
        this.listeners.delete(uuid);
        listeners.forEach(listener => listener(token));
        return {
            token,
            service: state.service,
            data: state.data
        }
    }

    async loginBUPT(username: string, uuid: string) {
        const state = await this.ctx.storage.get<State>(uuid);
        if (!state) {
            throw new Error('您的会话已过期，请重新登录');
        }
        const token = await sign({
            id: `BUPT-${username}`,
            iat: Math.floor(Date.now() / 1000),
        }, this.env.JWT_SECRET);
        state.login = true;
        state.token = token;
        await this.ctx.storage.put(uuid, state);
        const listeners = this.listeners.get(uuid) || [];
        this.listeners.delete(uuid);
        listeners.forEach(listener => listener(token));
        return {
            token,
            service: state.service,
            data: state.data
        }
    }

    async listen(uuid: string) {
        const state = await this.ctx.storage.get<State>(uuid);
        if (!state) {
            throw new Error('您的会话已过期，请重新登录');
        }
        if (state.login) {
            return state.token;
        }
        return await Promise.any([
            new Promise<string>(resolve => {
                const listener = this.listeners.get(uuid) || [];
                this.listeners.set(uuid, listener.concat(resolve));
            }),
            new Promise<void>(resolve => {
                setTimeout(() => {
                    this.listeners.delete(uuid);
                    resolve();
                }, 10 * 60 * 1000);
            })
        ]);
    }
}
