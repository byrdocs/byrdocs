import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import authRoutes from './auth';
import s3Routes from './s3';
import fileRoutes from './file';
import { isBupt } from '../utils';
import { login } from '@byrdocs/bupt-auth';
import { Counter, setCookie } from '..';

export default new Hono<{
    Bindings: Cloudflare.Env;
}>()
    .get('/ping', (c) => c.text('pong'))
    .route('/auth', authRoutes)
    .route('/s3', s3Routes)
    .route('/file', fileRoutes)
    .get('/rank', async (c) => {
        const token = c.req.query('token');
        if (token !== c.env.TOKEN) {
            return c.json({ error: 'Forbidden' }, { status: 403 });
        }
        const id: DurableObjectId = c.env.COUNTER.idFromName('counter');
        const stub: DurableObjectStub<Counter<Cloudflare.Env>> = c.env.COUNTER.get(id);
        const data = await stub.list();
        return c.json(data);
    })
    .get('/ip', async (c) => {
        const ip = c.req.header('CF-Connecting-IP') || '未知';
        return c.json({
            ip,
            bupt: isBupt(c.req.raw.cf),
        })
    })
    .post(
        '/login',
        zValidator(
            'json',
            z.object({
                studentId: z.string(),
                password: z.string(),
            })
        ),
        async (c) => {
            if (isBupt(c.req.raw.cf)) {
                await setCookie(c);
                return c.json({ success: true, message: '已通过校园网验证登录' });
            }

            const { studentId, password } = c.req.valid('json');

            try {
                if (await login(studentId, password, { ocr: { token: c.env.OCR_TOKEN } })) {
                    await setCookie(c);
                    return c.json({ success: true, message: '登录成功' });
                }
                return c.json({ success: false, error: '可能是用户名或密码错误' }, { status: 401 });
            } catch (e) {
                return c.json(
                    {
                        success: false,
                        error: (e as Error).message || e?.toString() || '未知错误',
                    },
                    { status: 500 }
                );
            }
        }
    )
    .all('*', async (c) => {
        return c.json({ error: 'API Not Found', success: false });
    });
