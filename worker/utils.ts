export function chunk<T>(array: T[], size: number): T[][] {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

export async function sign(env: Cloudflare.Env, path: string, headers: Headers): Promise<Response> {
    const range = headers.get("range");
    const object = await env.R2.get(path, {
        range: range ? headers : undefined,
        onlyIf: {
            uploadedBefore: headers.get("if-modified-since") ? new Date(headers.get("if-modified-since")!) : undefined,
            etagMatches: headers.get("if-match") || undefined,
            etagDoesNotMatch: headers.get("if-none-match") || undefined,
        }
    });
    
    if (!object) {
        return new Response("Object Not Found", {
            status: 404
        });
    }
    
    const responseHeaders = new Headers();
    object.writeHttpMetadata(responseHeaders);
    responseHeaders.set("etag", object.httpEtag);
    
    // Check if we got the body (R2ObjectBody) or just metadata (R2Object)
    if (!('body' in object)) {
        // Conditional request didn't match, return 304 Not Modified or 412 Precondition Failed
        return new Response(null, {
            status: 412,
            headers: responseHeaders
        });
    }
    
    if (range && object.range) {
        const rangeData = object.range as { offset: number, length?: number };
        const length = rangeData.length || (object.size - rangeData.offset);
        responseHeaders.set("content-range", `bytes ${rangeData.offset}-${rangeData.offset + length - 1}/${object.size}`);
        return new Response(object.body, {
            status: 206,
            headers: responseHeaders
        });
    }
    
    return new Response(object.body, { headers: responseHeaders });
}


export function isBupt(cf?: CfProperties): boolean {
    return cf ? (cf.asn === 24350 || cf.asn === 4538) : false;
}
