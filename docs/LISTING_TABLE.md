Steps
- Starts with zenstack /schema.zmodel
- Look at the model definition
- Create the +table.ts file
- Create the +page.svelte file
- Create the +page.server.ts file 

# Listing Table Implementation Guide

## File Structure
```
admin/
  your-entity/
    +page.svelte      # Main page with AdminPageLayout
    +page.server.ts   # Data loading and actions
    +table.ts         # Table configuration
    table.svelte      # Table component (reusable)
```

## 1. Page Layout with AdminPageLayout

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import AdminPageLayout from '$lib/layouts/AdminPageLayout.svelte';
  import Table from './table.svelte';
  
  export let data;
</script>

<AdminPageLayout title="Your Entities" description="Manage your entities">
  <Table {data} />
</AdminPageLayout>
```

## 2. Table Configuration (+table.ts)

```typescript
import type { DataTableConfig } from '$lib/components/ui_components_sveltekit/table';

export const dataTable: DataTableConfig = {
  rows: [],
  columns: [
    {
      id: 'id',
      label: 'ID',
      sortable: true,
      width: '15%',
      render: (record) => ({
        component: 'NameWithIdLink',
        props: {
          record: { id: record.id, name: record.name },
          baseUrl: '/admin/your-entity',
          showId: true
        }
      })
    },
    {
      id: 'status',
      label: 'Status',
      render: (record) => ({
        component: 'StatusBadge',
        props: { status: record.isActive ? 'active' : 'inactive' }
      })
    },
    {
      id: 'actions',
      label: 'Actions',
      render: (record) => ({
        component: 'RecordActions',
        props: {
          items: [
            {
              label: 'Edit',
              icon: 'Pencil',
              onClick: () => goto(`/admin/your-entity/${record.id}`)
            },
            {
              label: 'Delete',
              icon: 'Trash',
              onClick: () => confirmDelete(record)
            }
          ]
        }
      })
    }
  ]
};
```

## 3. Server-side Data Loading

```typescript
// +page.server.ts
import { error } from '@sveltejs/kit';
import { restrict } from '$lib/utils/security';

export const load = async ({ locals, url }) => {
  await restrict(locals, ['ADMIN']);
  
  const page = Number(url.searchParams.get('page') || 1);
  const perPage = 10;
  
  const [records, total] = await Promise.all([
    locals.prisma.yourEntity.findMany({
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { createdAt: 'desc' }
    }),
    locals.prisma.yourEntity.count()
  ]);

  return {
    records,
    pagination: {
      page,
      per_page: perPage,
      total_records: total,
      total_pages: Math.ceil(total / perPage)
    }
  };
};
```

## 4. Table Component (table.svelte)

### Layout Components

#### Admin Pages
Use `AdminPageLayout` for admin interfaces:

```svelte
<script lang="ts">
  import AdminPageLayout from '$lib/layouts/AdminPageLayout.svelte';
  import Table from './table.svelte';
  export let data;
</script>

<AdminPageLayout title="Admin Title" description="Manage entities">
  <Table {data} />
</AdminPageLayout>
```

#### User Pages
Use `UserPageLayout` for user-facing interfaces:

```svelte
<script lang="ts">
  import UserPageLayout from '$lib/layouts/UserPageLayout.svelte';
  import Table from './table.svelte';
  export let data;
</script>

<UserPageLayout>
  <Table {data} />
</UserPageLayout>
```

### Filter Components

#### DebouncedTextFilter
Use for text search inputs with debouncing:

```svelte
<DebouncedTextFilter
  label="Search"
  placeholder="Search by name..."
  paramName="search"
  debounceMs={300}
/>
```

#### EnhancedPopoverFilter
Enhanced version of PopoverFilter with URL parameter handling built-in:

```svelte
<EnhancedPopoverFilter
  label="Status"
  paramName="status"
  options={[
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' }
  ]}
/>
```

Key features:
- Automatically syncs with URL parameters
- Handles multiple selections
- Resets pagination when filters change
- Preserves filter state on page reload

### Complete Table Example

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { DataTable } from '$lib/components/ui_components_sveltekit/table';
  import DebouncedTextFilter from '$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte';
  import EnhancedPopoverFilter from '$lib/components/ui_components_sveltekit/table/filter/EnhancedPopoverFilter.svelte';
  import { onMount } from 'svelte';

  export let data;

  // Handle URL parameter changes
  $: {
    // React to URL changes
    $page.url.searchParams;
  }
</script>


<div class="space-y-4">
  <div class="flex flex-wrap gap-2 mb-4">
    <DebouncedTextFilter
      label="Search"
      placeholder="Search..."
      paramName="search"
      debounceMs={300}
    />
    
    <EnhancedPopoverFilter
      label="Status"
      paramName="status"
      options={[
        { value: 'ACTIVE', label: 'Active' },
        { value: 'INACTIVE', label: 'Inactive' }
      ]}
    />
  </div>

  <DataTable
    {data}
    on:sort
    on:pageChange
  >
    <!-- Table content -->
  </DataTable>
</div>
```

Key features to include:
- Loading states with LoadingSkeleton
- Filter components (DebouncedTextFilter, EnhancedPopoverFilter)
- Action handlers (delete, toggle status)
- Confirmation dialogs
- Error handling with toast notifications

## Implementation Notes

### Column Configuration
- Use `id` for data binding
- Set `sortable: true` for sortable columns
- Use `width` to control column sizing
- Use `render` for custom cell rendering

### Common Column Renderers

#### 1. Name with ID Link
Creates a clickable name that links to the detail page, optionally showing the ID.

```typescript
{
  id: 'name',
  label: 'Name',
  render: (record) => ({
    component: 'NameWithIdLink',
    props: {
      record: { id: record.id, name: record.name },
      baseUrl: '/path/to/detail',
      showId: true
    }
  })
}
```

#### 2. Status Badge
Displays a colored badge based on status value.

```typescript
{
  id: 'status',
  label: 'Status',
  render: (record) => ({
    component: 'StatusBadge',
    props: { 
      status: record.isActive ? 'active' : 'inactive',
      // Optional: Customize colors
      variant: record.isActive ? 'success' : 'destructive'
    }
  })
}
```

#### 3. Date Display
Formats dates in a user-friendly relative format with tooltip for exact time.

```typescript
{
  id: 'createdAt',
  label: 'Created',
  render: (record) => ({
    component: 'RelativeDate',
    props: { date: record.createdAt }
  })
}
```

#### 4. Boolean Toggle
Shows a toggle switch for boolean values.

```typescript
{
  id: 'isActive',
  label: 'Active',
  render: (record) => ({
    component: 'BooleanToggle',
    props: {
      value: record.isActive,
      onToggle: () => handleToggle(record.id, !record.isActive)
    }
  })
}
```

#### 5. Avatar with Text
Displays an avatar image with text next to it.

```typescript
{
  id: 'user',
  label: 'User',
  render: (record) => ({
    component: 'AvatarWithText',
    props: {
      image: record.avatarUrl,
      text: record.userName,
      subtext: record.email
    }
  })
}
```

#### 6. Record Actions
Shows action buttons (edit, delete, etc.) in a dropdown.

```typescript
{
  id: 'actions',
  label: 'Actions',
  render: (record) => ({
    component: 'RecordActions',
    props: {
      items: [
        {
          label: 'Edit',
          icon: 'Pencil',
          onClick: () => handleEdit(record.id)
        },
        {
          label: 'Delete',
          icon: 'Trash',
          variant: 'destructive',
          onClick: () => handleDelete(record.id)
        }
      ]
    }
  })
}
```

#### 7. Tags List
Displays an array of tags as chips.

```typescript
{
  id: 'tags',
  label: 'Tags',
  render: (record) => ({
    component: 'TagsList',
    props: {
      tags: record.tags,
      maxVisible: 2,
      // Optional: Make tags clickable
      onTagClick: (tag) => filterByTag(tag)
    }
  })
}
```

#### 8. Progress Indicator
Shows a progress bar or circle.

```typescript
{
  id: 'progress',
  label: 'Progress',
  render: (record) => ({
    component: 'ProgressIndicator',
    props: {
      value: record.progress,
      max: 100,
      showPercentage: true
    }
  })
}
```

### Common Patterns
1. **Status Badges**: Use StatusBadge with appropriate status values
2. **Date Display**: Use RelativeDate for user-friendly dates
3. **Actions**: Use RecordActions with icon buttons
4. **Filters**: 
   - Use `DebouncedTextFilter` for search inputs
   - Use `EnhancedPopoverFilter` for multi-select filters with URL sync
   - For simple filters, use the basic `PopoverFilter`
5. **URL Parameters**:
   - Filters automatically sync with URL parameters
   - Use `paramName` to specify the URL parameter name
   - Multiple values are comma-separated in the URL

### Performance Tips
- Implement server-side pagination
- Use debouncing for search inputs
- Load filters asynchronously if needed
- Use Svelte's reactive statements efficiently

### Security
- Always use `restrict` for admin routes
- Validate all user inputs
- Implement proper error handling
- Use CSRF protection for forms

## 5. User Context and Authentication

### Authentication Middleware

The application uses a middleware to handle authentication and set up the user context. The middleware:
- Validates the user's session
- Sets `auth.currentAccount` with the user's current account information
- Enhances the Prisma client with user context for Zenstack's row-level security

### Accessing User Context

In your `+page.server.ts`, access the authenticated user's account information through the `auth` parameter:

```typescript
export const load = restrict(
    async ({ url, locals, auth }) => {
        try {
            // Get the current user's account ID
            const accountId = auth.currentAccount?.account?.id;
            
            if (!accountId) {
                throw error(403, 'No account selected. Please select an account first.');
            }
            
            // Zenstack will automatically apply row-level security based on the user's permissions
            const result = await fetchTableData(locals, url, {
                modelName: 'yourModel',
                searchableFields: ['name', 'description'],
                // ... other options
            });
            
            return {
                records: result.records,
                table_state: result.table_state
            };
        } catch (err) {
            return handleApiError({
                error: err,
                prisma: locals.prisma,
                accountId: auth.currentAccount?.account?.id,
                defaultMessage: 'Failed to load records',
                action: 'loading records'
            });
        }
    },
    ['USER', 'ADMIN'] // Specify allowed roles
) satisfies PageServerLoad;
```

### Error Handling

Use the centralized `handleApiError` utility for consistent error handling:

```typescript
return handleApiError({
    error: err,
    prisma: locals.prisma,
    accountId: auth.currentAccount?.account?.id,
    defaultMessage: 'Failed to perform action',
    action: 'performing action'
});
```

### Key Points

1. **Row-Level Security**: Zenstack automatically filters records based on the user's permissions
2. **Account Context**: Always access the current account through `auth.currentAccount`
3. **Error Handling**: Use centralized error handling for consistency
4. **Role-Based Access**: Specify allowed roles in the `restrict` wrapper
