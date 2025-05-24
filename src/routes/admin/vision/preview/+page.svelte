<script lang="ts">
  
  // Page metadata
  const title = 'Vision Streams';
  const description = 'Manage vision streams';
  
  // Breadcrumbs
  $: pageCrumbs = [
    { label: 'Admin', href: '/admin' },
    { label: 'Vision', href: '/admin/vision' },
    { label: 'Streams'}
  ];
</script>

<svelte:head>
  <title>{title} | Admin</title>
  <meta name="description" content={description} />
</svelte:head>

