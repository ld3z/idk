<script lang="ts">
  import { APP_VERSION } from "../shared/version.ts";
  import PhExport from "~icons/ph/export";
  import PhDownloadSimple from "~icons/ph/download-simple";
  import PhWarningCircleFill from "~icons/ph/warning-circle-fill";
  import PhDatabaseFill from "~icons/ph/database-fill";
  import PhCloudArrowUpFill from "~icons/ph/cloud-arrow-up-fill";
  import PhGithubLogoFill from "~icons/ph/github-logo-fill";
  import PhWarningFill from "~icons/ph/warning-fill";
  import PhTrash from "~icons/ph/trash";
  import PhCheck from "~icons/ph/check";
  import PhFloppyDisk from "~icons/ph/floppy-disk";
  import PhEye from "~icons/ph/eye";
  import PhEyeSlash from "~icons/ph/eye-slash";

  type AppSettings = {
    imgchestApiKey: string;
    githubToken: string;
    githubOwner: string;
    githubRepo: string;
    githubBranch: string;
  };

  type SettingsRpcSchema = {
    bun: {
      requests: {
        getSettings: { params: void; response: { settings: AppSettings; dbPath: string } };
        saveSettings: { params: AppSettings; response: { ok: true } };
      };
      messages: Record<never, never>;
    };
    webview: {
      requests: Record<never, never>;
      messages: Record<never, never>;
    };
  };

  interface Props {
    rpc: any;
    mounted: boolean;
  }

  let { rpc, mounted }: Props = $props();

  let settingsDbPath = $state("");
  let saveStatus = $state<"idle" | "saved">("idle");
  let hasUnsavedChanges = $state(false);
  let originalSettings = $state<AppSettings | null>(null);
  let toast = $state<{ kind: "success" | "error" | "info"; message: string } | null>(null);
  let showResetModal = $state(false);

  $effect(() => {
    if (showResetModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  });

  let showImgchestKey = $state(false);
  let showGithubToken = $state(false);

  let fileInput = $state<HTMLInputElement | null>(null);
  let importError = $state<string | null>(null);

  $effect(() => {
    if (rpc) {
      (async () => {
        const stored = await rpc.request.getSettings();
        if (stored) {
          settings = { ...settings, ...stored.settings };
          originalSettings = { ...stored.settings };
          settingsDbPath = stored.dbPath;
        }
      })();
    }
  });

  let settings = $state({
    imgchestApiKey: "",
    githubToken: "",
    githubOwner: "",
    githubRepo: "",
    githubBranch: "main",
  } satisfies AppSettings);

  $effect(() => {
    if (originalSettings) {
      const hasChanges =
        settings.imgchestApiKey !== originalSettings.imgchestApiKey ||
        settings.githubToken !== originalSettings.githubToken ||
        settings.githubOwner !== originalSettings.githubOwner ||
        settings.githubRepo !== originalSettings.githubRepo ||
        settings.githubBranch !== originalSettings.githubBranch;
      hasUnsavedChanges = hasChanges;
    }
  });

  async function saveSettings() {
    await rpc.request.saveSettings(settings);
    originalSettings = { ...settings };
    hasUnsavedChanges = false;
    saveStatus = "saved";
    toast = { kind: "success", message: "Settings saved." };
    window.setTimeout(() => {
      saveStatus = "idle";
    }, 1800);
    window.setTimeout(() => {
      if (toast?.message === "Settings saved.") toast = null;
    }, 2200);
  }

  function exportSettings() {
    const exportData = {
      imgchestApiKey: settings.imgchestApiKey,
      githubToken: settings.githubToken,
      githubOwner: settings.githubOwner,
      githubRepo: settings.githubRepo,
      githubBranch: settings.githubBranch,
      exportedAt: new Date().toISOString(),
      version: APP_VERSION,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kaguya-settings-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function triggerImport() {
    fileInput?.click();
  }

  async function handleImport(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = JSON.parse(text);

      if (imported.imgchestApiKey !== undefined) settings.imgchestApiKey = imported.imgchestApiKey;
      if (imported.githubToken !== undefined) settings.githubToken = imported.githubToken;
      if (imported.githubOwner !== undefined) settings.githubOwner = imported.githubOwner;
      if (imported.githubRepo !== undefined) settings.githubRepo = imported.githubRepo;
      if (imported.githubBranch !== undefined) settings.githubBranch = imported.githubBranch;

      await saveSettings();
    } catch (e) {
      importError = "Failed to import settings. Invalid file format.";
      toast = { kind: "error", message: "Import failed. Invalid settings file." };
      window.setTimeout(() => {
        importError = null;
        if (toast?.kind === "error") toast = null;
      }, 3000);
    }

    target.value = "";
  }

  function openResetModal() {
    showResetModal = true;
  }

  async function confirmReset() {
    showResetModal = false;
    settings = {
      imgchestApiKey: "",
      githubToken: "",
      githubOwner: "",
      githubRepo: "",
      githubBranch: "main",
    };

    await rpc.request.saveSettings(settings);
    originalSettings = { ...settings };
    hasUnsavedChanges = false;
    saveStatus = "idle";
    toast = { kind: "success", message: "Settings reset." };
    window.setTimeout(() => {
      if (toast?.message === "Settings reset.") toast = null;
    }, 2200);
  }

  function cancelReset() {
    showResetModal = false;
  }
</script>

<div class="settings-page">
  <div class="page-header">
    <div class="header-text">
      <p class="page-eyebrow">Configuration</p>
      <h1 class="page-title">Settings</h1>
      <p class="page-subtitle">Manage integrations and application configuration.</p>
    </div>
    <div class="header-actions">
      <button class="action-btn-outline" type="button" title="Export" onclick={exportSettings}>
        <PhExport class="btn-icon" />
        Export
      </button>
      <button class="action-btn-outline" type="button" title="Import" onclick={triggerImport}>
        <PhDownloadSimple class="btn-icon" />
        Import
      </button>
      <input
        type="file"
        bind:this={fileInput}
        accept=".json"
        style="display: none"
        onchange={handleImport}
      />
      <button
        class="save-btn"
        class:saved={saveStatus === "saved"}
        type="button"
        onclick={saveSettings}
        disabled={!hasUnsavedChanges && saveStatus !== "saved"}
      >
        {#if saveStatus === "saved"}
          <PhCheck class="btn-icon" />
        {:else}
          <PhFloppyDisk class="btn-icon" />
        {/if}
        {saveStatus === "saved" ? "Saved" : "Save Changes"}
      </button>
    </div>
  </div>

  {#if importError}
    <div class="alert alert-error">
      <PhWarningCircleFill class="alert-icon" />
      {importError}
    </div>
  {/if}

  <div class="settings-grid">
    <div class="settings-card">
      <div class="card-header">
        <div class="card-header-icon" style="background: var(--bg-elevated); color: var(--text-muted)">
          <PhDatabaseFill class="card-h-icon" />
        </div>
        <div>
          <h3 class="card-heading">Database</h3>
          <p class="card-desc">Local storage location</p>
        </div>
      </div>
      <div class="card-content">
        <div class="field">
          <label class="field-label">Database Path</label>
          <div class="field-readonly">
            <code>{settingsDbPath || "Loading..."}</code>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-card">
      <div class="card-header">
        <div class="card-header-icon" style="background: var(--bg-elevated); color: var(--text-muted)">
          <PhCloudArrowUpFill class="card-h-icon" />
        </div>
        <div>
          <h3 class="card-heading">ImgChest</h3>
          <p class="card-desc">Image hosting integration</p>
        </div>
      </div>
      <div class="card-content">
        <div class="field">
          <label class="field-label">API Key</label>
          <div class="input-group">
            <input
              bind:value={settings.imgchestApiKey}
              class="field-input"
              placeholder="Enter your API key"
              type={showImgchestKey ? "text" : "password"}
            />
            <button class="input-addon" type="button" onclick={() => showImgchestKey = !showImgchestKey}>
              {#if showImgchestKey}<PhEyeSlash />{:else}<PhEye />{/if}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-card card-wide">
      <div class="card-header">
        <div class="card-header-icon" style="background: var(--bg-elevated); color: var(--text-primary)">
          <PhGithubLogoFill class="card-h-icon" />
        </div>
        <div>
          <h3 class="card-heading">GitHub</h3>
          <p class="card-desc">Repository sync configuration</p>
        </div>
      </div>
      <div class="card-content">
        <div class="field">
          <label class="field-label">Personal Access Token</label>
          <div class="input-group">
            <input
              bind:value={settings.githubToken}
              class="field-input"
              placeholder="ghp_xxxxxxxxxxxx"
              type={showGithubToken ? "text" : "password"}
            />
            <button class="input-addon" type="button" onclick={() => showGithubToken = !showGithubToken}>
              {#if showGithubToken}<PhEyeSlash />{:else}<PhEye />{/if}
            </button>
          </div>
        </div>

        <div class="fields-row">
          <div class="field">
            <label class="field-label">Owner</label>
            <input bind:value={settings.githubOwner} class="field-input" placeholder="username or org" />
          </div>
          <div class="field">
            <label class="field-label">Repository</label>
            <input bind:value={settings.githubRepo} class="field-input" placeholder="my-manga-repo" />
          </div>
          <div class="field">
            <label class="field-label">Branch</label>
            <input bind:value={settings.githubBranch} class="field-input" placeholder="main" />
          </div>
        </div>
      </div>
    </div>

    <div class="settings-card card-danger">
      <div class="card-header">
        <div class="card-header-icon" style="background: var(--bg-elevated); color: var(--text-muted)">
          <PhWarningFill class="card-h-icon" />
        </div>
        <div>
          <h3 class="card-heading">Danger Zone</h3>
          <p class="card-desc">Irreversible actions</p>
        </div>
      </div>
      <div class="card-content">
        <div class="danger-row">
          <div>
            <p class="danger-title">Reset all settings</p>
            <p class="danger-desc">Clear all API keys, tokens, and repository configuration.</p>
          </div>
          <button class="btn-danger" type="button" onclick={openResetModal}>
            <PhTrash class="btn-icon" />
            Reset
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="settings-footer">
    <span class="footer-brand">Kaguya</span>
    <span class="footer-sep">·</span>
    <span class="footer-version">v{APP_VERSION}</span>
  </div>
</div>

{#if showResetModal}
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title" onclick={cancelReset}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-icon-wrap">
        <PhWarningFill />
      </div>
      <h2 id="reset-modal-title" class="modal-title">Reset Settings?</h2>
      <p class="modal-message">
        This will clear all your settings (ImgChest API key, GitHub tokens, repository config). This action cannot be undone.
      </p>
      <div class="modal-actions">
        <button class="modal-btn-cancel" type="button" onclick={cancelReset}>
          Cancel
        </button>
        <button class="modal-btn-confirm" type="button" onclick={confirmReset}>
          <PhTrash />
          Reset All
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .settings-page {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 16px;
  }

  .page-eyebrow {
    font-family: var(--mono);
    font-size: 0.65rem;
    font-weight: 400;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 0 0 8px;
  }

  .page-title {
    font-size: 2rem;
    font-weight: 400;
    font-family: var(--display);
    color: var(--text-primary);
    letter-spacing: -0.03em;
    margin: 0;
    line-height: 1.05;
    text-wrap: balance;
  }

  .page-subtitle {
    font-size: 0.78rem;
    color: var(--text-muted);
    margin: 6px 0 0;
    line-height: 1.6;
    text-wrap: pretty;
  }

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  /* Muted earth-gray outline button */
  .action-btn-outline {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-pill);
    background: var(--btn-bg);
    color: var(--btn-text);
    font-family: var(--mono);
    font-size: 0.65rem;
    font-weight: 400;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition-property: background, border-color, scale;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }

  .action-btn-outline:hover {
    background: var(--btn-bg-hover);
    border-color: var(--border-strong);
  }

  .action-btn-outline:active { scale: 0.96; }

  .action-btn-outline:focus-visible {
    outline: 1px solid var(--focus-ring);
    outline-offset: 2px;
  }

  :global(.btn-icon) { font-size: 0.85rem; }

  /* Primary pill save button */
  .save-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 18px;
    background: var(--text-primary);
    border: 1px solid transparent;
    border-radius: var(--radius-pill);
    color: var(--bg-base);
    font-family: var(--mono);
    font-size: 0.65rem;
    font-weight: 400;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition-property: opacity, scale;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }

  .save-btn:hover { opacity: 0.88; }

  .save-btn:active:not(:disabled) { scale: 0.96; }

  .save-btn:focus-visible {
    outline: 1px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .save-btn:disabled {
    opacity: 0.35;
    cursor: default;
    pointer-events: none;
  }

  .save-btn.saved {
    background: var(--accent-green);
    color: var(--text-primary);
    opacity: 1;
  }

  .alert {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 16px;
    border-radius: var(--radius-md);
    font-size: 0.78rem;
    font-weight: 400;
    border: 1px solid rgba(154, 58, 58, 0.4);
  }

  .alert-error {
    background: rgba(154, 58, 58, 0.08);
    color: #d47070;
  }

  :global(.alert-icon) { font-size: 1rem; }

  .settings-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .settings-card {
    background: var(--bg-surface);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-subtle);
    overflow: hidden;
  }

  .card-wide { grid-column: 1 / -1; }

  .card-danger {
    grid-column: 1 / -1;
    border-color: rgba(154, 58, 58, 0.2);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .card-header-icon {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-sm);
    display: grid;
    place-items: center;
    flex-shrink: 0;
    border: 1px solid var(--border-default);
  }

  :global(.card-h-icon) { font-size: 1.1rem; }

  .card-heading {
    font-size: 0.9rem;
    font-weight: 400;
    font-family: var(--display);
    color: var(--text-primary);
    margin: 0;
    line-height: 1.2;
    letter-spacing: -0.01em;
    text-wrap: balance;
  }

  .card-desc {
    font-size: 0.65rem;
    color: var(--text-muted);
    margin: 2px 0 0;
    font-family: var(--mono);
    letter-spacing: 0.04em;
    text-wrap: pretty;
  }

  .card-content {
    padding: 16px 20px 20px;
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
    font-size: 0.6rem;
    font-weight: 400;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-family: var(--mono);
  }

  .field-readonly {
    padding: 9px 12px;
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
  }

  .field-readonly code {
    font-family: var(--mono);
    font-size: 0.72rem;
    color: var(--text-secondary);
    word-break: break-all;
  }

  .field-input {
    width: 100%;
    padding: 9px 12px;
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    color: var(--text-primary);
    font-family: var(--sans);
    font-size: 0.82rem;
    outline: none;
    transition-property: border-color;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }

  .field-input::placeholder { color: var(--text-faint); }

  .field-input:focus { border-color: var(--border-mist); }
  .field-input:focus-visible { outline: none; }

  .input-group {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-group .field-input { padding-right: 44px; }

  .input-addon {
    position: absolute;
    right: 2px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--text-faint);
    cursor: pointer;
    display: grid;
    place-items: center;
    border-radius: var(--radius-xs);
    transition-property: color;
    transition-duration: 0.15s;
    transition-timing-function: ease;
    width: 40px;
    height: 40px;
  }

  .input-addon:hover { color: var(--text-secondary); }
  .input-addon :global(svg) { font-size: 0.95rem; }

  .fields-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .danger-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
  }

  .danger-title {
    font-size: 0.82rem;
    font-weight: 400;
    font-family: var(--display);
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .danger-desc {
    font-size: 0.7rem;
    color: var(--text-muted);
    margin: 4px 0 0;
    text-wrap: pretty;
  }

  .btn-danger {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 16px;
    background: rgba(154, 58, 58, 0.1);
    border: 1px solid rgba(154, 58, 58, 0.35);
    border-radius: var(--radius-pill);
    color: #d47070;
    font-family: var(--mono);
    font-size: 0.65rem;
    font-weight: 400;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition-property: background, border-color, scale;
    transition-duration: 0.15s;
    transition-timing-function: ease;
    white-space: nowrap;
  }

  .btn-danger:hover {
    background: rgba(154, 58, 58, 0.2);
    border-color: rgba(154, 58, 58, 0.55);
  }

  .btn-danger:active { scale: 0.96; }

  .btn-danger:focus-visible {
    outline: 1px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .settings-footer {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    padding: 16px 0;
  }

  .footer-brand {
    font-size: 0.78rem;
    font-weight: 400;
    font-family: var(--display);
    color: var(--text-faint);
    letter-spacing: -0.01em;
  }

  .footer-sep { color: var(--text-faint); font-size: 0.7rem; }

  .footer-version {
    font-size: 0.65rem;
    color: var(--text-faint);
    font-family: var(--mono);
    letter-spacing: 0.04em;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(10, 10, 9, 0.7);
    display: grid;
    place-items: center;
    z-index: 50;
    padding: 20px;
    backdrop-filter: blur(4px);
  }

  .modal {
    background: var(--bg-elevated);
    border-radius: var(--radius-lg);
    padding: 28px;
    max-width: 400px;
    width: 100%;
    text-align: center;
    border: 1px solid var(--border-mist);
    box-shadow: var(--shadow-lg);
  }

  .modal-icon-wrap {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(154, 58, 58, 0.1);
    border: 1px solid rgba(154, 58, 58, 0.25);
    display: grid;
    place-items: center;
    margin: 0 auto 18px;
  }

  .modal-icon-wrap :global(svg) {
    font-size: 1.2rem;
    color: #d47070;
  }

  .modal-title {
    font-size: 1.15rem;
    font-weight: 400;
    font-family: var(--display);
    color: var(--text-primary);
    margin: 0 0 10px;
    line-height: 1.2;
    letter-spacing: -0.02em;
    text-wrap: balance;
  }

  .modal-message {
    font-size: 0.82rem;
    color: var(--text-secondary);
    line-height: 1.65;
    margin: 0 0 22px;
    text-wrap: pretty;
  }

  .modal-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .modal-btn-cancel {
    padding: 8px 18px;
    background: var(--btn-bg);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-pill);
    color: var(--btn-text);
    font-family: var(--mono);
    font-size: 0.65rem;
    font-weight: 400;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition-property: background, border-color, scale;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }

  .modal-btn-cancel:hover {
    background: var(--btn-bg-hover);
    border-color: var(--border-strong);
  }

  .modal-btn-cancel:active { scale: 0.96; }

  .modal-btn-cancel:focus-visible {
    outline: 1px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .modal-btn-confirm {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    background: rgba(154, 58, 58, 0.15);
    border: 1px solid rgba(154, 58, 58, 0.4);
    border-radius: var(--radius-pill);
    color: #d47070;
    font-family: var(--mono);
    font-size: 0.65rem;
    font-weight: 400;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition-property: background, border-color, scale;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }

  .modal-btn-confirm:hover {
    background: rgba(154, 58, 58, 0.25);
    border-color: rgba(154, 58, 58, 0.6);
  }

  .modal-btn-confirm:active { scale: 0.96; }

  .modal-btn-confirm:focus-visible {
    outline: 1px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .modal-btn-confirm :global(svg) { font-size: 0.85rem; }

  @media (max-width: 768px) {
    .settings-grid { grid-template-columns: 1fr; }
    .fields-row { grid-template-columns: 1fr; }
    .header-actions { flex-wrap: wrap; }
  }
</style>
