# WebLoader Mod 开发教程

WebLoader 是一个基于 Electron 的网页 Mod 加载器。它会在目标网站页面中按配置注入 Mod，并提供日志、持久化存储、样式注入、DOM 等待等基础 API。

安装完成后如果想再次查看本文档，运行：

```bash
WebLoader docs
```

## 目录

1. 快速开始
2. 项目结构
3. 加载器配置
4. Mod 配置
5. 编写第一个 Mod
6. 运行环境与执行时机
7. URL 匹配规则
8. WebLoader API
9. 持久化存储
10. 调试与热重载
11. 常见问题
12. 安全提醒

## 1. 快速开始

在当前目录安装 WebLoader：

```bash
WebLoader install https://www.bilibili.com/
```

启动当前目录的 WebLoader：

```bash
WebLoader start
```

查看当前目录中发现的 Mod：

```bash
WebLoader list
```

查看本文档：

```bash
WebLoader docs
```

安装时可以指定网站显示名称，或强制覆盖已有配置：

```bash
WebLoader install https://www.bilibili.com/ --name Bilibili
WebLoader install https://www.bilibili.com/ --force
```

启动时打开开发者工具：

```bash
WebLoader start --devtools
```

## 2. 项目结构

```text
当前目录/
├── WebLoader.loader.config.json   加载器配置
├── mods/
│   └── example/
│       ├── WebLoader.mod.json     Mod 配置
│       └── index.js               Mod 入口脚本
└── .webloader/
    └── storage/                   Mod 持久化数据
```

一个 Mod 必须放在 `mods/` 的直接子目录中，并且包含 `WebLoader.mod.json`。没有配置文件的目录会被跳过并显示警告。

## 3. 加载器配置

`WebLoader.loader.config.json` 由 `WebLoader install` 自动生成：

```json
{
  "formatVersion": 1,
  "site": {
    "url": "https://www.bilibili.com/",
    "name": "bilibili.com"
  },
  "window": {
    "width": 1440,
    "height": 900,
    "minWidth": 800,
    "minHeight": 600,
    "resizable": true
  },
  "devTools": false,
  "mods": {
    "watch": true,
    "disabled": []
  }
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `site.url` | string | 启动时加载的网站地址，只支持 `http://` 和 `https://` |
| `site.name` | string | 网站显示名称 |
| `window.width` | number | 窗口宽度 |
| `window.height` | number | 窗口高度 |
| `window.minWidth` | number | 窗口最小宽度 |
| `window.minHeight` | number | 窗口最小高度 |
| `window.resizable` | boolean | 是否允许调整窗口大小 |
| `devTools` | boolean | 启动时是否自动打开开发者工具 |
| `mods.watch` | boolean | 是否在 Mod 文件变化时自动重新加载页面 |
| `mods.disabled` | string[] | 要禁用的 Mod ID 列表 |
| `userAgent` | string | 可选，自定义 User-Agent |

Mod 是否启用由两处共同决定：

- `WebLoader.mod.json` 中的 `enabled` 不能为 `false`。
- Mod ID 或目录名不能出现在 `mods.disabled` 中。

## 4. Mod 配置

文件：`mods/<目录>/WebLoader.mod.json`

```json
{
  "id": "hello-bilibili",
  "name": "Hello Bilibili",
  "version": "1.0.0",
  "author": "your-name",
  "description": "在页面右下角显示一个标记。",
  "entry": "index.js",
  "matches": [
    "https://*.bilibili.com/*"
  ],
  "excludeMatches": [],
  "runAt": "document-end",
  "world": "page",
  "priority": 0,
  "enabled": true
}
```

| 字段 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `id` | 否 | 目录名 | Mod 唯一 ID，只能包含字母、数字、点、下划线、短横线，最长 64 字符 |
| `name` | 否 | ID | Mod 显示名称 |
| `version` | 否 | `0.0.0` | 版本号 |
| `author` | 否 | `Unknown` | 作者 |
| `description` | 否 | 空字符串 | 描述 |
| `entry` | 是 | 无 | 入口 JS 文件，相对于 Mod 目录，不能指向目录外 |
| `matches` | 否 | 目标网站的同源地址 | 要注入的页面匹配规则 |
| `excludeMatches` | 否 | `[]` | 排除的页面匹配规则 |
| `runAt` | 否 | `document-end` | 执行时机 |
| `world` | 否 | `page` | 运行环境 |
| `priority` | 否 | `0` | 加载优先级，数字越大越先执行 |
| `enabled` | 否 | `true` | 是否启用 |

如果 `matches` 为空数组或未填写，Mod 默认只在加载器目标网站的源地址上运行。例如目标为 `https://www.bilibili.com/` 时，默认规则是 `https://www.bilibili.com/*`。

`id` 会用于持久化存储文件名，建议安装后不要随意修改。

## 5. 编写第一个 Mod

创建目录和文件：

```text
mods/hello-bilibili/WebLoader.mod.json
mods/hello-bilibili/index.js
```

`WebLoader.mod.json`：

```json
{
  "id": "hello-bilibili",
  "name": "Hello Bilibili",
  "version": "1.0.0",
  "author": "your-name",
  "description": "在页面右下角显示一个标记。",
  "entry": "index.js",
  "matches": [
    "https://*.bilibili.com/*"
  ],
  "runAt": "document-end",
  "world": "page",
  "enabled": true
}
```

`index.js`：

```js
WebLoader.log('Hello Bilibili 已加载');

WebLoader.addStyle(`
  #hello-bilibili {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 2147483647;
    padding: 8px 12px;
    border-radius: 8px;
    background: #00a1d6;
    color: #fff;
    font: 14px/1.4 system-ui, sans-serif;
  }
`);

WebLoader.onReady(async () => {
  await WebLoader.waitFor('body');

  const badge = document.createElement('div');
  badge.id = 'hello-bilibili';
  badge.textContent = 'Hello Bilibili';
  document.body.appendChild(badge);
});
```

保存后如果正在运行 `WebLoader start`，页面通常会自动刷新。没有刷新时手动重新加载即可。

## 6. 运行环境与执行时机

### world

`world` 决定 Mod 代码运行在哪个 JavaScript 环境。

| 值 | 说明 |
| --- | --- |
| `page` | 默认值。运行在网页主世界，可以直接访问网页自己的全局变量和 JavaScript 对象。不能使用 Node.js 的 `require`。 |
| `isolated` | 运行在 Electron preload 的隔离世界。可以访问 Node.js 的 `require`、`module`、`exports`、`__filename`、`__dirname`，同时也能操作页面 DOM，但无法直接访问网页主世界的全局变量。 |

`page` 模式适合修改 DOM、CSS、监听网页事件，以及和网页自身的 JavaScript 交互。

`isolated` 模式适合需要读写本地文件、使用 Node.js 模块，或者不希望与网页全局变量冲突的 Mod。

### runAt

| 值 | 说明 |
| --- | --- |
| `document-start` | 页面刚开始加载时执行。适合尽早注入逻辑。 |
| `document-end` | DOMContentLoaded 后执行。默认值，适合大多数 DOM 操作。 |
| `document-idle` | 页面 load 事件后执行。适合等待图片等资源加载完成后再操作。 |

Mod 也可以在执行后使用 `WebLoader.onReady()` 或 `WebLoader.waitFor()` 等待需要的内容出现。

两个 Mod 都支持顶层 `await`。

## 7. URL 匹配规则

`matches` 和 `excludeMatches` 使用类似浏览器扩展的匹配规则：

```text
<scheme>://<host><path>
```

示例：

| 规则 | 说明 |
| --- | --- |
| `<all_urls>` | 匹配所有支持的页面 |
| `https://www.bilibili.com/*` | 匹配指定域名下的所有路径 |
| `https://*.bilibili.com/*` | 匹配 `bilibili.com` 及其所有子域名 |
| `*://*.bilibili.com/*` | 同时匹配 HTTP 和 HTTPS |
| `https://www.bilibili.com/video/*` | 只匹配 `/video/` 下的页面 |

路径中的 `*` 可以匹配任意字符，包括 `/`、查询参数等。URL 匹配会忽略 `#hash`。

排除规则优先于包含规则。例如：

```json
{
  "matches": ["https://*.bilibili.com/*"],
  "excludeMatches": ["https://api.bilibili.com/*"]
}
```

## 8. WebLoader API

Mod 入口中可以直接使用全局参数 `WebLoader`。

### WebLoader.version

加载器版本号：

```js
WebLoader.log(WebLoader.version);
```

### WebLoader.mod

当前 Mod 的配置信息：

```js
WebLoader.log(WebLoader.mod.id);
WebLoader.log(WebLoader.mod.name);
WebLoader.log(WebLoader.mod.version);
WebLoader.log(WebLoader.mod.author);
WebLoader.log(WebLoader.mod.description);
```

### WebLoader.url

当前页面地址：

```js
WebLoader.log(WebLoader.url);
```

### WebLoader.log / info / warn / error / debug

同时输出到页面开发者工具和启动 WebLoader 的终端：

```js
WebLoader.log('普通日志', { data: 1 });
WebLoader.info('信息');
WebLoader.warn('警告');
WebLoader.error('错误');
WebLoader.debug('调试信息');
```

### WebLoader.addStyle(css, key?)

向页面注入 CSS，返回一个用于移除样式的函数：

```js
const removeStyle = WebLoader.addStyle(`
  body {
    background: #111;
  }
`, 'dark-theme');

removeStyle();
```

`key` 是可选的标识，会写入 `data-webloader-key` 属性，方便在开发者工具中定位。

### WebLoader.onReady(callback)

在 DOMContentLoaded 后执行回调。回调可以返回 Promise，抛出的错误会被自动记录：

```js
WebLoader.onReady(async () => {
  WebLoader.log('DOM 已就绪');
  await WebLoader.waitFor('#app');
});
```

如果 DOM 已经就绪，回调会异步执行。

### WebLoader.waitFor(selector, options?)

等待元素出现，返回 Promise：

```js
const element = await WebLoader.waitFor('.video-card');

const another = await WebLoader.waitFor('.comment', {
  timeout: 5000,
  root: document.querySelector('#app')
});

const stillWaiting = await WebLoader.waitFor('#maybe', 3000);
```

`options` 可以是数字，表示超时毫秒数，也可以是对象：

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `timeout` | `10000` | 超时毫秒数，设为 `0` 表示不超时 |
| `root` | `document` | 在该元素内查找 |

超时会抛出错误。

### WebLoader.storage

用于保存 JSON 可序列化的数据。数据保存在当前项目的 `.webloader/storage/<mod-id>.json`，重启后仍然存在。

```js
const count = WebLoader.storage.get('count', 0);
WebLoader.storage.set('count', count + 1);
WebLoader.log('启动次数', count + 1);
```

API：

```js
WebLoader.storage.get(key, fallback);
WebLoader.storage.set(key, value);
WebLoader.storage.remove(key);
WebLoader.storage.clear();
```

- `get` 在键不存在时返回 `fallback`。
- `set` 成功返回 `true`，失败返回 `false`。
- 只能保存可以 JSON 序列化的值，例如字符串、数字、布尔值、数组、普通对象。
- 不要把函数、循环引用对象、DOM 元素放进存储。

### WebLoader.reload()

重新加载当前页面：

```js
WebLoader.reload();
```

## 9. 持久化存储

存储按 Mod ID 区分。不同 Mod 之间的数据互不影响。

```js
const settings = WebLoader.storage.get('settings', {
  theme: 'dark',
  autoPlay: true,
});

settings.autoPlay = false;
WebLoader.storage.set('settings', settings);
```

调试时可以直接查看：

```text
.webloader/storage/<mod-id>.json
```

删除对应文件可以重置该 Mod 的存储。

## 10. 调试与热重载

- 使用 `WebLoader start --devtools` 启动时自动打开开发者工具。
- 也可以在 WebLoader 菜单中选择 `视图 > 开发者工具`。
- Mod 的 `WebLoader.log()` 等日志会同时显示在页面控制台和启动 WebLoader 的终端。
- 默认开启 Mod 热重载。修改 `mods/` 中的 JS 或 JSON 后，页面会自动刷新。
- 在 `WebLoader.loader.config.json` 中设置 `"watch": false` 可以关闭热重载。
- 使用 `WebLoader list` 检查 Mod 是否被正确发现、是否被禁用，以及配置是否有错误。

## 11. 常见问题

### Mod 没有被加载

检查以下几点：

1. Mod 是否位于 `mods/<目录>/`。
2. 是否存在 `mods/<目录>/WebLoader.mod.json`。
3. `entry` 指向的文件是否存在。
4. `enabled` 是否为 `true`。
5. Mod ID 是否出现在配置的 `mods.disabled` 中。
6. `matches` 是否匹配当前页面。
7. 运行 `WebLoader list` 查看是否有配置错误。
8. 打开开发者工具，检查页面控制台和启动终端是否报错。

### 页面刷新后 Mod 重复执行

页面刷新会重新执行 Mod，这是正常行为。需要只执行一次的初始化逻辑可以使用存储记录状态：

```js
if (!WebLoader.storage.get('initialized', false)) {
  WebLoader.storage.set('initialized', true);
  WebLoader.log('只执行一次');
}
```

### 在 page 模式中 require 报错

`page` 模式没有 Node.js 环境，不支持 `require`。需要 Node.js 模块时将 Mod 配置改为：

```json
{
  "world": "isolated"
}
```

### 修改 Mod 后页面没有自动刷新

确认配置中 `mods.watch` 为 `true`，然后手动重新加载页面。部分编辑器保存文件较慢时，热重载可能延迟几百毫秒。

## 12. 安全提醒

Mod 是拥有页面访问权限的任意 JavaScript 代码。`isolated` 模式的 Mod 还可以访问本地 Node.js 能力。

只运行你信任的 Mod。不要加载来源不明、无法阅读或经过混淆的 Mod 代码。

WebLoader 不会限制 Mod 的权限。安装和启用 Mod 前请自行审查代码。

---

更多命令帮助：

```bash
WebLoader help
```
