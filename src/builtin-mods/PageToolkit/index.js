// Page Toolkit - WebLoader Mod 入口脚本
// 功能：页面信息面板、深色模式切换、元素统计、调试工具

// 记录加载时间
const loadStartTime = performance.now();

// 日志输出
WebLoader.log('Page Toolkit 已加载', {
    version: WebLoader.version,
    modId: WebLoader.mod.id,
    url: WebLoader.url
});

// ============ 样式注入 ============

const toolkitCSS = `
/* 工具面板基础样式 */
#page-toolkit-panel {
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 12px;
    line-height: 1.5;
    color: #333;
    user-select: none;
}

#page-toolkit-panel.dark {
    color: #ddd;
}

#page-toolkit-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    background: #1a1a2e;
    color: #fff;
    border: 1px solid #333;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

#page-toolkit-toggle:hover {
    background: #16213e;
    border-color: #0f3460;
}

#page-toolkit-dropdown {
    display: none;
    position: absolute;
    top: 36px;
    right: 0;
    width: 320px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    overflow: hidden;
}

#page-toolkit-panel.dark #page-toolkit-dropdown {
    background: #1a1a2e;
    border-color: #333;
    color: #ddd;
}

#page-toolkit-dropdown.show {
    display: block;
}

#page-toolkit-dropdown-header {
    padding: 10px 14px;
    background: #f5f5f5;
    border-bottom: 1px solid #eee;
    font-weight: 600;
    font-size: 13px;
}

#page-toolkit-panel.dark #page-toolkit-dropdown-header {
    background: #16213e;
    border-bottom-color: #333;
}

#page-toolkit-dropdown-body {
    padding: 10px 14px;
}

.toolkit-section {
    margin-bottom: 12px;
}

.toolkit-section:last-child {
    margin-bottom: 0;
}

.toolkit-section-title {
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
    margin-bottom: 4px;
}

#page-toolkit-panel.dark .toolkit-section-title {
    color: #888;
}

.toolkit-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
    font-size: 12px;
}

.toolkit-label {
    color: #666;
}

.toolkit-value {
    font-weight: 500;
    font-family: "SF Mono", Monaco, Consolas, monospace;
    font-size: 11px;
}

#page-toolkit-actions {
    display: flex;
    gap: 6px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #eee;
}

#page-toolkit-panel.dark #page-toolkit-actions {
    border-top-color: #333;
}

.toolkit-btn {
    flex: 1;
    padding: 5px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fff;
    color: #333;
    cursor: pointer;
    font-size: 11px;
    text-align: center;
    transition: all 0.15s;
}

#page-toolkit-panel.dark .toolkit-btn {
    background: #16213e;
    border-color: #333;
    color: #ddd;
}

.toolkit-btn:hover {
    background: #f0f0f0;
    border-color: #ccc;
}

#page-toolkit-panel.dark .toolkit-btn:hover {
    background: #0f3460;
}

/* 深色模式覆盖 */
body.page-toolkit-dark {
    filter: invert(1) hue-rotate(180deg);
}

body.page-toolkit-dark img,
body.page-toolkit-dark video,
body.page-toolkit-dark input,
body.page-toolkit-dark textarea,
body.page-toolkit-dark select {
    filter: invert(1) hue-rotate(180deg);
}

/* 调试信息浮窗 */
#page-toolkit-debug {
    position: fixed;
    bottom: 10px;
    left: 10px;
    z-index: 2147483647;
    padding: 6px 10px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.8);
    color: #0f0;
    font-family: "SF Mono", Monaco, Consolas, monospace;
    font-size: 11px;
    line-height: 1.4;
    display: none;
    max-width: 400px;
}

#page-toolkit-debug.show {
    display: block;
}
`;

// 注入样式
const removeStyle = WebLoader.addStyle(toolkitCSS, 'page-toolkit');

// ============ 创建面板 DOM ============

WebLoader.onReady(async () => {
    await WebLoader.waitFor('body');

    // 创建面板容器
    const panel = document.createElement('div');
    panel.id = 'page-toolkit-panel';
    document.body.appendChild(panel);

    // 获取深色模式状态
    const isDarkMode = WebLoader.storage.get('darkMode', false);
    if (isDarkMode) {
        panel.classList.add('dark');
        document.body.classList.add('page-toolkit-dark');
    }

    // 获取调试模式状态
    const isDebugMode = WebLoader.storage.get('debugMode', false);

    // 构建面板 HTML
    const pageUrl = window.location.href;
    const pageTitle = document.title || '未标题页面';
    const userAgent = navigator.userAgent.substring(0, 50) + '...';
    const screenRes = screen.width + 'x' + screen.height;
    const viewportRes = window.innerWidth + 'x' + window.innerHeight;
    const lang = navigator.language;
    const cookiesEnabled = navigator.cookieEnabled ? '是' : '否';
    const doNotTrack = navigator.doNotTrack || '未设置';

    panel.innerHTML = `
        <div id="page-toolkit-toggle">
            <span>Page Toolkit</span>
        </div>
        <div id="page-toolkit-dropdown">
            <div id="page-toolkit-dropdown-header">Page Toolkit v1.0.0</div>
            <div id="page-toolkit-dropdown-body">
                <div class="toolkit-section">
                    <div class="toolkit-section-title">页面信息</div>
                    <div class="toolkit-row">
                        <span class="toolkit-label">标题</span>
                        <span class="toolkit-value" id="pt-title">${pageTitle}</span>
                    </div>
                    <div class="toolkit-row">
                        <span class="toolkit-label">URL</span>
                        <span class="toolkit-value" id="pt-url">${pageUrl}</span>
                    </div>
                    <div class="toolkit-row">
                        <span class="toolkit-label">协议</span>
                        <span class="toolkit-value">${location.protocol}</span>
                    </div>
                </div>
                <div class="toolkit-section">
                    <div class="toolkit-section-title">浏览器信息</div>
                    <div class="toolkit-row">
                        <span class="toolkit-label">User-Agent</span>
                        <span class="toolkit-value">${userAgent}</span>
                    </div>
                    <div class="toolkit-row">
                        <span class="toolkit-label">语言</span>
                        <span class="toolkit-value">${lang}</span>
                    </div>
                    <div class="toolkit-row">
                        <span class="toolkit-label">Cookies</span>
                        <span class="toolkit-value">${cookiesEnabled}</span>
                    </div>
                    <div class="toolkit-row">
                        <span class="toolkit-label">DNT</span>
                        <span class="toolkit-value">${doNotTrack}</span>
                    </div>
                </div>
                <div class="toolkit-section">
                    <div class="toolkit-section-title">屏幕与视口</div>
                    <div class="toolkit-row">
                        <span class="toolkit-label">屏幕</span>
                        <span class="toolkit-value">${screenRes}</span>
                    </div>
                    <div class="toolkit-row">
                        <span class="toolkit-label">视口</span>
                        <span class="toolkit-value" id="pt-viewport">${viewportRes}</span>
                    </div>
                </div>
                <div class="toolkit-section">
                    <div class="toolkit-section-title">DOM 统计</div>
                    <div class="toolkit-row">
                        <span class="toolkit-label">总元素数</span>
                        <span class="toolkit-value" id="pt-elements">计算中...</span>
                    </div>
                    <div class="toolkit-row">
                        <span class="toolkit-label">标签统计</span>
                        <span class="toolkit-value" id="pt-tags">计算中...</span>
                    </div>
                    <div class="toolkit-row">
                        <span class="toolkit-label">加载时间</span>
                        <span class="toolkit-value" id="pt-loadtime">计算中...</span>
                    </div>
                </div>
                <div class="toolkit-section">
                    <div class="toolkit-section-title">快捷操作</div>
                    <div id="page-toolkit-actions">
                        <button class="toolkit-btn" id="pt-darkmode">深色模式</button>
                        <button class="toolkit-btn" id="pt-debug">调试开关</button>
                        <button class="toolkit-btn" id="pt-reload">刷新页面</button>
                        <button class="toolkit-btn" id="pt-copy">复制URL</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 计算 DOM 统计
    const allElements = document.querySelectorAll('*');
    const tagCounts = {};
    allElements.forEach(el => {
        const tag = el.tagName.toLowerCase();
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });

    // 加载时间
    const loadTime = (performance.now() - loadStartTime).toFixed(1);

    // 更新统计
    const elCountEl = panel.querySelector('#pt-elements');
    const tagsEl = panel.querySelector('#pt-tags');
    const loadtimeEl = panel.querySelector('#pt-loadtime');

    if (elCountEl) elCountEl.textContent = allElements.length;
    if (tagsEl) {
        const sorted = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(function(pair) { return pair[0] + '(' + pair[1] + ')'; })
            .join(', ');
        tagsEl.textContent = sorted;
    }
    if (loadtimeEl) loadtimeEl.textContent = loadTime + 'ms';

    // 面板切换
    const toggle = panel.querySelector('#page-toolkit-toggle');
    const dropdown = panel.querySelector('#page-toolkit-dropdown');

    toggle.addEventListener('click', () => {
        dropdown.classList.toggle('show');
    });

    // 点击外部关闭面板
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    // 深色模式切换
    const darkModeBtn = panel.querySelector('#pt-darkmode');
    darkModeBtn.addEventListener('click', () => {
        const currentDark = WebLoader.storage.get('darkMode', false);
        const newDark = !currentDark;
        WebLoader.storage.set('darkMode', newDark);

        if (newDark) {
            document.body.classList.add('page-toolkit-dark');
            panel.classList.add('dark');
            darkModeBtn.textContent = '浅色模式';
            WebLoader.log('深色模式已启用');
        } else {
            document.body.classList.remove('page-toolkit-dark');
            panel.classList.remove('dark');
            darkModeBtn.textContent = '深色模式';
            WebLoader.log('深色模式已关闭');
        }
    });

    // 更新深色模式按钮文本
    if (isDarkMode) {
        darkModeBtn.textContent = '浅色模式';
    }

    // 调试模式切换
    const debugBtn = panel.querySelector('#pt-debug');
    let debugVisible = isDebugMode;

    debugBtn.addEventListener('click', () => {
        debugVisible = !debugVisible;
        WebLoader.storage.set('debugMode', debugVisible);

        let debugEl = panel.querySelector('#page-toolkit-debug');
        if (!debugEl) {
            debugEl = document.createElement('div');
            debugEl.id = 'page-toolkit-debug';
            document.body.appendChild(debugEl);
        }

        if (debugVisible) {
            debugEl.classList.add('show');
            WebLoader.log('调试模式已开启');
        } else {
            debugEl.classList.remove('show');
            WebLoader.log('调试模式已关闭');
        }
    });

    // 如果之前开启了调试模式，显示调试面板
    if (isDebugMode) {
        debugBtn.click();
    }

    // 刷新页面
    const reloadBtn = panel.querySelector('#pt-reload');
    reloadBtn.addEventListener('click', () => {
        WebLoader.reload();
    });

    // 复制 URL
    const copyBtn = panel.querySelector('#pt-copy');
    copyBtn.addEventListener('click', () => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(window.location.href).then(() => {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '已复制!';
                setTimeout(function() {
                    copyBtn.textContent = originalText;
                }, 1500);
            }).catch(() => {
                fallbackCopy();
            });
        } else {
            fallbackCopy();
        }

        function fallbackCopy() {
            const textarea = document.createElement('textarea');
            textarea.value = window.location.href;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '已复制!';
            setTimeout(function() {
                copyBtn.textContent = originalText;
            }, 1500);
        }
    });

    // 调试模式：实时更新信息
    if (isDebugMode || debugVisible) {
        const updateDebug = () => {
            let debugEl = panel.querySelector('#page-toolkit-debug');
            if (!debugEl || !debugEl.classList.contains('show')) return;

            const now = new Date().toLocaleTimeString();
            const scrollY = window.scrollY;
            const scrollX = window.scrollX;
            const online = navigator.onLine ? '在线' : '离线';
            let memory = '不可用';
            if (performance.memory) {
                memory = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1) + 'MB';
            }

            debugEl.textContent =
                '[' + now + '] ' + window.location.href +
                '  |  滚动: (' + scrollX + ', ' + scrollY + ')' +
                '  |  状态: ' + online + ' 内存: ' + memory +
                '  |  元素: ' + document.querySelectorAll('*').length + '  DOM: ' + document.readyState;
        };

        updateDebug();
        setInterval(updateDebug, 1000);
    }

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', () => {
        WebLoader.log('页面可见性变化: ' + document.visibilityState);
    });

    // 监听窗口大小变化
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            const viewportEl = panel.querySelector('#pt-viewport');
            if (viewportEl) {
                viewportEl.textContent = window.innerWidth + 'x' + window.innerHeight;
            }
        }, 100);
    });

    WebLoader.log('Page Toolkit 面板已初始化');
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    removeStyle();
    WebLoader.log('Page Toolkit 已卸载');
});
