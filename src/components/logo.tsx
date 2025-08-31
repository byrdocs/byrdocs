function Suffix() {
    return <span>org</span>
}

export function Logo({
    className,
    confetti = false,
    size = 3
}: {
    className?: string,
    confetti?: boolean,
    size?: number
}) {
    let logoElement;
    
    switch (size) {
        case 0:
            logoElement = (
                <h1 className={`text-3xl md:text-4xl text-center font-bold italic select-none ` + className} style={{ fontFamily: "'Saira Variable', sans-serif" }}>
                    byrdocs<span className={`text-xl md:text-2xl`}>.<Suffix /></span>
                </h1>
            );
            break;
        case 1:
            logoElement = (
                <h1 className={`text-3xl sm:text-4xl md:text-5xl text-center font-bold italic select-none ` + className} style={{ fontFamily: "'Saira Variable', sans-serif" }}>
                    byrdocs<span className={`text-xl sm:text-2xl md:text-3xl`}>.<Suffix /></span>
                </h1>
            );
            break;
        case 2:
            logoElement = (
                <h1 className={`text-5xl md:text-6xl text-center font-bold italic select-none ` + className} style={{ fontFamily: "'Saira Variable', sans-serif" }}>
                    byrdocs<span className={`text-3xl md:text-4xl`}>.<Suffix /></span>
                </h1>
            );
            break;
        default:
            logoElement = (
                <h1 className={`text-5xl sm:text-6xl md:text-7xl text-center font-bold italic select-none ` + className} style={{ fontFamily: "'Saira Variable', sans-serif" }}>
                    byrdocs<span className={`text-3xl sm:text-4xl md:text-5xl`}>.<Suffix /></span>
                </h1>
            );
            break;
    }
    
    return confetti ? (
        <div className="relative">
            {logoElement}
        </div>
    ) : logoElement;
}