import { Logo } from "@/components/logo";
import { Link } from "react-router-dom";

function BuildInfo() {
    const date = new Date(import.meta.env.VITE_GIT_COMMIT_DATE);
    return (
        <footer className="mx-auto text-xs h-6">
            <div className="text-muted-foreground mt-4 text-center w-[100vw] group">
                <div className="space-x-1 px-6">
                    <span className="text-muted-foreground/50 group-hover:text-muted-foreground">{date.toLocaleString()}</span>
                    <a
                        href={"https://github.com/byrdocs/byrdocs/commit/" + import.meta.env.VITE_GIT_COMMIT_HASH}
                        className="text-blue-500/50 group-hover:text-blue-400" target="_blank">
                        {import.meta.env.VITE_GIT_LAST_COMMIT_MESSAGE}
                    </a>
                </div>
            </div>
        </footer>
    );
}


function A({ href, children }: { href: string, children: React.ReactNode }) {
    return (
        <a href={href} className="mx-1 text-blue-500 hover:text-blue-400" target="_blank">{children}</a>
    )
}

export default function About() {
    const idx = history.state.idx || 0;
    return (
        <>
            <div className="md:w-[800px] w-full md:m-auto px-10 flex flex-col min-h-[calc(100dvh-48px)]">
                <div className="w-full m-auto h-98">
                    <div className="text-center my-12" style={{ lineHeight: 3 }}>
                        <span className="text-4xl sm:text-5xl md:text-6xl">关于</span>
                        <Logo className="inline-block" size={1} />
                    </div>
                    <div className="space-y-3 text-xl">
                        <li>
                            BYR Docs 是一个资料分享平台，旨在使北邮学生更方便地获取与北邮课程有关的教育资源，包括电子书籍、考试题目和复习资料等。
                        </li>
                        <li>
                            BYR Docs 是一个开源项目，你可以在 <A href="https://github.com/byrdocs" >GitHub</A> 上找到我们的代码和数据。
                        </li>
                        <li>
                            如果您想要贡献文件，请参阅<A href="https://github.com/byrdocs/byrdocs-archive/blob/master/CONTRIBUTING.md">贡献指南</A>。
                            有任何问题或建议，请发送邮件至
                            <A href="mailto:contact@byrdocs.org" >contact@byrdocs.org</A>、在
                            <A href="https://github.com/orgs/byrdocs/discussions">GitHub Discussions</A>
                            留言或者加入我们的
                            <A href="https://qm.qq.com/q/sxv5SAKP0A" >QQ 群</A>。
                        </li>
                    </div>
                    <div className="w-full mt-12 text-center text-blue-500 hover:text-blue-400 cursor-pointer">
                        {idx ?
                            <div onClick={() => history.go(-1)} >返回</div> :
                            <Link to="/">首页</Link>
                        }
                    </div>

                </div>
            </div>
            <BuildInfo />
        </>
    );
}
