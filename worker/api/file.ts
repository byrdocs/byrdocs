import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { PrismaClient } from '../generated/prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1'

export default new Hono<{
    Bindings: Cloudflare.Env
}>()
    .use(async (c, next) => {
        if (c.req.header("Authorization") !== "Bearer " + c.env.BYRDOCS_SITE_TOKEN) {
            return c.json({ error: "无效的 Token", success: false }, { status: 401 })
        }
        await next()
    })
    .get("/notPublished", zValidator('query', z.object({
        since: z.coerce.date().optional().default(new Date(0))
    })), async c => {
        const { since } = c.req.valid("query")
        const prisma = new PrismaClient({ adapter: new PrismaD1(c.env.DB) })

        const files = await prisma.file.findMany({
            where: {
                createdAt: {
                    gte: since
                },
                status: "Uploaded"
            }
        })

        return c.json({ files, success: true })
    })
    .post("/publish", zValidator('json', z.object({
        ids: z.array(z.number())
    })), async c =>{
        const { ids } = c.req.valid("json")
        const prisma = new PrismaClient({ adapter: new PrismaD1(c.env.DB) })

        const check = await prisma.file.findMany({
            select: {
                id: true,
                status: true
            },
            where: {
                id: {
                    in: ids
                },
                status: {
                    notIn: ["Uploaded", "Published"]
                }
            }
        })

        if (check.length) {
            console.error("文件状态不正确", check)
            return c.json({
                error: "文件状态不正确",
                success: false,
                files: check
            })
        }
        console.log("Publishing", ids)
        await prisma.file.updateMany({
            where: {
                id: {
                    in: ids
                }
            },
            data: {
                status: "Published"
            }
        })

        // R2 doesn't need tag cleanup like S3 did
        // Files are managed via database records only

        return c.json({
            success: true,
            message: `成功将 ${ids.length} 个文件标记为已发布`,
            ids,
        })
    })
