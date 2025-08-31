import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { drizzle } from 'drizzle-orm/d1'
import { eq, gte, ne, and, inArray, desc, notInArray } from 'drizzle-orm'
import { file as fileTable } from '../schema'
import { AwsClient } from 'aws4fetch'
import { chunk } from '../utils'

export default new Hono<{
    Bindings: Cloudflare.Env
}>()
    .use(async (c, next) => {
        if (c.req.header("Authorization") !== "Bearer " + c.env.TOKEN) {
            return c.json({ error: "无效的 Token", success: false }, { status: 401 })
        }
        await next()
    })
    .get("/notPublished", zValidator('query', z.object({
        since: z.coerce.date().optional().default(new Date(0))
    })), async c => {
        const { since } = c.req.valid("query")
        const db = drizzle(c.env.DB)

        const files = await db.select().from(fileTable)
            .where(
                and(
                    gte(fileTable.createdAt, since),
                    ne(fileTable.status, "Published")
                )
            )
            .orderBy(desc(fileTable.createdAt))

        return c.json({ files, success: true })
    })
    .post("/publish", zValidator('json', z.object({
        ids: z.array(z.number())
    })), async c => {
        const { ids } = c.req.valid("json")
        const db = drizzle(c.env.DB)

        const check = await db.select({
            id: fileTable.id,
            status: fileTable.status
        }).from(fileTable)
            .where(
                and(
                    inArray(fileTable.id, ids),
                    notInArray(fileTable.status, ["Uploaded", "Published"])
                )
            )

        if (check.length) {
            console.error("文件状态不正确", check)
            return c.json({
                error: "文件状态不正确",
                success: false,
                files: check
            })
        }
        console.log("Publishing", ids)
        for (const id of ids) {
            await db.update(fileTable).set({
                status: "Published"
            }).where(eq(fileTable.id, id))
        }

        const updated = await db.select({
            fileName: fileTable.fileName,
            id: fileTable.id
        }).from(fileTable)
            .where(inArray(fileTable.id, ids))

        const s3 = new AwsClient({
            accessKeyId: c.env.S3_ADMIN_ACCESS_KEY_ID,
            secretAccessKey: c.env.S3_ADMIN_SECRET_ACCESS_KEY,
            service: "s3",
        })

        const responses = []

        for (const files of chunk(updated, 5)) {
            responses.push(...await Promise.all(files.map(async file => {
                const res = await s3.fetch(`${c.env.S3_HOST}/${c.env.S3_BUCKET}/${file.fileName}?tagging=`, {
                    method: "DELETE"
                })
                if (!res.ok) {
                    return {
                        status: "rejected",
                        error: await res.text(),
                        file
                    }
                }
                return {
                    status: "fulfilled",
                    response: await res.text(),
                    file
                }
            })))
        }

        if (responses.some(r => r.status === "rejected")) {
            return c.json({
                success: false,
                error: "部分标签删除失败",
                responses
            })
        }

        return c.json({ success: true, responses })
    })
