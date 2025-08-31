import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Link } from "react-router-dom";
import { toast } from 'sonner';
import { ErrorIcon, LoadingIcon, SuccessIcon } from '@/components/icons';

export default function Callback() {
    const [token, setToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showDetail, setShowDetail] = useState(false);
    const location = useLocation();
    const arg = useParams()
    const service = arg.service || 'byrdocs'

    useEffect(() => {
        const query = new URLSearchParams(location.search);
        if (!query.get('code') || !query.get('state')) {
            setError('参数错误，请重试');
            return;
        }
        fetch('/api/auth/callback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: query.get('code'),
                state: query.get('state'),
            }),
        })
            .then((res) => res.json())
            .then((res) => {
                if (res.token) {
                    setToken(res.token);
                    if (service === 'byrdocs' && res.data) {
                        window.location.href = res.data
                    }
                } else if (res.redirect) {
                    window.location.href = res.redirect
                } else {
                    setError(res.error);
                }
                
            })
            .catch((err) => {
                setError(err.toString());
            })
    }, [location.search]);

    function copy() {
        if (!globalThis.navigator.clipboard) {
            return
        }
        navigator.clipboard.writeText(`byrdocs login --token ${token}`);
        toast.success('已复制命令');
    }

    return (
        <>
            <div className="flex flex-col items-center justify-center min-h-dvh bg-background md:w-[500px] w-full md:m-auto px-10">
                <div className="w-full m-auto">
                    <Link to="/">
                        <img src="/logo_512.png" alt="logo" className="w-24 h-24 mx-auto" />
                    </Link>
                    <div className="text-center text-2xl md:text-3xl font-bold" style={{ lineHeight: 3 }}>
                        登录 <code>{service}</code>
                    </div>
                    {error ? (
                        <div>
                            <ErrorIcon />
                            <div className='text-center text-red-500 font-bold text-xl'>
                                登录失败
                            </div>
                            <div className='text-center text-red-300 dark:text-red-800 mt-6'>
                                <code>{error}</code>
                            </div>
                        </div>

                    ) : (
                        <div>
                            {token ? (
                                <>
                                    <SuccessIcon />
                                    <div className='text-center text-green-500 font-bold text-xl'>
                                        登录成功
                                    </div>
                                    {service === 'byrdocs-cli' && 
                                        (showDetail ? (
                                            <div>
                                                <div className='mt-11'>
                                                    运行以下命令：
                                                </div>
                                                <code className='block mt-4 bg-gray-100 dark:bg-gray-800 select-all p-2 rounded-md break-all text-gray-700 dark:text-gray-300' onClick={copy}>
                                                    byrdocs login --token {token}
                                                </code>
                                            </div>
                                        ) : (
                                            <div className='text-center mt-11 text-gray-500 cursor-pointer' onClick={() => {
                                                setShowDetail(true)
                                                copy()
                                            }}>
                                                手动登录
                                            </div>
                                        ))
                                    }
                                </>
                            ) : <LoadingIcon />}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
