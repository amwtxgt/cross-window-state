<script setup lang="ts">
import StatusBar from "./components/StatusBar.vue";
import BoardView from "./components/BoardView.vue";
import PreviewView from "./components/PreviewView.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import AuditFeed from "./components/AuditFeed.vue";
import { role } from "./env";
import { useApplySettings } from "./composables/useSettings";

// Applies theme/fontScale/compact to <html> and re-applies on every change,
// from any window.
useApplySettings();
</script>

<template>
  <StatusBar />
  <main :class="role">
    <PreviewView v-if="role === 'preview'" />
    <BoardView v-else />
    <aside>
      <SettingsPanel />
      <AuditFeed />
    </aside>
  </main>
</template>
