<script setup lang="ts">
import { watch } from "vue";
import { useI18n } from "../composables/useI18n";
import { useNotes } from "../composables/useNotes";
import { useSelectedNote } from "../composables/useSelection";
import type { Note, NoteColor } from "../../shared/notes";

const { items, addNote, updateNote, removeNote } = useNotes();
const { selectedId, select } = useSelectedNote();
const { t } = useI18n();

const COLORS: NoteColor[] = ["yellow", "pink", "blue", "green"];

function cycleColor(note: Note): void {
  const next = COLORS[(COLORS.indexOf(note.color) + 1) % COLORS.length]!;
  updateNote(note.id, { color: next });
}

function addAndSelect(): void {
  select(addNote());
}

// If the selected note is deleted (here or in another window), clear the
// selection everywhere.
watch(items, (list) => {
  if (selectedId.value && !list.some((n) => n.id === selectedId.value)) select("");
});

function onTitleInput(note: Note, event: Event): void {
  updateNote(note.id, { title: (event.target as HTMLInputElement).value });
}

function onBodyInput(note: Note, event: Event): void {
  updateNote(note.id, { body: (event.target as HTMLTextAreaElement).value });
}
</script>

<template>
  <section class="board">
    <div class="board-toolbar">
      <h2>{{ t("board.title") }}</h2>
      <button type="button" data-testid="add-note" @click="addAndSelect">
        {{ t("board.add") }}
      </button>
    </div>

    <p v-if="items.length === 0" class="empty">{{ t("board.empty") }}</p>

    <div class="grid">
      <article
        v-for="note in items"
        :key="note.id"
        class="note"
        :class="[`note--${note.color}`, { selected: note.id === selectedId }]"
        :data-note-id="note.id"
        @click="select(note.id)"
      >
        <div class="note-head">
          <input
            :value="note.title"
            class="note-title"
            :placeholder="t('note.titlePlaceholder')"
            @click.stop
            @input="onTitleInput(note, $event)"
          />
          <button type="button" :title="t('note.cycleColor')" @click.stop="cycleColor(note)">
            🎨
          </button>
          <button type="button" :title="t('note.delete')" @click.stop="removeNote(note.id)">
            ✕
          </button>
        </div>
        <textarea
          :value="note.body"
          :placeholder="t('note.bodyPlaceholder')"
          @click.stop
          @input="onBodyInput(note, $event)"
        />
      </article>
    </div>
  </section>
</template>
