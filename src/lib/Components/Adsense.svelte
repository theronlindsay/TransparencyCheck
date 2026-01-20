<script>
  let scriptTag;

  export let enabled = false;

  $: if (enabled && scriptTag)
    scriptTag.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
</script>

<svelte:head>
  <script data-ad-client="ca-pub-6606810145118251" async
          bind:this={scriptTag}></script>
</svelte:head>