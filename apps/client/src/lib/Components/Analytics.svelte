<script lang="ts">
  export let enabled = false;
  import { page } from "$app/stores";

  $: {
    if (typeof gtag !== "undefined") {
      gtag("config", "UA-175300558-1", {
        page_title: document.title,
        page_path: $page.url.pathname
      });
    }
  }

  let scriptTag;
  $: if (enabled && scriptTag)
    scriptTag.src = "https://www.googletagmanager.com/gtag/js?id=UA-175300558-1";
</script>

<svelte:head>
  <script async bind:this={scriptTag} />
  <script>
    window.dataLayer = window.dataLayer || [];

    function gtag() {
      dataLayer.push(arguments);
    }

    gtag("js", new Date());
    gtag("config", "UA-175300558-1");
  </script>
</svelte:head>