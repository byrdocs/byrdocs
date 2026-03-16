import { raw } from 'hono/html';

import type { BookItem, DocItem, Item, TestItem, WikiTestItem } from '../src/types';

type SearchPageProps = {
    item: Item | WikiTestItem;
    pageUrl: string;
    siteUrl: string;
};

type FieldProps = {
    label: string;
    value: string;
};

function resolveUrl(base: string, path: string): string {
    try {
        return new URL(path, base).toString();
    } catch {
        return path;
    }
}

function joinValues(values?: Array<string | undefined>): string {
    return values?.filter(Boolean).join('、') || '未提供';
}

function formatFileSize(size?: number): string {
    if (!size || Number.isNaN(size)) return '未提供';
    if (size < 1024) return `${size} B`;

    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = size / 1024;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function formatSemester(semester?: 'First' | 'Second'): string {
    if (semester === 'First') return '第一学期';
    if (semester === 'Second') return '第二学期';
    return '未提供';
}

function formatTimeRange(start: string, end: string): string {
    return start === end ? start : `${start}-${end}`;
}

function getItemTypeLabel(item: Item | WikiTestItem): string {
    if (item.type === 'book') return '书籍';
    if (item.type === 'doc') return '课程资料';
    if (item.data.filetype === 'wiki') return '试卷 Wiki 条目';
    return '试卷';
}

function getCourseSummary(item: Item | WikiTestItem): string {
    if (item.type === 'book') return '教材与参考书';
    if (item.type === 'doc') {
        return joinValues(item.data.course.map((course) => {
            if (!course.name) return undefined;
            return course.type ? `${course.name}（${course.type}）` : course.name;
        }));
    }

    return item.data.course.type
        ? `${item.data.course.name}（${item.data.course.type}）`
        : item.data.course.name;
}

function getDescription(item: Item | WikiTestItem): string {
    if (item.type === 'book') {
        const details = [
            `作者：${joinValues(item.data.authors)}`,
            item.data.translators?.length ? `译者：${joinValues(item.data.translators)}` : undefined,
            item.data.publisher ? `出版社：${item.data.publisher}` : undefined,
            item.data.publish_year ? `出版年份：${item.data.publish_year}` : undefined,
            item.data.edition ? `版次：${item.data.edition}` : undefined,
        ].filter(Boolean).join('，');
        return details || 'BYR Docs 收录的书籍资料。'
    }

    if (item.type === 'doc') {
        return `适用课程：${getCourseSummary(item)}。资料类型：${joinValues(item.data.content)}。`;
    }

    const parts = [
        `课程：${getCourseSummary(item)}`,
        `考试时间：${formatTimeRange(item.data.time.start, item.data.time.end)}`,
        item.data.time.semester ? `学期：${formatSemester(item.data.time.semester)}` : undefined,
        item.data.time.stage ? `考试阶段：${item.data.time.stage}` : undefined,
        `内容类型：${joinValues(item.data.content)}`,
        item.data.college?.length ? `学院：${joinValues(item.data.college)}` : undefined,
    ].filter(Boolean).join('。');
    return parts + "。";
}

function getKeywords(item: Item | WikiTestItem): string {
    const keywords = new Set<string>(['BYR Docs', '北京邮电大学', '北邮', item.data.title, getItemTypeLabel(item)]);

    if (item.type === 'book') {
        item.data.authors.forEach((author) => keywords.add(author));
        item.data.isbn.forEach((isbn) => keywords.add(isbn));
        if (item.data.publisher) keywords.add(item.data.publisher);
    }

    if (item.type === 'doc') {
        item.data.course.forEach((course) => {
            if (course.name) keywords.add(course.name);
            if (course.type) keywords.add(course.type);
        });
        item.data.content.forEach((content) => keywords.add(content));
    }

    if (item.type === 'test') {
        keywords.add(item.data.course.name);
        if (item.data.course.type) keywords.add(item.data.course.type);
        item.data.content.forEach((content) => keywords.add(content));
        item.data.college?.forEach((college) => keywords.add(college));
    }

    return Array.from(keywords).join(', ');
}

function getStructuredData(item: Item | WikiTestItem, pageUrl: string, siteUrl: string): string {
    const common = {
        '@context': 'https://schema.org',
        name: item.data.title,
        url: pageUrl,
        description: getDescription(item),
        inLanguage: 'zh-Hans',
        isPartOf: {
            '@type': 'WebSite',
            name: 'BYR Docs',
            url: siteUrl,
        },
    };

    if (item.type === 'book') {
        return JSON.stringify({
            ...common,
            '@type': 'Book',
            author: item.data.authors.map((author) => ({
                '@type': 'Person',
                name: author,
            })),
            publisher: item.data.publisher ? {
                '@type': 'Organization',
                name: item.data.publisher,
            } : undefined,
            isbn: item.data.isbn,
            datePublished: item.data.publish_year,
            bookEdition: item.data.edition,
            encodingFormat: item.data.filetype,
        });
    }

    if (item.type === 'doc') {
        return JSON.stringify({
            ...common,
            '@type': 'LearningResource',
            learningResourceType: item.data.content,
            educationalUse: 'course material',
            encodingFormat: item.data.filetype,
            about: item.data.course.map((course) => course.name).filter(Boolean),
        });
    }

    return JSON.stringify({
        ...common,
        '@type': 'LearningResource',
        learningResourceType: item.data.filetype === 'wiki' ? 'exam wiki' : 'exam paper',
        educationalUse: 'assessment',
        encodingFormat: item.data.filetype,
        about: item.data.course.name,
    });
}

function Field({ label, value }: FieldProps) {
    return (
        <>
            <dt>{label}</dt>
            <dd>{value}</dd>
        </>
    );
}

function BookFields({ item }: { item: BookItem }) {
    return (
        <>
            <Field label="作者" value={joinValues(item.data.authors)} />
            {item.data.translators?.length ? <Field label="译者" value={joinValues(item.data.translators)} /> : null}
            {item.data.publisher ? <Field label="出版社" value={item.data.publisher} /> : null}
            {item.data.publish_year ? <Field label="出版年份" value={item.data.publish_year} /> : null}
            {item.data.edition ? <Field label="版次" value={item.data.edition} /> : null}
            <Field label="ISBN" value={joinValues(item.data.isbn)} />
        </>
    );
}

function DocFields({ item }: { item: DocItem }) {
    return (
        <>
            <Field label="适用课程" value={getCourseSummary(item)} />
            <Field label="资料类型" value={joinValues(item.data.content)} />
        </>
    );
}

function TestFields({ item }: { item: TestItem | WikiTestItem }) {
    return (
        <>
            <Field label="课程" value={item.data.course.name} />
            {item.data.course.type ? <Field label="课程层次" value={item.data.course.type} /> : null}
            {item.data.college?.length ? <Field label="学院" value={joinValues(item.data.college)} /> : null}
            <Field label="考试时间" value={formatTimeRange(item.data.time.start, item.data.time.end)} />
            <Field label="学期" value={formatSemester(item.data.time.semester)} />
            {item.data.time.stage ? <Field label="考试阶段" value={item.data.time.stage} /> : null}
            <Field label="内容类型" value={joinValues(item.data.content)} />
        </>
    );
}

function ItemFields({ item }: { item: Item | WikiTestItem }) {
    if (item.type === 'book') return <BookFields item={item} />;
    if (item.type === 'doc') return <DocFields item={item} />;
    return <TestFields item={item} />;
}

function buildFileUrl(item: Item | WikiTestItem, siteUrl: string): string {
    const url = new URL(item.url, siteUrl);
    if (item.data.filetype !== 'wiki') {
        url.searchParams.set('filename', `${item.data.title}.${item.data.filetype}`);
        url.searchParams.set('f', '1');
    }
    return url.toString();
}

export function SearchPage({ item, pageUrl, siteUrl }: SearchPageProps) {
    const description = getDescription(item);
    const keywords = getKeywords(item);
    const canonicalUrl = pageUrl;
    const fileUrl = buildFileUrl(item, siteUrl);
    const siteHomeUrl = resolveUrl(siteUrl, '/');
    const ogImageUrl = resolveUrl(siteUrl, '/og.png');
    const structuredData = getStructuredData(item, pageUrl, siteUrl);

    return (
        <>
            {raw('<!DOCTYPE html>')}
            <html lang="zh-Hans">
                <head>
                    <meta charSet="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <link rel="icon" type="image/png" href={resolveUrl(siteUrl, '/logo_512.png')} />
                    <link rel="apple-touch-icon" type="image/png" href={resolveUrl(siteUrl, '/logo_512.png')} />
                    <title>{item.data.title} - BYR Docs</title>
                    <meta name="description" content={description} />
                    <meta name="keywords" content={keywords} />
                    <meta name="author" content="BYR Docs" />
                    <meta name="robots" content="index,follow,max-image-preview:large" />
                    <link rel="canonical" href={canonicalUrl} />
                    <meta property="og:type" content="article" />
                    <meta property="og:title" content={item.data.title} />
                    <meta property="og:description" content={description} />
                    <meta property="og:url" content={canonicalUrl} />
                    <meta property="og:image" content={ogImageUrl} />
                    <meta property="og:image:width" content="2345" />
                    <meta property="og:image:height" content="2345" />
                    <meta property="og:site_name" content="BYR Docs" />
                    <meta name="twitter:card" content="summary" />
                    <meta name="twitter:title" content={item.data.title} />
                    <meta name="twitter:description" content={description} />
                    <style>{`
                        * {
                            box-sizing: border-box;
                        }

                        body {
                            margin: 0;
                            font-family: "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
                            background: #fff;
                            color: #222;
                            line-height: 1.65;
                        }

                        a {
                            color: #0b57d0;
                            text-decoration: underline;
                        }

                        main {
                            max-width: 840px;
                            margin: 0 auto;
                            padding: 24px 16px 40px;
                        }

                        .hero,
                        .panel {
                            border: 1px solid #ddd;
                            padding: 20px;
                        }

                        .panel {
                            margin-top: 16px;
                        }

                        h1 {
                            margin: 0;
                            font-size: 32px;
                            line-height: 1.3;
                        }

                        .summary {
                            margin: 12px 0 0;
                        }

                        .actions {
                            display: flex;
                            flex-wrap: wrap;
                            gap: 12px;
                            margin-top: 16px;
                        }

                        h2 {
                            margin: 0 0 12px;
                            font-size: 22px;
                        }

                        dl {
                            display: grid;
                            grid-template-columns: 160px 1fr;
                            margin: 0;
                        }

                        dt,
                        dd {
                            padding: 8px 0;
                            border-top: 1px solid #eee;
                        }

                        dt {
                            font-weight: 600;
                        }

                        dd {
                            margin: 0;
                            word-break: break-word;
                        }

                        footer {
                            margin-top: 24px;
                            font-size: 14px;
                        }

                        @media (max-width: 640px) {
                            main {
                                padding: 16px 12px 32px;
                            }

                            .hero,
                            .panel {
                                padding: 16px;
                            }

                            dl {
                                grid-template-columns: 1fr;
                            }

                            dt {
                                padding-bottom: 2px;
                            }

                            dd {
                                padding-top: 0;
                                border-top: 0;
                                padding-bottom: 12px;
                            }
                        }
                    `}</style>
                    <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{
                            __html: structuredData,
                        }}
                    />
                </head>
                <body>
                    <main>
                        <header class="hero">
                            <h1>{item.data.title}</h1>
                            <p class="summary">{description}</p>
                            <div class="actions">
                                <a href={fileUrl}>下载文件</a>
                                <a href={siteHomeUrl}>访问 BYR Docs</a>
                                {item.type === 'test' && item.data.filetype === 'pdf' && item.data.wiki
                                    ? <a href={item.data.wiki.url}>查看试卷 Wiki</a>
                                    : null}
                            </div>
                        </header>

                        <section class="panel" aria-labelledby="file-info-title">
                            <h2 id="file-info-title">文件信息</h2>
                            <dl>
                                <Field label="标题" value={item.data.title} />
                                <Field label="类型" value={getItemTypeLabel(item)} />
                                <Field label="格式" value={item.data.filetype.toUpperCase()} />
                                <Field label="文件大小" value={formatFileSize('filesize' in item.data ? item.data.filesize : undefined)} />
                                <Field label="文件标识" value={item.id} />
                                <Field label="文件链接" value={fileUrl} />
                                <ItemFields item={item} />
                            </dl>
                        </section>

                        {item.type === 'test' && item.data.filetype === 'pdf' && item.data.wiki ? (
                            <section class="panel" aria-labelledby="wiki-title">
                                <h2 id="wiki-title">补充信息</h2>
                                <dl>
                                    <Field label="Wiki 链接" value={item.data.wiki.url} />
                                    <Field label="Wiki 标题" value={item.data.wiki.data.title} />
                                    <Field label="Wiki 内容类型" value={joinValues(item.data.wiki.data.content)} />
                                    <Field label="Wiki 考试时间" value={formatTimeRange(item.data.wiki.data.time.start, item.data.wiki.data.time.end)} />
                                </dl>
                            </section>
                        ) : null}

                        <footer>
                            <p>
                                来源：<a href={siteHomeUrl}>BYR Docs</a>
                            </p>
                        </footer>
                    </main>
                </body>
            </html>
        </>
    );
}
