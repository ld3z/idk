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
  import PhCaretDown from "~icons/ph/caret-down";
  import PhCaretRight from "~icons/ph/caret-right";
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

  let title = $state(entry.manga.title);
  let description = $state(entry.manga.description);
  let author = $state(entry.manga.author);
  let artist = $state(entry.manga.artist);
  let cover = $state(entry.manga.cover);
  let chapters = $state<Record<string, Chapter>>({ ...entry.manga.chapters });

  let saveStatus = $state<"idle" | "saving" | "saved">("idle");
  let hasChanges = $state(false);

  let expandedChapter = $state<string | null>(null);
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

  let editingChapter = $state<string | null>(null);
  let editChapterNum = $state("");
  let editTitle = $state("");
  let editVolume = $state("");
  let editLastUpdated = $state("");

  function startEditChapter(chNum: string) {
    const ch = chapters[chNum];
    if (!ch) return;
    editingChapter = chNum;
    editChapterNum = chNum;
    editTitle = ch.title;
    editVolume = ch.volume;
    editLastUpdated = ch.last_updated;
  }

  function cancelEditChapter() {
    editingChapter = null;
  }

  function applyEditChapter() {
    if (!editingChapter || !chapters[editingChapter]) return;
    const oldNum = editingChapter;
    const newNum = editChapterNum.trim() || oldNum;
    const ch = chapters[oldNum];
    ch.title = editTitle;
    ch.volume = editVolume;
    ch.last_updated = editLastUpdated || String(Math.floor(Date.now() / 1000));

    if (newNum !== oldNum) {
      delete chapters[oldNum];
      chapters[newNum] = ch;
    }

    chapters = { ...chapters };
    editingChapter = null;
    if (expandedChapter === oldNum) expandedChapter = newNum;
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
    const manga: MangaJson = { title, description, author, artist, cover, chapters };
    try {
      await rpc.request.updateManga({ id: entry.id, manga });
      entry.manga = manga;
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
      if (expandedChapter === chapterNum) expandedChapter = null;
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
      expandedChapter = chapterNum;
    } else {
      expandedChapter = chapterNum;
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

  const DESC_FONT = '400 11.2px "DM Sans", ui-sans-serif, system-ui, sans-serif';
  const DESC_LINE_HEIGHT = 16;
  const PREVIEW_FONT = '400 12px "DM Sans", ui-sans-serif, system-ui, sans-serif';
  const PREVIEW_LINE_HEIGHT = 17;
  const TEXTAREA_FONT = '400 13.6px "DM Sans", ui-sans-serif, system-ui, sans-serif';
  const TEXTAREA_LINE_HEIGHT = 20;
  const MONO_FONT = '400 11.2px "IBM Plex Mono", ui-monospace, monospace';
  const MONO_LINE_HEIGHT = 16;
  const CHAPTER_TITLE_FONT = '400 12.8px "DM Sans", ui-sans-serif, system-ui, sans-serif';
  const CHAPTER_TITLE_LINE_HEIGHT = 18;
  /** Padding (4+4) + border (1+1) on `.folder-path`; pretext height is text-only */
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

  <div class="detail-content">
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

    <div class="chapters-section">
      <div class="chapters-header">
        <h2 class="section-title">Chapters</h2>
        <span class="chapter-count">{filteredChapterKeys.length}{groupFilter ? ` / ${Object.keys(chapters).length}` : ""}</span>
        <div class="chapters-header-actions">
          <button class="add-chapter-btn" type="button" onclick={() => (showAddChapter = true)}>
            <PhPlus />
            Add Chapter
          </button>
        </div>
      </div>

      {#if allGroups.length > 1}
        <div class="group-filter-bar">
          <button
            class="group-filter-chip"
            class:active={groupFilter === null}
            type="button"
            onclick={() => (groupFilter = null)}
          >All</button>
          {#each allGroups as g}
            <button
              class="group-filter-chip"
              class:active={groupFilter === g}
              type="button"
              onclick={() => (groupFilter = groupFilter === g ? null : g)}
            >{g}</button>
          {/each}
        </div>
      {/if}

      {#if showAddChapter}
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
      {/if}

      {#if Object.keys(chapters).length === 0}
        <div class="empty-chapters">
          <p class="empty-text">No chapters yet. Add one to get started.</p>
        </div>
      {:else}
        <div class="chapters-list">
          {#each filteredChapterKeys as chNum}
            {@const ch = chapters[chNum]}
            <div class="chapter-item">
              <button
                class="chapter-row"
                type="button"
                onclick={() => (expandedChapter = expandedChapter === chNum ? null : chNum)}
              >
                <span class="chapter-caret">
                  {#if expandedChapter === chNum}
                    <PhCaretDown />
                  {:else}
                    <PhCaretRight />
                  {/if}
                </span>
                <span class="chapter-num">Ch. {chNum}{#if ch.volume} <span class="chapter-vol-inline">v{ch.volume}</span>{/if}</span>
                {#if ch.title && ch.title !== chNum}
                  <span
                    class="chapter-title"
                    style="height:{textHeight(ch.title, 350, CHAPTER_TITLE_FONT, CHAPTER_TITLE_LINE_HEIGHT)}px"
                  >{ch.title}</span>
                {/if}
                <span class="chapter-info">
                  {#each Object.keys(ch.groups) as g}
                    <span class="chapter-group-tag">{g}</span>
                  {/each}
                  <span class="chapter-img-count">{groupImageCount(ch)} img{groupImageCount(ch) !== 1 ? "s" : ""}</span>
                  {#if ch.last_updated}
                    <span class="chapter-date">{formatTimestamp(ch.last_updated)}</span>
                  {/if}
                </span>
              </button>
              <button
                class="chapter-edit-btn"
                type="button"
                title="Edit chapter"
                onclick={(e) => { e.stopPropagation(); startEditChapter(chNum); expandedChapter = chNum; }}
              >
                <PhPencilSimple />
              </button>
              <button
                class="chapter-upload-btn"
                type="button"
                title="Upload images"
                onclick={(e) => { e.stopPropagation(); startChapterUpload(chNum); }}
                disabled={uploadingChapter === chNum}
              >
                <PhUploadSimple />
              </button>
              <button
                class="chapter-remove-btn"
                type="button"
                title="Remove chapter"
                onclick={() => (confirmRemoveChapter = chNum)}
              >
                <PhTrash />
              </button>

              {#if expandedChapter === chNum}
                <div class="chapter-detail">
                  {#if editingChapter === chNum}
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
                          <input class="field-input" type="text" bind:value={editLastUpdated} placeholder="Unix timestamp" />
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
                        <span class="group-count">{urls.length} images</span>
                        <button
                          class="upload-btn"
                          type="button"
                          onclick={() => handleUpload(chNum, groupName)}
                          disabled={uploadingChapter === chNum}
                        >
                          <PhUploadSimple />
                          Upload
                        </button>
                      </div>
                      <div class="url-list">
                        {#each urls as url, i}
                          <div class="url-item">
                            <span class="url-index">{i + 1}</span>
                            <div class="url-cell">
                              <a
                                class="url-link"
                                href={url}
                                rel="noopener noreferrer"
                                onclick={(e) => {
                                  e.preventDefault();
                                  void rpc.request.openExternal({ url });
                                }}
                              >{url}</a>
                              <figure class="url-thumb" aria-hidden="true">
                                <img
                                  src={url}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                />
                                <figcaption class="url-thumb-cap">Page {i + 1}</figcaption>
                              </figure>
                            </div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/each}
                  <div class="add-group-row">
                    {#if newGroupUpload?.chapterNum === chNum}
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
                      <button class="upload-btn" type="button" onclick={() => { newGroupUpload = { chapterNum: chNum }; newGroupName = ""; }}>
                        <PhPlus />
                        Upload to new group
                      </button>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          {/each}
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
  </div>
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
  <div class="modal-overlay" role="dialog" aria-modal="true" onclick={() => (showFetchModal = false)}>
    <div class="fetch-modal" onclick={(e) => e.stopPropagation()}>

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
        <div class="fetch-results-header">
          <h2 class="fetch-modal-title">Preview Changes</h2>
          <button class="fetch-back-btn" type="button" onclick={() => (fetchPhase = "results")}>Back</button>
        </div>
        {#if fetchPicked}
          <div class="fetch-preview-list">
            {#each [
              { key: "title", label: "Title", current: title, fetched: fetchPicked.title },
              { key: "description", label: "Description", current: description, fetched: fetchPicked.description },
              { key: "author", label: "Author", current: author, fetched: fetchPicked.author },
              { key: "artist", label: "Artist", current: artist, fetched: fetchPicked.artist },
              { key: "cover", label: "Cover", current: cover, fetched: fetchPicked.cover },
            ] as field}
              <label class="fetch-preview-row">
                <input type="checkbox" bind:checked={fetchFields[field.key]} />
                <div class="fetch-preview-field">
                  <span class="fetch-preview-label">{field.label}</span>
                  {#if field.key === "description"}
                    <span
                      class="fetch-preview-current fetch-preview-wrap"
                      class:empty={!field.current}
                      style="height:{textHeight(field.current || '', 440, PREVIEW_FONT, PREVIEW_LINE_HEIGHT)}px"
                    >{field.current || "(empty)"}</span>
                    <span class="fetch-preview-arrow">&#8594;</span>
                    <span
                      class="fetch-preview-new fetch-preview-wrap"
                      class:empty={!field.fetched}
                      style="height:{textHeight(field.fetched || '', 440, PREVIEW_FONT, PREVIEW_LINE_HEIGHT)}px"
                    >{field.fetched || "(empty)"}</span>
                  {:else}
                    <span class="fetch-preview-current" class:empty={!field.current}>{field.current || "(empty)"}</span>
                    <span class="fetch-preview-arrow">&#8594;</span>
                    <span class="fetch-preview-new" class:empty={!field.fetched}>{field.fetched || "(empty)"}</span>
                  {/if}
                </div>
              </label>
            {/each}
          </div>
          <div class="fetch-preview-actions">
            <button class="btn-secondary" type="button" onclick={() => (showFetchModal = false)}>Cancel</button>
            <button class="btn-primary" type="button" onclick={applyFetchResult}>Apply Selected</button>
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
    gap: 24px;
  }

  .detail-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--bg-surface);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .back-btn:hover {
    border-color: var(--border-default);
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
    border: 1px solid var(--border-subtle);
    max-width: 350px;
    word-break: break-all;
  }

  :global(.folder-icon) { font-size: 0.85rem; flex-shrink: 0; }

  .save-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--accent-blue);
    border: none;
    border-radius: var(--radius-sm);
    color: #fff;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.25);
  }

  .save-btn:hover { background: var(--accent-blue-hover); }

  .save-btn:disabled {
    opacity: 0.45;
    cursor: default;
    pointer-events: none;
  }

  .save-btn.saved {
    background: var(--accent-green);
    box-shadow: 0 1px 3px rgba(5, 150, 105, 0.25);
  }

  :global(.btn-icon) { font-size: 0.95rem; }

  /* Metadata */
  .detail-content {
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .metadata-section {
    display: flex;
    gap: 24px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: 24px;
    box-shadow: var(--shadow-sm);
  }

  .meta-cover {
    flex-shrink: 0;
    width: 180px;
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
    border-radius: var(--radius-sm);
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.85rem;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .field-input::placeholder { color: var(--text-muted); }

  .field-input:focus {
    border-color: var(--accent-blue);
    box-shadow: 0 0 0 3px var(--accent-blue-light);
  }

  .field-textarea {
    width: 100%;
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.85rem;
    outline: none;
    resize: vertical;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .field-textarea::placeholder { color: var(--text-muted); }

  .field-textarea:focus {
    border-color: var(--accent-blue);
    box-shadow: 0 0 0 3px var(--accent-blue-light);
  }

  .fields-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  /* Chapters */
  .chapters-section {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .chapters-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 18px 22px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .section-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .chapter-count {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--accent-blue);
    font-weight: 600;
    padding: 2px 8px;
    background: var(--accent-blue-light);
    border-radius: 999px;
  }

  .chapters-header-actions {
    margin-left: auto;
  }

  .group-filter-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 14px 22px;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--border-subtle);
  }

  .group-filter-chip {
    padding: 5px 14px;
    border-radius: 999px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-base);
    color: var(--text-muted);
    font-family: inherit;
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .group-filter-chip:hover {
    border-color: var(--border-default);
    color: var(--text-secondary);
  }

  .group-filter-chip.active {
    background: var(--accent-blue);
    border-color: var(--accent-blue);
    color: #fff;
  }

  .add-chapter-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    background: var(--accent-blue);
    border: none;
    border-radius: var(--radius-sm);
    color: #fff;
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .add-chapter-btn:hover { background: var(--accent-blue-hover); }

  .add-chapter-btn :global(svg) { font-size: 0.85rem; }

  .add-chapter-form {
    padding: 16px 22px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--bg-elevated);
  }

  .form-row {
    display: grid;
    grid-template-columns: 100px 1fr 80px 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }

  .field-sm .field-input {
    padding: 8px 10px;
    font-size: 0.8rem;
  }

  .form-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .btn-secondary {
    padding: 7px 14px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-secondary:hover { border-color: var(--border-default); color: var(--text-primary); }

  .btn-primary {
    padding: 7px 14px;
    background: var(--accent-blue);
    border: none;
    border-radius: var(--radius-sm);
    color: #fff;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-primary:hover { background: var(--accent-blue-hover); }

  .btn-primary:disabled {
    opacity: 0.4;
    cursor: default;
    pointer-events: none;
  }

  .empty-chapters {
    padding: 40px 22px;
    text-align: center;
  }

  .empty-text {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin: 0;
  }

  .chapters-list {
    display: flex;
    flex-direction: column;
  }

  .chapter-item {
    position: relative;
    border-bottom: 1px solid var(--border-subtle);
  }

  .chapter-item:last-child { border-bottom: none; }

  .chapter-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 14px 118px 14px 22px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    font: inherit;
    color: inherit;
    transition: background 0.1s ease;
  }

  .chapter-row:hover { background: var(--bg-hover); }

  .chapter-caret { color: var(--text-muted); display: grid; place-items: center; flex-shrink: 0; }
  .chapter-caret :global(svg) { font-size: 0.85rem; }

  .chapter-num {
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--text-primary);
    min-width: 60px;
    flex-shrink: 0;
  }

  .chapter-vol-inline {
    font-weight: 400;
    color: var(--text-muted);
    margin-left: 2px;
  }

  .chapter-title {
    font-size: 0.8rem;
    color: var(--text-secondary);
    flex: 1;
    overflow: hidden;
    word-break: break-word;
    line-height: 18px;
    min-width: 0;
  }

  .chapter-info {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: auto;
    flex-shrink: 0;
  }

  .chapter-group-tag {
    font-size: 0.65rem;
    padding: 3px 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    color: var(--text-muted);
    font-weight: 500;
    white-space: nowrap;
  }

  .chapter-img-count {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .chapter-date {
    font-family: var(--mono);
    font-size: 0.65rem;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .chapter-edit-btn {
    position: absolute;
    right: 86px;
    top: 11px;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: grid;
    place-items: center;
    opacity: 0;
    transition: opacity 0.15s ease, color 0.15s ease;
    z-index: 2;
  }

  .chapter-item:hover .chapter-edit-btn { opacity: 1; }

  .chapter-edit-btn:hover { color: var(--accent-blue); }

  .chapter-edit-btn :global(svg) { font-size: 0.9rem; }

  .chapter-upload-btn {
    position: absolute;
    right: 52px;
    top: 11px;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: grid;
    place-items: center;
    opacity: 0;
    transition: opacity 0.15s ease, color 0.15s ease;
    z-index: 2;
  }

  .chapter-item:hover .chapter-upload-btn { opacity: 1; }

  .chapter-upload-btn:hover { color: var(--accent-blue); }

  .chapter-upload-btn:disabled { opacity: 0.3; pointer-events: none; }

  .chapter-upload-btn :global(svg) { font-size: 0.9rem; }

  .chapter-remove-btn {
    position: absolute;
    right: 18px;
    top: 11px;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: grid;
    place-items: center;
    opacity: 0;
    transition: opacity 0.15s ease, color 0.15s ease;
    z-index: 2;
  }

  .chapter-item:hover .chapter-remove-btn { opacity: 1; }

  .chapter-remove-btn:hover { color: var(--accent-rose); }

  .chapter-remove-btn :global(svg) { font-size: 0.9rem; }

  .chapter-detail {
    padding: 4px 22px 20px 46px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .chapter-edit-form {
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 14px 16px;
  }

  .chapter-edit-row {
    display: grid;
    grid-template-columns: 80px 1fr 80px 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }

  .chapter-edit-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .group-section {
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 14px 16px;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .group-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .group-count {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .upload-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    margin-left: auto;
    transition: all 0.15s ease;
  }

  .upload-btn:hover {
    border-color: var(--accent-blue);
    color: var(--accent-blue);
    background: var(--accent-blue-light);
  }

  .upload-btn:disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .upload-btn :global(svg) { font-size: 0.8rem; }

  .add-group-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-top: 4px;
  }

  .new-group-input {
    padding: 6px 12px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--bg-base);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.75rem;
    width: 180px;
    outline: none;
  }

  .new-group-input:focus {
    border-color: var(--accent-blue);
    box-shadow: 0 0 0 2px var(--accent-blue-light);
  }

  .new-group-input::placeholder { color: var(--text-muted); }

  .btn-cancel-sm {
    padding: 5px 12px;
    background: none;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-family: inherit;
    font-size: 0.72rem;
    cursor: pointer;
  }

  .btn-cancel-sm:hover { color: var(--text-secondary); border-color: var(--border-default); }

  .url-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .url-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 6px 0;
  }

  .url-cell {
    flex: 1;
    min-width: 0;
  }

  .url-index {
    font-family: var(--mono);
    font-size: 0.65rem;
    color: var(--text-muted);
    min-width: 22px;
    text-align: right;
    flex-shrink: 0;
    padding-top: 2px;
  }

  .url-link {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--accent-blue);
    text-decoration: none;
    word-break: break-all;
  }

  .url-link:hover { text-decoration: underline; }

  .url-thumb {
    display: none;
    margin: 10px 0 0;
    padding: 0;
    max-width: min(100%, 300px);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--bg-surface);
    box-shadow: var(--shadow-md);
    overflow: hidden;
  }

  .url-thumb img {
    display: block;
    width: 100%;
    height: auto;
    max-height: 240px;
    object-fit: contain;
    object-position: top center;
    background: var(--bg-elevated);
  }

  .url-thumb-cap {
    margin: 0;
    padding: 6px 10px 8px;
    font-family: var(--mono);
    font-size: 0.62rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-base);
  }

  .url-item:hover .url-thumb,
  .url-item:focus-within .url-thumb {
    display: block;
  }

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
      var(--accent-blue) 40%,
      var(--accent-blue) 60%,
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

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.5);
    display: grid;
    place-items: center;
    z-index: 50;
    padding: 20px;
  }

  .modal {
    background: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: 28px;
    max-width: 420px;
    width: 100%;
    box-shadow: var(--shadow-lg);
    text-align: center;
  }

  .modal-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 10px;
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
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
  }

  .modal-btn-cancel:hover { border-color: var(--border-default); color: var(--text-primary); }

  .modal-btn-danger {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 9px 20px;
    background: var(--accent-rose);
    border: none;
    border-radius: var(--radius-sm);
    color: #fff;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }

  .modal-btn-danger:hover { background: #be123c; }

  .modal-btn-danger :global(svg) { font-size: 0.95rem; }

  /* Fetch Metadata Button */
  .fetch-meta-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    padding: 7px 14px;
    background: var(--bg-base);
    border: 1px dashed var(--border-default);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .fetch-meta-btn:hover {
    border-style: solid;
    border-color: var(--accent-blue);
    color: var(--accent-blue);
    background: var(--accent-blue-light);
  }

  .fetch-meta-btn :global(svg) { font-size: 1rem; }

  /* Fetch Modal */
  .fetch-modal {
    background: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: 28px;
    max-width: 580px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: var(--shadow-lg);
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
    border-radius: var(--radius-sm);
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.85rem;
    outline: none;
  }

  .fetch-search-input:focus {
    border-color: var(--accent-blue);
    box-shadow: 0 0 0 3px var(--accent-blue-light);
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
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
  }

  .fetch-back-btn:hover { border-color: var(--border-default); color: var(--text-primary); }

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
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background: var(--bg-base);
    cursor: pointer;
    text-align: left;
    font: inherit;
    color: inherit;
    transition: all 0.12s ease;
    width: 100%;
  }

  .fetch-result-card:hover {
    border-color: var(--accent-blue);
    background: var(--accent-blue-light);
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

  /* Preview */
  .fetch-preview-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 18px;
  }

  .fetch-preview-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
    padding: 10px 12px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background: var(--bg-base);
    transition: border-color 0.12s ease;
  }

  .fetch-preview-row:hover { border-color: var(--border-default); }

  .fetch-preview-row input[type="checkbox"] {
    margin-top: 2px;
    flex-shrink: 0;
    accent-color: var(--accent-blue);
  }

  .fetch-preview-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    flex: 1;
  }

  .fetch-preview-label {
    font-family: var(--mono);
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .fetch-preview-current {
    font-size: 0.75rem;
    color: var(--text-secondary);
    word-break: break-word;
    line-height: 17px;
  }

  .fetch-preview-current.empty { color: var(--text-muted); font-style: italic; }

  .fetch-preview-arrow {
    font-size: 0.7rem;
    color: var(--accent-blue);
    font-weight: 600;
  }

  .fetch-preview-new {
    font-size: 0.75rem;
    color: var(--accent-green);
    font-weight: 500;
    word-break: break-word;
    line-height: 17px;
  }

  .fetch-preview-new.empty { color: var(--text-muted); font-style: italic; }

  .fetch-preview-wrap {
    overflow: hidden;
  }

  .fetch-preview-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  @media (max-width: 768px) {
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
  }
</style>
