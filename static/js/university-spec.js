import { initParagraphFolder } from "./fold-paragraphs.js";
function onDomReady(callback) {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
        callback();
    }
}

onDomReady(() => {
    const isTouchDevice = window.matchMedia("(hover: none)").matches;
    //  解析页面中的 ID 和时间映射
    const idTimeMap = Object.fromEntries(
        [...document.querySelectorAll("blockquote + details li")]
            .map((li) => {
                const text = li.textContent.trim();
                const id = text.match(/A\d+/)?.[0];
                const time = text.match(/\((.*?)\)/)?.[1];
                return id && time ? [id, time] : null;
            })
            .filter(Boolean),
    );

    const makeIdSpan = (id, time) => {
        const actionText = isTouchDevice ? "长按反馈问题" : "右键反馈问题";
        return `<span class="id-link" data-id="${id}" data-title="回答时间: ${time} (${actionText})">${id}</span>`;
    };

    //  处理并聚合重复回答
    document.querySelectorAll('h2[id^="q"] + ul').forEach((ul) => {
        const lis = [...ul.querySelectorAll("li")];
        if (!lis.length) return;

        const groupsMap = new Map();

        for (const li of lis) {
            const text = li.textContent.trim();
            const idMatch = text.match(/A\d+/);
            const id = idMatch ? idMatch[0] : null;
            const answer = text.split(/[:：]\s*/).slice(1).join(":").trim() ||
                text;

            if (!groupsMap.has(answer)) {
                groupsMap.set(answer, []);
            }
            groupsMap.get(answer).push(id);
        }

        ul.replaceChildren(
            ...Array.from(groupsMap.entries()).map(([answer, ids]) => {
                if (ids.length === 1) {
                    const li = document.createElement("li");
                    const time = idTimeMap[ids[0]];
                    const content = answer;
                    li.innerHTML = ids[0]
                        ? `${makeIdSpan(ids[0], time)}: ${content}`
                        : content;
                    return li;
                }

                const li = document.createElement("li");
                const details = document.createElement("details");
                const summary = document.createElement("summary");
                const idContainer = document.createElement("div");

                summary.textContent = `${answer} × ${ids.length}`;
                summary.style.cursor = "pointer";
                summary.style.padding = "1rem";
                details.style.margin = "0";
                details.style.padding = "0.5rem";

                idContainer.innerHTML = ids
                    .map((
                        id,
                    ) => (idTimeMap[id] ? makeIdSpan(id, idTimeMap[id]) : id))
                    .join(" ");

                details.append(summary, idContainer);
                li.append(details);
                return li;
            }),
        );
    });

    //  电脑端：右键直接跳转
    document.addEventListener("contextmenu", (e) => {
        const el = e.target.closest(".id-link");
        if (!el) return;
        // 如果是触摸设备，交给下面的触摸事件处理，阻止默认右键
        if (window.matchMedia("(hover: none)").matches) {
            e.preventDefault();
            return;
        }
        e.preventDefault();
        triggerReport(el.dataset.id);
    });

    //  移动端专门处理：精准区分“轻点看日期”与“长按 800ms 跳转”
    let longPressTimer = null;
    let isLongPressAction = false;

    // 跳转公共函数
    function triggerReport(id) {
        window.open(
            `https://github.com/CollegesChat/university-information/issues/new?template=malicious_data.yml&title=${
                encodeURIComponent(`[数据举报]：${id}`)
            }&target=${encodeURIComponent(document.querySelector('meta[itemprop="name"]').content)}`,
            "_blank",
        );
    }

    document.addEventListener("touchstart", (e) => {
        const el = e.target.closest(".id-link");
        if (!el) return;

        isLongPressAction = false;

        // 设置自定义长按定时器：800 毫秒（可根据需要自行调整）
        longPressTimer = setTimeout(() => {
            isLongPressAction = true;

            // 手机微震动反馈（可选，部分安卓支持）
            if (navigator.vibrate) navigator.vibrate(50);

            // 弹出确认框，防止用户在看日期时手抖误触发跳转
            if (confirm(`是否要针对 ID: ${el.dataset.id} 发起数据举报？`)) {
                triggerReport(el.dataset.id);
            }
            // 触发后隐藏气泡
            el.classList.remove("show-tip");
        }, 800);
    }, { passive: true });

    document.addEventListener("touchend", (e) => {
        const el = e.target.closest(".id-link");

        // 只要手抬起来了，立刻清除长按定时器
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        if (!el) return;

        // 如果不是长按，说明是“轻点”
        if (!isLongPressAction) {
            // 切换日期气泡的显示与隐藏
            const hasTip = el.classList.contains("show-tip");
            // 先清空页面上所有其他的气泡
            document.querySelectorAll(".id-link.show-tip").forEach((node) =>
                node.classList.remove("show-tip")
            );
            if (!hasTip) {
                el.classList.add("show-tip");
            }
        }
    });

    // 手指在屏幕上滑动时，取消长按判定
    document.addEventListener("touchmove", () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    }, { passive: true });

    // 点击页面其他空白处时，隐藏手机上的日期气泡
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".id-link")) {
            document.querySelectorAll(".id-link.show-tip").forEach((node) =>
                node.classList.remove("show-tip")
            );
        }
    });
    initParagraphFolder();
});
