/**
 * Standardized error handling utilities for server-side code
 */
import { logger } from '$lib/server/logger';
import { createErrorResponse, type ApiErrorResponse } from '$lib/types/api';
import { FormValidationError } from './FormValidationError';
import type { PrismaClient } from '@prisma/client';
import { message, type SuperValidated } from 'sveltekit-superforms/server';
import { json, type HttpError } from '@sveltejs/kit';

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
  
  // Check if this is a FormValidationError and use its specific properties
  let errorStatus = status;
  let errorCode = undefined;
  let errorMessage = defaultMessage;
  
  if (error instanceof FormValidationError) {
    errorStatus = error.status;
    errorCode = error.code;
    errorMessage = error.message;
    
    // Log the validation error with more context
    logger.warn(`Form validation error in ${action}: ${error.message} (code: ${error.code})`);
  }
  
  // Process the error to get a standardized error response
  const errorResponse = await handleZenstackError({
    error,
    accountId,
    prisma,
    requestId,
    defaultMessage: errorMessage
  });
  
  // Override the error code if we have a specific one from FormValidationError
  if (errorCode) {
    errorResponse.code = errorCode;
  }
  
  // Return the message with the cleaned form and error response
  return message(
    cleanForm,
    errorResponse,
    { status: errorStatus }
  );
}

/**
 * Options for the API error handler
 */
export interface ApiErrorHandlerOptions {
  /** The error that was caught */
  error: unknown;
  /** The Prisma client for looking up related information */
  prisma?: PrismaClient;
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
 * Standardized API error handler for SvelteKit endpoints
 * Processes errors and returns a consistent JSON response format
 */
export async function handleApiError(
  options: ApiErrorHandlerOptions
) {
  const {
    error,
    prisma,
    accountId,
    defaultMessage = 'An error occurred while processing your request',
    status = 500,
    requestId,
    action = 'API request'
  } = options;
  
  // Log the error with context
  logger.error(`Error in ${action}: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.stack) {
    logger.debug(`Stack trace: ${error.stack}`);
  }
  
  // Determine the appropriate status code
  let errorStatus = status;
  
  // Handle HTTP errors from SvelteKit
  if (error && typeof error === 'object' && 'status' in error) {
    const httpError = error as HttpError;
    errorStatus = httpError.status || errorStatus;
  }
  
  // Process the error to get a standardized error response
  const errorResponse = await handleZenstackError({
    error,
    accountId,
    prisma,
    requestId,
    defaultMessage
  });
  
  // Return a standardized JSON response
  return json({
    success: false,
    error: errorResponse.text,
    details: errorResponse.details || undefined,
    code: errorResponse.code || undefined,
    requestId: errorResponse.requestId || undefined,
    timestamp: errorResponse.timestamp
  }, { status: errorStatus });
}

/**
 * Options for the combined form and API error handler
 */
export interface FormApiErrorHandlerOptions<T extends Record<string, any>> extends FormErrorHandlerOptions<T> {
  /** Whether to return an API-style JSON response instead of a form message */
  apiResponse?: boolean;
}

/**
 * Combined form and API error handler
 * Can return either a form error message or an API-style JSON response
 * Useful for form actions that may be called via API or form submission
 */
export async function handleFormApiError<T extends Record<string, any>>(
  options: FormApiErrorHandlerOptions<T>
) {
  const {
    error,
    form,
    prisma,
    accountId,
    defaultMessage = 'An error occurred while processing your request',
    status = 500,
    requestId,
    action = 'form submission',
    apiResponse = false
  } = options;
  
  // Log the error with context
  logger.error(`Error in ${action}: ${error instanceof Error ? error.message : String(error)}`);
  
  if (apiResponse) {
    // Return an API-style JSON response
    return handleApiError({
      error,
      prisma,
      accountId,
      defaultMessage,
      status,
      requestId,
      action
    });
  } else {
    // Return a form error message
    return handleFormError({
      error,
      form,
      prisma,
      accountId,
      defaultMessage,
      status,
      requestId,
      action
    });
  }
}
