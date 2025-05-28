# Create Resource Guide

This guide covers the implementation of create forms using SvelteKit, Superforms, and Zenstack, following the project's standardized patterns.

## File Structure

```
admin/
  your-entity/
    new/
      +page.svelte      # Create form component
      +page.server.ts   # Form handling and data submission
```

## 1. Server-side Implementation (+page.server.ts)

### Schema Definition
```typescript
// $lib/schemas/your-entity.ts
import { z } from 'zod';

export const yourEntitySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  // Add other fields as needed
});
```

### Server Load Function
```typescript
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { yourEntitySchema } from '$lib/schemas/your-entity';

export const load = restrict(
  async ({ locals }) => {
    // Initialize form with defaults
    const form = await superValidate(zod(yourEntitySchema), {
      defaults: {
        name: '',
        description: ''
      }
    });

    // Load any related data needed for the form
    const relatedData = await locals.prisma.relatedModel.findMany();

    return { form, relatedData };
  },
  [SystemRole.ADMIN]
);
```

### Form Action
```typescript
export const actions = {
  default: restrict(
    async ({ request, locals }) => {
      const form = await superValidate(request, zod(yourEntitySchema));
      
      if (!form.valid) {
        return fail(400, { form });
      }

      try {
        const auth = await locals.auth.validate();
        if (!auth?.user) {
          // Throw a FormValidationError that will be caught and handled by handleFormError
          throw new FormValidationError(
            'You must be logged in to perform this action',
            'AUTH_REQUIRED',
            401
          );
        }

        // Create the record
        const record = await locals.prisma.yourEntity.create({
          data: {
            ...form.data,
            createdById: auth.user.id
          }
        });

        // Return success response with detailed message and data
        return message(
          form,
          createSuccessResponse('Resource created successfully!', {
            details: `Resource '${record.name}' has been created.`,
            data: {
              id: record.id,
              // Include other relevant fields that might be needed after creation
              ...(record.name && { name: record.name }),
              ...(record.createdAt && { createdAt: record.createdAt })
            }
          })
        );
      } catch (err) {
        return handleFormError({
          error: err,
          form,
          prisma: locals.prisma,
          defaultMessage: 'Failed to create resource',
          action: 'create'
        });
      }
    },
    [SystemRole.ADMIN]
  )
};
```

## 2. Form Components

### FormContainer

`FormContainer` is a wrapper component that provides consistent form styling and behavior:

```svelte
<FormContainer
  method="POST"
  action="?/actionName"
  {enhance}
  novalidate
  errorMessage={$errorMessage}
>
  <!-- Form fields go here -->
</FormContainer>
```

**Props:**
- `method`: HTTP method (usually "POST" for form submissions)
- `action`: Form action URL with SvelteKit action name
- `enhance`: From `createFormHandler` for progressive enhancement
- `novalidate`: Disables browser validation (use Zod validation instead)
- `errorMessage`: Global error message to display above the form

### ActionButton in Forms

Action buttons in forms should be defined in the `actionButtons` prop of `AdminPageLayout` for consistent placement and styling:

```svelte
<AdminPageLayout
  {title}
  {pageCrumbs}
  actionButtons={[
    // Cancel button - returns to previous page
    {
      label: 'Cancel',
      icon: ArrowLeft,  // Import from 'lucide-svelte'
      onClick: () => goto('/admin/resource'),
      variant: 'outline',
      class: 'h-9'  // Fixed height for consistency
    },
    // Primary action button (e.g., Save, Create)
    {
      label: 'Save',
      icon: Save,  // Import from 'lucide-svelte'
      variant: 'default',
      class: 'h-9',
      disabled: $submitting,
      // Programmatic form submission
      onClick: () => {
        const form = document.querySelector('form[action^="?/"]');
        if (form) form.requestSubmit();
      }
    },
    // Additional actions (e.g., Save & New)
    {
      label: 'Save & New',
      icon: Plus,
      variant: 'outline',
      class: 'h-9',
      disabled: $submitting,
      onClick: async () => {
        const form = document.querySelector('form[action^="?/"]');
        if (form) {
          // Add a hidden field to indicate save and new
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = 'saveAndNew';
          input.value = 'true';
          form.appendChild(input);
          form.requestSubmit();
        }
      }
    }
  ]}
>
  <!-- Page content -->
</AdminPageLayout>
```

**ActionButton Props:**
- `label`: Button text
- `icon`: Icon component from lucide-svelte
- `variant`: 'default' | 'outline' | 'destructive' | 'ghost' | 'link'
- `disabled`: Boolean to disable the button
- `class`: Additional CSS classes
- `onClick`: Click handler function
- `type`: Button type ('button' | 'submit' | 'reset')
- `form`: Form ID for submit buttons

**Best Practices:**
1. Always include a Cancel button that returns to the previous page
2. Use consistent button heights (h-9)
3. Disable buttons during form submission
4. Use appropriate icons for actions
5. For form submission, prefer using the form's submit event over individual button clicks
6. Use variant='outline' for secondary actions
7. For destructive actions, use variant='destructive'

### FormRow and FormField

`FormRow` and `FormField` components help create consistent form layouts:

```svelte
<FormRow columns={2}>  <!-- Number of columns (1-4) -->
  <FormField 
    id="fieldName" 
    label="Field Label" 
    error={$errors.fieldName} 
    required={true}
  >
    <Input
      id="fieldName"
      name="fieldName"
      bind:value={$form.fieldName}
      placeholder="Enter value"
      aria-invalid={$errors.fieldName ? 'true' : undefined}
      disabled={$submitting}
    />
    <p class="text-xs text-muted-foreground mt-1">
      Helpful hint or description
    </p>
  </FormField>
</FormRow>
```

**FormRow Props:**
- `columns`: Number of columns (1-4) for responsive grid layout
- `class`: Additional CSS classes

**FormField Props:**
- `id`: Unique ID for the field (must match input id)
- `label`: Field label text
- `error`: Error message (from form handler)
- `required`: Whether the field is required
- `class`: Additional CSS classes

## 3. Create Form Component (+page.svelte)

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
  
  export let data;
  
  // Page configuration
  const title = 'Create New Resource';
  const pageCrumbs = [
    ['Admin', '/admin'],
    ['Your Section', '/admin/your-section'],
    ['Resources', '/admin/your-section/resources'],
    'Create New'
  ];
  
  // Initialize form handler
  const { form, errors, enhance, submitting, errorMessage } = createFormHandler(data.form, {
    successRedirect: '/admin/your-section/resources',
    validateOnInput: true,
    onSuccess: () => {
      toast.success('Resource created successfully!');
    }
  });
</script>

<AdminPageLayout
  {title}
  crumbs={pageCrumbs}
  actionButtons={[
    {
      label: 'Cancel',
      icon: ArrowLeft,
      href: '/admin/your-section/resources',
      variant: 'outline',
      class: 'h-9'  // Fixed height for consistency
    },
    {
      label: 'Save',
      icon: Save,
      type: 'submit',
      form: 'create-form',
      class: 'h-9',  // Fixed height for consistency
      disabled: $submitting
    }
  ]}
  compact={true}
  contentSpacing="space-y-4"
>
  <AdminCard
    title="Resource Details"
    description="Fill in the details below to create a new resource"
    icon={Plus}
    compact={true}
  >
        <FormContainer
  method="POST"
  action="?/createResource"
  {enhance}
  novalidate
  errorMessage={$errorMessage}
>
  <div class="space-y-6">
          <div class="space-y-2">
            <Label for="name">Name</Label>
            <Input 
              id="name"
              name="name"
              bind:value={$form.name}
              error={$errors.name}
            />
            {#if $errors.name}
              <p class="text-sm text-destructive mt-1">{$errors.name}</p>
            {/if}
          </div>
          
          <div class="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              on:click={() => goto('/admin/your-section/resources')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={$submitting}>
              {#if $submitting}
                <RefreshCw class="mr-2 h-4 w-4 animate-spin" />
              {/if}
              Create Resource
            </Button>
          </div>
      </div>
    </FormContainer>
  </AdminCard>
</AdminPageLayout>
```

## Error Handling

### Throwing Form Validation Errors

When validation fails or access is denied, throw a `FormValidationError` with a clear message and error code:

```typescript
throw new FormValidationError(
  'You must be logged in to perform this action',
  'AUTH_REQUIRED',  // Unique error code
  401               // HTTP status code
);
```

### Handling Errors Consistently

Use the `handleFormError` utility to handle all form errors in a consistent way:

```typescript
import { handleFormError } from '$lib/utils/form-errors';

// In your action:
try {
  // Your form processing logic here
} catch (err) {
  return handleFormError({
    error: err,                    // The caught error
    form,                         // The form object
    prisma: locals.prisma,        // Prisma client for database operations
    defaultMessage: 'Failed to create resource. Please try again later.',
    action: 'resource creation'   // Description of the action for logging
  });
}
```

### Error Response Structure

All error responses follow a consistent structure:
- `success: false`
- `message`: User-friendly error message
- `code`: Machine-readable error code (e.g., 'AUTH_REQUIRED')
- `details`: Additional error details (if any)
- `fieldErrors`: Object containing field-specific validation errors

## Best Practices

1. **Form Validation**
   - Use Zod for schema validation
   - Provide clear error messages
   - Validate on both client and server

2. **Error Handling**
   - Use `handleFormError` for consistent error handling
   - Show user-friendly error messages
   - Log detailed errors server-side

3. **UI/UX**
   - Follow the standard layout pattern
   - Use shadcn-svelte components
   - Show loading states during submission
   - Provide clear success/error feedback

4. **Security**
   - Always use `restrict` for route protection
   - Validate all inputs on the server
   - Use CSRF protection

5. **Accessibility**
   - Use proper form labels
   - Ensure keyboard navigation works
   - Include ARIA attributes where needed