<script lang="ts">
  import { onMount } from "svelte";
  import { APP_VERSION } from "../shared/version.ts";
  import { Electroview } from "electrobun/view";
  import type { MangaEntry } from "../shared/types.ts";
  import Settings from "./Settings.svelte";
  import Library from "./Library.svelte";
  import MangaDetail from "./MangaDetail.svelte";
  import PhBooks from "~icons/ph/books";
  import PhBooksFill from "~icons/ph/books-fill";
  import PhGear from "~icons/ph/gear";
  import PhGearFill from "~icons/ph/gear-fill";
  import PhCheckCircleFill from "~icons/ph/check-circle-fill";
  import PhXCircleFill from "~icons/ph/x-circle-fill";
  import PhInfoFill from "~icons/ph/info-fill";
  import PhSun from "~icons/ph/sun";
  import PhMoon from "~icons/ph/moon";

  let rpc = $state<any>(null);
  let toast = $state<{ kind: "success" | "error" | "info"; message: string } | null>(null);

  let dark = $state(false);

  let selectedManga = $state<MangaEntry | null>(null);

  function applyTheme(isDark: boolean) {
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }

  function toggleTheme() {
    dark = !dark;
    applyTheme(dark);
    rpc?.request.setTheme({ theme: dark ? "dark" : "light" });
  }

  let activeNav = $state("Library");
  const navItems = [
    { name: "Library", icon: PhBooks, iconActive: PhBooksFill },
    { name: "Settings", icon: PhGear, iconActive: PhGearFill },
  ];

  let settingsComponent: any;

  function handleSelectManga(entry: MangaEntry) {
    selectedManga = entry;
  }

  function handleBackToLibrary() {
    selectedManga = null;
  }

  onMount(async () => {
    const _rpc = Electroview.defineRPC({
      maxRequestTime: 120_000,
      handlers: {
        requests: {},
        messages: {},
      },
    });

    new Electroview({ rpc: _rpc });

    const { theme } = await _rpc.request.getTheme();
    dark = theme === "dark";
    applyTheme(dark);

    rpc = _rpc;
  });

</script>

<svelte:head>
  <title>Kaguya</title>
  <meta name="description" content="Manga library manager" />
</svelte:head>

<div class="app-root">
  <header class="topbar">
    <div class="topbar-inner">
      <div class="topbar-left">
        <div class="brand">
          <div class="brand-mark">K</div>
          <span class="brand-name">Kaguya</span>
        </div>
      </div>

      <nav class="topbar-nav">
        {#each navItems as item}
          <button
            class="nav-link"
            class:active={activeNav === item.name}
            type="button"
            onclick={() => { activeNav = item.name; selectedManga = null; }}
          >
            {#if activeNav === item.name}
              <item.iconActive class="nav-link-icon" />
            {:else}
              <item.icon class="nav-link-icon" />
            {/if}
            {item.name}
          </button>
        {/each}
      </nav>

      <div class="topbar-right">
        <button class="theme-toggle" type="button" onclick={toggleTheme} title={dark ? "Light mode" : "Dark mode"}>
          {#if dark}
            <PhSun class="theme-toggle-icon" />
          {:else}
            <PhMoon class="theme-toggle-icon" />
          {/if}
        </button>
        <span class="version-tag">v{APP_VERSION}</span>
      </div>
    </div>
  </header>

  {#if toast}
    <div class={`toast toast-${toast.kind}`} role="status" aria-live="polite">
      {#if toast.kind === "success"}
        <PhCheckCircleFill class="toast-icon" />
      {:else if toast.kind === "error"}
        <PhXCircleFill class="toast-icon" />
      {:else}
        <PhInfoFill class="toast-icon" />
      {/if}
      <span>{toast.message}</span>
    </div>
  {/if}

  <main class="main-content">
    {#if activeNav === "Library"}
      {#if selectedManga && rpc}
        <MangaDetail {rpc} entry={selectedManga} onBack={handleBackToLibrary} />
      {:else if rpc}
        <Library {rpc} onSelectManga={handleSelectManga} />
      {/if}
    {/if}

    {#if activeNav === "Settings"}
      <Settings bind:this={settingsComponent} {rpc} mounted={true} />
    {/if}
  </main>
</div>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    background: var(--bg-base);
    color: var(--text-primary);
    font-family: "DM Sans", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }

  /* ── Warm Anthropic Design System ── */
  :global(:root) {
    /* Surface & Background */
    --bg-base: #f5f4ed;
    --bg-surface: #faf9f5;
    --bg-elevated: #e8e6dc;
    --bg-hover: #f0eee6;
    --topbar-bg: rgba(245, 244, 237, 0.88);

    /* Borders */
    --border-subtle: #f0eee6;
    --border-default: #e8e6dc;
    --border-strong: #d1cfc5;

    /* Text */
    --text-primary: #141413;
    --text-secondary: #5e5d59;
    --text-muted: #87867f;

    /* Brand & Accent */
    --accent-brand: #c96442;
    --accent-brand-light: rgba(201, 100, 66, 0.12);
    --accent-brand-hover: #b5573a;
    --accent-coral: #d97757;

    /* Semantic */
    --accent-green: #4a7a4e;
    --accent-green-light: rgba(90, 138, 94, 0.12);
    --accent-amber: #b58a3a;
    --accent-amber-light: rgba(181, 138, 58, 0.12);
    --accent-rose: #b53333;
    --accent-rose-light: rgba(181, 51, 51, 0.10);
    --focus-blue: #3898ec;

    /* Radius */
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 24px;

    /* Shadows — ring-based warm system */
    --shadow-sm: 0px 0px 0px 1px #e8e6dc;
    --shadow-md: 0px 0px 0px 1px #d1cfc5, rgba(0, 0, 0, 0.05) 0px 4px 24px;
    --shadow-lg: 0px 0px 0px 1px #d1cfc5, rgba(0, 0, 0, 0.05) 0px 8px 32px;

    /* Typography */
    --serif: "Newsreader", Georgia, "Times New Roman", serif;
    --sans: "DM Sans", Arial, sans-serif;
    --mono: "IBM Plex Mono", ui-monospace, monospace;

    /* Warm neutrals */
    --charcoal-warm: #4d4c48;
    --warm-silver: #b0aea5;
    --dark-surface: #30302e;
  }

  :global(:root.dark) {
    --bg-base: #141413;
    --bg-surface: #30302e;
    --bg-elevated: #3d3d3a;
    --bg-hover: #262624;
    --topbar-bg: rgba(20, 20, 19, 0.88);

    --border-subtle: #30302e;
    --border-default: #3d3d3a;
    --border-strong: #4d4c48;

    --text-primary: #faf9f5;
    --text-secondary: #b0aea5;
    --text-muted: #87867f;

    --accent-brand: #d97757;
    --accent-brand-light: rgba(217, 119, 87, 0.15);
    --accent-brand-hover: #c96442;
    --accent-coral: #e08a6a;

    --accent-green: #6a9d6e;
    --accent-green-light: rgba(122, 173, 126, 0.15);
    --accent-amber: #d4a44a;
    --accent-amber-light: rgba(212, 164, 74, 0.15);
    --accent-rose: #d44545;
    --accent-rose-light: rgba(212, 69, 69, 0.12);

    --shadow-sm: 0px 0px 0px 1px #30302e;
    --shadow-md: 0px 0px 0px 1px #3d3d3a, rgba(0, 0, 0, 0.25) 0px 4px 24px;
    --shadow-lg: 0px 0px 0px 1px #3d3d3a, rgba(0, 0, 0, 0.35) 0px 8px 32px;
  }

  .app-root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* ── Top navigation bar ── */
  .topbar {
    position: sticky;
    top: 0;
    z-index: 30;
    background: var(--topbar-bg);
    backdrop-filter: blur(16px) saturate(1.8);
    border-bottom: 1px solid var(--border-subtle);
  }

  .topbar-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 32px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .topbar-left {
    display: flex;
    align-items: center;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .brand-mark {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--accent-brand);
    color: #faf9f5;
    font-weight: 500;
    font-size: 1rem;
    font-family: var(--serif);
    display: grid;
    place-items: center;
    letter-spacing: -0.02em;
    box-shadow: 0px 0px 0px 1px var(--accent-brand);
  }

  .brand-name {
    font-weight: 500;
    font-size: 1.1rem;
    font-family: var(--serif);
    color: var(--text-primary);
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .topbar-nav {
    display: flex;
    gap: 4px;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-family: var(--sans);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all 0.15s ease;
    position: relative;
  }

  .nav-link:active {
    transform: scale(0.97);
  }

  .nav-link:focus-visible {
    outline: 2px solid var(--focus-blue);
    outline-offset: 2px;
  }

  .nav-link:hover {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }

  .nav-link.active {
    color: var(--accent-brand);
    background: var(--accent-brand-light);
    box-shadow: 0px 0px 0px 1px rgba(201, 100, 66, 0.2);
  }

  :global(.nav-link-icon) {
    font-size: 1.1rem;
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .theme-toggle {
    width: 34px;
    height: 34px;
    border-radius: var(--radius-sm);
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: all 0.15s ease;
    box-shadow: 0px 0px 0px 1px transparent;
  }

  .theme-toggle:hover {
    background: var(--bg-elevated);
    color: var(--text-primary);
    box-shadow: 0px 0px 0px 1px var(--border-default);
  }

  .theme-toggle:active {
    box-shadow: inset 0px 0px 0px 1px rgba(0, 0, 0, 0.12);
  }

  .theme-toggle:focus-visible {
    outline: 2px solid var(--focus-blue);
    outline-offset: 2px;
  }

  :global(.theme-toggle-icon) {
    font-size: 1rem;
  }

  .version-tag {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--text-muted);
    padding: 3px 8px;
    background: var(--bg-surface);
    border-radius: var(--radius-sm);
    box-shadow: 0px 0px 0px 1px var(--border-subtle);
  }

  /* Main content */
  .main-content {
    flex: 1;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    padding: 32px;
  }

  /* Toast */
  .toast {
    position: fixed;
    top: 72px;
    right: 24px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 18px;
    border-radius: var(--radius-md);
    background: var(--bg-surface);
    box-shadow: var(--shadow-md);
    color: var(--text-primary);
    font-size: 0.85rem;
    font-weight: 500;
    z-index: 40;
    animation: toast-in 0.25s ease-out;
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .toast-success {
    box-shadow: 0px 0px 0px 1px var(--accent-green), rgba(0, 0, 0, 0.05) 0px 4px 24px;
  }

  .toast-error {
    box-shadow: 0px 0px 0px 1px var(--accent-rose), rgba(0, 0, 0, 0.05) 0px 4px 24px;
  }

  .toast-info {
    box-shadow: 0px 0px 0px 1px var(--accent-brand), rgba(0, 0, 0, 0.05) 0px 4px 24px;
  }

  :global(.toast-icon) {
    font-size: 1.15rem;
  }

  .toast-success :global(.toast-icon) {
    color: var(--accent-green);
  }

  .toast-error :global(.toast-icon) {
    color: var(--accent-rose);
  }

  .toast-info :global(.toast-icon) {
    color: var(--accent-brand);
  }

  /* Warm selection */
  :global(::selection) {
    background: rgba(201, 100, 66, 0.22);
    color: var(--text-primary);
  }

  /* Warm scrollbar */
  :global(*) {
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
  }

  :global(*::-webkit-scrollbar) {
    width: 6px;
  }

  :global(*::-webkit-scrollbar-track) {
    background: transparent;
  }

  :global(*::-webkit-scrollbar-thumb) {
    background: var(--border-strong);
    border-radius: 999px;
  }

  :global(*::-webkit-scrollbar-thumb:hover) {
    background: var(--text-muted);
  }

  @media (max-width: 768px) {
    .topbar-inner {
      padding: 0 16px;
    }

    .main-content {
      padding: 20px 16px;
    }

    .brand-name {
      display: none;
    }
  }
</style>
