<script lang="ts">
  import { onMount } from "svelte";
  import { prepare, layout } from "@chenglou/pretext";
  import type { MangaEntry, MangaJson, Chapter } from "../shared/types.ts";
  import { mergeChapterIntoExisting } from "../shared/chapterMerge.ts";
  import PhArrowLeft from "~icons/ph/arrow-left";
  import PhFloppyDisk from "~icons/ph/floppy-disk";
  import PhCheck from "~icons/ph/check";
  import PhPlus from "~icons/ph/plus";
  import PhTrash from "~icons/ph/trash";
  import PhCaretRight from "~icons/ph/caret-right";
  import PhArrowSquareOut from "~icons/ph/arrow-square-out";
  import PhDotsSixVertical from "~icons/ph/dots-six-vertical";
  import PhUploadSimple from "~icons/ph/upload-simple";
  import PhImage from "~icons/ph/image";
  import PhFolderOpen from "~icons/ph/folder-open";
  import PhPencilSimple from "~icons/ph/pencil-simple";
  import PhCloudArrowDown from "~icons/ph/cloud-arrow-down";

  interface Props {
    rpc: any;
    entry: MangaEntry;
    onBack: () => void;
  }

  let { rpc, entry, onBack }: Props = $props();

  function cloneChapter(chapter: Chapter): Chapter {
    return {
      title: chapter.title,
      volume: chapter.volume,
      last_updated: chapter.last_updated,
      groups: Object.fromEntries(
        Object.entries(chapter.groups).map(([groupName, urls]) => [groupName, [...urls]])
      ),
    };
  }

  function cloneChapters(source: Record<string, Chapter>): Record<string, Chapter> {
    return Object.fromEntries(
      Object.entries(source).map(([chapterNum, chapter]) => [chapterNum, cloneChapter(chapter)])
    );
  }

  let title = $state(entry.manga.title);
  let description = $state(entry.manga.description);
  let author = $state(entry.manga.author);
  let artist = $state(entry.manga.artist);
  let cover = $state(entry.manga.cover);
  let chapters = $state<Record<string, Chapter>>(cloneChapters(entry.manga.chapters));

  let saveStatus = $state<"idle" | "saving" | "saved">("idle");
  let hasChanges = $state(false);

  let selectedChapter = $state<string | null>(null);
  let showAddChapter = $state(false);
  let newChapterNum = $state("");
  let newChapterTitle = $state("");
  let newChapterVolume = $state("");
  let newChapterGroup = $state("");

  let uploadingChapter = $state<string | null>(null);
  let uploadStatus = $state<string | null>(null);
  let uploadError = $state<string | null>(null);
  let uploadProgress = $state<{ group: string; count: number; startTime: number } | null>(null);
  let newGroupUpload = $state<{ chapterNum: string } | null>(null);
  let newGroupName = $state("");

  let confirmRemoveChapter = $state<string | null>(null);

  let dragState = $state<{ chapterNum: string; groupName: string; fromIndex: number } | null>(null);
  let dragOverIndex = $state<number | null>(null);

  function onDragStart(chNum: string, groupName: string, index: number) {
    dragState = { chapterNum: chNum, groupName, fromIndex: index };
    dragOverIndex = null;
  }

  function onDragOver(index: number) {
    if (!dragState) return;
    dragOverIndex = index;
  }

  function onDragEnd() {
    dragState = null;
    dragOverIndex = null;
  }

  function onDrop(chNum: string, groupName: string, toIndex: number) {
    if (!dragState || dragState.chapterNum !== chNum || dragState.groupName !== groupName) return;
    const fromIndex = dragState.fromIndex;
    if (fromIndex === toIndex) { dragState = null; dragOverIndex = null; return; }
    const ch = chapters[chNum];
    if (!ch) return;
    const urls = ch.groups[groupName];
    if (!urls) return;
    const [moved] = urls.splice(fromIndex, 1);
    urls.splice(toIndex, 0, moved);
    chapters = { ...chapters };
    dragState = null;
    dragOverIndex = null;
  }

  let editingChapter = $state<string | null>(null);
  let editChapterNum = $state("");
  let editTitle = $state("");
  let editVolume = $state("");
  let editLastUpdated = $state("");

  function padDatePart(n: number): string {
    return String(n).padStart(2, "0");
  }

  function formatTimestampForInput(ts: string): string {
    if (!ts) return "";
    const num = Number(ts);
    if (!Number.isFinite(num)) return "";
    const d = new Date(num * 1000);
    if (isNaN(d.getTime())) return "";
    return [
      d.getFullYear(),
      padDatePart(d.getMonth() + 1),
      padDatePart(d.getDate()),
    ].join("-") + `T${padDatePart(d.getHours())}:${padDatePart(d.getMinutes())}`;
  }

  function parseLastUpdatedInput(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      const raw = Number(trimmed);
      if (!Number.isFinite(raw)) return null;
      return String(trimmed.length > 10 ? Math.floor(raw / 1000) : raw);
    }

    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) return null;
    return String(Math.floor(parsed.getTime() / 1000));
  }

  let editLastUpdatedUnixPreview = $derived.by(() => parseLastUpdatedInput(editLastUpdated));

  function startEditChapter(chNum: string) {
    const ch = chapters[chNum];
    if (!ch) return;
    editingChapter = chNum;
    editChapterNum = chNum;
    editTitle = ch.title;
    editVolume = ch.volume;
    editLastUpdated = formatTimestampForInput(ch.last_updated);
  }

  function cancelEditChapter() {
    editingChapter = null;
  }

  function applyEditChapter() {
    if (!editingChapter || !chapters[editingChapter]) return;
    const oldNum = editingChapter;
    const newNum = editChapterNum.trim() || oldNum;
    const ch = chapters[oldNum];
    const parsedLastUpdated = parseLastUpdatedInput(editLastUpdated);
    ch.title = editTitle;
    ch.volume = editVolume;
    ch.last_updated = parsedLastUpdated ?? String(Math.floor(Date.now() / 1000));

    if (newNum !== oldNum) {
      delete chapters[oldNum];
      chapters[newNum] = ch;
    }

    chapters = { ...chapters };
    editingChapter = null;
    if (selectedChapter === oldNum) selectedChapter = newNum;
  }

  let elapsedStr = $state("");
  let elapsedInterval: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    if (uploadProgress) {
      const start = uploadProgress.startTime;
      const tick = () => {
        const s = Math.floor((Date.now() - start) / 1000);
        const m = Math.floor(s / 60);
        elapsedStr = m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
      };
      tick();
      elapsedInterval = setInterval(tick, 1000);
      return () => { if (elapsedInterval) clearInterval(elapsedInterval); };
    } else {
      elapsedStr = "";
      if (elapsedInterval) { clearInterval(elapsedInterval); elapsedInterval = null; }
    }
  });

  $effect(() => {
    const orig = entry.manga;
    hasChanges =
      title !== orig.title ||
      description !== orig.description ||
      author !== orig.author ||
      artist !== orig.artist ||
      cover !== orig.cover ||
      JSON.stringify(chapters) !== JSON.stringify(orig.chapters);
  });

  async function saveMetadata() {
    saveStatus = "saving";
    const manga: MangaJson = { title, description, author, artist, cover, chapters: cloneChapters(chapters) };
    try {
      await rpc.request.updateManga({ id: entry.id, manga });
      entry.manga = { ...manga, chapters: cloneChapters(manga.chapters) };
      hasChanges = false;
      saveStatus = "saved";
      setTimeout(() => { saveStatus = "idle"; }, 1800);
    } catch (e) {
      console.error("Failed to save:", e);
      saveStatus = "idle";
    }
  }

  async function addChapter() {
    const num = newChapterNum.trim();
    if (!num) return;

    const groupName = newChapterGroup.trim();

    const chapter: Chapter = {
      title: newChapterTitle.trim() || num,
      volume: newChapterVolume.trim(),
      last_updated: String(Math.floor(Date.now() / 1000)),
      groups: {},
    };

    if (groupName) {
      chapter.groups[groupName] = [];
    }

    try {
      await rpc.request.addChapter({ id: entry.id, chapterNum: num, chapter });
      const prior = chapters[num];
      chapters[num] = prior ? mergeChapterIntoExisting(prior, chapter, num) : chapter;
      chapters = { ...chapters };

      if (groupName) {
        const picked = await rpc.request.pickImages();
        if (picked && picked.paths.length > 0) {
          uploadingChapter = num;
          uploadProgress = { group: groupName, count: picked.paths.length, startTime: Date.now() };

          try {
            const result = await rpc.request.uploadImages({
              id: entry.id,
              chapterNum: num,
              group: groupName,
              filePaths: picked.paths,
            });
            chapters[num].groups[groupName] = result.urls;
            chapters = { ...chapters };
            uploadProgress = null;
            uploadStatus = `Uploaded ${result.urls.length} image${result.urls.length > 1 ? "s" : ""} to ${groupName}`;
            setTimeout(() => { uploadStatus = null; uploadingChapter = null; }, 2500);
          } catch (e: any) {
            uploadProgress = null;
            uploadStatus = null;
            uploadingChapter = null;
            uploadError = `Upload failed: ${e.message ?? "Unknown error"}`;
          }
        }
      }

      showAddChapter = false;
      newChapterNum = "";
      newChapterTitle = "";
      newChapterVolume = "";
      newChapterGroup = "";
    } catch (e) {
      console.error("Failed to add chapter:", e);
    }
  }

  async function removeChapter(chapterNum: string) {
    try {
      await rpc.request.removeChapter({ id: entry.id, chapterNum });
      delete chapters[chapterNum];
      chapters = { ...chapters };
      confirmRemoveChapter = null;
      if (selectedChapter === chapterNum) selectedChapter = null;
    } catch (e) {
      console.error("Failed to remove chapter:", e);
    }
  }

  function startChapterUpload(chapterNum: string) {
    const ch = chapters[chapterNum];
    const groupKeys = ch ? Object.keys(ch.groups) : [];
    if (groupKeys.length === 1) {
      handleUpload(chapterNum, groupKeys[0]);
    } else if (groupKeys.length === 0) {
      newGroupUpload = { chapterNum };
      newGroupName = "";
      selectedChapter = chapterNum;
    } else {
      selectedChapter = chapterNum;
    }
  }

  async function handleNewGroupUpload() {
    if (!newGroupUpload || !newGroupName.trim()) return;
    const { chapterNum } = newGroupUpload;
    const groupName = newGroupName.trim();
    newGroupUpload = null;
    newGroupName = "";

    if (chapters[chapterNum] && !chapters[chapterNum].groups[groupName]) {
      chapters[chapterNum].groups[groupName] = [];
      chapters = { ...chapters };
    }

    await handleUpload(chapterNum, groupName);
  }

  async function handleUpload(chapterNum: string, groupName: string) {
    const picked = await rpc.request.pickImages();
    if (!picked || picked.paths.length === 0) return;

    uploadingChapter = chapterNum;
    uploadProgress = { group: groupName, count: picked.paths.length, startTime: Date.now() };
    uploadStatus = null;

    try {
      const result = await rpc.request.uploadImages({
        id: entry.id,
        chapterNum,
        group: groupName,
        filePaths: picked.paths,
      });

      if (chapters[chapterNum]) {
        chapters[chapterNum].groups[groupName] = result.urls;
        chapters = { ...chapters };
      }

      uploadProgress = null;
      uploadStatus = `Uploaded ${result.urls.length} image${result.urls.length > 1 ? "s" : ""} to ${groupName}`;
      setTimeout(() => { uploadStatus = null; uploadingChapter = null; }, 2500);
    } catch (e: any) {
      uploadProgress = null;
      uploadStatus = null;
      uploadingChapter = null;
      uploadError = `Upload failed: ${e.message ?? "Unknown error"}`;
    }
  }

  let groupFilter = $state<string | null>(null);

  let allGroups = $derived.by(() => {
    const set = new Set<string>();
    for (const ch of Object.values(chapters)) {
      for (const g of Object.keys(ch.groups)) set.add(g);
    }
    return [...set].sort();
  });

  let filteredChapterKeys = $derived.by(() => {
    const keys = Object.keys(chapters).sort((a, b) => {
      const na = parseFloat(a);
      const nb = parseFloat(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
    if (!groupFilter) return keys;
    return keys.filter((k) => groupFilter! in (chapters[k]?.groups ?? {}));
  });

  function formatTimestamp(ts: string): string {
    if (!ts) return "";
    const d = new Date(Number(ts) * 1000);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function groupImageCount(ch: Chapter): number {
    let total = 0;
    for (const urls of Object.values(ch.groups)) {
      total += urls.length;
    }
    return total;
  }

  type BakaResult = { id: number; title: string; description: string; author: string; artist: string; cover: string };

  let showFetchModal = $state(false);
  let fetchPhase = $state<"search" | "results" | "preview">("search");
  let fetchQuery = $state("");
  let fetchLoading = $state(false);
  let fetchError = $state<string | null>(null);
  let fetchResults = $state<BakaResult[]>([]);
  let fetchPicked = $state<BakaResult | null>(null);
  let fetchFields = $state<Record<string, boolean>>({ title: true, description: true, author: true, artist: true, cover: true });

  const DESC_FONT = '400 11.2px "DM Sans", Arial, sans-serif';
  const DESC_LINE_HEIGHT = 16;
  const PREVIEW_FONT = '400 12px "DM Sans", Arial, sans-serif';
  const PREVIEW_LINE_HEIGHT = 17;
  const TEXTAREA_FONT = '400 13.6px "DM Sans", Arial, sans-serif';
  const TEXTAREA_LINE_HEIGHT = 20;
  const MONO_FONT = '400 11.2px "IBM Plex Mono", ui-monospace, monospace';
  const MONO_LINE_HEIGHT = 16;
  const FOLDER_PATH_Y_CHROME = 8 + 2 + 2;

  function textHeight(text: string, widthPx: number, font: string, lh: number, minLines = 1): number {
    if (!text) return lh * minLines;
    const p = prepare(text, font);
    const { height } = layout(p, widthPx, lh);
    return Math.max(height, lh * minLines);
  }

  function textLines(text: string, widthPx: number, font: string, lh: number): number {
    if (!text) return 1;
    const p = prepare(text, font);
    const { lineCount } = layout(p, widthPx, lh);
    return Math.max(lineCount, 1);
  }

  $effect(() => {
    if (description) {
      const rows = textLines(description, 460, TEXTAREA_FONT, TEXTAREA_LINE_HEIGHT);
      const el = document.querySelector('.field-textarea') as HTMLTextAreaElement | null;
      if (el) el.rows = Math.max(rows, 3);
    }
  });

  function openFetchModal() {
    showFetchModal = true;
    fetchPhase = "search";
    fetchQuery = title || "";
    fetchLoading = false;
    fetchError = null;
    fetchResults = [];
    fetchPicked = null;
    fetchFields = { title: true, description: true, author: true, artist: true, cover: true };
  }

  async function doFetchSearch() {
    if (!fetchQuery.trim()) return;
    fetchLoading = true;
    fetchError = null;
    try {
      const res = await rpc.request.searchMangaBaka({ query: fetchQuery.trim() });
      fetchResults = res.results;
      if (fetchResults.length === 0) {
        fetchError = "No results found.";
      } else {
        fetchPhase = "results";
      }
    } catch (e: any) {
      fetchError = e.message ?? "Search failed";
    } finally {
      fetchLoading = false;
    }
  }

  function pickFetchResult(r: BakaResult) {
    fetchPicked = r;
    fetchPhase = "preview";
  }

  function applyFetchResult() {
    if (!fetchPicked) return;
    if (fetchFields.title) title = fetchPicked.title;
    if (fetchFields.description) description = fetchPicked.description;
    if (fetchFields.author) author = fetchPicked.author;
    if (fetchFields.artist) artist = fetchPicked.artist;
    if (fetchFields.cover) cover = fetchPicked.cover;
    showFetchModal = false;
  }

  let modalScrollLocked = $derived(showFetchModal || confirmRemoveChapter !== null || showAddChapter);

  $effect(() => {
    if (!modalScrollLocked) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  });

  function isLikelyCoverUrl(s: string): boolean {
    if (!s?.trim()) return false;
    const t = s.trim();
    return t.startsWith("http://") || t.startsWith("https://") || t.startsWith("data:image/");
  }
</script>

<div class="detail-page">
  <div class="detail-topbar">
    <button class="back-btn" type="button" onclick={onBack}>
      <PhArrowLeft />
      Library
    </button>
    <div class="detail-topbar-right">
      <span
        class="folder-path"
        style="min-height:{textHeight(entry.folderPath, 308, MONO_FONT, MONO_LINE_HEIGHT) + FOLDER_PATH_Y_CHROME}px"
      >
        <PhFolderOpen class="folder-icon" />
        {entry.folderPath}
      </span>
      <button
        class="save-btn"
        class:saved={saveStatus === "saved"}
        type="button"
        onclick={saveMetadata}
        disabled={!hasChanges && saveStatus !== "saved"}
      >
        {#if saveStatus === "saved"}
          <PhCheck class="btn-icon" />
          Saved
        {:else}
          <PhFloppyDisk class="btn-icon" />
          Save Changes
        {/if}
      </button>
    </div>
  </div>

  <div class="detail-body">
    <!-- Left sidebar: chapters -->
    <aside class="chapter-sidebar">
      <div class="sidebar-header">
        <h2 class="sidebar-title">Chapters</h2>
        <span class="chapter-count">{filteredChapterKeys.length}{groupFilter ? ` / ${Object.keys(chapters).length}` : ""}</span>
      </div>

      {#if allGroups.length > 1}
        <div class="sidebar-groups">
          <button
            class="group-chip"
            class:active={groupFilter === null}
            type="button"
            onclick={() => (groupFilter = null)}
          >All</button>
          {#each allGroups as g}
            <button
              class="group-chip"
              class:active={groupFilter === g}
              type="button"
              onclick={() => (groupFilter = groupFilter === g ? null : g)}
            >{g}</button>
          {/each}
        </div>
      {/if}

      <div class="sidebar-list">
        {#if filteredChapterKeys.length === 0}
          <div class="sidebar-empty">
            <p>No chapters yet</p>
          </div>
        {:else}
          {#each filteredChapterKeys as chNum}
            {@const ch = chapters[chNum]}
            <button
              class="chapter-pill"
              class:selected={selectedChapter === chNum}
              type="button"
              onclick={() => (selectedChapter = selectedChapter === chNum ? null : chNum)}
            >
              <span class="pill-num">{chNum}</span>
              {#if ch.title && ch.title !== chNum}
                <span class="pill-title">{ch.title}</span>
              {/if}
              {#if ch.volume}
                <span class="pill-vol">v{ch.volume}</span>
              {/if}
              <span class="pill-imgs">{groupImageCount(ch)}</span>
            </button>
          {/each}
        {/if}
      </div>

      <!-- Big plus button -->
      <button class="sidebar-plus" type="button" onclick={() => (showAddChapter = true)}>
        <PhPlus />
      </button>
    </aside>

    <!-- Right panel -->
    <div class="detail-main">
      <!-- Metadata section -->
      <div class="metadata-section">
        <div class="meta-cover">
          {#if cover}
            <img src={cover} alt={title} class="cover-img" />
          {:else}
            <div class="cover-placeholder">
              <PhImage class="cover-placeholder-icon" />
            </div>
          {/if}
        </div>

        <div class="meta-fields">
          <div class="field">
            <label class="field-label">Title</label>
            <input class="field-input" type="text" bind:value={title} placeholder="Manga title" />
          </div>
          <div class="fields-row">
            <div class="field">
              <label class="field-label">Author</label>
              <input class="field-input" type="text" bind:value={author} placeholder="Author name" />
            </div>
            <div class="field">
              <label class="field-label">Artist</label>
              <input class="field-input" type="text" bind:value={artist} placeholder="Artist name" />
            </div>
          </div>
          <div class="field">
            <label class="field-label">Cover URL</label>
            <input class="field-input" type="text" bind:value={cover} placeholder="https://..." />
          </div>
          <div class="field">
            <label class="field-label">Description</label>
            <textarea class="field-textarea" bind:value={description} placeholder="Synopsis..." rows="3"></textarea>
          </div>
          <button class="fetch-meta-btn" type="button" onclick={openFetchModal}>
            <PhCloudArrowDown />
            Fetch from MangaBaka
          </button>
        </div>
      </div>

      <!-- Chapter detail (when selected) -->
      {#if selectedChapter && chapters[selectedChapter]}
        {@const ch = chapters[selectedChapter]}
        <div class="chapter-panel">
          <div class="chapter-panel-header">
            <div class="chapter-panel-title-row">
              <h3 class="chapter-panel-title">Ch. {selectedChapter}</h3>
              {#if ch.title && ch.title !== selectedChapter}
                <span class="chapter-panel-subtitle">{ch.title}</span>
              {/if}
              {#if ch.volume}
                <span class="chapter-panel-vol">Vol. {ch.volume}</span>
              {/if}
              {#if ch.last_updated}
                <span class="chapter-panel-date">{formatTimestamp(ch.last_updated)}</span>
              {/if}
            </div>
            <div class="chapter-panel-actions">
              <button
                class="panel-action-btn"
                type="button"
                title="Edit chapter"
                onclick={() => { startEditChapter(selectedChapter); }}
              >
                <PhPencilSimple />
              </button>
              <button
                class="panel-action-btn"
                type="button"
                title="Upload images"
                onclick={() => startChapterUpload(selectedChapter)}
                disabled={uploadingChapter === selectedChapter}
              >
                <PhUploadSimple />
              </button>
              <button
                class="panel-action-btn panel-action-btn-danger"
                type="button"
                title="Remove chapter"
                onclick={() => (confirmRemoveChapter = selectedChapter)}
              >
                <PhTrash />
              </button>
            </div>
          </div>

          {#if editingChapter === selectedChapter}
            <div class="chapter-edit-form">
              <div class="chapter-edit-row">
                <div class="field field-sm">
                  <label class="field-label">Chapter #</label>
                  <input class="field-input" type="text" bind:value={editChapterNum} />
                </div>
                <div class="field field-sm">
                  <label class="field-label">Title</label>
                  <input class="field-input" type="text" bind:value={editTitle} placeholder="Chapter title" />
                </div>
                <div class="field field-sm">
                  <label class="field-label">Volume</label>
                  <input class="field-input" type="text" bind:value={editVolume} placeholder="e.g. 3" />
                </div>
                <div class="field field-sm">
                  <label class="field-label">Last Updated</label>
                  <input class="field-input field-input-datetime" type="datetime-local" bind:value={editLastUpdated} />
                  <div class="field-hint-row">
                    <span class="field-hint">Local time, easier edit</span>
                    <span class="field-hint field-hint-code">
                      unix: {editLastUpdatedUnixPreview ?? "auto-now"}
                    </span>
                  </div>
                </div>
              </div>
              <div class="chapter-edit-actions">
                <button class="btn-secondary" type="button" onclick={cancelEditChapter}>Cancel</button>
                <button class="btn-primary" type="button" onclick={applyEditChapter}>Apply</button>
              </div>
            </div>
          {/if}

          {#each Object.entries(ch.groups) as [groupName, urls]}
            <div class="group-section">
              <div class="group-header">
                <span class="group-name">{groupName}</span>
                <span class="group-count">{urls.length} pages</span>
                <span class="group-reorder-hint">Drag pages to reorder</span>
                <button
                  class="upload-btn"
                  type="button"
                  onclick={() => handleUpload(selectedChapter, groupName)}
                  disabled={uploadingChapter === selectedChapter}
                >
                  <PhUploadSimple />
                  Upload
                </button>
              </div>
              <div class="page-grid">
                {#each urls as url, i}
                  <div
                    class="page-card"
                    class:dragging={dragState?.chapterNum === selectedChapter && dragState?.groupName === groupName && dragState?.fromIndex === i}
                    class:drag-over={dragOverIndex === i && dragState?.chapterNum === selectedChapter && dragState?.groupName === groupName && dragState?.fromIndex !== i}
                    draggable="true"
                    ondragstart={(e) => { e.dataTransfer!.effectAllowed = "move"; onDragStart(selectedChapter, groupName, i); }}
                    ondragover={(e) => { e.preventDefault(); e.dataTransfer!.dropEffect = "move"; onDragOver(i); }}
                    ondragleave={() => { if (dragOverIndex === i) dragOverIndex = null; }}
                    ondragend={onDragEnd}
                    ondrop={(e) => { e.preventDefault(); onDrop(selectedChapter, groupName, i); }}
                  >
                    <div class="page-grip" title="Drag to reorder">
                      <PhDotsSixVertical />
                    </div>
                    <div class="page-thumb-wrap">
                      <img src={url} alt="Page {i + 1}" class="page-thumb" loading="lazy" decoding="async" />
                      <span class="page-num">{i + 1}</span>
                    </div>
                    <button
                      class="page-open-btn"
                      type="button"
                      title="Open in browser"
                      onclick={() => rpc.request.openExternal({ url })}
                    >
                      <PhArrowSquareOut />
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          {/each}

          <div class="add-group-row">
            {#if newGroupUpload?.chapterNum === selectedChapter}
              <input
                class="new-group-input"
                type="text"
                placeholder="Group name"
                bind:value={newGroupName}
                onkeydown={(e) => e.key === "Enter" && handleNewGroupUpload()}
              />
              <button class="upload-btn" type="button" onclick={handleNewGroupUpload} disabled={!newGroupName.trim()}>
                <PhUploadSimple />
                Upload
              </button>
              <button class="btn-cancel-sm" type="button" onclick={() => (newGroupUpload = null)}>Cancel</button>
            {:else}
              <button class="upload-btn" type="button" onclick={() => { newGroupUpload = { chapterNum: selectedChapter }; newGroupName = ""; }}>
                <PhPlus />
                Upload to new group
              </button>
            {/if}
          </div>
        </div>
      {:else if !selectedChapter}
        <div class="chapter-placeholder">
          <PhCaretRight class="placeholder-icon" />
          <p>Select a chapter from the sidebar</p>
        </div>
      {/if}
    </div>
  </div>

  {#if showAddChapter}
    <div class="modal-overlay" role="dialog" aria-modal="true" onclick={() => (showAddChapter = false)}>
      <div class="modal modal--wide" onclick={(e) => e.stopPropagation()}>
        <h2 class="modal-title">Add Chapter</h2>
        <div class="add-chapter-form">
          <div class="form-row">
            <div class="field field-sm">
              <label class="field-label">Chapter #</label>
              <input class="field-input" type="text" bind:value={newChapterNum} placeholder="e.g. 71" />
            </div>
            <div class="field field-sm">
              <label class="field-label">Title</label>
              <input class="field-input" type="text" bind:value={newChapterTitle} placeholder="Optional" />
            </div>
            <div class="field field-sm">
              <label class="field-label">Volume</label>
              <input class="field-input" type="text" bind:value={newChapterVolume} placeholder="Optional" />
            </div>
            <div class="field field-sm">
              <label class="field-label">Group</label>
              <input class="field-input" type="text" bind:value={newChapterGroup} placeholder="e.g. Scanlation Group" />
            </div>
          </div>
          <div class="form-actions">
            <button class="btn-secondary" type="button" onclick={() => (showAddChapter = false)}>Cancel</button>
            <button class="btn-primary" type="button" onclick={addChapter} disabled={!newChapterNum.trim()}>Add</button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if uploadProgress}
    <div class="upload-progress-bar">
      <div class="upload-progress-inner">
        <div class="upload-progress-shimmer"></div>
      </div>
      <div class="upload-progress-info">
        <span class="upload-progress-label">
          Uploading {uploadProgress.count} image{uploadProgress.count !== 1 ? "s" : ""}
          <span class="upload-progress-group">to {uploadProgress.group}</span>
        </span>
        <span class="upload-progress-elapsed">{elapsedStr}</span>
      </div>
    </div>
  {/if}

  {#if uploadStatus}
    <div class="upload-toast upload-toast-success">{uploadStatus}</div>
  {/if}

  {#if uploadError}
    <div class="upload-error-toast">
      <span class="upload-error-text">{uploadError}</span>
      <button class="upload-error-dismiss" type="button" onclick={() => (uploadError = null)}>&times;</button>
    </div>
  {/if}
</div>

{#if confirmRemoveChapter !== null}
  <div class="modal-overlay" role="dialog" aria-modal="true" onclick={() => (confirmRemoveChapter = null)}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <h2 class="modal-title">Remove Chapter {confirmRemoveChapter}?</h2>
      <p class="modal-message">This will remove the chapter from the metadata JSON file for this series. Image URLs will be lost.</p>
      <div class="modal-actions">
        <button class="modal-btn-cancel" type="button" onclick={() => (confirmRemoveChapter = null)}>Cancel</button>
        <button class="modal-btn-danger" type="button" onclick={() => confirmRemoveChapter !== null && removeChapter(confirmRemoveChapter)}>
          <PhTrash />
          Remove
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showFetchModal}
  <div class="modal-overlay" role="dialog"
    aria-modal="true"
    onclick={() => (showFetchModal = false)}
  >
    <div
      class="fetch-modal"
      class:fetch-modal--preview={fetchPhase === "preview"}
      onclick={(e) => e.stopPropagation()}
    >

      {#if fetchPhase === "search"}
        <h2 class="fetch-modal-title">Fetch Metadata</h2>
        <p class="fetch-modal-sub">Search MangaBaka for series metadata</p>
        <form class="fetch-search-row" onsubmit={(e) => { e.preventDefault(); doFetchSearch(); }}>
          <input
            class="fetch-search-input"
            type="text"
            bind:value={fetchQuery}
            placeholder="Search by title..."
            autofocus
          />
          <button class="btn-primary" type="submit" disabled={fetchLoading || !fetchQuery.trim()}>
            {fetchLoading ? "Searching..." : "Search"}
          </button>
        </form>
        {#if fetchError}
          <p class="fetch-error">{fetchError}</p>
        {/if}

      {:else if fetchPhase === "results"}
        <div class="fetch-results-header">
          <h2 class="fetch-modal-title">Select Series</h2>
          <button class="fetch-back-btn" type="button" onclick={() => (fetchPhase = "search")}>Back</button>
        </div>
        <div class="fetch-results-list">
          {#each fetchResults as r}
            <button class="fetch-result-card" type="button" onclick={() => pickFetchResult(r)}>
              {#if r.cover}
                <img class="fetch-result-cover" src={r.cover} alt={r.title} />
              {:else}
                <div class="fetch-result-cover-empty"></div>
              {/if}
              <div class="fetch-result-info">
                <span class="fetch-result-title">{r.title}</span>
                <span class="fetch-result-author">{[r.author, r.artist].filter(Boolean).join(" / ") || "Unknown"}</span>
                <span
                  class="fetch-result-desc"
                  style="height:{textHeight(r.description || '', 460, DESC_FONT, DESC_LINE_HEIGHT)}px"
                >{r.description || "No description"}</span>
              </div>
            </button>
          {/each}
        </div>

      {:else if fetchPhase === "preview"}
        {#if fetchPicked}
          <div class="fetch-preview-masthead">
            <button class="fetch-back-btn fetch-preview-back" type="button" onclick={() => (fetchPhase = "results")}>
              Back
            </button>
            <p class="fetch-preview-eyebrow">Merge preview</p>
            <h2 class="fetch-preview-headline">{fetchPicked.title}</h2>
            <p class="fetch-preview-lede">
              Turn fields on to replace your library copy with the MangaBaka value. Off keeps what you already have.
            </p>
          </div>

          <div class="fetch-preview-stack">
            {#each [
              { key: "title", label: "Title", current: title, fetched: fetchPicked.title },
              { key: "description", label: "Description", current: description, fetched: fetchPicked.description },
              { key: "author", label: "Author", current: author, fetched: fetchPicked.author },
              { key: "artist", label: "Artist", current: artist, fetched: fetchPicked.artist },
              { key: "cover", label: "Cover", current: cover, fetched: fetchPicked.cover },
            ] as field, i (field.key)}
              <label class="fetch-diff-card" class:fetch-diff-card--skip={!fetchFields[field.key]}>
                <input class="fetch-diff-check" type="checkbox" bind:checked={fetchFields[field.key]} />
                <span class="fetch-diff-toggle" aria-hidden="true"></span>
                <div class="fetch-diff-inner">
                  <div class="fetch-diff-rail">
                    <span class="fetch-diff-index">{String(i + 1).padStart(2, "0")}</span>
                    <span class="fetch-diff-name">{field.label}</span>
                    <span class="fetch-diff-pill" class:on={fetchFields[field.key]} class:off={!fetchFields[field.key]}>
                      {fetchFields[field.key] ? "Replace" : "Keep"}
                    </span>
                  </div>
                  <div
                    class="fetch-diff-columns"
                    class:fetch-diff-columns--cover={field.key === "cover" &&
                      (isLikelyCoverUrl(field.current) || isLikelyCoverUrl(field.fetched))}
                  >
                    <div class="fetch-diff-col fetch-diff-col--from">
                      <span class="fetch-diff-col-title">In your library</span>
                      {#if field.key === "cover" && (isLikelyCoverUrl(field.current) || isLikelyCoverUrl(field.fetched))}
                        <figure class="fetch-cover-frame">
                          {#if isLikelyCoverUrl(field.current)}
                            <img src={field.current} alt="" class="fetch-cover-thumb" />
                          {:else}
                            <div class="fetch-cover-missing">No image URL</div>
                          {/if}
                        </figure>
                      {:else if field.key === "description"}
                        <p
                          class="fetch-diff-body"
                          class:empty={!field.current}
                          style="min-height:{textHeight(field.current || '', 280, PREVIEW_FONT, PREVIEW_LINE_HEIGHT)}px"
                        >{field.current || "Empty — nothing on file."}</p>
                      {:else}
                        <p class="fetch-diff-body" class:empty={!field.current}>{field.current || "Empty — nothing on file."}</p>
                      {/if}
                    </div>
                    <div class="fetch-diff-col fetch-diff-col--to">
                      <span class="fetch-diff-col-title">From MangaBaka</span>
                      {#if field.key === "cover" && (isLikelyCoverUrl(field.current) || isLikelyCoverUrl(field.fetched))}
                        <figure class="fetch-cover-frame fetch-cover-frame--incoming">
                          {#if isLikelyCoverUrl(field.fetched)}
                            <img src={field.fetched} alt="" class="fetch-cover-thumb" />
                          {:else}
                            <div class="fetch-cover-missing">No image URL</div>
                          {/if}
                        </figure>
                      {:else if field.key === "description"}
                        <p
                          class="fetch-diff-body fetch-diff-body--incoming"
                          class:empty={!field.fetched}
                          style="min-height:{textHeight(field.fetched || '', 280, PREVIEW_FONT, PREVIEW_LINE_HEIGHT)}px"
                        >{field.fetched || "Nothing returned for this field."}</p>
                      {:else}
                        <p class="fetch-diff-body fetch-diff-body--incoming" class:empty={!field.fetched}>
                          {field.fetched || "Nothing returned for this field."}
                        </p>
                      {/if}
                    </div>
                  </div>
                </div>
              </label>
            {/each}
          </div>

          <div class="fetch-preview-actions fetch-preview-actions--bar">
            <button class="fetch-preview-cancel" type="button" onclick={() => (showFetchModal = false)}>Cancel</button>
            <button class="fetch-preview-apply" type="button" onclick={applyFetchResult}>Apply toggled fields</button>
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .detail-page {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* ── Topbar ── */
  .detail-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 24px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--bg-surface);
    color: var(--text-secondary);
    font-family: var(--sans);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0px 0px 0px 1px var(--border-default);
    transition: background 0.15s ease, color 0.15s ease;
  }

  .back-btn:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .back-btn :global(svg) { font-size: 1rem; }

  .detail-topbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .folder-path {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-family: var(--mono);
    font-size: 0.7rem;
    line-height: 16px;
    color: var(--text-muted);
    padding: 4px 10px;
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    border: none;
    max-width: 350px;
    word-break: break-all;
    box-shadow: 0px 0px 0px 1px var(--border-default);
  }

  :global(.folder-icon) { font-size: 0.85rem; flex-shrink: 0; }

  .save-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--accent-brand);
    border: none;
    border-radius: var(--radius-sm);
    color: #faf9f5;
    font-family: var(--sans);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0px 0px 0px 1px var(--accent-brand);
    transition: background 0.15s ease;
  }

  .save-btn:hover { background: var(--accent-brand-hover); }

  .save-btn:disabled {
    opacity: 0.45;
    cursor: default;
    pointer-events: none;
  }

  .save-btn.saved {
    background: var(--accent-green);
    box-shadow: 0px 0px 0px 1px var(--accent-green);
  }

  :global(.btn-icon) { font-size: 0.95rem; }

  /* ── Two-column layout ── */
  .detail-body {
    display: flex;
    gap: 20px;
    align-items: flex-start;
  }

  /* ── Chapter sidebar ── */
  .chapter-sidebar {
    width: 220px;
    flex-shrink: 0;
    background: var(--bg-surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 120px);
    position: sticky;
    top: 76px;
    overflow: hidden;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px 10px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .sidebar-title {
    font-size: 0.9rem;
    font-weight: 500;
    font-family: var(--serif);
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .chapter-count {
    font-family: var(--mono);
    font-size: 0.65rem;
    color: var(--accent-brand);
    font-weight: 600;
    padding: 1px 7px;
    background: var(--accent-brand-light);
    border-radius: 999px;
    margin-left: 2px;
  }

  .sidebar-groups {
    display: flex;
    gap: 4px;
    padding: 8px 12px;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--border-subtle);
  }

  .group-chip {
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-base);
    color: var(--text-muted);
    font-family: var(--sans);
    font-size: 0.65rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
  }

  .group-chip:hover {
    border-color: var(--border-default);
    color: var(--text-secondary);
  }

  .group-chip.active {
    background: var(--accent-brand);
    border-color: var(--accent-brand);
    color: #faf9f5;
  }

  .sidebar-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sidebar-empty {
    padding: 24px 12px;
    text-align: center;
  }

  .sidebar-empty p {
    font-size: 0.78rem;
    color: var(--text-muted);
    margin: 0;
  }

  /* Compact rounded chapter pill */
  .chapter-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 7px 10px;
    border: 1px solid transparent;
    border-radius: 999px;
    background: var(--bg-base);
    color: var(--text-primary);
    font-family: var(--sans);
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
  }

  .chapter-pill:hover {
    background: var(--bg-hover);
    border-color: var(--border-subtle);
  }

  .chapter-pill.selected {
    background: var(--accent-brand-light);
    border-color: var(--accent-brand);
    color: var(--accent-brand);
    font-weight: 600;
  }

  .pill-num {
    font-weight: 700;
    font-family: var(--mono);
    font-size: 0.72rem;
    min-width: 0;
    flex-shrink: 0;
  }

  .pill-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 400;
    font-size: 0.72rem;
    color: var(--text-secondary);
    min-width: 0;
  }

  .chapter-pill.selected .pill-title {
    color: var(--accent-brand);
  }

  .pill-vol {
    font-size: 0.6rem;
    color: var(--text-muted);
    font-weight: 400;
    flex-shrink: 0;
  }

  .pill-imgs {
    font-family: var(--mono);
    font-size: 0.58rem;
    color: var(--text-muted);
    padding: 1px 5px;
    background: var(--bg-elevated);
    border-radius: 999px;
    flex-shrink: 0;
    margin-left: auto;
  }

  /* Big plus button */
  .sidebar-plus {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 14px;
    border: none;
    border-top: 1px solid var(--border-subtle);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    background: transparent;
    color: var(--accent-brand);
    cursor: pointer;
    font-size: 1.4rem;
    flex-shrink: 0;
  }

  .sidebar-plus :global(svg) {
    font-size: 1.5rem;
  }

  .sidebar-plus:hover {
    background: var(--accent-brand-light);
    color: var(--accent-brand-hover);
  }

  /* ── Right main panel ── */
  .detail-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Metadata section */
  .metadata-section {
    display: flex;
    gap: 24px;
    background: var(--bg-surface);
    border-radius: var(--radius-lg);
    padding: 24px;
    box-shadow: var(--shadow-sm);
  }

  .meta-cover {
    flex-shrink: 0;
    width: 160px;
  }

  .cover-img {
    width: 100%;
    border-radius: var(--radius-md);
    object-fit: cover;
    aspect-ratio: 2/3;
  }

  .cover-placeholder {
    width: 100%;
    aspect-ratio: 2/3;
    border-radius: var(--radius-md);
    background: var(--bg-elevated);
    border: 1px dashed var(--border-default);
    display: grid;
    place-items: center;
  }

  :global(.cover-placeholder-icon) {
    font-size: 2.5rem;
    color: var(--text-muted);
    opacity: 0.4;
  }

  .meta-fields {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-family: var(--mono);
  }

  .field-input {
    width: 100%;
    padding: 10px 14px;
    border-radius: var(--radius-md);
    background: var(--bg-base);
    border: none;
    color: var(--text-primary);
    font-family: var(--sans);
    font-size: 0.85rem;
    outline: none;
    box-shadow: 0px 0px 0px 1px var(--border-default);
    transition: box-shadow 0.15s ease;
  }

  .field-input::placeholder { color: var(--text-muted); }

  .field-input:focus {
    box-shadow: 0px 0px 0px 1px var(--focus-blue), 0px 0px 0px 4px rgba(56, 152, 236, 0.15);
  }

  .field-textarea {
    width: 100%;
    padding: 10px 14px;
    border-radius: var(--radius-md);
    background: var(--bg-base);
    border: none;
    color: var(--text-primary);
    font-family: var(--sans);
    font-size: 0.85rem;
    outline: none;
    resize: vertical;
    box-shadow: 0px 0px 0px 1px var(--border-default);
    transition: box-shadow 0.15s ease;
  }

  .field-textarea::placeholder { color: var(--text-muted); }

  .field-textarea:focus {
    box-shadow: 0px 0px 0px 1px var(--focus-blue), 0px 0px 0px 4px rgba(56, 152, 236, 0.15);
  }

  .fields-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  /* Chapter placeholder (nothing selected) */
  .chapter-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 60px 24px;
    background: var(--bg-surface);
    border-radius: var(--radius-lg);
    color: var(--text-muted);
    box-shadow: var(--shadow-sm);
  }

  .placeholder-icon {
    font-size: 2rem;
    opacity: 0.3;
  }

  .chapter-placeholder p {
    font-size: 0.85rem;
    margin: 0;
  }

  /* ── Chapter panel (selected chapter detail) ── */
  .chapter-panel {
    background: var(--bg-surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .chapter-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid var(--border-subtle);
    gap: 12px;
  }

  .chapter-panel-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .chapter-panel-title {
    font-size: 1rem;
    font-weight: 500;
    font-family: var(--serif);
    color: var(--text-primary);
    margin: 0;
  }

  .chapter-panel-subtitle {
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-weight: 400;
  }

  .chapter-panel-vol {
    font-family: var(--mono);
    font-size: 0.65rem;
    color: var(--text-muted);
    padding: 2px 8px;
    background: var(--bg-elevated);
    border-radius: 999px;
    font-weight: 500;
  }

  .chapter-panel-date {
    font-family: var(--mono);
    font-size: 0.65rem;
    color: var(--text-muted);
  }

  .chapter-panel-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .panel-action-btn {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .panel-action-btn :global(svg) { font-size: 0.9rem; }

  .panel-action-btn:hover {
    border-color: var(--border-subtle);
    color: var(--accent-brand);
    background: var(--bg-hover);
  }

  .panel-action-btn-danger:hover {
    color: var(--accent-rose);
    background: var(--accent-rose-light);
    border-color: transparent;
  }

  .panel-action-btn:disabled {
    opacity: 0.3;
    pointer-events: none;
  }

  /* Chapter edit form */
  .chapter-edit-form {
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border-subtle);
    padding: 14px 20px;
  }

  .chapter-edit-row {
    display: grid;
    grid-template-columns: minmax(80px, 0.75fr) minmax(140px, 1.2fr) minmax(80px, 0.7fr) minmax(220px, 1.4fr);
    gap: 12px;
    margin-bottom: 12px;
  }

  .field-input-datetime {
    min-width: 0;
  }

  .field-hint-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 6px;
    flex-wrap: wrap;
  }

  .field-hint {
    font-size: 0.66rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .field-hint-code {
    font-family: var(--mono);
    padding: 2px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--bg-base) 72%, transparent);
    border: 1px solid var(--border-subtle);
  }

  .chapter-edit-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  /* Group section */
  .group-section {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .group-section:last-of-type {
    border-bottom: none;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }

  .group-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .group-reorder-hint {
    margin-left: auto;
    padding: 4px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent-brand-light) 70%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-brand) 28%, var(--border-subtle));
    color: var(--accent-brand);
    font-family: var(--mono);
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .group-count {
    font-family: var(--mono);
    font-size: 0.65rem;
    color: var(--text-muted);
  }

  .upload-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    background: var(--bg-surface);
    border: none;
    border-radius: var(--radius-sm);
    color: var(--charcoal-warm);
    font-family: var(--sans);
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    margin-left: auto;
    box-shadow: 0px 0px 0px 1px var(--border-strong);
  }

  .upload-btn:hover {
    box-shadow: 0px 0px 0px 1px var(--accent-brand);
    color: var(--accent-brand);
    background: var(--accent-brand-light);
  }

  .upload-btn:disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .upload-btn :global(svg) { font-size: 0.8rem; }

  /* ── Page thumbnail grid ── */
  .page-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
  }

  .page-card {
    position: relative;
    border-radius: var(--radius-md);
    border: 2px solid var(--border-subtle);
    background: var(--bg-base);
    overflow: hidden;
    cursor: grab;
    transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
  }

  .page-card:hover {
    border-color: var(--border-default);
    transform: translateY(-1px);
  }

  .page-card.dragging {
    opacity: 0.3;
    border-color: var(--accent-brand);
  }

  .page-card.drag-over {
    border-color: var(--accent-brand);
    box-shadow: 0 0 0 2px var(--accent-brand-light);
  }

  .page-card:active {
    cursor: grabbing;
  }

  .page-grip {
    position: absolute;
    top: 4px;
    left: 4px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 24px;
    padding: 0 8px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.58);
    color: #fff;
    z-index: 2;
    cursor: grab;
  }

  .page-grip::after {
    content: "Drag";
    font-family: var(--mono);
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .page-grip :global(svg) { font-size: 0.78rem; }

  .page-open-btn {
    position: absolute;
    bottom: 4px;
    left: 4px;
    min-height: 24px;
    padding: 0 8px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.58);
    border: none;
    color: #fff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    z-index: 2;
  }

  .page-open-btn::after {
    content: "Open";
    font-family: var(--mono);
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .page-open-btn :global(svg) { font-size: 0.72rem; }

  .page-open-btn:hover {
    background: var(--accent-brand);
  }

  .page-thumb-wrap {
    position: relative;
    aspect-ratio: 2/3;
    background: var(--bg-elevated);
  }

  .page-thumb {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .page-num {
    position: absolute;
    bottom: 6px;
    right: 6px;
    font-family: var(--mono);
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #fff;
    background: rgba(7, 10, 18, 0.82);
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
    z-index: 2;
  }

  /* Add group row */
  .add-group-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px 16px;
  }

  .new-group-input {
    padding: 6px 12px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--bg-base);
    color: var(--text-primary);
    font-family: var(--sans);
    font-size: 0.75rem;
    width: 180px;
    outline: none;
    box-shadow: 0px 0px 0px 1px var(--border-default);
    transition: box-shadow 0.15s ease;
  }

  .new-group-input:focus {
    box-shadow: 0px 0px 0px 1px var(--focus-blue), 0px 0px 0px 4px rgba(56, 152, 236, 0.15);
  }

  .new-group-input::placeholder { color: var(--text-muted); }

  .btn-cancel-sm {
    padding: 5px 12px;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--charcoal-warm);
    font-family: var(--sans);
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0px 0px 0px 1px var(--border-strong);
  }

  .btn-cancel-sm:hover { background: var(--border-default); }

  /* Shared buttons */
  .btn-secondary {
    padding: 7px 14px;
    background: var(--bg-surface);
    border: none;
    border-radius: var(--radius-sm);
    color: var(--charcoal-warm);
    font-family: var(--sans);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0px 0px 0px 1px var(--border-strong);
  }

  .btn-secondary:hover { background: var(--border-default); }

  .btn-primary {
    padding: 7px 14px;
    background: var(--accent-brand);
    border: none;
    border-radius: var(--radius-sm);
    color: #faf9f5;
    font-family: var(--sans);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0px 0px 0px 1px var(--accent-brand);
  }

  .btn-primary:hover { background: var(--accent-brand-hover); }

  .btn-primary:disabled {
    opacity: 0.4;
    cursor: default;
    pointer-events: none;
  }

  .field-sm .field-input {
    padding: 8px 10px;
    font-size: 0.8rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 100px 1fr 80px 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }

  .form-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  /* Fetch Metadata Button */
  .fetch-meta-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    padding: 7px 14px;
    background: var(--bg-base);
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-sm);
    color: var(--charcoal-warm);
    font-family: var(--sans);
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
  }

  .fetch-meta-btn:hover {
    border-style: solid;
    border-color: var(--accent-brand);
    color: var(--accent-brand);
    background: var(--accent-brand-light);
  }

  .fetch-meta-btn :global(svg) { font-size: 1rem; }

  /* Upload progress */
  .upload-progress-bar {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 340px;
    background: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 52;
    overflow: hidden;
  }

  .upload-progress-inner {
    height: 3px;
    background: var(--bg-elevated);
    position: relative;
    overflow: hidden;
  }

  .upload-progress-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--accent-brand) 40%,
      var(--accent-brand) 60%,
      transparent 100%
    );
    animation: shimmer 1.4s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  .upload-progress-info {
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .upload-progress-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .upload-progress-group {
    font-weight: 400;
    color: var(--text-muted);
    margin-left: 2px;
  }

  .upload-progress-elapsed {
    font-family: var(--mono);
    font-size: 0.68rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .upload-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 12px 18px;
    background: var(--bg-surface);
    border: 1px solid var(--accent-green);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--accent-green);
    z-index: 50;
  }

  .upload-error-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    left: 24px;
    max-width: 560px;
    margin-left: auto;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    background: var(--bg-surface);
    border: 1px solid var(--accent-rose);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 51;
  }

  .upload-error-text {
    flex: 1;
    font-size: 0.78rem;
    color: var(--accent-rose);
    line-height: 1.5;
    word-break: break-word;
    font-family: var(--mono);
  }

  .upload-error-dismiss {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 1.1rem;
    cursor: pointer;
    display: grid;
    place-items: center;
    line-height: 1;
  }

  .upload-error-dismiss:hover {
    background: var(--accent-rose-light);
    color: var(--accent-rose);
  }

  /* ── Modal ── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(20, 20, 19, 0.45);
    display: grid;
    place-items: center;
    z-index: 50;
    padding: 20px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .modal {
    background: var(--bg-surface);
    border-radius: var(--radius-lg);
    padding: 28px;
    max-width: 420px;
    width: 100%;
    box-shadow: var(--shadow-lg);
    text-align: center;
  }

  .modal--wide {
    max-width: 720px;
    text-align: left;
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 500;
    font-family: var(--serif);
    color: var(--text-primary);
    margin: 0 0 10px;
    line-height: 1.2;
  }

  .modal-message {
    font-size: 0.85rem;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0 0 20px;
  }

  .modal-message code {
    font-family: var(--mono);
    font-size: 0.8rem;
    padding: 1px 5px;
    background: var(--bg-elevated);
    border-radius: 3px;
  }

  .modal-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
  }

  .modal-btn-cancel {
    padding: 9px 20px;
    background: var(--bg-elevated);
    border: none;
    border-radius: var(--radius-sm);
    color: var(--charcoal-warm);
    font-family: var(--sans);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0px 0px 0px 1px var(--border-strong);
  }

  .modal-btn-cancel:hover { background: var(--border-default); }

  .modal-btn-danger {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 9px 20px;
    background: var(--accent-rose);
    border: none;
    border-radius: var(--radius-sm);
    color: #faf9f5;
    font-family: var(--sans);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0px 0px 0px 1px var(--accent-rose);
    transition: background 0.15s ease;
  }

  .modal-btn-danger:hover { background: #9a2b2b; }

  .modal-btn-danger :global(svg) { font-size: 0.95rem; }

  /* Add chapter form (inside modal) */
  .add-chapter-form {
    text-align: left;
  }

  .add-chapter-form .form-row {
    grid-template-columns: minmax(110px, 0.9fr) minmax(180px, 1.4fr) minmax(110px, 0.9fr) minmax(220px, 1.6fr);
    gap: 14px;
  }

  /* ── Fetch Modal ── */
  .fetch-modal {
    background: var(--bg-surface);
    border-radius: var(--radius-lg);
    padding: 28px;
    max-width: 580px;
    width: 100%;
    max-height: min(80vh, 900px);
    overflow-y: auto;
    overscroll-behavior: contain;
    box-shadow: var(--shadow-lg);
  }

  .fetch-modal--preview {
    max-width: min(720px, 100%);
    padding: 16px 0 0;
  }

  .fetch-modal-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .fetch-modal-sub {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 4px 0 16px;
  }

  .fetch-search-row {
    display: flex;
    gap: 8px;
  }

  .fetch-search-input {
    flex: 1;
    padding: 10px 14px;
    border-radius: var(--radius-md);
    background: var(--bg-base);
    border: none;
    color: var(--text-primary);
    font-family: var(--sans);
    font-size: 0.85rem;
    outline: none;
    box-shadow: 0px 0px 0px 1px var(--border-default);
    transition: box-shadow 0.15s ease;
  }

  .fetch-search-input:focus {
    box-shadow: 0px 0px 0px 1px var(--focus-blue), 0px 0px 0px 4px rgba(56, 152, 236, 0.15);
  }

  .fetch-search-input::placeholder { color: var(--text-muted); }

  .fetch-error {
    font-size: 0.8rem;
    color: var(--accent-rose);
    margin: 10px 0 0;
  }

  .fetch-results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .fetch-back-btn {
    padding: 5px 12px;
    background: var(--bg-elevated);
    border: none;
    border-radius: var(--radius-sm);
    color: var(--charcoal-warm);
    font-family: var(--sans);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0px 0px 0px 1px var(--border-strong);
  }

  .fetch-back-btn:hover { background: var(--border-default); }

  .fetch-results-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .fetch-result-card {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 10px 12px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--bg-base);
    cursor: pointer;
    text-align: left;
    font: inherit;
    color: inherit;
    width: 100%;
    box-shadow: 0px 0px 0px 1px var(--border-default);
  }

  .fetch-result-card:hover {
    box-shadow: 0px 0px 0px 1px var(--accent-brand);
    background: var(--accent-brand-light);
  }

  .fetch-result-cover {
    width: 44px;
    height: 62px;
    border-radius: 4px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .fetch-result-cover-empty {
    width: 44px;
    height: 62px;
    border-radius: 4px;
    background: var(--bg-elevated);
    flex-shrink: 0;
  }

  .fetch-result-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .fetch-result-title {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-primary);
    word-break: break-word;
    line-height: 1.3;
  }

  .fetch-result-author {
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .fetch-result-desc {
    font-size: 0.7rem;
    color: var(--text-secondary);
    line-height: 16px;
    display: block;
    overflow: hidden;
    word-break: break-word;
  }

  /* MangaBaka merge preview */
  .fetch-preview-masthead {
    position: relative;
    padding: 12px 28px 22px;
    border-bottom: 1px solid color-mix(in srgb, var(--border-subtle) 80%, var(--accent-brand));
    margin-bottom: 4px;
  }

  .fetch-preview-back {
    position: absolute;
    top: 10px;
    right: 24px;
  }

  .fetch-preview-eyebrow {
    margin: 0 0 6px;
    font-family: var(--mono);
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent-brand);
  }

  .fetch-preview-headline {
    margin: 0 0 10px;
    padding-right: 88px;
    font-family: "Newsreader", Georgia, "Times New Roman", serif;
    font-size: 1.65rem;
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .fetch-preview-lede {
    margin: 0;
    max-width: 42em;
    font-size: 0.82rem;
    line-height: 1.55;
    color: var(--text-secondary);
  }

  .fetch-preview-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 28px 8px;
  }

  .fetch-diff-card {
    position: relative;
    display: block;
    cursor: pointer;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background: var(--bg-base);
    overflow: hidden;
  }

  .fetch-diff-card--skip {
    opacity: 0.88;
    background: color-mix(in srgb, var(--bg-base) 96%, var(--text-muted));
  }

  .fetch-diff-card--skip .fetch-diff-body--incoming {
    color: var(--text-muted);
  }

  .fetch-diff-check {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
    opacity: 0;
  }

  .fetch-diff-card:has(.fetch-diff-check:focus-visible) {
    outline: 2px solid var(--accent-brand);
    outline-offset: 2px;
  }

  .fetch-diff-toggle {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 44px;
    height: 26px;
    border-radius: 999px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    flex-shrink: 0;
    pointer-events: none;
  }

  .fetch-diff-toggle::after {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--text-muted);
  }

  .fetch-diff-card:has(.fetch-diff-check:checked) .fetch-diff-toggle {
    background: color-mix(in srgb, var(--accent-brand) 22%, var(--bg-elevated));
    border-color: var(--accent-brand);
  }

  .fetch-diff-card:has(.fetch-diff-check:checked) .fetch-diff-toggle::after {
    transform: translateX(18px);
    background: var(--accent-brand);
  }

  .fetch-diff-inner {
    padding: 14px 58px 14px 14px;
  }

  .fetch-diff-rail {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px dashed var(--border-subtle);
  }

  .fetch-diff-index {
    font-family: var(--mono);
    font-size: 0.62rem;
    font-weight: 500;
    color: var(--text-muted);
    letter-spacing: 0.06em;
  }

  .fetch-diff-name {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-primary);
  }

  .fetch-diff-pill {
    margin-left: auto;
    padding: 3px 10px;
    border-radius: 999px;
    font-family: var(--mono);
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .fetch-diff-pill.on {
    background: color-mix(in srgb, var(--accent-green) 18%, transparent);
    color: var(--accent-green);
    border: 1px solid color-mix(in srgb, var(--accent-green) 35%, transparent);
  }

  .fetch-diff-pill.off {
    background: var(--bg-elevated);
    color: var(--text-muted);
    border: 1px solid var(--border-subtle);
  }

  .fetch-diff-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    align-items: start;
  }

  @media (max-width: 620px) {
    .fetch-diff-columns {
      grid-template-columns: 1fr;
    }
  }

  .fetch-diff-columns--cover {
    align-items: stretch;
  }

  .fetch-diff-col {
    min-width: 0;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--bg-surface) 85%, var(--bg-base));
    border: 1px solid var(--border-subtle);
  }

  .fetch-diff-col--to {
    border-color: color-mix(in srgb, var(--accent-brand) 22%, var(--border-subtle));
    background: color-mix(in srgb, var(--accent-brand-light) 35%, var(--bg-surface));
  }

  .fetch-diff-card--skip .fetch-diff-col--to {
    border-color: var(--border-subtle);
    background: color-mix(in srgb, var(--bg-surface) 85%, var(--bg-base));
  }

  .fetch-diff-col-title {
    display: block;
    margin-bottom: 8px;
    font-family: var(--mono);
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .fetch-diff-body {
    margin: 0;
    font-size: 0.78rem;
    line-height: 1.5;
    color: var(--text-secondary);
    word-break: break-word;
  }

  .fetch-diff-body.empty {
    color: var(--text-muted);
    font-style: italic;
  }

  .fetch-diff-body--incoming {
    color: var(--text-primary);
    font-weight: 500;
  }

  .fetch-cover-frame {
    margin: 0;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--border-subtle);
    background: var(--bg-elevated);
    aspect-ratio: 2 / 3;
    max-height: 200px;
    width: 100%;
    max-width: 140px;
  }

  .fetch-cover-frame--incoming {
    border-color: color-mix(in srgb, var(--accent-brand) 40%, var(--border-subtle));
  }

  .fetch-cover-thumb {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .fetch-cover-missing {
    display: grid;
    place-items: center;
    height: 100%;
    min-height: 120px;
    font-size: 0.72rem;
    color: var(--text-muted);
    text-align: center;
    padding: 8px;
  }

  .fetch-preview-actions--bar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: flex-end;
    padding: 18px 28px 24px;
    margin-top: 8px;
    border-top: 1px solid var(--border-subtle);
    background: color-mix(in srgb, var(--bg-elevated) 40%, var(--bg-surface));
  }

  .fetch-preview-cancel {
    padding: 10px 18px;
    border-radius: var(--radius-sm);
    border: none;
    background: var(--bg-surface);
    color: var(--charcoal-warm);
    font-family: var(--sans);
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0px 0px 0px 1px var(--border-strong);
  }

  .fetch-preview-cancel:hover {
    background: var(--border-default);
  }

  .fetch-preview-apply {
    padding: 10px 22px;
    border-radius: var(--radius-sm);
    border: none;
    background: var(--accent-brand);
    color: #faf9f5;
    font-family: var(--sans);
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0px 0px 0px 1px var(--accent-brand);
  }

  .fetch-preview-apply:hover {
    background: var(--accent-brand-hover);
  }

  .fetch-preview-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .detail-body {
      flex-direction: column;
    }

    .chapter-sidebar {
      width: 100%;
      max-height: none;
      position: static;
    }

    .sidebar-list {
      flex-direction: row;
      flex-wrap: wrap;
      max-height: 160px;
    }

    .metadata-section {
      flex-direction: column;
    }

    .meta-cover {
      width: 120px;
    }

    .fields-row {
      grid-template-columns: 1fr;
    }

    .form-row {
      grid-template-columns: 1fr 1fr;
    }

    .folder-path {
      display: none;
    }

    .chapter-edit-row {
      grid-template-columns: 1fr;
    }
  }
</style>
