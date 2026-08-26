<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "../composables/useI18n";
import { useNotes } from "../composables/useNotes";
import { useSelectedNote } from "../composables/useSelection";

const { items } = useNotes();
// Read-only handle in this window: selecting is only possible from a board.
const { selectedId } = useSelectedNote();
const { t, locale } = useI18n();

const note = computed(() => items.value.find((n) => n.id === selectedId.value) ?? null);
</script>

<template>
  <section class="preview">
    <div class="board-toolbar">
      <h2>{{ t("preview.title") }}</h2>
      <span class="badge badge--readonly">{{ t("preview.readonly") }}</span>
    </div>

    <article
      v-if="note"
      class="note note--big"
      :class="`note--${note.color}`"
      data-testid="preview-note"
    >
      <h3 class="preview-title">{{ note.title }}</h3>
      <p class="preview-body">{{ note.body || t("preview.emptyNote") }}</p>
      <footer class="muted">
        {{ t("preview.updated") }} {{ new Date(note.updatedAt).toLocaleString(locale) }}
      </footer>
    </article>

    <p v-else class="empty">{{ t("preview.hint") }}</p>
  </section>
</template>
