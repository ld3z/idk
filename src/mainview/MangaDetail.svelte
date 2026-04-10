<script lang="ts">
  import { onMount } from "svelte";
  import type { MangaEntry, MangaJson, Chapter } from "../shared/types.ts";
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

  let confirmRemoveChapter = $state<string | null>(null);

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
      chapters[num] = chapter;
      chapters = { ...chapters };

      if (groupName) {
        const picked = await rpc.request.pickImages();
        if (picked && picked.paths.length > 0) {
          uploadingChapter = num;
          uploadStatus = `Uploading ${picked.paths.length} image${picked.paths.length > 1 ? "s" : ""}...`;

          try {
            const result = await rpc.request.uploadImages({
              id: entry.id,
              chapterNum: num,
              group: groupName,
              filePaths: picked.paths,
            });
            chapters[num].groups[groupName] = result.urls;
            chapters = { ...chapters };
            uploadStatus = `Uploaded ${result.urls.length} image${result.urls.length > 1 ? "s" : ""}!`;
            setTimeout(() => { uploadStatus = null; uploadingChapter = null; }, 2000);
          } catch (e: any) {
            uploadStatus = `Upload failed: ${e.message ?? "Unknown error"}`;
            setTimeout(() => { uploadStatus = null; uploadingChapter = null; }, 3000);
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

  async function handleUpload(chapterNum: string, groupName: string) {
    const picked = await rpc.request.pickImages();
    if (!picked || picked.paths.length === 0) return;

    uploadingChapter = chapterNum;
    uploadStatus = `Uploading ${picked.paths.length} image${picked.paths.length > 1 ? "s" : ""}...`;

    try {
      const result = await rpc.request.uploadImages({
        id: entry.id,
        chapterNum,
        group: groupName,
        filePaths: picked.paths,
      });

      if (chapters[chapterNum]) {
        if (!chapters[chapterNum].groups[groupName]) {
          chapters[chapterNum].groups[groupName] = [];
        }
        chapters[chapterNum].groups[groupName].push(...result.urls);
        chapters = { ...chapters };
      }

      uploadStatus = `Uploaded ${result.urls.length} image${result.urls.length > 1 ? "s" : ""}!`;
      setTimeout(() => { uploadStatus = null; uploadingChapter = null; }, 2000);
    } catch (e: any) {
      uploadStatus = `Upload failed: ${e.message ?? "Unknown error"}`;
      setTimeout(() => { uploadStatus = null; uploadingChapter = null; }, 3000);
    }
  }

  function sortedChapterKeys(chs: Record<string, Chapter>): string[] {
    return Object.keys(chs).sort((a, b) => {
      const na = parseFloat(a);
      const nb = parseFloat(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }

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
</script>

<div class="detail-page">
  <div class="detail-topbar">
    <button class="back-btn" type="button" onclick={onBack}>
      <PhArrowLeft />
      Library
    </button>
    <div class="detail-topbar-right">
      <span class="folder-path">
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
      </div>
    </div>

    <div class="chapters-section">
      <div class="chapters-header">
        <h2 class="section-title">Chapters</h2>
        <span class="chapter-count">{Object.keys(chapters).length}</span>
        <div class="chapters-header-actions">
          <button class="add-chapter-btn" type="button" onclick={() => (showAddChapter = true)}>
            <PhPlus />
            Add Chapter
          </button>
        </div>
      </div>

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
          {#each sortedChapterKeys(chapters) as chNum}
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
                <span class="chapter-num">Ch. {chNum}</span>
                {#if ch.title && ch.title !== chNum}
                  <span class="chapter-title">{ch.title}</span>
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
                class="chapter-remove-btn"
                type="button"
                title="Remove chapter"
                onclick={() => (confirmRemoveChapter = chNum)}
              >
                <PhTrash />
              </button>

              {#if expandedChapter === chNum}
                <div class="chapter-detail">
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
                            <a class="url-link" href={url} target="_blank" rel="noopener">{url}</a>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/each}
                  {#if Object.keys(ch.groups).length === 0}
                    <p class="empty-text" style="padding: 12px 0">No groups yet. Add images to create one.</p>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if uploadStatus}
        <div class="upload-toast">{uploadStatus}</div>
      {/if}
    </div>
  </div>
</div>

{#if confirmRemoveChapter !== null}
  <div class="modal-overlay" role="dialog" aria-modal="true" onclick={() => (confirmRemoveChapter = null)}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <h2 class="modal-title">Remove Chapter {confirmRemoveChapter}?</h2>
      <p class="modal-message">This will remove the chapter from <code>manga.json</code>. Image URLs will be lost.</p>
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
    align-items: center;
    gap: 6px;
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--text-muted);
    padding: 4px 10px;
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    max-width: 350px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    gap: 8px;
    width: 100%;
    padding: 12px 22px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    font: inherit;
    color: inherit;
    transition: background 0.1s ease;
  }

  .chapter-row:hover { background: var(--bg-hover); }

  .chapter-caret { color: var(--text-muted); display: grid; place-items: center; }
  .chapter-caret :global(svg) { font-size: 0.85rem; }

  .chapter-num {
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--text-primary);
    min-width: 60px;
  }

  .chapter-title {
    font-size: 0.8rem;
    color: var(--text-secondary);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chapter-info {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    flex-shrink: 0;
  }

  .chapter-group-tag {
    font-size: 0.65rem;
    padding: 2px 8px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .chapter-img-count {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .chapter-date {
    font-family: var(--mono);
    font-size: 0.65rem;
    color: var(--text-muted);
  }

  .chapter-remove-btn {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    width: 26px;
    height: 26px;
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

  .chapter-remove-btn :global(svg) { font-size: 0.8rem; }

  .chapter-detail {
    padding: 0 22px 16px 42px;
  }

  .group-section {
    margin-bottom: 12px;
  }

  .group-section:last-child { margin-bottom: 0; }

  .group-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
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
    gap: 4px;
    padding: 4px 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 0.7rem;
    font-weight: 500;
    cursor: pointer;
    margin-left: auto;
    transition: all 0.15s ease;
  }

  .upload-btn:hover {
    border-color: var(--accent-blue);
    color: var(--accent-blue);
  }

  .upload-btn:disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .upload-btn :global(svg) { font-size: 0.8rem; }

  .url-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .url-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }

  .url-index {
    font-family: var(--mono);
    font-size: 0.65rem;
    color: var(--text-muted);
    min-width: 20px;
    text-align: right;
  }

  .url-link {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--accent-blue);
    text-decoration: none;
    word-break: break-all;
  }

  .url-link:hover { text-decoration: underline; }

  .upload-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 10px 18px;
    background: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    font-size: 0.8rem;
    color: var(--text-primary);
    z-index: 50;
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
