import { Link } from "react-router-dom";

export default function Notfound() {

    return (
        <div className="md:w-[800px] w-full md:m-auto px-5 flex flex-col h-dvh">
            <div className="w-full m-auto h-98">
                <div className="text-center mb-12">
                    <span className="text-4xl sm:text-5xl md:text-6xl font-extrabold">404</span>
                </div>
                <div className="space-y-3 text-xl text-center">
                    <p>您访问的页面不存在。</p>
                    <p>如果您认为这是一个错误，请发送邮件至  <a href="mailto:contact@byrdocs.org" className="text-blue-500 hover:text-blue-400">contact@byrdocs.org</a>。
                    </p>
                </div>
                <div className="w-full mt-12 text-center text-blue-500 hover:text-blue-400">
                    <Link to="/">返回首页</Link>
                </div>
            </div>
        </div>
    );
}