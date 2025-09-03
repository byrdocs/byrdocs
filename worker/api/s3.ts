import { Hono } from 'hono'
import { verify } from 'hono/jwt'
import { AwsClient } from 'aws4fetch'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { XMLParser } from 'fast-xml-parser'
import { PrismaClient } from '../generated/prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1'

async function s3_test() {
    const res = await fetch('https://s3.byrdocs.org/webhook-test')
    if (res.status === 200) {
        const text = await res.text()
        if (text.includes("BYR Docs Robots.txt")) return true
        throw new Error(`Got unexpected response: ${text}`)
    }
    throw new Error(`HTTP Code is ${res.status}`)
}

export default new Hono<{
    Bindings: Cloudflare.Env,
    Variables: {
        id?: string,
        s3: AwsClient,
        canDownload: boolean
    }
}>()
    .use(async (c, next) => {
        c.set("s3", new AwsClient({
            accessKeyId: c.env.S3_ADMIN_ACCESS_KEY_ID,
            secretAccessKey: c.env.S3_ADMIN_SECRET_ACCESS_KEY,
            service: "s3",
        }))
        await next()
    })
    .post("/webhook", async c => {
        if (c.req.header("Authorization") !== "Bearer " + c.env.TOKEN) {
            return c.json({ error: "无效的 Token", success: false }, { status: 401 })
        }
        const body = await c.req.json() as {
            EventName: string,
            Records: Array<{
                s3: {
                    bucket: {
                        name: string
                    },
                    object: {
                        key: string,
                        size: number,
                        eTag: string
                    }
                }
            }>
        }
        console.log("BODY:" + JSON.stringify(body))
        if (body.EventName !== "s3:ObjectCreated:Put" && body.EventName !== "s3:ObjectCreated:CompleteMultipartUpload") {
            return c.json({ success: true })
        }
        const prisma = new PrismaClient({ adapter: new PrismaD1(c.env.DB) })
        for (const record of body.Records) {
            if (record.s3.bucket.name !== c.env.S3_BUCKET) continue
            const count = await prisma.file.count({
                where: {
                    fileName: record.s3.object.key
                }
            })
            if (count == 0) continue;
            const file = await prisma.file.findFirst({
                where: {
                    fileName: record.s3.object.key,
                    status: "Pending"
                }
            })
            if (count != 0 && !file) {
                continue
            }

            async function setError(reason: string) {
                await prisma.file.update({
                    where: {
                        id: file!.id
                    },
                    data: {
                        status: "Error",
                        errorMessage: reason
                    }
                })
                console.log('DELETE', record.s3.object.key, 'Reason:', reason)
                await c.get("s3").fetch(`${c.env.S3_HOST}/${c.env.S3_BUCKET}/${record.s3.object.key}`, {
                    method: "DELETE"
                })
            }

            if (record.s3.object.size > 1024 * 1024 * 1024 * 2) {
                await setError("文件大小超过 2G")
                continue
            }

            await c.get("s3").fetch(`${c.env.S3_HOST}/${c.env.S3_BUCKET}/${record.s3.object.key}?tagging`, {
                method: "PUT",
                body: `<?xml version="1.0" encoding="UTF-8"?>
<Tagging xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
   <TagSet>
        <Tag>
            <Key>status</Key>
            <Value>temp</Value>
        </Tag>
        <Tag>
            <Key>uploader</Key>
            <Value>${file?.uploader ?? "Unknown"}</Value>
        </Tag>
   </TagSet>
</Tagging>`
            })
            await prisma.file.update({
                where: {
                    id: file!.id
                },
                data: {
                    status: "Uploaded",
                    uploadTime: new Date(),
                    fileSize: record.s3.object.size
                }
            })
        }
        return c.json({ success: true })
    })
    .use(async (c, next) => {
        const auth = c.req.header("Authorization")
        const token = auth?.split("Bearer ")?.[1]
        if (!token) {
            return c.json({ error: "缺少 Token", success: false })
        }
        try {
            const payload = await verify(token, c.env.JWT_SECRET)
            if (typeof payload.id !== "string") {
                return c.json({ error: "Token 无效", success: false })
            }
            c.set("id", payload.id)
            c.set("canDownload", payload.download === true)
        } catch (e) {
            return c.json({ error: "Token 无效", success: false })
        }
        await next()
    })
    .get("/files/:path{.*?}", async c => {
        if (!c.get("canDownload")) {
            return c.json({ error: "无权访问", success: false }, { status: 403 })
        }
        return c.get("s3").fetch(`${c.env.S3_HOST}/${c.env.S3_BUCKET}/` + (c.req.param("path") ?? ''))
    })
    .post("/upload", zValidator(
        'json',
        z.object({
            key: z.string()
        })
    ),
    async c => {
        const { key } = await c.req.valid("json")
        try {
            await s3_test()
        } catch (e) {
            return c.json({ error: "S3 服务器错误", success: false })
        }
        if (!/^[0-9a-f]{32}\.(zip|pdf)$/.test(key)) {
            return c.json({ error: "文件名不合法", success: false })
        }
        const aws = c.get("s3")
        const file = await aws.fetch(`${c.env.S3_HOST}/${c.env.S3_BUCKET}/` + key + "?cache=false", {
            method: "HEAD"
        })
        if (file.status === 200) {
            return c.json({ error: "文件已存在", success: false, code: "FILE_EXISTS" })
        } else if (file.status !== 404) {
            return c.json({ error: "文件预检失败, status=" + file.status.toString(), success: false })
        }

        const prisma = new PrismaClient({ adapter: new PrismaD1(c.env.DB) })

        const uploaded = await prisma.file.findMany({
            where: {
                uploader: c.get("id")!.toString(),
                status: "Uploaded"
            }
        })

        const totalSize = uploaded
            .filter(f => f.fileSize !== null)
            .reduce((acc, f) => acc + f.fileSize!, 0)

        if (totalSize > 1024 * 1024 * 1024 * 5) { // 5G
            return c.json({ error: "您的未发布文件总计大小超过限制，请等待其他文件 PR 合并后再试", success: false })
        }

        const sts = new AwsClient({
            accessKeyId: c.env.S3_ADMIN_ACCESS_KEY_ID,
            secretAccessKey: c.env.S3_ADMIN_SECRET_ACCESS_KEY,
            service: "sts",
        })
        const token = await sts.fetch(c.env.S3_HOST, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                Action: "AssumeRole",
                DurationSeconds: "900",
                Version: "2011-06-15",
                Policy: JSON.stringify({
                    "Version": "2012-10-17",
                    "Statement": [{
                        "Effect": "Allow",
                        "Action": [
                            "s3:PutObject",
                            "s3:AbortMultipartUpload",
                        ],
                        "Resource": `arn:aws:s3:::${c.env.S3_BUCKET}/${key}`,
                        // Commented out to allow multipart upload
                        // "Condition": {
                        //     "StringEquals": {
                        //         "s3:RequestObjectTag/status": "temp"
                        //     }
                        // },
                    }]
                })
            }).toString()
        })
        if (!token.ok) {
            return c.json({ error: "获取临时凭证失败", success: false })
        }
        const parser = new XMLParser()
        const data = parser.parse(await token.text()) as {
            AssumeRoleResponse: {
                AssumeRoleResult: {
                    Credentials: {
                        AccessKeyId: string,
                        SecretAccessKey: string,
                        SessionToken: string,
                    }
                }
            }
        }
        try {
            await prisma.file.deleteMany({
                where: {
                    fileName: key
                }
            })
            await prisma.file.create({
                data: {
                    fileName: key,
                    uploader: c.get("id")!.toString(),
                    status: "Pending"
                }
            })
        } catch (e) {
            return c.json({ error: (e as Error).message || e?.toString() || "未知错误", success: false })
        }

        return c.json({
            success: true,
            key: key,
            host: c.env.S3_HOST,
            bucket: c.env.S3_BUCKET,
            tags: {
                status: "temp"
            },
            credentials: {
                access_key_id: data.AssumeRoleResponse.AssumeRoleResult.Credentials.AccessKeyId,
                secret_access_key: data.AssumeRoleResponse.AssumeRoleResult.Credentials.SecretAccessKey,
                session_token: data.AssumeRoleResponse.AssumeRoleResult.Credentials.SessionToken
            }
        }, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        })
    })
