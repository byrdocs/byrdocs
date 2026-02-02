import { Hono } from 'hono'
import { verify } from 'hono/jwt'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { PrismaClient } from '../generated/prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1'

export default new Hono<{
    Bindings: Cloudflare.Env,
    Variables: {
        id?: string,
        canDownload: boolean
    }
}>()
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
        const path=c.req.param("path")??"";
        const object=await c.env.R2.get(path);
        if(!object){
            return new Response(`${path} Not Found`,{
                status:404
            });
        }
        const headers=new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag",object.httpEtag);
        return new Response(object.body,{headers});
    })
    .post("/mpu-start", zValidator(
        'json',
        z.object({
            key: z.string()
        })
    ),
    async c => {
        const { key } = await c.req.valid("json")
        if (!/^[0-9a-f]{32}\.(zip|pdf)$/.test(key)) {
            return c.json({
                error: "文件名不合法",
                success: false
            })
        }
        const file=await c.env.R2.head(key)
        if(file){
            return c.json({
                error:"文件已存在",
                success:false,
                code:"FILE_EXISTS",
            })
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
            const multipartUpload=await c.env.R2.createMultipartUpload(key);
            return c.json({
                success:true,
                key:multipartUpload.key,
                uploadId:multipartUpload.uploadId,
            },{
                headers:{
                    "Content-Type":"application/x-www-form-urlencoded"
                },
            })
        } catch (e) {
            return c.json({ error: (e as Error).message || e?.toString() || "未知错误", success: false})
        }
    })
    .put("/mpu-uploadpart", zValidator(
        'form',
        z.object({
            key: z.string(),
            uploadId: z.string(),
            partNumber: z.string(),
            file: z.instanceof(Blob),
        })
    ),
    async c => {
        const {key,uploadId,partNumber,file}=await c.req.valid("form");
        const partNumberInt=parseInt(partNumber,10);
        if(isNaN(partNumberInt)||partNumberInt<1||partNumberInt>2000){
            return c.json({
                error:"PartNumber 不合法",
                success:false,
            });
        }
        if(!uploadId){
            return c.json({
                error:"缺少 UploadId",
                success:false,
            });
        }
        if(!file.size){
            return c.json({
                error:"文件不能为空",
                success:false,
            });
        }
        try{
            const multipartUpload=c.env.R2.resumeMultipartUpload(key,uploadId);
            const uploadPart=await multipartUpload.uploadPart(partNumberInt,file);
            return c.json({
                success:true,
                key:key,
                etag:uploadPart.etag,
                partNumber:uploadPart.partNumber,
            },{
                headers:{
                    "Content-Type":"application/x-www-form-urlencoded"
                },
            });
        }catch(e){
            return c.json({
                error:(e as Error).message||e?.toString()||"未知错误",
                success:false,
            });
        }
    })
    .post("/mpu-complete", zValidator(
        'json',
        z.object({
            key: z.string(),
            uploadId: z.string(),
            parts: z.array(z.object({
                partNumber: z.number(),
                etag: z.string(),
            })),
        })
    ), async c => {
        const {key,uploadId,parts}=await c.req.valid("json");
        if(!uploadId){
            return c.json({
                error:"缺少 UploadId",
                success:false,
            });
        }
        try{
            const multipartUpload=c.env.R2.resumeMultipartUpload(key,uploadId);
            const object=await multipartUpload.complete(parts);
            
            // Update database: mark file as "Uploaded"
            const prisma = new PrismaClient({ adapter: new PrismaD1(c.env.DB) })
            const file = await prisma.file.findFirst({
                where: {
                    fileName: key,
                    status: "Pending"
                }
            })
            
            if (file) {
                // Validate file size (max 2GB)
                if (object.size > 1024 * 1024 * 1024 * 2) {
                    // Delete the uploaded file
                    await c.env.R2.delete(key);
                    // Mark as error in database
                    await prisma.file.update({
                        where: { id: file.id },
                        data: {
                            status: "Error",
                            errorMessage: "文件大小超过 2G"
                        }
                    });
                    return c.json({
                        error: "文件大小超过 2G",
                        success: false
                    });
                }
                
                // Update file record with upload info
                await prisma.file.update({
                    where: { id: file.id },
                    data: {
                        status: "Uploaded",
                        uploadTime: new Date(),
                        fileSize: object.size
                    }
                });
            }
            
            return c.json({
                success:true,
                key:key,
                etag:object.httpEtag,
            });
        }catch(e){
            return c.json({
                error:(e as Error).message||e?.toString()||"未知错误",
                success:false,
            });
        }
    })
    .delete("/mpu-abort",zValidator(
        'json',
        z.object({
            key: z.string(),
            uploadId: z.string(),
        })
    ),async c=>{
        const {key,uploadId}=await c.req.valid("json");
        if(!uploadId){
            return c.json({
                error:"缺少 UploadId",
                success:false,
            });
        }
        try{
            const multipartUpload=c.env.R2.resumeMultipartUpload(key,uploadId);
            await multipartUpload.abort();
        }catch(e){
            return c.json({
                error:(e as Error).message||e?.toString()||"未知错误",
                success:false,
            });
        }
        return c.json({
            success:true,
        });
    })
