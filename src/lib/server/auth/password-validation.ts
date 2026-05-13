import { getSetting } from '../settings/utils';
import { logger } from '../logger';

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
  requirements?: string[];
}

/**
 * Validates a password based on the enforceStrongPasswords setting.
 * If enforceStrongPasswords is true, applies strict validation.
 * If false, only requires non-empty password.
 */
export async function validatePassword(password: string): Promise<PasswordValidationResult> {
  try {
    // Get the enforceStrongPasswords setting
    const enforceStrong = await getSetting('security.enforceStrongPasswords', false);

    if (!password || password.length === 0) {
      return { valid: false, error: 'Password is required' };
    }

    if (enforceStrong) {
      // Strong password requirements
      const requirements: string[] = [];
      let isValid = true;

      if (password.length < 12) {
        requirements.push('at least 12 characters');
        isValid = false;
      }
      
      if (!/[A-Z]/.test(password)) {
        requirements.push('at least one uppercase letter');
        isValid = false;
      }
      
      if (!/[a-z]/.test(password)) {
        requirements.push('at least one lowercase letter');
        isValid = false;
      }
      
      if (!/[0-9]/.test(password)) {
        requirements.push('at least one number');
        isValid = false;
      }
      
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        requirements.push('at least one special character (!@#$%^&*()_+-=[]{};\'"\\|,.<>/?)');
        isValid = false;
      }

      if (!isValid) {
        return {
          valid: false,
          error: `Password must contain ${requirements.join(', ')}`,
          requirements
        };
      }
    }
    
    return { valid: true };
  } catch (error) {
    logger.error('Error validating password:', error as Record<string, any>);
    // In case of error, default to basic validation
    return password && password.length > 0 
      ? { valid: true } 
      : { valid: false, error: 'Password is required' };
  }
}

/**
 * Gets password requirements text based on current settings.
 * Useful for displaying to users before they enter a password.
 */
export async function getPasswordRequirements(): Promise<string> {
  try {
    const enforceStrong = await getSetting('auth.enforceStrongPasswords', true);
    
    if (enforceStrong) {
      return 'Password must be at least 12 characters and contain uppercase letter, lowercase letter, number, and special character.';
    } else {
      return 'Password is required.';
    }
  } catch (error) {
    logger.error('Error getting password requirements:', error as Record<string, any>);
    return 'Password is required.';
  }
} 
