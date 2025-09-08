import { AwsClient } from 'aws4fetch';

export function chunk<T>(array: T[], size: number): T[][] {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

export async function sign(env: Cloudflare.Env, path: string, headers: Headers): Promise<Request> {
    const aws = new AwsClient({
        accessKeyId: env.S3_GET_ACCESS_KEY_ID,
        secretAccessKey: env.S3_GET_SECRET_ACCESS_KEY,
        service: 's3',
    });
    return await aws.sign(`${env.S3_HOST}/${env.S3_BUCKET}/` + path, {
        headers: Object.fromEntries(
            Array.from(headers.entries()).filter(([key, _]) =>
                ['range', 'if-modified-since', 'if-none-match', 'if-match', 'if-unmodified-since'].includes(key)
            )
        )
    });
}


export function isBupt(cf?: CfProperties): boolean {
    return cf ? (cf.asn === 24350 || cf.asn === 4538) : false;
}
