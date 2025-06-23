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

## 3. Server-side Data Loading with Sorting and Filtering

### Using fetchTableData Utility

For consistent table behavior, use the `fetchTableData` utility which handles:
- Pagination
- Sorting
- Filtering
- Search
- Row-level security

```typescript
// +page.server.ts
import { restrict } from '$lib/server/security/guards';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';

// Define table options
const tableOptions = {
  modelName: 'yourEntity', // Must match Prisma model name
  searchableFields: ['name', 'email'], // Fields to search in
  allowedFilters: ['status', 'type'], // Allowed filter parameters
  defaultSortField: 'createdAt',
  defaultSortOrder: 'desc' as const,
  defaultPerPage: 10,
  // Map URL parameters to database fields
  filterMappings: {
    'status': { 
      field: 'status', 
      operator: 'in',
      valueTransformer: (value: string) => value.toUpperCase()
    },
    'type': { field: 'type', operator: 'equals' }
  },
  // Optional base where clause for additional filtering
  baseWhere: {
    accountId: locals.account?.id // Example: Filter by current account
  }
};

export const load = restrict(
  async ({ url, locals }) => {
    try {
      const result = await fetchTableData(locals, url, tableOptions);
      
      return {
        records: result.records,
        meta: result.meta // Contains pagination, sorting, and filter info
      };
    } catch (error) {
      // Handle errors consistently
      return handleApiError({
        error,
        prisma: locals.prisma,
        defaultMessage: 'Failed to load records',
        action: 'loading records'
      });
    }
  },
  ['USER', 'ADMIN'] // Required roles
);
```

### Response Structure

The server should return:

```typescript
{
  records: T[];         // Array of records
  meta: {
    pagination: {
      page: number;      // Current page
      per_page: number;  // Items per page
      total_records: number;
      total_pages: number;
    };
    sort: {
      field: string;     // Current sort field
      order: 'asc' | 'desc';
    };
    filters: Record<string, any>; // Applied filters
  }
}
```

## 4. Table Component with Sorting (table.svelte)

### Basic Setup

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { handleTableSort, handleTablePagination } from '$lib/components/ui_components_sveltekit/table/pagination/pagination-utils';
  import DataTable from '$lib/components/ui_components_sveltekit/table/DataTable.svelte';
  
  export let data: {
    records: any[];
    meta: {
      pagination: {
        page: number;
        per_page: number;
        total_records: number;
        total_pages: number;
      };
      sort: {
        field: string;
        order: 'asc' | 'desc';
      };
    };
  };

  // Extract data for the table
  $: props = {
    records: data.records,
    pagination: data.meta.pagination,
    sort: data.meta.sort
  };

  // Initialize with URL parameters
  $: initialSort = {
    field: $page.url.searchParams.get('sort') || 'createdAt',
    order: ($page.url.searchParams.get('order') || 'desc') as 'asc' | 'desc'
  };
</script>

<DataTable
  {columns}
  {props}
  on:sort={handleTableSort}
  on:pagination={handleTablePagination}
/>
```

### Column Definition with Sorting

```typescript
const columns = [
  {
    id: 'name',
    label: 'Name',
    sortable: true,  // Make column sortable
    field: 'name',   // Field to sort by (defaults to id if not specified)
    sortKey: 'name', // Optional: use different field for sorting
    width: '25%',
    render: (record) => record.name
  },
  {
    id: 'status',
    label: 'Status',
    sortable: true,
    field: 'status',
    render: (record) => ({
      component: 'StatusBadge',
      props: { 
        status: record.status,
        className: 'capitalize'
      }
    })
  },
  // ... other columns
];
```

### Handling URL Parameters

The table automatically handles URL parameters for:
- `page`: Current page number
- `per_page`: Items per page
- `sort`: Field to sort by
- `order`: Sort direction ('asc' or 'desc')
- Any custom filter parameters

### Client-Side Sorting (if needed)

For client-side sorting, use the `sortedRecords` store:

```svelte
<script>
  import { sortedRecords } from '$lib/stores/table';
  
  $: sorted = sortedRecords($page.url, data.records, {
    sortField: 'name',
    sortOrder: 'asc'
  });
</script>

{#each $sorted as record}
  <!-- Render records -->
{/each}
```

## 5. Best Practices

1. **Consistent Parameter Naming**
   - Use `sort` for sort field
   - Use `order` for sort direction ('asc' or 'desc')
   - Use `page` for current page
   - Use `per_page` for items per page

2. **Server-Side Sorting**
   - Always implement server-side sorting for large datasets
   - Use `fetchTableData` for consistent behavior
   - Validate sort fields against allowed columns

3. **Client-Side State**
   - Keep URL as the single source of truth
   - Use `$page.url` for reading state
   - Use `goto` with `replaceState: true` for updates

4. **Error Handling**
   - Handle invalid sort parameters gracefully
   - Provide default values for missing parameters
   - Log errors with context

5. **Performance**
   - Add database indexes for sortable columns
   - Consider composite indexes for common sort+filter combinations
   - Use cursor-based pagination for very large datasets

## 6. Common Patterns

### Filter Components

#### DebouncedTextFilter
Use for text search with debouncing:

```svelte
<DebouncedTextFilter
  placeholder="Search..."
  paramName="search"
  value={$page.url.searchParams.get('search') || ''}
  debounceMs={300}
  onSearch={(value) => {
    const url = new URL($page.url);
    if (value) {
      url.searchParams.set('search', value);
    } else {
      url.searchParams.delete('search');
    }
    url.searchParams.set('page', '1');
    goto(url.toString(), { replaceState: true });
  }}
/>
```

#### EnhancedPopoverFilter
For filter dropdowns with URL synchronization:

```svelte
<script>
  import { enhance } from '$app/forms';
  
  let selectedValues = [];
  
  // Initialize from URL
  $: if (browser) {
    const params = new URL($page.url).searchParams.get('status');
    selectedValues = params ? params.split(',') : [];
  }
</script>

<EnhancedPopoverFilter
  label="Status"
  options={[
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' }
  ]}
  {selectedValues}
  onChange={(values) => {
    selectedValues = values;
    const url = new URL($page.url);
    if (values.length) {
      url.searchParams.set('status', values.join(','));
    } else {
      url.searchParams.delete('status');
    }
    url.searchParams.set('page', '1');
    goto(url.toString(), { replaceState: true });
  }}
/>
```

## 7. Column Renderers

### StatusBadge
Display status indicators with appropriate colors and labels.

```typescript
{
  id: 'status',
  label: 'Status',
  field: 'status',
  sortable: true,
  render: (record) => ({
    component: 'StatusBadge',
    props: {
      status: record.status,  // 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED' | 'DRAFT'
      value: record.status,  // Alternative to status prop
      className: 'custom-class' // Optional additional classes
    }
  })
}
```

### DateDisplay
Display dates with relative or formatted output.

```typescript
{
  id: 'createdAt',
  label: 'Created',
  field: 'createdAt',
  sortable: true,
  render: (record) => ({
    component: 'DateDisplay',
    props: {
      date: record.createdAt,  // Date | string | null
      format: 'relative',     // 'relative' | 'calendar' | 'full'
      emptyText: 'Never',     // Text to show when date is null
      showTooltip: true,      // Show tooltip on hover
      useHoverCard: false,    // Use hover card instead of tooltip
      iconSize: 14            // Size of the calendar icon
    }
  })
}
```

### NameWithIdLink
Display a clickable name with optional ID and badge.

```typescript
{
  id: 'name',
  label: 'Name',
  field: 'name',
  sortable: true,
  render: (record) => ({
    component: 'NameWithIdLink',
    props: {
      record: {
        id: record.id,
        name: record.name
      },
      baseUrl: '/admin/entities',  // Base URL for the edit link
      idField: 'id',               // Field name for ID
      nameField: 'name',           // Field name for display name
      showId: true,                // Show ID below the name
      showBadge: true,             // Show optional badge
      badgeText: 'Default',         // Badge text
      badgeClass: 'bg-yellow-50 text-yellow-800' // Badge style
    }
  })
}
```

### RecordActions
Display action buttons in a dropdown menu.

```typescript
{
  id: 'actions',
  label: 'Actions',
  width: '100px',
  render: (record) => ({
    component: 'RecordActions',
    props: {
      items: [
        {
          label: 'Edit',
          icon: 'Pencil',
          onClick: () => goto(`/admin/entities/${record.id}/edit`)
        },
        {
          label: 'Delete',
          icon: 'Trash2',
          onClick: () => handleDelete(record.id),
          className: 'text-red-600 hover:bg-red-50'
        }
      ]
    }
  })
}
```

### AlgorithmBadge
Display algorithm information in a badge.

```typescript
{
  id: 'algorithm',
  label: 'Algorithm',
  field: 'algorithm',
  render: (record) => ({
    component: 'AlgorithmBadge',
    props: {
      algorithm: record.algorithm  // Algorithm name/code
    }
  })
}
```

### JwtStatusBadge
Display JWT token status.

```typescript
{
  id: 'tokenStatus',
  label: 'Token Status',
  render: (record) => ({
    component: 'JwtStatusBadge',
    props: {
      isPrimary: record.isPrimary,
      isActive: record.isActive
    }
  })
}
```

### ActionDropdown (Internal)
Internal component used by RecordActions. Not typically used directly.

## 8. Complete Example

### Server-Side (+page.server.ts)

```typescript
import { restrict } from '$lib/server/security/guards';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';

const tableOptions = {
  modelName: 'yourEntity',
  searchableFields: ['name', 'email'],
  allowedFilters: ['status'],
  defaultSortField: 'createdAt',
  defaultSortOrder: 'desc',
  defaultPerPage: 10,
  filterMappings: {
    'status': { 
      field: 'status',
      operator: 'in',
      valueTransformer: (value: string) => value.toUpperCase()
    }
  }
};

export const load = restrict(
  async ({ url, locals }) => {
    try {
      const result = await fetchTableData(locals, url, tableOptions);
      return {
        records: result.records,
        meta: result.meta
      };
    } catch (error) {
      return handleApiError({
        error,
        prisma: locals.prisma,
        defaultMessage: 'Failed to load records',
        action: 'loading records'
      });
    }
  },
  ['USER', 'ADMIN']
);
```

### Page Component (+page.svelte)

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  import UserPageLayout from '$lib/components/user/layout/UserPageLayout.svelte';
  import Table from './table.svelte';
  import { initPagination } from '$lib/components/ui_components_sveltekit/table/pagination/pagination-utils';
  
  export let data: PageData;
  
  // Initialize pagination with stored preferences
  initPagination('preferredPageSize');
  
  // Define breadcrumbs
  const pageCrumbs = [
    ['Your Section', '/your-section'],
    'Your Page'
  ];
  
  const pageTitle = "Your Records";
</script>

<UserPageLayout {pageCrumbs} {pageTitle}>
  <div class="space-y-4">
    <Table {data} />
  </div>
</UserPageLayout>
```

## 8. Best Practices (Continued)

### Performance Optimization

1. **Database Indexing**
   - Add indexes for frequently filtered/sorted columns
   - Consider composite indexes for common query patterns
   ```sql
   CREATE INDEX idx_status_created ON your_entity(status, created_at);
   ```

2. **Query Optimization**
   - Use `select` to fetch only needed fields
   - Implement cursor-based pagination for large datasets
   - Consider materialized views for complex queries

3. **Caching**
   - Implement caching for frequently accessed data
   - Use `stale-while-revalidate` pattern for better UX
   - Cache filter/sort combinations that are commonly used

### Testing

1. **Unit Tests**
   - Test sorting with different field combinations
   - Verify URL parameter handling
   - Test edge cases (empty results, single page, etc.)

2. **Integration Tests**
   - Test full flow from UI to database
   - Verify security restrictions
   - Test with different user roles

3. **Performance Testing**
   - Test with large datasets
   - Monitor query performance
   - Test concurrent user scenarios

### Accessibility

1. **Keyboard Navigation**
   - Ensure sortable columns are focusable
   - Support keyboard shortcuts for common actions
   - Provide visible focus states

2. **Screen Readers**
   - Add ARIA attributes for sortable columns
   - Provide status messages for loading states
   - Ensure proper heading structure

3. **Responsive Design**
   - Test on different screen sizes
   - Implement horizontal scrolling for wide tables
   - Consider card layouts for mobile views

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

## Row Actions

For actions that affect individual rows (like edit, delete, etc.), use the following pattern:

1. **Create API Endpoints** in `+server.ts` for each action
2. **Use the `restrict` wrapper** for authentication and authorization
3. **Leverage error handling utilities** for consistent error responses
4. **Use standardized response formats**

Example for a delete action:

```typescript
// src/routes/api/items/[id]/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { handleApiError } from '$lib/server/errors/errorHandlers';
import { createSuccessResponse } from '$lib/types/api';

export const DELETE = restrict(
    async ({ request, locals, params, auth }) => {
        try {
            const { id } = params;
            
            if (!id) {
                throw error(400, 'Item ID is required');
            }

            // Get the current user's account ID
            const accountId = auth.currentAccount?.account?.id;
            
            if (!accountId) {
                throw error(403, 'No account selected');
            }

            // Delete the item with proper access checks
            await locals.prisma.item.delete({
                where: { 
                    id,
                    accountId // Ensures the item belongs to the user's account
                }
            });

            // Return standardized success response
            return json(createSuccessResponse('Item deleted successfully'));
        } catch (err) {
            // Handle errors consistently
            return handleApiError({
                error: err,
                prisma: locals.prisma,
                accountId: auth.currentAccount?.account?.id,
                defaultMessage: 'Failed to delete item',
                action: 'delete_item'
            });
        }
    },
    ['USER', 'ADMIN'] // Specify allowed roles
) satisfies RequestHandler;
```

### Client-Side Implementation

In your table component, implement the delete handler like this:

```typescript
async function handleDelete(id: string) {
    try {
        const response = await fetch(`/api/items/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to delete item');
        }

        // Show success message
        toast.success(result.text || 'Item deleted successfully');
        
        // Refresh the table data
        await invalidate('table:data');
        
    } catch (err) {
        toast.error(err instanceof Error ? err.message : 'An error occurred');
    }
}
```

### Best Practices

1. **Use HTTP Methods Properly**:
   - `GET` for fetching data
   - `POST` for creating new resources
   - `PUT`/`PATCH` for updates
   - `DELETE` for deletions

2. **Error Handling**:
   - Use `handleApiError` for consistent error responses
   - Include meaningful error messages
   - Log detailed errors server-side

3. **Security**:
   - Always use the `restrict` wrapper
   - Verify ownership of resources
   - Implement proper validation

4. **Performance**:
   - Use proper error boundaries
   - Implement loading states
   - Consider optimistic UI updates

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
