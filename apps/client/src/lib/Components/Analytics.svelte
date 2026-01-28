<script>
  let { enabled = false } = $props();
  import { page } from "$app/stores";

  $effect(() => {
    if (enabled && typeof gtag !== "undefined") {
      gtag("config", "UA-175300558-1", {
        page_title: document.title,
        page_path: $page.url.pathname
      });
    }
  });
</script>

<svelte:head>
  {#if enabled}
    <script src="https://www.googletagmanager.com/gtag/js?id=UA-175300558-1" async></script>
  {/if}
  <script>
    window.dataLayer = window.dataLayer || [];

    function gtag() {
      dataLayer.push(arguments);
    }

    gtag("js", new Date());
    gtag("config", "UA-175300558-1");
  </script>
</svelte:head>