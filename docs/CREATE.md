# Create Resource Guide

This guide covers the implementation of create forms using SvelteKit, Superforms, and Zenstack, following the project's standardized patterns.

## File Structure

```
admin/
  your-entity/
    new/
      +page.svelte      # Create form component
      +page.server.ts   # Form handling and data submission
      +types.ts         # TypeScript types and schemas (optional)
```

## 1. Server-side Implementation (+page.server.ts)

### Required Imports

```typescript
import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { FormValidationError } from '$lib/server/errors/FormValidationError';
import { createSuccessResponse } from '$lib/types/api';
import { yourEntitySchema } from './types';  // Or from shared schema file
```

### Schema Definition

Define your schema in a separate file (recommended) or at the top of your server file:

```typescript
// File: ./types.ts or $lib/schemas/your-entity.ts
import { z } from 'zod';

export const yourEntitySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  // Add other fields with proper validation
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  // Example of date validation
  scheduledAt: z.string().datetime().optional(),
  // Example of number validation with constraints
  waveSize: z.number().int().min(1).default(100),
  // Example of boolean with default
  isActive: z.boolean().default(true)
});

export type YourEntitySchema = typeof yourEntitySchema;
```

### Server Load Function

The load function is used to initialize the form with default values and load any related data needed for the form.

```typescript
export const load = restrict(
    async ({ locals, auth }) => {  // auth is provided by the restrict guard
        try {
            // Create a form with default values
            const form = await superValidate(zod(yourEntitySchema), {
                id: 'your-entity-form',
                defaults: {
                    name: '',
                    description: '',
                    // Set other default values
                }
            });
            
            // Get the authenticated user from the enhanced event
            const userInfo = auth.user;
            
            // Example: Load related data (e.g., account memberships)
            const relatedData = await locals.prisma.someRelatedModel.findMany({
                where: { userId: userInfo.id },
                select: { id: true, name: true }
            });
            
            return { 
                form,
                relatedData,
                // Include any other data needed by the form
            };
        } catch (err) {
            // Log the error and return a user-friendly message
            logger.error(`Error loading form: ${JSON.stringify(err)}`);
            throw error(500, 'Failed to load form');
        }
    },
    [SystemRole.ADMIN]  // Restrict to admin users
) satisfies PageServerLoad;

### Form Action Handler

The form action handles form submissions, validates input, and creates/updates the resource.

```typescript
export const actions: Actions = {
    create: restrict(
        re    // Validate the form data
            const form = await superValidate(request, zod(yourEntitySchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }
            
            try {
                // Get the authenticated user from the enhanced event
                const userInfo = auth.user;
                
                // Example: Look up related data if needed
                let relatedId = form.data.someRelatedId;
                if (!relatedId) {
                    // Handle case where related ID is required but not provided
                    const defaultRelated = await locals.prisma.someRelatedModel.findFirst({
                        where: { userId: userInfo.id },
                        select: { id: true }
                    });
                    
                    if (!defaultRelated) {
                        throw new FormValidationError(
                            'No related item available',
                            'NO_RELATED_ITEM',
                            400
                        );
                    }
                    relatedId = defaultRelated.id;
                }

                // Create the new record
                const newRecord = await locals.prisma.yourModel.create({
                    data: {
                        name: form.data.name,
                        description: form.data.description || null,
                        // Map other fields
                        status: 'DRAFT',
                        createdBy: userInfo.id,
                        updatedBy: userInfo.id,
                        // Add relationships if needed
                        relatedId: relatedId
                    }
                });

                logger.info(`Created new record: ${newRecord.id}`);
                
                // Return success response with the new record's data
                return message(
                    form,
                    createSuccessResponse('Record created successfully!', {
                        details: `Record '${newRecord.name}' has been created.`,
                        data: {
                            id: newRecord.id,
                            name: newRecord.name,
                            // Include other fields needed by the client
                        }
                    })
                );
                
            } catch (err) {
                // Handle any errors that occur during creation
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    defaultMessage: 'Failed to create record. Please try again later.',
                    action: 'create'
                });
            }
        },
        [SystemRole.ADMIN]  // Restrict to admin users
    )
};
```

## Best Practices

### Error Handling

1. **Use FormValidationError** for expected validation errors
2. **Use handleFormError** for consistent error responses
3. **Log errors** with appropriate context
4. **Provide user-friendly messages** while keeping sensitive details in logs

### Security

1. **Always use the restrict guard** to enforce authentication and authorization
2. **Never trust client input** - validate all data
3. **Use Prisma's select** to limit returned fields
4. **Sanitize user input** before displaying it

### Performance

1. **Only select needed fields** from the database
2. **Use pagination** for large data sets
3. **Consider caching** frequently accessed data
4. **Use transactions** for multiple related operations

### Code Organization

1. **Keep schemas separate** from route handlers
2. **Use TypeScript** for type safety
3. **Document complex logic** with comments
4. **Follow consistent naming conventions**

## Example: Complete Implementation

For a complete working example, refer to the bundle creation implementation in:

```
src/routes/admin/iot/bundles/new/+page.server.ts
```

This implementation demonstrates all the patterns and best practices outlined in this guide.
                    // Set default values here
                }
            });
            
            return { form };
        } catch (err) {
            logger.error(`Error loading form: ${JSON.stringify(err)}`);
            throw error(500, 'Failed to load form');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;
```

### Form Action with Enhanced Event

**Best Practice**: Use the enhanced event from the restrict guard to access the authenticated user.

```typescript
export const actions: Actions = {
    create: restrict(
        async ({ request, locals, auth }) => { // Use auth from enhanced event
            // Validate the form data
            const form = await superValidate(request, zod(yourEntitySchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }
            
            try {
                // Get authenticated user directly from the enhanced event
                const userInfo = auth.user; // No need to re-validate auth
                
                // Create the entity
                const entity = await locals.prisma.yourEntity.create({
                    data: {
                        // Your entity fields
                        createdBy: userInfo.id,
                        updatedBy: userInfo.id
                    }
                });
                
                // Return standardized success response
                return message(
                    form,
                    createSuccessResponse('Entity created successfully!', {
                        details: `Entity '${entity.name}' has been created.`,
                        data: {
                            id: entity.id,
                            name: entity.name,
                            // Include other relevant fields
                        }
                    })
                );
            } catch (err) {
                // Use the handleFormError utility for standardized error handling
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    defaultMessage: 'Failed to create entity. Please try again later.',
                    action: 'entity creation'
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    )
};
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