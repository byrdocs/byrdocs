import { DurableObject } from "cloudflare:workers";

export class Counter<T> extends DurableObject {
    storage: DurableObjectStorage;
    constructor(ctx: DurableObjectState, env: T) {
        super(ctx, env);
        this.storage = ctx.storage;
    }

    async add(key: string) {
        const value: number = await this.storage.get(key) || 0
        await this.storage.put(key, value + 1)
    }

    async list() {
        const data = await this.storage.list();
        const result: { key: string, value: number }[] = []
        for (const [key, value] of data) {
            result.push({ key, value: value as number })
        }

        return result.sort((a, b) => b.value - a.value)
    }
}
