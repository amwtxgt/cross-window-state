# cross-window-state

[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088ff?logo=githubactions&logoColor=white)](https://github.com/amwtxgt/cross-window-state/actions)
[![npm](https://img.shields.io/badge/npm-cross--window--state-cb3837?logo=npm&logoColor=white)](https://www.npmjs.com/package/cross-window-state)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](./tsconfig.json)

**一份数据，多个窗口，永远同步。**

面向 Electron 多窗口应用与跨标签页 Web 应用的共享响应式状态库 —— 内置持久化、版本迁移，主进程与所有渲染进程 API 完全一致。

- **一份数据** —— 所有窗口与主进程共享同一状态源；任一端的写入，其它端立即可见。
- **默认响应式** —— 用 `.watch()` 订阅，或使用可选的 Vue 桥；无需轮询、无需手动刷新。
- **零差别 DX** —— `createRuntimeState` / `createStorageState` 在主进程与渲染进程上同名、同签名、同语义。传输差异（IPC vs BroadcastChannel）全部内部消化。
- **双宿主** —— 同一份渲染进程代码既能在 Electron 窗口运行，也能在纯浏览器标签页运行（自动降级为 localStorage + BroadcastChannel）。
- **持久化 + 迁移 + 原子写** —— storage 状态跨重启存活，版本升级自动迁移（新增/移除/类型变更三分支），写入原子（tmp + rename）且带重试。
- **核心零依赖** —— 约 50 行的 signal 原语替代框架级响应式；任意 UI 栈可用。Vue 用户有一等桥接。

[快速开始](#快速开始) · [文档站点](https://amwtxgt.github.io/cross-window-state/) · [English](./README.md)

## 为什么

|                                            | electron-store      | zustand cross-tab | cross-window-state |
| ------------------------------------------ | ------------------- | ----------------- | ------------------ |
| 主进程 + 所有窗口共享一份状态              | ❌（仅主进程 JSON） | ❌                | ✅                 |
| runtime（内存态）+ storage（持久态）双状态 | ❌ 仅持久化         | 部分              | ✅ 两者            |
| 主进程与渲染进程 API 一致                  | —                   | —                 | ✅ 契约测试锁定    |
| 版本化迁移                                 | ✅                  | ❌                | ✅                 |
| Web 降级（无 Electron）                    | ❌                  | ✅                | ✅                 |
| 框架无关核心                               | n/a                 | React 优先        | ✅（Vue 桥可选）   |

如果你曾经为了两个窗口的数据同步到处复制 `ipcMain.handle` / `ipcRenderer.send` 样板代码——这个库就是那段代码的抽取、加固与测试版。

## 安装

```bash
pnpm add cross-window-state
pnpm add -D electron   # >= 28（仅 Electron 应用需要）
```

Vue 支持是可选 peer：只有使用 `/vue` 入口时才需要安装 `vue >= 3.3`。

## 快速开始（30 秒，三端代码）

**1. 主进程** —— import 一次；状态创建方式与渲染端完全一致：

```ts
// src/main/index.ts
import { createRuntimeState, createStorageState } from "cross-window-state/main";

const theme = createRuntimeState("theme", "light");
theme.set("dark"); // 所有窗口立即更新

const settings = createStorageState("settings", { locale: "en", notifications: true }, 1);
settings.state.locale = "zh"; // Proxy 直写：自动同步 + 持久化
```

**2. Preload** —— 一行；必须是 CJS（沙箱 preload 不支持 ESM）：

```ts
// src/preload/index.ts（由 electron-vite / electron-builder 打成 CJS）
import "cross-window-state/preload";
```

**3. 渲染进程** —— 同名同签名工厂。在浏览器标签页（无 preload）中，同一份代码透明切换到 localStorage + BroadcastChannel：

```ts
// src/renderer 任意位置
import { createRuntimeState, createStorageState } from "cross-window-state/renderer";

const theme = createRuntimeState("theme", "light");
theme.watch((v) => console.log("theme 更新为", v));
theme.set("dark"); // 传播到主进程与所有窗口

const settings = createStorageState("settings", { locale: "en", notifications: true }, 1);
settings.set("locale", "zh"); // 单键
settings.set({ notifications: false }); // 批量 patch
settings.state.locale = "en"; // 或直接 Proxy 写入
```

**Vue 桥**（可选）：

```ts
import { useRuntimeState } from "cross-window-state/vue";

const { state, set } = useRuntimeState("theme", "light");
// state 是 ShallowRef —— 模板自动更新
```

可运行示例在 [`examples/`](./examples)：

- [`examples/basic`](./examples/basic) —— 最小化计数器/设置演示（兼作 e2e 测试载体）
- [`examples/notes`](./examples/notes) —— 贴近真实应用的 Vue 3 多窗口示例：便签看板 + 只读预览窗、版本化迁移的持久化、主进程数据流、在线窗口列表，以及 Web 多标签模式

仓库根目录一条命令即可运行（会自动先构建库）：

```bash
pnpm example:notes      # Electron：看板窗 + 预览窗
pnpm example:notes:web  # 浏览器多标签 → http://localhost:4173
pnpm example:basic      # 最小化 Electron 演示
pnpm example:basic:web  # 浏览器多标签
```

## API 摘要

| API                                                        | 位置              | 用途                                                          |
| ---------------------------------------------------------- | ----------------- | ------------------------------------------------------------- |
| `createRuntimeState<T>(name, defaultValue?, options?)`     | 主进程 + 渲染进程 | 内存共享状态：`.state`、`.set(v)`、`.watch(cb)`、`.destroy()` |
| `createStorageState<T>(name, defaults, version, options?)` | 主进程 + 渲染进程 | 持久化 JSON 状态（同形态，外加可直写 `.state` Proxy）         |
| `new SyncArray<T>(runtimeState, initial)`                  | 主进程 + 渲染进程 | 经 runtime 状态提交的数组 API（`push/splice/batch/…`）        |
| `useRuntimeState / useStorageState`                        | 渲染进程（Vue）   | `ShallowRef` 视图；作用域销毁只退订、绝不销毁共享状态         |
| `channel`、`runtimeUpdateChannel(key)` 等                  | 根入口            | IPC 协议常量（`cws:` 命名空间），供互操作/调试                |

runtime 状态在主进程与所有窗口都不再持有引用后自动回收。storage 状态写入 `<userData>/cross-window-state/<name>.json`，300ms 防抖，destroy 与应用退出时强制落盘。

### 版本升级迁移

提升 `version` 并修改 `defaults` —— 存量数据自动迁移：defaults 中不存在的键被删除、新增键取默认值、类型变更的键重置为默认值。

## FAQ

**为什么首次读取是同步的（`sendSync`）？**
状态必须在模块作用域立即可用 —— 异步初始化会让每个调用方先 `await` 再读。`sendSync` 只在状态创建时执行一次，而非每次读取。用一次同步 IPC 换取本质上更简单的 API 是刻意取舍；若将来成为启动瓶颈，可以在不改变调用方逻辑的前提下增加异步初始化模式。

**我修改了嵌套对象，为什么没有同步？**
状态是浅响应式设计。修改后请赋新引用（`state.items = [...state.items]`）或再调一次 `.set()`。这保证变更检测 O(1) 且序列化行为可预期。

**其它窗口新增的键在这里看不到。**
storage 的键级订阅覆盖 `defaults` 声明的键（以及你 `.watch()` 的键）。想让一个键处处可见，就把它声明进 defaults —— 未声明的键刻意不可见（它们无法被类型化或校验）。

**Web 模式也持久化吗？**
是 —— localStorage 取代 JSON 文件。版本不匹配时回退 defaults（Web 端没有主进程来跑迁移链）。

**不可信的渲染进程能写状态吗？**
所有渲染进程彼此同等信任，与 Electron 其余 IPC 面一致。不要在共享状态的窗口里加载不受信的远程页面。

## 开发

```bash
pnpm install
pnpm test       # 单测 + 契约测试
pnpm e2e        # 真实 Electron 窗口 + 真实浏览器标签页
pnpm build      # dist（双格式 + preload cjs）
pnpm lint       # oxlint + oxfmt
```

主进程/渲染进程的一致性由**同一套行为契约套件**分别注入两端工厂来强制 —— 任何一端行为漂移即 CI 失败。

## 许可证

[MIT](./LICENSE)
