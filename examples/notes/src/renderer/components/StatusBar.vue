<script setup lang="ts">
import { computed } from "vue";
import { demoBridge, isElectron, role, windowId } from "../env";
import { useClock } from "../composables/useClock";
import { useI18n } from "../composables/useI18n";
import { usePresence } from "../composables/usePresence";

const { clock } = useClock();
const { presence } = usePresence();
const { t, locale } = useI18n();

const clockText = computed(() =>
  clock.value ? new Date(clock.value).toLocaleTimeString(locale.value) : "—",
);
const shortId = (id: string): string => id.slice(0, 4);

function openPreviewTab(): void {
  window.open(`${location.pathname}?role=preview`, "_blank");
}
</script>

<template>
  <header class="status-bar">
    <span class="badge" :class="`badge--${role}`">{{ t(`app.${role}`) }}</span>

    <span class="presence" :title="t('status.presenceTip')">
      <span class="dot" />{{ presence.length }} {{ t("status.online") }}
      <span v-for="p in presence" :key="p.id" class="chip" :class="{ me: p.id === windowId }">
        {{ t(`app.${p.role}`) }}·{{ shortId(p.id) }}
      </span>
    </span>

    <span class="clock" :title="t(isElectron ? 'status.clockTipElectron' : 'status.clockTipWeb')">
      🕐 {{ clockText }}
    </span>

    <span class="spacer" />

    <template v-if="demoBridge">
      <button v-if="role === 'board'" type="button" @click="demoBridge.openWindow('preview')">
        {{ t("status.openPreviewWindow") }}
      </button>
      <button type="button" @click="demoBridge.openWindow('board')">
        {{ t("status.openBoard") }}
      </button>
    </template>
    <button v-else-if="role === 'board'" type="button" @click="openPreviewTab">
      {{ t("status.openPreviewTab") }}
    </button>
  </header>
</template>
