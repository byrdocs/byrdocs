import { ArrowRight, Key } from 'lucide-react'
import { Link, useParams } from 'react-router-dom';

function Github({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className}>
            <title>GitHub</title>
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" fill="currentColor"/>
        </svg>
    )
}

export default function Component() {
    const arg = useParams()
    const service = arg.service || 'byrdocs'
    return (
        <div className="flex items-center justify-center min-h-dvh bg-background">
            <div className="w-full max-w-md p-6">
                <Link to="/">
                    <img src="/logo_512.png" alt="logo" className="w-24 h-24 mx-auto" />
                </Link>
                <div className="text-center text-2xl md:text-3xl font-bold" style={{ lineHeight: 3 }}>
                    登录 <code>{service}</code>
                </div>
                <div className="space-y-4">
                    {service !== "byrdocs-publish" && (
                        <AuthOption
                            icon={<Key className="w-6 h-6 dark:text-white" />}
                            title="北京邮电大学统一认证"
                            description='适用于校内用户的便捷认证方式'
                            to={`/login/${arg.uuid}/${service ?? ''}`}
                        />
                    )}
                    
                    <AuthOption
                        icon={<Github className="w-6 h-6 dark:text-white" />}
                        title="GitHub 认证"
                        description={service === 'byrdocs' ? '仅限 BYR Docs GitHub 组织成员使用' : '使用 GitHub 账号登录'}
                        to={`/api/auth/github/${arg.uuid}`}
                        external={true}
                    />
                </div>
            </div>
        </div>
    )
}

interface AuthOptionProps {
    icon: React.ReactNode;
    title: string;
    description?: string;
    to: string;
    external?: boolean;
}

function AuthOption({ icon, title, description, to, external }: AuthOptionProps) {
    return (
        external ? 
        <a className="w-full group block" href={to}>
            <div className="flex items-center p-4 rounded-lg border border-border transition-all duration-300 ease-in-out transform hover:scale-[1.01] hover:shadow-md">
                <div className="flex-shrink-0 mr-4 text-primary">{icon}</div>
                <div className="flex-grow text-left space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                    <div className="flex space-x-2 text-muted-foreground">
                        {description}
                    </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground transition-all duration-300 ease-in-out transform group-hover:text-foreground" />
            </div>
        </a > :
        <Link className="w-full group block" to={to}>
            <div className="flex items-center p-4 rounded-lg border border-border transition-all duration-300 ease-in-out transform hover:scale-[1.01] hover:shadow-md">
                <div className="flex-shrink-0 mr-4 text-primary">{icon}</div>
                <div className="flex-grow text-left space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                    <div className="flex space-x-2 text-muted-foreground">
                        {description}
                    </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground transition-all duration-300 ease-in-out transform group-hover:text-foreground" />
            </div>
        </Link >
    )
}