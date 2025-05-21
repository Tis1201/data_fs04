# Admin Page Layout Components

A set of standardized layout components for admin pages that follow the project's UI/UX guidelines.

## Components

### AdminPageLayout

The main layout component that provides a standardized structure for admin pages.

```svelte
<script>
  import { AdminPageLayout, AdminCard } from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout";
  import { ArrowLeft, Settings } from "lucide-svelte";
  
  // Define breadcrumbs
  const pageCrumbs = [
    ["Admin", "/admin"],
    ["Devices", "/admin/devices"],
    ["Device Details", ""]
  ];
</script>

<AdminPageLayout 
  title="Device Details"
  crumbs={pageCrumbs}
  actionLabel="Back"
  actionIcon={ArrowLeft}
  actionHref="/admin/devices"
>
  <AdminCard 
    title="Device Information"
    description="Basic details about this device"
    icon={Settings}
  >
    <!-- Card content goes here -->
    <div class="space-y-4">
      <p>Device content...</p>
    </div>
    
    <!-- Optional footer -->
    <svelte:fragment slot="footer">
      <p class="text-sm text-muted-foreground">Footer content</p>
    </svelte:fragment>
  </AdminCard>
  
  <!-- Add more cards as needed -->
</AdminPageLayout>
```

### AdminCard

A standardized card component that follows the project's UI guidelines.

```svelte
<AdminCard 
  title="Card Title"
  description="Card description text"
  icon={Settings}
  class_name="mt-4" // Optional additional classes
>
  <!-- Card content -->
  <div class="space-y-4">
    <p>Card content goes here...</p>
  </div>
  
  <!-- Optional header slot for custom header content -->
  <svelte:fragment slot="header">
    <div class="flex justify-end">
      <Button variant="outline" size="sm">Action</Button>
    </div>
  </svelte:fragment>
  
  <!-- Optional footer -->
  <svelte:fragment slot="footer">
    <div class="text-sm text-muted-foreground">
      Footer content
    </div>
  </svelte:fragment>
</AdminCard>
```

## Best Practices

1. **Consistent Navigation**: Use breadcrumbs and back buttons consistently
2. **Standardized Cards**: Use AdminCard for all card content
3. **Responsive Design**: The layout is responsive by default
4. **Accessibility**: Follows shadcn-svelte accessibility guidelines

## Integration with Other Components

- Works with shadcn-svelte components
- Compatible with sveltekit-superforms for form handling
- Supports Zod validation
- Works with lucide icons
