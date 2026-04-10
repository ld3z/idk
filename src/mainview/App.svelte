<script lang="ts">
  import { onMount } from "svelte";
  import { APP_VERSION } from "../shared/version.ts";
  import { Electroview } from "electrobun/view";
  import Settings from "./Settings.svelte";
  import Library from "./Library.svelte";
  import PhBooks from "~icons/ph/books";
  import PhBooksFill from "~icons/ph/books-fill";
  import PhGear from "~icons/ph/gear";
  import PhGearFill from "~icons/ph/gear-fill";
  import PhCheckCircleFill from "~icons/ph/check-circle-fill";
  import PhXCircleFill from "~icons/ph/x-circle-fill";
  import PhInfoFill from "~icons/ph/info-fill";
  import PhSun from "~icons/ph/sun";
  import PhMoon from "~icons/ph/moon";

  let rpc: any;
  let toast = $state<{ kind: "success" | "error" | "info"; message: string } | null>(null);

  let mounted = $state(true);

  let dark = $state(false);

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

  onMount(async () => {
    rpc = Electroview.defineRPC({
      handlers: {
        requests: {},
        messages: {},
      },
    });

    new Electroview({ rpc });

    const { theme } = await rpc.request.getTheme();
    dark = theme === "dark";
    applyTheme(dark);
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
            onclick={() => (activeNav = item.name)}
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
      <Library {mounted} />
    {/if}

    {#if activeNav === "Settings"}
      <Settings bind:this={settingsComponent} {rpc} {mounted} />
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
    font-family: "DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }

  :global(:root) {
    --bg-base: #fafbfc;
    --bg-surface: #ffffff;
    --bg-elevated: #f1f5f9;
    --bg-hover: #f8fafc;
    --topbar-bg: rgba(255, 255, 255, 0.85);
    --border-subtle: #e8ecf1;
    --border-default: #d1d9e0;
    --border-strong: #b0bac5;
    --text-primary: #0f172a;
    --text-secondary: #475569;
    --text-muted: #94a3b8;
    --accent-blue: #2563eb;
    --accent-blue-light: #dbeafe;
    --accent-blue-hover: #1d4ed8;
    --accent-green: #059669;
    --accent-green-light: #d1fae5;
    --accent-amber: #d97706;
    --accent-amber-light: #fef3c7;
    --accent-rose: #e11d48;
    --accent-rose-light: #ffe4e6;
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
    --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
    --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04);
    --mono: "IBM Plex Mono", ui-monospace, monospace;
  }

  :global(:root.dark) {
    --bg-base: #000000;
    --bg-surface: #0a0a0a;
    --bg-elevated: #141414;
    --bg-hover: #111111;
    --topbar-bg: rgba(0, 0, 0, 0.85);
    --border-subtle: #1a1a1a;
    --border-default: #2a2a2a;
    --border-strong: #3a3a3a;
    --text-primary: #f0f0f0;
    --text-secondary: #a0a0a0;
    --text-muted: #606060;
    --accent-blue: #3b82f6;
    --accent-blue-light: rgba(59, 130, 246, 0.15);
    --accent-blue-hover: #60a5fa;
    --accent-green: #10b981;
    --accent-green-light: rgba(16, 185, 129, 0.15);
    --accent-amber: #f59e0b;
    --accent-amber-light: rgba(245, 158, 11, 0.15);
    --accent-rose: #f43f5e;
    --accent-rose-light: rgba(244, 63, 94, 0.15);
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
    --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.4);
    --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.5);
  }

  .app-root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* Top navigation bar */
  .topbar {
    position: sticky;
    top: 0;
    z-index: 30;
    background: var(--topbar-bg);
    backdrop-filter: blur(12px) saturate(1.8);
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
    background: var(--accent-blue);
    color: #fff;
    font-weight: 700;
    font-size: 0.95rem;
    display: grid;
    place-items: center;
    letter-spacing: -0.02em;
  }

  .brand-name {
    font-weight: 700;
    font-size: 1.05rem;
    color: var(--text-primary);
    letter-spacing: -0.03em;
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
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all 0.15s ease;
    position: relative;
  }

  .nav-link:hover {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }

  .nav-link.active {
    color: var(--accent-blue);
    background: var(--accent-blue-light);
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
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: all 0.15s ease;
  }

  .theme-toggle:hover {
    background: var(--bg-elevated);
    color: var(--text-primary);
    border-color: var(--border-default);
  }

  :global(.theme-toggle-icon) {
    font-size: 1rem;
  }

  .version-tag {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--text-muted);
    padding: 3px 8px;
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
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
    border: 1px solid var(--border-subtle);
    background: var(--bg-surface);
    box-shadow: var(--shadow-lg);
    color: var(--text-primary);
    font-size: 0.85rem;
    font-weight: 500;
    z-index: 40;
  }

  .toast-success {
    border-color: var(--accent-green);
  }

  .toast-error {
    border-color: var(--accent-rose);
  }

  .toast-info {
    border-color: var(--accent-blue);
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
    color: var(--accent-blue);
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
