<script lang="ts">
  import Icon from "@iconify/svelte";
  import { APP_VERSION } from "../shared/version.ts";

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

  // Lock body scroll when modal is open
  $effect(() => {
    if (showResetModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  });

  // Password visibility toggles
  let showImgchestKey = $state(false);
  let showGithubToken = $state(false);

  // Hidden file input for import
  let fileInput = $state<HTMLInputElement | null>(null);
  let importError = $state<string | null>(null);

  // Initialize settings from storage when rpc is available
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

  // Settings state
  let settings = $state({
    imgchestApiKey: "",
    githubToken: "",
    githubOwner: "",
    githubRepo: "",
    githubBranch: "main",
  } satisfies AppSettings);

  // Track changes to settings
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

      // Validate and apply imported settings
      if (imported.imgchestApiKey !== undefined) settings.imgchestApiKey = imported.imgchestApiKey;
      if (imported.githubToken !== undefined) settings.githubToken = imported.githubToken;
      if (imported.githubOwner !== undefined) settings.githubOwner = imported.githubOwner;
      if (imported.githubRepo !== undefined) settings.githubRepo = imported.githubRepo;
      if (imported.githubBranch !== undefined) settings.githubBranch = imported.githubBranch;

      // Auto-save after import
      await saveSettings();
    } catch (e) {
      importError = "Failed to import settings. Invalid file format.";
      toast = { kind: "error", message: "Import failed. Invalid settings file." };
      window.setTimeout(() => {
        importError = null;
        if (toast?.kind === "error") toast = null;
      }, 3000);
    }

    // Reset input so same file can be selected again
    target.value = "";
  }

  function openResetModal() {
    showResetModal = true;
  }

  function confirmReset() {
    showResetModal = false;
    settings = {
      imgchestApiKey: "",
      githubToken: "",
      githubOwner: "",
      githubRepo: "",
      githubBranch: "main",
    };

    saveSettings();
    toast = { kind: "success", message: "Settings reset and saved." };
  }

  function cancelReset() {
    showResetModal = false;
  }
</script>

<div class="settings-wrapper">
  <div class="settings-header" class:visible={mounted}>
    <div class="header-left">
      <h1 class="page-title">Settings</h1>
      <span class="item-count">Configuration</span>
    </div>
    <div class="header-actions">
      <button class="header-btn" type="button" title="Export Settings" onclick={exportSettings}>
        <Icon icon="ph:export" class="action-icon" />
      </button>
      <button class="header-btn" type="button" title="Import Settings" onclick={triggerImport}>
        <Icon icon="ph:download-simple" class="action-icon" />
      </button>
      <input
        type="file"
        bind:this={fileInput}
        accept=".json"
        style="display: none"
        onchange={handleImport}
      />
      {#if hasUnsavedChanges || saveStatus === "saved"}
        <button class="global-save-btn" class:saved={saveStatus === "saved"} type="button" onclick={saveSettings}>
          <Icon icon={saveStatus === "saved" ? "ph:check" : "ph:floppy-disk"} class="save-icon" />
          {saveStatus === "saved" ? "Saved" : "Save"}
        </button>
      {/if}
    </div>
  </div>

  {#if importError}
    <div class="import-error" class:visible={importError}>
      <Icon icon="ph:warning-circle" class="error-icon" />
      {importError}
    </div>
  {/if}

  <div class="settings-list">
    <!-- Database Section -->
    <div class="settings-section" class:visible={mounted} style="transition-delay: 0.08s">
      <div class="section-header">
        <Icon icon="ph:database" class="section-icon" />
        <span class="section-title">Database</span>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">Database Path</span>
          <code class="setting-value">{settingsDbPath || "Loading..."}</code>
        </div>
      </div>
    </div>

    <!-- ImgChest Section -->
    <div class="settings-section" class:visible={mounted} style="transition-delay: 0.1s">
      <div class="section-header">
        <Icon icon="ph:cloud-arrow-up" class="section-icon" />
        <span class="section-title">ImgChest</span>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">API Key</span>
          <div class="password-field">
            <input
              bind:value={settings.imgchestApiKey}
              class="setting-input"
              placeholder="Enter your API key"
              type={showImgchestKey ? "text" : "password"}
            />
            <button class="toggle-password" type="button" onclick={() => showImgchestKey = !showImgchestKey}>
              <Icon icon={showImgchestKey ? "ph:eye-slash" : "ph:eye"} />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- GitHub Section -->
    <div class="settings-section" class:visible={mounted} style="transition-delay: 0.12s">
      <div class="section-header">
        <Icon icon="ph:github-logo" class="section-icon" />
        <span class="section-title">GitHub</span>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">Personal Access Token</span>
          <div class="password-field">
            <input
              bind:value={settings.githubToken}
              class="setting-input"
              placeholder="ghp_xxxxxxxxxxxx"
              type={showGithubToken ? "text" : "password"}
            />
            <button class="toggle-password" type="button" onclick={() => showGithubToken = !showGithubToken}>
              <Icon icon={showGithubToken ? "ph:eye-slash" : "ph:eye"} />
            </button>
          </div>
        </div>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">Repository Owner</span>
          <input bind:value={settings.githubOwner} class="setting-input" placeholder="username or org" />
        </div>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">Repository Name</span>
          <input bind:value={settings.githubRepo} class="setting-input" placeholder="my-manga-repo" />
        </div>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">Branch</span>
          <input bind:value={settings.githubBranch} class="setting-input" placeholder="main" />
        </div>
      </div>
    </div>

    <!-- Actions Section -->
    <div class="settings-section" class:visible={mounted} style="transition-delay: 0.14s">
      <div class="section-header">
        <Icon icon="ph:gear" class="section-icon" />
        <span class="section-title">Actions</span>
      </div>
      <div class="action-buttons">
        <button class="action-btn-reset" type="button" onclick={openResetModal}>
          <Icon icon="ph:trash" class="action-btn-icon" />
          Reset All Settings
        </button>
      </div>
    </div>

    <!-- About Section -->
    <div class="settings-section about-section" class:visible={mounted} style="transition-delay: 0.16s">
      <div class="about-minimal">
        <span class="about-brand">Kaguya</span>
        <span class="about-version">v{APP_VERSION}</span>
      </div>
    </div>
  </div>
</div>

<!-- Reset Confirmation Modal -->
{#if showResetModal}
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title" onclick={cancelReset}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-icon">
        <Icon icon="ph:warning" />
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
          <Icon icon="ph:trash" />
          Reset All
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .settings-wrapper {
    display: block;
    flex: 1;
    position: relative;
    z-index: 1;
  }

  /* Settings - List Layout */
  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28px;
    opacity: 0;
    transform: translateY(-8px);
    transition: all 0.4s ease;
  }

  .settings-header.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .settings-header .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-left {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .page-title {
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .item-count {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-family: "JetBrains Mono", monospace;
  }

  .header-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: all 0.2s ease;
  }

  .header-btn:hover {
    background: var(--bg-elevated);
    color: var(--text-secondary);
    border-color: var(--border-default);
  }

  :global(.action-icon) {
    font-size: 1rem;
  }

  .global-save-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: linear-gradient(135deg, var(--accent-cyan) 0%, #0891b2 100%);
    border: none;
    border-radius: 6px;
    color: var(--bg-deep);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .global-save-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(34, 211, 238, 0.3);
  }

  .global-save-btn:active {
    transform: translateY(0);
  }

  .global-save-btn.saved {
    background: var(--accent-green);
  }

  /* Settings List */
  .import-error {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(251, 113, 133, 0.1);
    border: 1px solid var(--accent-rose);
    border-radius: 8px;
    color: var(--accent-rose);
    font-size: 0.85rem;
    opacity: 0;
    transform: translateY(-8px);
    transition: all 0.3s ease;
  }

  .import-error.visible {
    opacity: 1;
    transform: translateY(0);
  }

  :global(.error-icon) {
    font-size: 1.1rem;
  }

  .settings-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .settings-section {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    padding: 16px 20px;
    opacity: 0;
    transform: translateY(12px);
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .settings-section.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border-subtle);
  }

  :global(.section-icon) {
    font-size: 1.1rem;
    color: var(--accent-cyan);
  }

  .section-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .setting-item {
    padding: 10px 0;
  }

  .setting-item + .setting-item {
    border-top: 1px solid var(--border-subtle);
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .setting-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .setting-value {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-family: "JetBrains Mono", monospace;
    word-break: break-all;
    white-space: pre-wrap;
  }

  .password-field {
    position: relative;
    display: flex;
    align-items: center;
  }

  .password-field .setting-input {
    padding-right: 40px;
  }

  .toggle-password {
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
    transition: all 0.2s ease;
  }

  .toggle-password:hover {
    color: var(--text-secondary);
  }

  .toggle-password :global(svg) {
    font-size: 1rem;
  }

  .setting-input {
    width: 100%;
    padding: 10px 12px;
    border-radius: 6px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.85rem;
    outline: none;
    transition: all 0.2s ease;
  }

  .setting-input::placeholder {
    color: var(--text-muted);
  }

  .setting-input:focus {
    border-color: var(--accent-cyan);
  }

  .action-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .action-btn-reset {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: transparent;
    border: 1px solid var(--accent-rose);
    border-radius: 6px;
    color: var(--accent-rose);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn-reset:hover {
    background: rgba(251, 113, 133, 0.1);
  }

  :global(.action-btn-icon) {
    font-size: 1rem;
  }

  .about-section {
    background: transparent;
    border: 1px solid transparent;
    display: flex;
    justify-content: center;
    padding: 20px;
  }

  .about-minimal {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .about-brand {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .about-version {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: "JetBrains Mono", monospace;
  }

  :global(.save-icon) {
    font-size: 0.9rem;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: grid;
    place-items: center;
    z-index: 50;
    padding: 20px;
    animation: overlay-in 0.2s ease-out;
  }

  @keyframes overlay-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal {
    background: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: 16px;
    padding: 28px;
    max-width: 400px;
    width: 100%;
    text-align: center;
    animation: modal-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  }

  @keyframes modal-in {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .modal-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgba(251, 113, 133, 0.15);
    display: grid;
    place-items: center;
    margin: 0 auto 20px;
  }

  .modal-icon :global(svg) {
    font-size: 1.75rem;
    color: var(--accent-rose);
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 12px;
    letter-spacing: -0.01em;
  }

  .modal-message {
    font-size: 0.9rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0 0 24px;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .modal-btn-cancel {
    padding: 10px 20px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .modal-btn-cancel:hover {
    background: var(--bg-surface);
    border-color: var(--border-default);
    color: var(--text-primary);
  }

  .modal-btn-confirm {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    background: var(--accent-rose);
    border: none;
    border-radius: 8px;
    color: #fff;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .modal-btn-confirm:hover {
    background: #f43f5e;
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(251, 113, 133, 0.35);
  }

  .modal-btn-confirm :global(svg) {
    font-size: 1rem;
  }
</style>