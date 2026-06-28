import { useEffect } from "react";

/**
 * 可选的 AI 答疑气泡:仅当配置了 VITE_CHAT_EMBED_URL 时加载,否则完全不出现。
 * 聊天 / AI / 登录等全部在该 URL 指向的独立后端(/app/*),本组件只注入一行加载器;
 * 加载器在 Shadow DOM 里建悬浮气泡 + iframe,样式与本站完全隔离。
 */
export function ChatBubble() {
  const base = import.meta.env.VITE_CHAT_EMBED_URL as string | undefined;
  useEffect(() => {
    if (!base || document.getElementById("sd-agent-widget-loader")) return;
    const s = document.createElement("script");
    s.id = "sd-agent-widget-loader";
    s.src = base.replace(/\/$/, "") + "/app/widget.js";
    s.defer = true;
    s.setAttribute("data-accent", "#2563eb");
    s.setAttribute("data-position", "bottom-right");
    document.body.appendChild(s);
  }, [base]);
  return null;
}
