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
        <div class="card-header-icon" style="background: var(--accent-blue-light); color: var(--accent-blue)">
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
        <div class="card-header-icon" style="background: var(--accent-green-light); color: var(--accent-green)">
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
        <div class="card-header-icon" style="background: #f1f5f9; color: #1e293b">
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
        <div class="card-header-icon" style="background: var(--accent-rose-light); color: var(--accent-rose)">
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
    gap: 28px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 16px;
  }

  .page-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.03em;
    margin: 0;
  }

  .page-subtitle {
    font-size: 0.9rem;
    color: var(--text-muted);
    margin: 4px 0 0;
  }

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .action-btn-outline {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--bg-surface);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: var(--shadow-sm);
  }

  .action-btn-outline:hover {
    border-color: var(--border-default);
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  :global(.btn-icon) {
    font-size: 0.95rem;
  }

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

  .save-btn:hover {
    background: var(--accent-blue-hover);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  }

  .save-btn:disabled {
    opacity: 0.45;
    cursor: default;
    pointer-events: none;
  }

  .save-btn.saved {
    background: var(--accent-green);
    box-shadow: 0 1px 3px rgba(5, 150, 105, 0.25);
  }

  .alert {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    font-weight: 500;
  }

  .alert-error {
    background: var(--accent-rose-light);
    border: 1px solid var(--accent-rose);
    color: var(--accent-rose);
  }

  :global(.alert-icon) {
    font-size: 1.1rem;
  }

  .settings-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .settings-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .card-wide {
    grid-column: 1 / -1;
  }

  .card-danger {
    grid-column: 1 / -1;
    border-color: #fecdd3;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 22px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .card-header-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  :global(.card-h-icon) {
    font-size: 1.2rem;
  }

  .card-heading {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .card-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin: 2px 0 0;
  }

  .card-content {
    padding: 18px 22px 22px;
    display: flex;
    flex-direction: column;
    gap: 16px;
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

  .field-readonly {
    padding: 10px 14px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
  }

  .field-readonly code {
    font-family: var(--mono);
    font-size: 0.8rem;
    color: var(--text-secondary);
    word-break: break-all;
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

  .field-input::placeholder {
    color: var(--text-muted);
  }

  .field-input:focus {
    border-color: var(--accent-blue);
    box-shadow: 0 0 0 3px var(--accent-blue-light);
  }

  .input-group {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-group .field-input {
    padding-right: 42px;
  }

  .input-addon {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    display: grid;
    place-items: center;
    border-radius: 4px;
    transition: color 0.15s ease;
  }

  .input-addon:hover {
    color: var(--text-secondary);
  }

  .input-addon :global(svg) {
    font-size: 1rem;
  }

  .fields-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }

  .danger-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
  }

  .danger-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .danger-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin: 4px 0 0;
  }

  .btn-danger {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--accent-rose);
    border-radius: var(--radius-sm);
    color: var(--accent-rose);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
    white-space: nowrap;
  }

  .btn-danger:hover {
    background: var(--accent-rose-light);
  }

  .settings-footer {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    padding: 16px 0;
  }

  .footer-brand {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .footer-sep {
    color: var(--text-muted);
  }

  .footer-version {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: var(--mono);
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    backdrop-filter: blur(4px);
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
    max-width: 400px;
    width: 100%;
    text-align: center;
    box-shadow: var(--shadow-lg);
  }

  .modal-icon-wrap {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--accent-rose-light);
    display: grid;
    place-items: center;
    margin: 0 auto 18px;
  }

  .modal-icon-wrap :global(svg) {
    font-size: 1.5rem;
    color: var(--accent-rose);
  }

  .modal-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 10px;
    letter-spacing: -0.02em;
  }

  .modal-message {
    font-size: 0.85rem;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0 0 22px;
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
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .modal-btn-cancel:hover {
    border-color: var(--border-default);
    color: var(--text-primary);
  }

  .modal-btn-confirm {
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
    transition: background 0.15s ease;
  }

  .modal-btn-confirm:hover {
    background: #be123c;
  }

  .modal-btn-confirm :global(svg) {
    font-size: 0.95rem;
  }

  @media (max-width: 768px) {
    .settings-grid {
      grid-template-columns: 1fr;
    }

    .fields-row {
      grid-template-columns: 1fr;
    }

    .header-actions {
      flex-wrap: wrap;
    }
  }
</style>
