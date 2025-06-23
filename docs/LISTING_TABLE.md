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

Key features to include:
- Loading states with LoadingSkeleton
- Filter components (DebouncedTextFilter, PopoverFilter)
- Action handlers (delete, toggle status)
- Confirmation dialogs
- Error handling with toast notifications

## Implementation Notes

### Column Configuration
- Use `id` for data binding
- Set `sortable: true` for sortable columns
- Use `width` to control column sizing
- Use `render` for custom cell rendering

### Common Patterns
1. **Status Badges**: Use StatusBadge with appropriate status values
2. **Date Display**: Use RelativeDate for user-friendly dates
3. **Actions**: Use RecordActions with icon buttons
4. **Filters**: Use DebouncedTextFilter for search, PopoverFilter for multi-select

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
