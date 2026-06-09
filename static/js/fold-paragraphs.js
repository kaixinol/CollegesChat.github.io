/**
 * 自动折叠 H2#自由补充 下面超过3行的 Axx: 开头的 p 标签
 */
export function initParagraphFolder() {
    // 找到 "自由补充" 这个标题
    const heading = document.getElementById("自由补充");
    if (!heading) return;

    // 收集该标题之后、直到下一个 H2 之前的所有 Axx: 开头的 p 标签
    const targetPs = [];
    let nextEl = heading.nextElementSibling;

    while (nextEl && nextEl.tagName !== "H2") {
        if (nextEl.tagName === "P" && /^A\d+[:：]/.test(nextEl.textContent.trim())) {
            targetPs.push(nextEl);
        }
        nextEl = nextEl.nextElementSibling;
    }

    // 遍历这些 p 标签，判断并执行折叠
    targetPs.forEach((p) => {
        // 先加上基础样式类
        p.classList.add("foldable-p");

        // 核心原理：通过临时对比“不限行高度”和“限制3行高度”来判断是否超过3行
        const fullHeight = p.scrollHeight; // 未折叠时的真实高度

        p.classList.add("is-clamped");
        const clampedHeight = p.clientHeight; // 限制3行后的高度

        // 如果完整高度大于3行高度，说明内容确实超过了3行
        if (fullHeight > clampedHeight) {
            // 创建“展开全文”按钮，插在当前 p 标签的后面
            const btn = document.createElement("span");
            btn.className = "fold-toggle-btn";
            btn.textContent = "展开全文 ↓";

            // 点击事件：切换展开和收起
            btn.addEventListener("click", () => {
                const isClamped = p.classList.contains("is-clamped");
                if (isClamped) {
                    p.classList.remove("is-clamped");
                    btn.textContent = "收起全文 ↑";
                } else {
                    p.classList.add("is-clamped");
                    btn.textContent = "展开全文 ↓";
                }
            });

            p.after(btn);
        } else {
            // 如果没超过3行，移除 line-clamp 限制，保持原样展示
            p.classList.remove("is-clamped");
        }
    });
}