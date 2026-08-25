import { defineConfig } from "vitepress";

export default defineConfig({
  title: "cross-window-state",
  description:
    "One state, many windows, always in sync — shared reactive state for Electron multi-window apps and cross-tab web apps.",
  lang: "en-US",
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API", link: "/guide/api-runtime" },
      { text: "中文", link: "https://github.com/YOUR_USER/cross-window-state#readme" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "Electron setup", link: "/guide/electron-setup" },
          { text: "Web mode", link: "/guide/web-mode" },
          { text: "Vue bridge", link: "/guide/vue-bridge" },
          { text: "Migrating from raw IPC", link: "/guide/migration-from-raw-ipc" },
        ],
      },
      {
        text: "API reference",
        items: [
          { text: "Runtime state", link: "/guide/api-runtime" },
          { text: "Storage state", link: "/guide/api-storage" },
          { text: "SyncArray", link: "/guide/api-sync-array" },
          { text: "Vue bridge", link: "/guide/api-vue" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/YOUR_USER/cross-window-state" }],
  },
});
