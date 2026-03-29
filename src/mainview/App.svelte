<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@iconify/svelte";
  import { APP_VERSION } from "../shared/version.ts";
  import { Electroview } from "electrobun/view";
  import Settings from "./Settings.svelte";
  import Library from "./Library.svelte";

  let rpc: any;
  let toast = $state<{ kind: "success" | "error" | "info"; message: string } | null>(null);

  let mounted = $state(false);
  onMount(() => {
    setTimeout(() => (mounted = true), 50);
  });

  let activeNav = $state("Library");
  const navItems: { name: string; icon: string; iconActive: string }[] = [
    { name: "Library", icon: "ph:books", iconActive: "ph:books-fill" },
    { name: "Settings", icon: "ph:gear", iconActive: "ph:gear-fill" },
  ];

  let settingsComponent: any;

  onMount(async () => {
    rpc = Electroview.defineRPC({
      handlers: {
        requests: {},
        messages: {},
      },
    });

    new Electroview({ rpc });
  });

</script>

<svelte:head>
  <title>Kaguya Library</title>
  <meta name="description" content="Manga library manager" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<main class="shell">
  <!-- Sleek icon-only sidebar -->
  <aside class="sidebar">
    <div class="brand-icon" class:visible={mounted}>
      <span class="k-icon">K</span>
    </div>

    <nav class="icon-nav">
      {#each navItems as item, i}
        <button
          class="nav-icon-btn"
          class:active={activeNav === item.name}
          class:visible={mounted}
          type="button"
          onclick={() => (activeNav = item.name)}
          style={`transition-delay: ${0.06 + i * 0.04}s`}
          title={item.name}
        >
          <div class="icon-wrapper">
            <Icon icon={activeNav === item.name ? item.iconActive : item.icon} class="nav-svg" />
          </div>

          {#if activeNav === item.name}
            <span class="active-indicator"></span>
          {/if}
        </button>
      {/each}
    </nav>


  </aside>

  <section class="content">

    {#if toast}
      <div class={`toast ${toast.kind}`} role="status" aria-live="polite">
        <Icon
          icon={toast.kind === "success" ? "ph:check-circle" : toast.kind === "error" ? "ph:x-circle" : "ph:info"}
          class="toast-icon"
        />
        <span>{toast.message}</span>
      </div>
    {/if}


    {#if activeNav === "Library"}
      <Library {mounted} />
    {/if}

    {#if activeNav === "Settings"}
      <Settings bind:this={settingsComponent} {rpc} {mounted} />
    {/if}
  </section>
</main>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(html) {
    color-scheme: dark;
  }

  :global(body) {
    background: #09090b;
    color: #fafafa;
    font-family: "Outfit", sans-serif;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }

  /* CSS Variables */
  :global(:root) {
    --bg-deep: #050507;
    --bg-base: #09090b;
    --bg-surface: #111113;
    --bg-elevated: #18181b;
    --border-subtle: #1f1f23;
    --border-default: #27272a;
    --text-primary: #fafafa;
    --text-secondary: #a1a1aa;
    --text-muted: #52525b;
    --accent-cyan: #22d3ee;
    --accent-green: #4ade80;
    --accent-amber: #fbbf24;
    --accent-rose: #fb7185;
    --accent-muted: #71717a;
  }

  .shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 72px 1fr;
    gap: 0;
    padding: 0;
  }

  /* Sleek icon-only sidebar */
  .sidebar {
    background: linear-gradient(180deg, var(--bg-deep) 0%, var(--bg-base) 100%);
    border-right: 1px solid var(--border-subtle);
    padding: 20px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: sticky;
    top: 0;
    height: 100vh;
  }

  .brand-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, var(--accent-cyan) 0%, #0891b2 100%);
    margin-bottom: 32px;
    opacity: 0;
    transform: scale(0.8);
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 4px 20px rgba(34, 211, 238, 0.25);
  }

  .brand-icon.visible {
    opacity: 1;
    transform: scale(1);
  }

  .k-icon {
    font-weight: 700;
    font-size: 1.25rem;
    color: var(--bg-deep);
    font-family: "Outfit", sans-serif;
    letter-spacing: -0.02em;
  }

  .icon-nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .nav-icon-btn {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    position: relative;
    display: grid;
    place-items: center;
    opacity: 0;
    transform: translateY(8px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .nav-icon-btn.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .nav-icon-btn:hover {
    background: var(--bg-elevated);
    color: var(--text-secondary);
  }

  .nav-icon-btn.active {
    background: var(--bg-surface);
    color: var(--accent-cyan);
  }

  .icon-wrapper {
    position: relative;
    z-index: 1;
  }

  :global(.nav-svg) {
    font-size: 1.35rem;
    transition: all 0.25s ease;
  }

  .nav-icon-btn.active :global(.nav-svg) {
    filter: drop-shadow(0 0 8px rgba(34, 211, 238, 0.5));
  }

  .active-indicator {
    position: absolute;
    left: -8px;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 20px;
    background: var(--accent-cyan);
    border-radius: 0 3px 3px 0;
    box-shadow: 0 0 12px var(--accent-cyan);
  }

  /* Content area */
  .content {
    background: var(--bg-base);
    padding: 32px 40px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-height: 100vh;
    position: relative;
  }

  .toast {
    position: fixed;
    top: 20px;
    right: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid var(--border-subtle);
    background: rgba(17, 17, 19, 0.92);
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(12px);
    color: var(--text-primary);
    font-size: 0.85rem;
    z-index: 40;
    animation: toast-in 0.22s ease-out;
  }

  .toast.success {
    border-color: rgba(74, 222, 128, 0.35);
    box-shadow: 0 18px 40px rgba(74, 222, 128, 0.12), 0 18px 40px rgba(0, 0, 0, 0.35);
  }

  .toast.error {
    border-color: rgba(251, 113, 133, 0.35);
    box-shadow: 0 18px 40px rgba(251, 113, 133, 0.12), 0 18px 40px rgba(0, 0, 0, 0.35);
  }

  .toast.info {
    border-color: rgba(34, 211, 238, 0.35);
  }

  :global(.toast-icon) {
    font-size: 1rem;
    color: var(--accent-cyan);
  }

  .toast.success :global(.toast-icon) {
    color: var(--accent-green);
  }

  .toast.error :global(.toast-icon) {
    color: var(--accent-rose);
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Subtle grid pattern background */
  .content::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      radial-gradient(circle at 1px 1px, var(--border-subtle) 1px, transparent 0);
    background-size: 32px 32px;
    opacity: 0.5;
    pointer-events: none;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .workspace {
    display: block;
    flex: 1;
    position: relative;
    z-index: 1;
  }

  /* Library header */
  .library-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28px;
    opacity: 0;
    transform: translateY(-8px);
    transition: all 0.4s ease;
  }

  .library-header.visible {
    opacity: 1;
    transform: translateY(0);
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

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    background: var(--bg-elevated);
    color: var(--text-secondary);
    border-color: var(--border-default);
  }

  :global(.action-icon) {
    font-size: 1.1rem;
  }

  /* Library grid */
  .library-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;
  }

  .manga-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
    padding: 14px;
    cursor: pointer;
    text-align: left;
    opacity: 0;
    transform: translateY(20px) scale(0.98);
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .manga-card.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .manga-card:hover {
    border-color: var(--border-default);
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  }

  .cover {
    aspect-ratio: 3/4;
    border-radius: 10px;
    display: flex;
    align-items: flex-end;
    padding: 14px;
    margin-bottom: 14px;
    position: relative;
    overflow: hidden;
  }

  .cover::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60%;
    background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%);
    pointer-events: none;
  }

  .cover-letter {
    font-family: "Outfit", sans-serif;
    font-weight: 700;
    font-size: 1.6rem;
    color: var(--text-primary);
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
    position: relative;
    z-index: 1;
  }

  .cover-overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.5);
    opacity: 0;
    transition: all 0.25s ease;
  }

  .manga-card:hover .cover-overlay {
    opacity: 1;
  }

  :global(.preview-icon) {
    font-size: 2rem;
    color: var(--text-primary);
  }

  .manga-info {
    padding: 0 2px;
  }

  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 4px;
  }

  .manga-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    letter-spacing: -0.01em;
  }

  .rating {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 0.75rem;
    color: var(--rating-color);
    font-family: "JetBrains Mono", monospace;
    white-space: nowrap;
  }

  :global(.star-icon) {
    font-size: 0.8rem;
  }

  .author {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-bottom: 10px;
  }

  .volumes {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-family: "JetBrains Mono", monospace;
  }

  :global(.search-icon) {
    font-size: 1.1rem;
    color: var(--text-muted);
  }

  :global(.empty-icon) {
    font-size: 3rem;
    color: var(--text-muted);
    margin-bottom: 12px;
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
    position: relative;
    z-index: 1;
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

  @media (max-width: 768px) {
    .content {
      padding: 16px;
    }

    .library-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    }
  }
</style>
