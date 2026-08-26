<script setup lang="ts">
import { computed } from "vue";
import { isElectron } from "../env";
import { useAudit } from "../composables/useAudit";
import { useI18n } from "../composables/useI18n";

const { auditEntries } = useAudit();
const { t, locale } = useI18n();
const latestFirst = computed(() => [...auditEntries.value].reverse());
</script>

<template>
  <section class="audit">
    <h2>
      {{ t("audit.title") }}
      <span class="muted">{{ t("audit.subtitle") }}</span>
    </h2>
    <p v-if="!isElectron" class="muted">
      {{ t("audit.webOnly") }}
    </p>
    <p v-else-if="latestFirst.length === 0" class="muted">
      {{ t("audit.empty") }}
    </p>
    <ul v-else>
      <li v-for="(e, i) in latestFirst" :key="i">
        <time>{{ new Date(e.at).toLocaleTimeString(locale) }}</time>
        <code>{{ e.action }}</code> {{ e.detail }}
      </li>
    </ul>
  </section>
</template>
