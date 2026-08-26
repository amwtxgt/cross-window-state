import { computed } from "vue";
import type { Locale } from "../../shared/notes";
import { useSettings } from "./useSettings";

/**
 * Dependency-free mini i18n. The locale lives in the persisted settings
 * state, so switching language in one window re-renders every window — a
 * storage state doing exactly what it is for.
 */
const messages: Record<Locale, Record<string, string>> = {
  en: {
    "app.board": "board",
    "app.preview": "preview",
    "status.online": "online",
    "status.presenceTip": "live presence — a runtime state every window writes",
    "status.clockTipElectron": "ticked by the main process once per second",
    "status.clockTipWeb": "main-process clock — available in Electron mode",
    "status.openPreviewWindow": "open preview window",
    "status.openBoard": "open another board",
    "status.openPreviewTab": "open preview tab",
    "board.title": "Board",
    "board.add": "+ add note",
    "board.empty": "No notes yet — add one and watch every window.",
    "note.titlePlaceholder": "title",
    "note.bodyPlaceholder": "write something…",
    "note.cycleColor": "cycle color",
    "note.delete": "delete",
    "preview.title": "Preview",
    "preview.readonly": "read-only selection",
    "preview.emptyNote": "(empty note)",
    "preview.hint": "Select a note on any board — this window follows the selection live.",
    "preview.updated": "updated",
    "settings.title": "Settings",
    "settings.schema": "persisted · schema v{n}",
    "settings.theme": "theme",
    "settings.theme.light": "light",
    "settings.theme.dark": "dark",
    "settings.fontScale": "font size",
    "settings.fontScale.small": "small",
    "settings.fontScale.medium": "medium",
    "settings.fontScale.large": "large",
    "settings.compact": "compact cards",
    "settings.locale": "language",
    "audit.title": "Audit feed",
    "audit.subtitle": "SyncArray written by the main process",
    "audit.webOnly":
      "Electron only — the main process records every settings change here, and late-joining windows adopt the whole feed.",
    "audit.empty": "Change a setting to see entries arrive.",
  },
  "zh-CN": {
    "app.board": "看板",
    "app.preview": "预览",
    "status.online": "个窗口在线",
    "status.presenceTip": "实时在线列表 —— 每个窗口都会写入的 runtime 状态",
    "status.clockTipElectron": "由主进程每秒推进",
    "status.clockTipWeb": "主进程时钟 —— 仅 Electron 模式可用",
    "status.openPreviewWindow": "打开预览窗",
    "status.openBoard": "再开一个看板",
    "status.openPreviewTab": "打开预览标签页",
    "board.title": "看板",
    "board.add": "+ 新建便签",
    "board.empty": "还没有便签 —— 新建一条，所有窗口都会实时更新。",
    "note.titlePlaceholder": "标题",
    "note.bodyPlaceholder": "写点什么…",
    "note.cycleColor": "切换颜色",
    "note.delete": "删除",
    "preview.title": "预览",
    "preview.readonly": "只读跟随选中",
    "preview.emptyNote": "（空便签）",
    "preview.hint": "在任意看板窗口选择一张便签 —— 本窗口会实时跟随。",
    "preview.updated": "更新于",
    "settings.title": "设置",
    "settings.schema": "持久化 · schema v{n}",
    "settings.theme": "主题",
    "settings.theme.light": "浅色",
    "settings.theme.dark": "深色",
    "settings.fontScale": "字号",
    "settings.fontScale.small": "小",
    "settings.fontScale.medium": "中",
    "settings.fontScale.large": "大",
    "settings.compact": "紧凑卡片",
    "settings.locale": "语言",
    "audit.title": "审计流",
    "audit.subtitle": "由主进程写入的 SyncArray",
    "audit.webOnly": "仅 Electron —— 主进程在此记录每次设置变更，新开的窗口会自动继承整条记录。",
    "audit.empty": "修改任意设置即可看到记录。",
  },
};

export function useI18n() {
  const { settings } = useSettings();
  const locale = computed(() => settings.value.locale);

  function t(key: string, params?: Record<string, string | number>): string {
    let text = messages[locale.value][key] ?? messages.en[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replace(`{${name}}`, String(value));
      }
    }
    return text;
  }

  return { locale, t };
}
