import { invalidate } from '$app/navigation';
import { toast } from 'svelte-sonner';
import { writable, derived } from 'svelte/store';

/**
 * Simple utility functions for form handling best practices
 */

/**
 * Standard SuperForms configuration for detail pages
 */
export const getDetailPageFormConfig = (entityName: string) => ({
  // Disable browser's default alert - we'll handle this with custom dialog
  taintedMessage: null,
  invalidateAll: true,
  resetForm: false,
  delayMs: 500,
  timeoutMs: 8000,
  
  onResult: async ({ result }: any) => {
    if (result.type === "success") {
      toast.success(`${entityName} updated successfully!`, {
        description: "All changes have been saved.",
        duration: 4000
      });
    } else if (result.type === "failure") {
      if (result.data?.form?.message) {
        toast.error("Validation Error", {
          description: result.data.form.message.text || "Please check your input and try again.",
          duration: 6000
        });
      } else {
        toast.error(`Failed to update ${entityName.toLowerCase()}`, {
          description: "Please check your input and try again.",
          duration: 6000
        });
      }
    } else if (result.type === "error") {
      toast.error("Server Error", {
        description: "An unexpected error occurred. Please try again later.",
        duration: 6000
      });
    }
  },
  
  onError: ({ result }: any) => {
    console.error("Form submission error:", result);
    toast.error("Connection Error", {
      description: "Unable to connect to the server. Please check your connection and try again.",
      duration: 6000
    });
  },
  
  onSubmit: ({ formData }: any) => {
    console.log("Form submitting with data:", Object.fromEntries(formData));
  }
});

/**
 * Reusable navigation guard hook for forms with unsaved changes
 * Returns everything needed to implement custom confirmation dialogs
 */
export const useNavigationGuard = (entityName: string) => {
  // Dialog state stores for reactive binding
  const dialogOpen = writable(false);
  const dialogTitle = writable('');
  const dialogDescription = writable('');
  
  // Internal state for pending navigation
  let pendingNavigationFn: (() => Promise<void> | void) | null = null;

  // Navigation guard function that can be called directly
  const guardedNavigate = (hasChanges: boolean, navigationFn: () => Promise<void> | void) => {
    if (hasChanges) {
      // Store the navigation function and show dialog
      pendingNavigationFn = navigationFn;
      dialogTitle.set("Unsaved Changes");
      dialogDescription.set(`You have unsaved changes to this ${entityName.toLowerCase()}. Are you sure you want to leave without saving?`);
      dialogOpen.set(true);
    } else {
      // No changes, navigate immediately
      navigationFn();
    }
  };

  // Handle dialog confirm
  const handleConfirm = async () => {
    dialogOpen.set(false);
    if (pendingNavigationFn) {
      await pendingNavigationFn();
      pendingNavigationFn = null;
    }
  };

  // Handle dialog cancel
  const handleCancel = () => {
    dialogOpen.set(false);
    pendingNavigationFn = null;
  };

  // Return everything the component needs
  return {
    // Stores for reactive binding
    dialogOpen,
    dialogTitle, 
    dialogDescription,
    
    // Main navigation guard function
    guardedNavigate,
    
    // Dialog handlers
    handleConfirm,
    handleCancel,
    
    // Pre-configured dialog props
    getDialogProps: () => ({
      confirmText: "Leave without saving",
      cancelText: "Stay on page"
    })
  };
};

/**
 * Enhanced SuperForms configuration that includes navigation guard reset
 */
export const getDetailPageFormConfigWithGuard = (entityName: string, resetTainted: () => void) => ({
  ...getDetailPageFormConfig(entityName),
  onResult: async ({ result }: any) => {
    // Call the default onResult first
    const defaultConfig = getDetailPageFormConfig(entityName);
    if (defaultConfig.onResult) {
      await defaultConfig.onResult({ result });
    }
    
    // Reset tainted state on successful submission to prevent confirmation dialog
    if (result.type === "success") {
      resetTainted();
    }
  }
});

/**
 * Get field props for consistent styling and accessibility
 */
export const getFieldProps = (errors: any, fieldName: string, isLoading: boolean) => ({
  disabled: isLoading,
  'aria-invalid': errors[fieldName] ? true : undefined,
  class: errors[fieldName] ? 'border-destructive focus:border-destructive' : ''
});

/**
 * Get select field props for consistent styling and accessibility
 */
export const getSelectProps = (errors: any, fieldName: string, isLoading: boolean) => ({
  disabled: isLoading,
  'aria-invalid': errors[fieldName] ? true : undefined,
  className: errors[fieldName] ? 'border-destructive' : ''
});

/**
 * Create standard action buttons for detail pages
 */
export const createDetailPageActions = (
  entityName: string,
  listUrl: string,
  formAction: string,
  isLoading: boolean,
  hasErrors: boolean,
  delayed: any,
  goto: (url: string) => void
) => [
  {
    label: "Cancel",
    onClick: () => goto(listUrl),
    variant: "outline" as const,
    disabled: isLoading
  },
  {
    label: isLoading ? (delayed ? "Saving..." : "Processing...") : "Save Changes",
    onClick: () => {
      const form = document.querySelector(`form[action="${formAction}"]`);
      if (form) (form as HTMLFormElement).requestSubmit();
    },
    disabled: isLoading || hasErrors,
    loading: isLoading
  }
];

/**
 * Process form messages for FormContainer (only error messages)
 * Success messages are handled via toast notifications
 */
export const processFormMessages = (message: any) => {
  const errorMessage = message?.type === 'error' ? { 
    text: message.text || 'An error occurred',
    details: message.details,
  } : null;

  return { errorMessage };
}; 
