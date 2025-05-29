# Update Resource Guide

This guide covers the implementation of update forms using SvelteKit, Superforms, and Zenstack, following the project's standardized patterns.

## File Structure

```
admin/
  your-entity/
    [id]/
      +page.svelte      # Update form component
      +page.server.ts   # Form handling and data submission
```

## 1. Server-side Implementation (+page.server.ts)

### Load Function
```typescript
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { yourEntitySchema } from '$lib/schemas/your-entity';

export const load = restrict(
  async ({ params, locals }) => {
    const { id } = params;

    try {
      // Fetch the entity by ID
      const entity = await locals.prisma.yourEntity.findUnique({
        where: { id },
        include: {
          // Include related data as needed
          relatedModel: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
      
      if (!entity) {
        throw error(404, {
          message: 'Entity not found',
          code: 'ENTITY_NOT_FOUND'
        });
      }
      
      // Create form data from existing entity
      const formData = {
        name: entity.name,
        description: entity.description || '',
        // Add other fields as needed
      };
      
      const form = await superValidate(formData, zod(yourEntitySchema));
      
      // Load any additional data needed for the form
      const relatedData = await locals.prisma.relatedModel.findMany();
      
      return {
        form,
        entity,
        relatedData,
        meta: {
          title: `Edit: ${entity.name}`,
          description: `Edit ${entity.name}`
        }
      };
    } catch (err) {
      console.error(`Error loading entity ${id}:`, err);
      throw error(500, {
        message: 'Failed to load entity',
        code: 'ENTITY_LOAD_ERROR'
      });
    }
  },
  [SystemRole.ADMIN]
);
```

### Update Action
```typescript
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { message } from 'sveltekit-superforms/server';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { createSuccessResponse } from '$lib/types/api';
import { FormValidationError } from '$lib/server/errors/FormValidationError';

export const actions: Actions = {
  updateEntity: restrict(
    async ({ params, locals, request }) => {
      const { id } = params;
      
      // Validate form data
      const form = await superValidate(request, zod(yourEntitySchema));
      
      if (!form.valid) {
        return fail(400, { form });
      }
      
      try {
        // Fetch the existing entity
        const existingEntity = await locals.prisma.yourEntity.findUnique({
          where: { id }
        });
        
        if (!existingEntity) {
          throw new FormValidationError(
            'Entity not found',
            'ENTITY_NOT_FOUND',
            404
          );
        }
        
        // Get authenticated user info
        const auth = await locals.auth.validate();
        if (!auth?.user) {
          throw new FormValidationError(
            'You must be logged in to update this entity',
            'AUTH_REQUIRED',
            401
          );
        }

        // Create update object
        const { data } = form;
        const updateData = {
          name: data.name,
          description: data.description || null,
          // Add other fields as needed
          
          // For relations, use the connect pattern
          relatedModel: data.relatedModelId ? {
            connect: { id: data.relatedModelId }
          } : undefined
        };

        // Update the entity
        const entity = await locals.prisma.yourEntity.update({
          where: { id },
          data: updateData
        });
        
        // Return success response
        return message(
          form,
          createSuccessResponse('Entity updated successfully!', {
            details: `Entity '${entity.name}' has been updated.`,
            data: {
              id: entity.id,
              name: entity.name
            }
          })
        );
      } catch (err) {
        return handleFormError({
          error: err,
          form,
          prisma: locals.prisma,
          defaultMessage: 'Failed to update entity. Please try again later.',
          action: 'entity update'
        });
      }
    },
    [SystemRole.ADMIN]
  ),
  
  deleteEntity: restrict(
    async ({ params, locals }) => {
      const { id } = params;
      
      try {
        // Check if the entity exists
        const entity = await locals.prisma.yourEntity.findUnique({
          where: { id }
        });
        
        if (!entity) {
          return fail(404, { error: 'Entity not found' });
        }
        
        // Delete the entity
        await locals.prisma.yourEntity.delete({
          where: { id }
        });
        
        return createSuccessResponse('Entity deleted successfully', {
          details: `Entity '${entity.name}' has been deleted.`
        });
      } catch (err) {
        console.error(`Error deleting entity:`, err);
        return fail(500, { 
          error: 'Failed to delete entity: ' + (err instanceof Error ? err.message : 'Unknown error')
        });
      }
    },
    [SystemRole.ADMIN]
  )
};
```

## 2. Update Form Component (+page.svelte)

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { ArrowLeft, Save, Trash2 } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';
  
  // Import layout components
  import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
  import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
  import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
  import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
  
  // Import form components
  import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
  import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
  import * as Select from "$lib/components/ui/select";
  import { createFormHandler } from "$lib/components/ui_components_sveltekit/form/utils/formHandler";
  
  export let data;
  const { entity, relatedData } = data;
  
  // Create form handler
  const { form, errors, enhance, submitting, errorMessage } = createFormHandler(data.form, {
    successRedirect: '/admin/your-section/entities',
    validateOnInput: true,
    onSuccess: (result) => {
      toast.success(result.data?.message || 'Entity updated successfully');
    }
  });
  
  // Format date for display
  function formatDate(date) {
    return date ? new Date(date).toLocaleString() : 'Not available';
  }
  
  // Define breadcrumbs for this page
  const pageCrumbs = [
    ["Admin", "/admin"],
    ["Your Section", "/admin/your-section"],
    ["Entities", "/admin/your-section/entities"],
    entity.name
  ];
  
  // Handle delete
  function deleteEntity() {
    if (confirm('Are you sure you want to delete this entity? This action cannot be undone.')) {
      document.getElementById('deleteForm').submit();
    }
  }
  
  const title = `Edit: ${entity.name}`;
</script>

<AdminPageLayout
  {title}
  crumbs={pageCrumbs}
  actionButtons={[
    {
      label: "Back",
      icon: ArrowLeft,
      onClick: () => goto('/admin/your-section/entities'),
      variant: "outline",
      class: "h-9"
    },
    {
      label: "Delete",
      icon: Trash2,
      onClick: deleteEntity,
      variant: "destructive",
      class: "h-9"
    },
    {
      label: "Save",
      icon: Save,
      onClick: () => {
        const form = document.querySelector('form[action="?/updateEntity"]');
        if (form) form.requestSubmit();
      },
      class: "h-9",
      disabled: $submitting
    }
  ]}
  compact={true}
  contentSpacing="space-y-6"
>
  <div class="w-full space-y-6">
    <FormContainer
      method="POST"
      action="?/updateEntity"
      {enhance}
      novalidate
      errorMessage={$errorMessage}
    >
      <AdminCard
        title="Entity Details"
        description="Update entity information"
        icon={Save}
        compact={true}
      >
        <!-- Form Fields -->
        <div class="space-y-6">
          <FormRow columns={2}>
            <FormField 
              id="name" 
              label="Name" 
              error={$errors.name}
              required={true}
            >
              <Input 
                id="name" 
                name="name" 
                bind:value={$form.name}
                placeholder="Enter name"
                disabled={$submitting}
              />
            </FormField>
            
            <FormField 
              id="relatedModelId" 
              label="Related Model"
              error={$errors.relatedModelId}
            >
              <EnhancedSelect
                name="relatedModelId"
                id="relatedModelId"
                bind:value={$form.relatedModelId}
                placeholder="Select related model"
                disabled={$submitting}
              >
                {#each relatedData as item}
                  <Select.Item value={item.id}>
                    {item.name}
                  </Select.Item>
                {/each}
              </EnhancedSelect>
            </FormField>
          </FormRow>

          <FormRow>
            <FormField 
              id="description" 
              label="Description"
              error={$errors.description}
            >
              <Textarea 
                id="description" 
                name="description" 
                bind:value={$form.description}
                placeholder="Enter description"
                disabled={$submitting}
                rows={3}
              />
            </FormField>
          </FormRow>
        </div>
        
        <svelte:fragment slot="footer">
          <MetadataFooter
            items={[
              { label: "Created", date: entity.createdAt, icon: 'calendar' },
              { label: "Last Updated", date: entity.updatedAt, icon: 'clock' },
              { label: "ID", value: entity.id.substring(0, 8) + '...', icon: 'tag' }
            ]}
          />
        </svelte:fragment>
      </AdminCard>
    </FormContainer>
  </div>
</AdminPageLayout>

<!-- Hidden form for entity deletion -->
<form 
  id="deleteForm" 
  method="POST" 
  action="?/deleteEntity" 
  use:enhance={() => {
    return ({ result }) => {
      if (result.type === 'success') {
        toast.success('Entity deleted successfully');
        goto('/admin/your-section/entities');
      } else if (result.type === 'failure') {
        toast.error(result.data?.error || 'Failed to delete entity');
      }
    };
  }}
  class="hidden"
></form>
```

## Best Practices

### 1. Data Loading

- Always fetch the entity by ID in the load function
- Include related data needed for the form
- Handle 404 errors properly when entity doesn't exist
- Pre-populate the form with existing data

### 2. Relation Handling

- Use Prisma's nested update pattern for relations:
  ```typescript
  relatedModel: {
    connect: { id: data.relatedModelId }
  }
  ```
- Never update foreign key fields directly (e.g., `relatedModelId: data.relatedModelId`)

### 3. Form Structure

- Use `AdminPageLayout` with proper breadcrumbs
- Implement action buttons for save, delete, and back navigation
- Use `FormContainer` with error handling
- Organize fields with `FormRow` and `FormField`

### 4. Error Handling

- Use `FormValidationError` for structured errors
- Implement `handleFormError` for consistent error responses
- Display clear error messages to users

### 5. Security

- Always use `restrict` for route protection
- Validate user permissions before updates
- Verify entity existence before updates

### 6. UX Considerations

- Show loading states during submission
- Provide confirmation for destructive actions
- Display success/error notifications
- Include metadata about the entity (created date, updated date)

### 7. Accessibility

- Use proper labels and ARIA attributes
- Ensure keyboard navigation works
- Provide clear error states and messages