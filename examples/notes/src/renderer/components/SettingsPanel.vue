<script setup lang="ts">
import { SETTINGS_VERSION } from "../../shared/notes";
import type { Settings } from "../../shared/notes";
import { useI18n } from "../composables/useI18n";
import { useSettings } from "../composables/useSettings";

const { settings, setSetting } = useSettings();
const { t } = useI18n();

function set<K extends keyof Settings>(key: K, value: Settings[K]): void {
  setSetting(key, value);
}

function onTheme(event: Event): void {
  set("theme", (event.target as HTMLSelectElement).value as Settings["theme"]);
}

function onFontScale(event: Event): void {
  set("fontScale", (event.target as HTMLSelectElement).value as Settings["fontScale"]);
}

function onCompact(event: Event): void {
  set("compact", (event.target as HTMLInputElement).checked);
}

function onLocale(event: Event): void {
  set("locale", (event.target as HTMLSelectElement).value as Settings["locale"]);
}
</script>

<template>
  <section class="settings">
    <h2>
      {{ t("settings.title") }}
      <span class="muted">{{ t("settings.schema", { n: SETTINGS_VERSION }) }}</span>
    </h2>
    <label>
      {{ t("settings.locale") }}
      <select data-testid="locale" :value="settings.locale" @change="onLocale">
        <option value="en">English</option>
        <option value="zh-CN">中文</option>
      </select>
    </label>
    <label>
      {{ t("settings.theme") }}
      <select data-testid="theme" :value="settings.theme" @change="onTheme">
        <option value="light">{{ t("settings.theme.light") }}</option>
        <option value="dark">{{ t("settings.theme.dark") }}</option>
      </select>
    </label>
    <label>
      {{ t("settings.fontScale") }}
      <select :value="settings.fontScale" @change="onFontScale">
        <option value="small">{{ t("settings.fontScale.small") }}</option>
        <option value="medium">{{ t("settings.fontScale.medium") }}</option>
        <option value="large">{{ t("settings.fontScale.large") }}</option>
      </select>
    </label>
    <label>
      {{ t("settings.compact") }}
      <input
        data-testid="compact"
        type="checkbox"
        :checked="settings.compact"
        @change="onCompact"
      />
    </label>
  </section>
</template>
