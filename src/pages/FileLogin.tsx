import { FormEvent, useState, useEffect } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { AlertCircle, HelpCircle } from "lucide-react"

import {
    Alert,
    AlertDescription,
} from "@/components/ui/alert"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface LoginState {
    current: 'login' | 'explain' | 'loginExplain' | 'success'
    submitted: boolean
    errorMsg: string
    ip: string
}

const LoginFooter = () => (
    <footer className="h-12 text-center text-xs sm:text-sm flex text-gray-500 dark:text-gray-400 px-4 mt-12">
        <p className="m-auto text-xs px-5">
            <Link to="mailto:contact@byrdocs.org" className="hover:underline">
                联系我们
            </Link>
            <span className="mx-2">|</span>
            <Link to="https://github.com/orgs/byrdocs/discussions" className="hover:underline">
                GitHub Discussions
            </Link>
            <span className="mx-2">|</span>
            <Link to="https://qm.qq.com/q/sxv5SAKP0A" className="hover:underline">
                QQ 群
            </Link>
        </p>
    </footer>
)

const LoginLayout = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-dvh flex flex-col dark:bg-black pt-12">
        <div className="flex-1 flex flex-col justify-center">
            {children}
        </div>
        <LoginFooter />
    </div>
)

const LoginForm = ({
    state,
    studentId,
    setStudentId,
    password,
    setPassword,
    handleSubmit,
    goTo,
    to
}: {
    state: LoginState
    studentId: string
    setStudentId: (value: string) => void
    password: string
    setPassword: (value: string) => void
    handleSubmit: (e: FormEvent) => void
    goTo: (screen: LoginState['current']) => void
    to: string | null
}) => (
    <Card className="w-full sm:w-[500px] mx-auto">
        <CardHeader>
            <CardTitle className="text-2xl">登录 BYR Docs</CardTitle>
            <CardDescription>
                您没有使用北邮校园网(IPv6)访问本站
                <HelpCircle
                    className="inline-block w-4 h-4 cursor-pointer hover:text-foreground"
                    onClick={() => goTo('explain')}
                />
                ，我们无法确定您的身份，请您考虑使用
                <Link
                    to="https://auth.bupt.edu.cn/authserver/login"
                    className="text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300 mx-1"
                    target="_blank"
                >
                    北邮统一认证
                </Link>
                账号登录。
            </CardDescription>
            {state.errorMsg && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{state.errorMsg}</AlertDescription>
                </Alert>
            )}
        </CardHeader>
        <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="studentId">
                        学号
                    </label>
                    <Input
                        id="studentId"
                        type="text"
                        name="studentId"
                        minLength={10}
                        maxLength={10}
                        required
                        pattern="20\d{8}"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        className="h-10"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="password">
                        密码
                    </label>
                    <Input
                        id="password"
                        type="password"
                        name="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-10"
                    />
                </div>
            </CardContent>
            <CardFooter className="flex-col space-y-4">
                <Button
                    type="submit"
                    className="w-full h-10"
                    disabled={state.submitted}
                >
                    {state.submitted ? '登录中...' : '登录'}
                </Button>
                <div className="flex flex-col space-y-1 text-xs text-muted-foreground w-full">
                    <div className="space-x-2 text-center">
                        <button
                            type="button"
                            className="text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                            onClick={() => goTo('loginExplain')}
                        >
                            此登录是如何工作的?
                        </button>
                        <span>|</span>
                        <button
                            type="button"
                            className="text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                            onClick={() => goTo('explain')}
                        >
                            关于网络环境
                        </button>
                        <span>|</span>
                        <a
                            href={to ? `/api/auth/login?${new URLSearchParams({ to }).toString()}` : "/api/auth/login"}
                            className="text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                        >
                            其他登录方式
                        </a>
                    </div>
                </div>
            </CardFooter>
        </form>
    </Card>
)

const NetworkExplanation = ({
    state,
    goTo
}: {
    state: LoginState
    goTo: (screen: LoginState['current']) => void
}) => (
    <Card className="w-full sm:w-[500px] mx-auto">
        <CardHeader>
            <CardTitle className="text-2xl">关于网络环境</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>本项目仅对北京邮电大学在校学生提供服务。我们使用您的 IP 地址来验证您是否在校内。</p>
            <p>您当前的 IP 地址是 <span className="font-semibold text-foreground">{state.ip}</span>。</p>
            <p>若您的 IP 地址不属于北邮教育网地址，我们将需通过其他方式验证您的身份。</p>

            <h4 className="font-bold text-foreground pt-2">可以使用 IPv4 吗？</h4>
            <p>北邮到 Cloudflare 的 IPv4 出口为北京移动，我们可能无法通过 IPv4 分辨您的身份。</p>

            <h4 className="font-bold text-foreground pt-2">我的网络支持 IPv6 吗？</h4>
            <p>
                您可以通过
                <Link to="https://test-ipv6.com/" className="text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300 mx-1" target="_blank">
                    IPv6 测试网站
                </Link>
                测试。如果您处于北邮校园网环境中，您的网络应当已支持 IPv6。如果上述检测未通过，请检查您的设备的网络设置。
            </p>

            <h4 className="font-bold text-foreground pt-2">我已经使用了 IPv6，为什么还需要登录？</h4>
            <p>
                尽管您已启用 IPv6，但由于本站同时支持 IPv4 和 IPv6，您可能还是通过 IPv4 访问了本站。您可以尝试提高 IPv6 的使用优先级或禁用 IPv4，或者使用 IPv6 only 的网站镜像：
                <Link to="https://v6.byrdocs.org/" className="text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300 mx-1" target="_blank">
                    v6.byrdocs.org
                </Link>
                。
            </p>

            <h4 className="font-bold text-foreground pt-2">如果我不在校内，我该怎么办？</h4>
            <p>
                如果您不在校内，可以使用
                <button
                    className="text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300 mx-1"
                    onClick={() => goTo('login')}
                >
                    北邮统一认证
                </button>
                登录。
            </p>
        </CardContent>
        <CardFooter>
            <Button className="w-full h-10" onClick={() => goTo('login')}>
                返回
            </Button>
        </CardFooter>
    </Card>
)

const LoginExplanation = ({
    goTo
}: {
    goTo: (screen: LoginState['current']) => void
}) => (
    <Card className="w-full sm:w-[500px] mx-auto">
        <CardHeader>
            <CardTitle className="text-2xl">此登录是如何工作的？</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
            <p>
                本站使用
                <Link to="https://auth.bupt.edu.cn/authserver/login" className="text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300 mx-1" target="_blank">
                    北京邮电大学统一认证系统
                </Link>
                来验证用户身份。以下是我们的登录流程和隐私保护措施的详细说明：
            </p>

            <p><b className="text-foreground">1. 用户认证过程</b></p>
            <p>当您在我们的网站上发起登录请求时，我们的系统会模拟一个登录过程，与北京邮电大学的统一认证系统进行通信。</p>
            <p>您需要输入您的北京邮电大学统一认证的用户名和密码。这些信息将会在登录过程中被传递给北京邮电大学统一认证系统，用于验证您的身份。</p>
            <p>我们的系统<b className="text-foreground">不会存储</b>您的用户名和密码。</p>

            <p><b className="text-foreground">2. 数据处理与安全</b></p>
            <p>我们严格遵守数据保护原则，<b className="text-foreground">不</b>收集或存储任何敏感信息，如您的姓名等个人信息。</p>
            <p>您成功登录后，我们只会在您的设备上存储一个名为 <code>login</code> 、值为登录时时间戳的 Cookie。该 Cookie 不包含任何可以识别您身份的信息。</p>

            <p><b className="text-foreground">3. Cookie 的使用</b></p>
            <p>该 Cookie 仅用于识别用户是否已经成功登录，帮助我们提供更流畅的用户体验，并维持登录状态。</p>
            <p>该 Cookie 不会被用来追踪您的个人浏览活动或用于任何其他目的。</p>

            <p><b className="text-foreground">4. 保护与隐私</b></p>
            <p>我们采取了适当的技术和组织安全措施来保护您的数据安全和隐私。</p>
            <p>我们承诺遵守所有相关的隐私法规保护用户信息不被未授权访问或泄露。</p>

            <p><b className="text-foreground">5. 开放源代码</b></p>
            <p>
                为增加透明度，我们提供了登录过程的源代码。您可以通过访问我们的
                <Link
                    to="https://github.com/byrdocs/byrdocs-edge/blob/1f96285f03ff26010879a0746fd44f3b8e508b4e/src/index.tsx#L71-L74"
                    className="text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300 mx-1"
                    target="_blank"
                >
                    GitHub
                </Link>
                查看详细的实现方法。
            </p>
        </CardContent>
        <CardFooter>
            <Button className="w-full h-10" onClick={() => goTo('login')}>
                返回
            </Button>
        </CardFooter>
    </Card>
)

const SuccessScreen = ({
    to,
    navigate
}: {
    to: string | null
    navigate: (path: string) => void
}) => (
    <Card className="w-full sm:w-[500px] mx-auto">
        <CardHeader>
            <CardTitle className="text-2xl">登录成功</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground">
                {to?.startsWith("/files/") ? (
                    <>
                        文件即将开始下载...<br />
                        如果 BYRDocs 帮助到了你，请考虑给我们一个
                        <Link to="https://github.com/byrdocs/byrdocs-archive" className="text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300" target="_blank">
                            Star
                        </Link>
                        ！
                    </>
                ) : (
                    "您已在其他标签页成功登录 BYR Docs。"
                )}
            </p>
        </CardContent>
        {!to?.startsWith("/files/") && (
            <CardFooter>
                <Button className="w-full h-10" onClick={() => navigate(to || "/")}>
                    继续
                </Button>
            </CardFooter>
        )}
    </Card>
)

export default function Login() {
    const [state, setState] = useState<LoginState>({
        current: 'login',
        submitted: false,
        errorMsg: '',
        ip: '未知'
    })
    const [studentId, setStudentId] = useState('')
    const [password, setPassword] = useState('')
    const [searchParams] = useSearchParams()
    const navigate = (path: string) => location.href = path

    const to = searchParams.get('to')

    // Get IP address on mount
    useEffect(() => {
        fetch('/api/ip')
            .then(res => res.text())
            .then(ip => setState(prev => ({ ...prev, ip })))
            .catch(() => {})
    }, [])

    // Check for login cookie changes
    useEffect(() => {
        const getCookie = () => {
            let cookie = document.cookie.split(';').map(e => e.trim()).find(e => e.startsWith('login='))
            return cookie ? cookie.split('=')[1] : null
        }

        const initCookie = getCookie()

        const interval = setInterval(() => {
            const currentCookie = getCookie()
            if (currentCookie && currentCookie !== initCookie) {
                if (state.submitted) {
                    if (to?.startsWith("/files/")) {
                        setState(prev => ({
                            ...prev,
                            current: 'success'
                        }))
                    }
                } else {
                    setState(prev => ({
                        ...prev,
                        current: 'success'
                    }))
                    setTimeout(() => {
                        navigate(to || "/")
                    }, 500)
                }
                clearInterval(interval)
            }
        }, 100)

        return () => clearInterval(interval)
    }, [state.submitted, to, navigate])

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setState(prev => ({ ...prev, submitted: true, errorMsg: '' }))

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    studentId,
                    password
                })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || '登录失败')
            }

            if (data.success) {
                navigate(to || "/")
                return
            }
        } catch (error) {
            setState(prev => ({
                ...prev,
                submitted: false,
                errorMsg: (error as Error).message || '登录失败'
            }))
        }
    }

    const goTo = (screen: LoginState['current']) => {
        setState(prev => ({ ...prev, current: screen }))
    }

    const renderContent = () => {
        switch (state.current) {
            case 'login':
                return (
                    <LoginForm
                        state={state}
                        studentId={studentId}
                        setStudentId={setStudentId}
                        password={password}
                        setPassword={setPassword}
                        handleSubmit={handleSubmit}
                        goTo={goTo}
                        to={to}
                    />
                )
            case 'explain':
                return <NetworkExplanation state={state} goTo={goTo} />
            case 'loginExplain':
                return <LoginExplanation goTo={goTo} />
            case 'success':
                return <SuccessScreen to={to} navigate={navigate} />
            default:
                return null
        }
    }

    return <LoginLayout>{renderContent()}</LoginLayout>
}
