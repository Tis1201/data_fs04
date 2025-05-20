/**
 * Standardized error handling utilities for server-side code
 */
import { logger } from '$lib/server/logger';
import { createErrorResponse, type ApiErrorResponse } from '$lib/types/api';
import type { PrismaClient } from '@prisma/client';
import { message, type SuperValidated } from 'sveltekit-superforms/server';

/**
 * Options for handling Zenstack/Prisma errors
 */
export interface ErrorHandlerOptions {
  /** The error object to process */
  error: unknown;
  /** Optional account ID to provide more context for access policy violations */
  accountId?: string;
  /** Optional Prisma client for looking up account information */
  prisma?: PrismaClient;
  /** Optional request ID for tracking errors */
  requestId?: string;
  /** Default error message if none can be determined */
  defaultMessage?: string;
  /** Whether to include stack traces in the response (defaults to false in production) */
  includeStack?: boolean;
}

/**
 * Process a Zenstack/Prisma error and return a standardized error response
 * Handles access policy violations, validation errors, and other common error types
 */
export async function handleZenstackError(options: ErrorHandlerOptions): Promise<ApiErrorResponse> {
  const { 
    error, 
    accountId, 
    prisma, 
    requestId,
    defaultMessage = 'An error occurred while processing your request',
    includeStack = process.env.NODE_ENV !== 'production'
  } = options;
  
  // Default error information
  let errorText = defaultMessage;
  let errorDetails = '';
  let errorCode = 'SERVER_ERROR';
  let stack: string | undefined = undefined;
  
  if (error instanceof Error) {
    // Extract stack trace if allowed
    if (includeStack) {
      stack = error.stack;
    }
    
    // Check if it's an access policy error
    if (error.message.includes('access policy') || 
        error.message.includes('denied by policy') || 
        error.message.includes('access denied')) {
      
      errorText = `Access denied: You don't have permission to perform this action.`;
      errorCode = 'ACCESS_POLICY_VIOLATION';
      errorDetails = error.message;
      
      // Add more context for the user if account ID and prisma client are provided
      if (accountId && prisma) {
        try {
          const account = await prisma.account.findUnique({
            where: { id: accountId },
            select: { name: true }
          });
          
          if (account) {
            errorText = `Access denied: You don't have permission to perform this action in the "${account.name}" account.`;
          }
        } catch (lookupError) {
          // If account lookup fails, just use the generic message
          logger.warn(`Failed to look up account for error context: ${lookupError}`);
        }
      }
    } else if (error.message) {
      // Use the actual error message as details
      errorDetails = error.message;
    }
    
    // Log the detailed error for debugging
    logger.error(`Detailed error: ${JSON.stringify(error)}`);
    
    // Try to extract more information if it's a Prisma error
    if ('code' in error && error.code) {
      errorCode = `PRISMA_${error.code}`;
      logger.error(`Prisma error code: ${error.code}`);
      
      // Provide more user-friendly messages for common Prisma errors
      switch (error.code) {
        case 'P2002':
          errorText = 'A record with this information already exists.';
          break;
        case 'P2025':
          errorText = 'The requested record was not found.';
          break;
        case 'P2003':
          errorText = 'This operation would violate a foreign key constraint.';
          break;
      }
    }
  } else if (typeof error === 'string') {
    errorDetails = error;
  }
  
  return createErrorResponse(errorText, {
    details: errorDetails,
    code: errorCode,
    requestId,
    stack
  });
}

/**
 * Handle form submission errors with file uploads
 * Cleans the form data to remove file objects that can't be serialized
 */
export function cleanFormData<T extends Record<string, any>>(formData: T): T {
  // Create a deep copy of the form data
  const cleanedData = { ...formData };
  
  // If there's a data property (as in SuperForms), clean it separately
  if (cleanedData.data && typeof cleanedData.data === 'object') {
    cleanedData.data = { ...cleanedData.data };
    
    // Remove file objects that can't be serialized
    for (const key in cleanedData.data) {
      const value = cleanedData.data[key];
      if (value instanceof File || 
          (value && typeof value === 'object' && 'arrayBuffer' in value)) {
        delete cleanedData.data[key];
      }
    }
  }
  
  return cleanedData;
}

/**
 * Options for the catch-all form error handler
 */
export interface FormErrorHandlerOptions<T extends Record<string, any>> {
  /** The error that was caught */
  error: unknown;
  /** The form data to clean and return */
  form: SuperValidated<T>;
  /** The Prisma client for looking up related information */
  prisma: PrismaClient;
  /** Optional account ID for access policy violations */
  accountId?: string;
  /** Default error message if none can be determined */
  defaultMessage?: string;
  /** HTTP status code to return (default: 500) */
  status?: number;
  /** Optional request ID for tracking errors */
  requestId?: string;
  /** Optional action name for logging context */
  action?: string;
}

/**
 * Catch-all form error handler for SvelteKit actions
 * Handles cleaning form data, processing errors, and returning appropriate messages
 */
export async function handleFormError<T extends Record<string, any>>(
  options: FormErrorHandlerOptions<T>
) {
  const {
    error,
    form,
    prisma,
    accountId,
    defaultMessage = 'An error occurred while processing your request',
    status = 500,
    requestId,
    action = 'form submission'
  } = options;
  
  // Log the error with context
  logger.error(`Error in ${action}: ${error}`);
  
  // Clean the form data to remove file objects that can't be serialized
  const cleanForm = cleanFormData(form);
  
  // Process the error to get a standardized error response
  const errorResponse = await handleZenstackError({
    error,
    accountId,
    prisma,
    requestId,
    defaultMessage
  });
  
  // Return the message with the cleaned form and error response
  return message(
    cleanForm,
    errorResponse,
    { status }
  );
}
