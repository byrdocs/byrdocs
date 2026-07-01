const CANONICAL_HOST = "search-byrdocs.youx.am";
if (location.host && location.host !== CANONICAL_HOST) {
    document.querySelectorAll(".host-url").forEach((el) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (node.nodeValue.includes(CANONICAL_HOST)) {
                node.nodeValue = node.nodeValue.split(CANONICAL_HOST).join(location.host);
            }
        }
    });
}

const form = document.getElementById("search-form");
const keywordEl = document.getElementById("f-keyword");
const typeEl = document.getElementById("f-type");
const limitEl = document.getElementById("f-limit");
const jmespathEl = document.getElementById("f-jmespath");
const runBtn = document.getElementById("run-btn");
const hintEl = document.getElementById("pg-hint");
const summaryEl = document.getElementById("result-summary");
const cardsEl = document.getElementById("result-cards");
const jsonEl = document.getElementById("result-json");
const toggleJsonBtn = document.getElementById("toggle-json");
const curlCmdEl = document.getElementById("curl-cmd");
const copyCurlBtn = document.getElementById("copy-curl");

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function metaFor(item) {
    const d = item.data || {};
    const parts = [];
    if (Array.isArray(d.authors) && d.authors.length) parts.push(d.authors.join(", "));
    if (Array.isArray(d.translators) && d.translators.length) parts.push(`译 ${d.translators.join(", ")}`);
    if (d.publisher) parts.push(d.publisher);
    if (d.publish_year) parts.push(d.publish_year);
    if (d.edition) parts.push(d.edition);
    if (d.course) {
        if (typeof d.course.name === "string") parts.push(d.course.name);
        else if (Array.isArray(d.course)) parts.push(d.course.map((c) => c.name).filter(Boolean).join(" / "));
    }
    if (Array.isArray(d.content) && d.content.length) parts.push(d.content.join(" · "));
    return parts.filter(Boolean);
}

function isItem(value) {
    return value && typeof value === "object" && !Array.isArray(value) && "type" in value && "data" in value;
}

function renderCard(value) {
    if (!isItem(value)) {
        return `<div class="card"><pre class="json" style="margin:0;border:none;padding:0;background:none">${escapeHtml(JSON.stringify(value, null, 2))}</pre></div>`;
    }
    const d = value.data || {};
    const title = escapeHtml(d.title || value.id || "(无标题)");
    const badge = value.type ? `<span class="badge">${escapeHtml(value.type)}</span>` : "";
    const meta = metaFor(value).map((m) => `<span>${escapeHtml(m)}</span>`).join("");
    const link = value.url
        ? `<a class="card-link" href="${escapeHtml(value.url)}" target="_blank" rel="noopener">${escapeHtml(value.url)}</a>`
        : "";
    return `<div class="card">
        <div class="card-title">${badge}<span>${title}</span></div>
        ${meta ? `<div class="card-meta">${meta}</div>` : ""}
        ${link}
    </div>`;
}

function render(data) {
    const results = Array.isArray(data.results) ? data.results : [];
    summaryEl.textContent = `共 ${data.total} 条，显示 ${results.length} 条`;
    toggleJsonBtn.hidden = false;
    jsonEl.textContent = JSON.stringify(data, null, 2);
    if (results.length === 0) {
        cardsEl.innerHTML = `<div class="empty">没有匹配的结果</div>`;
        return;
    }
    cardsEl.innerHTML = results.map(renderCard).join("");
}

function buildBody() {
    const body = {};
    const keyword = keywordEl.value.trim();
    const jmespath = jmespathEl.value.trim();
    const limit = parseInt(limitEl.value, 10);
    if (keyword) body.keyword = keyword;
    if (jmespath) body.jmespath = jmespath;
    if (typeEl.value !== "all") body.type = typeEl.value;
    if (Number.isFinite(limit)) body.limit = limit;
    return body;
}

function shellQuote(value) {
    return `'${value.split("'").join(`'\\''`)}'`;
}

function renderCurl() {
    const json = JSON.stringify(buildBody());
    const url = escapeHtml(`${location.origin}/api/search`);
    const body = escapeHtml(shellQuote(json));
    curlCmdEl.innerHTML =
        `<span class="tk-k">curl</span> <span class="tk-t">-X</span> POST ${url} \\\n` +
        `  <span class="tk-t">-H</span> <span class="tk-s">'content-type: application/json'</span> \\\n` +
        `  <span class="tk-t">-d</span> <span class="tk-s">${body}</span>`;
}

async function runSearch() {
    const body = buildBody();

    runBtn.disabled = true;
    hintEl.textContent = "搜索中…";
    const started = performance.now();
    try {
        const res = await fetch("/api/search", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
            summaryEl.innerHTML = `<span class="error">${escapeHtml(data.message || `HTTP ${res.status}`)}</span>`;
            cardsEl.innerHTML = "";
            jsonEl.textContent = JSON.stringify(data, null, 2);
            toggleJsonBtn.hidden = false;
            return;
        }
        render(data);
        hintEl.textContent = `${Math.round(performance.now() - started)} ms`;
    } catch (err) {
        summaryEl.innerHTML = `<span class="error">请求失败：${escapeHtml(err.message)}</span>`;
        cardsEl.innerHTML = "";
    } finally {
        runBtn.disabled = false;
    }
}

form.addEventListener("submit", (e) => {
    e.preventDefault();
    runSearch();
});

[keywordEl, typeEl, limitEl, jmespathEl].forEach((el) => {
    el.addEventListener("input", renderCurl);
    el.addEventListener("change", renderCurl);
});

copyCurlBtn.addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(curlCmdEl.textContent);
        copyCurlBtn.textContent = "已复制";
        setTimeout(() => { copyCurlBtn.textContent = "复制"; }, 1500);
    } catch {
        copyCurlBtn.textContent = "复制失败";
        setTimeout(() => { copyCurlBtn.textContent = "复制"; }, 1500);
    }
});

toggleJsonBtn.addEventListener("click", () => {
    const showJson = jsonEl.hidden;
    jsonEl.hidden = !showJson;
    cardsEl.hidden = showJson;
    toggleJsonBtn.textContent = showJson ? "查看卡片" : "查看原始 JSON";
});

document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
        keywordEl.value = chip.dataset.k || "";
        typeEl.value = chip.dataset.t || "all";
        jmespathEl.value = chip.dataset.j || "";
        renderCurl();
        runSearch();
    });
});

renderCurl();

const schemaTabs = document.querySelectorAll("#schema-tabs .tab");
const schemaPanels = document.querySelectorAll("#schema-tabs .tab-panel");
schemaTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        schemaTabs.forEach((t) => t.classList.toggle("active", t === tab));
        schemaPanels.forEach((p) => {
            p.hidden = p.dataset.panel !== tab.dataset.tab;
        });
    });
});
