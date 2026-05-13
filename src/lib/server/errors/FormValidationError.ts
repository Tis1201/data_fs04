/**
 * Custom error class for form validation errors
 * This provides a structured way to handle form validation errors
 * and integrates with the handleFormError utility
 */
export class FormValidationError extends Error {
  code: string;
  status: number;
  
  /**
   * Create a new form validation error
   * @param message The error message
   * @param code The error code (used for client-side handling)
   * @param status The HTTP status code to return
   */
  constructor(message: string, code: string = 'VALIDATION_ERROR', status: number = 400) {
    super(message);
    this.name = 'FormValidationError';
    this.code = code;
    this.status = status;
    
    // This is needed to make instanceof work correctly in TypeScript
    Object.setPrototypeOf(this, FormValidationError.prototype);
  }
}
