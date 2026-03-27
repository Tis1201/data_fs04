import prisma from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';

/**
 * Result of MAC address authorization
 */
export interface MacAddressAuth {
  valid: boolean;
  deviceId: string | null;
  error?: string;
}

/**
 * Normalize MAC address format
 * 
 * Handles various input formats:
 * - 00:1A:2B:3C:4D:5E (colon-separated)
 * - 00-1A-2B-3C-4D-5E (dash-separated)
 * - 001A2B3C4D5E (no separators)
 * - Case-insensitive
 * 
 * Returns standard format: XX:XX:XX:XX:XX:XX (uppercase)
 * 
 * @param macAddress - MAC address in any format
 * @returns Normalized MAC address in XX:XX:XX:XX:XX:XX format
 * @throws Error if MAC address format is invalid
 */
export function normalizeMacAddress(macAddress: string): string {
  if (!macAddress || typeof macAddress !== 'string') {
    throw new Error('MAC address must be a non-empty string');
  }

  // Remove all separators (colons, dashes, spaces, dots) and convert to uppercase
  const cleaned = macAddress.replace(/[:.\s-]/g, '').toUpperCase();

  // Validate format (should be exactly 12 hex characters)
  if (!/^[0-9A-F]{12}$/.test(cleaned)) {
    throw new Error(`Invalid MAC address format: ${macAddress}. Expected 12 hex characters.`);
  }

  // Return in standard format: XX:XX:XX:XX:XX:XX
  return cleaned.match(/.{2}/g)?.join(':') || cleaned;
}

/**
 * Validate that a MAC address belongs to a device in the specified account
 * 
 * This function:
 * 1. Normalizes the MAC address format
 * 2. Queries the Device table for matching MAC address
 * 3. Verifies the device belongs to the account (accountId match)
 * 4. Returns device ID if valid
 * 
 * @param macAddress - MAC address to validate (any format)
 * @param accountId - Account ID to verify ownership
 * @param prismaClient - Prisma client instance (defaults to global prisma)
 * @returns MacAddressAuth object with validation result
 */
export async function validateMacAddressForAccount(
  macAddress: string,
  accountId: string,
  prismaClient?: PrismaClient
): Promise<MacAddressAuth> {
  const client = prismaClient || prisma;

  try {
    // Validate inputs
    if (!macAddress || macAddress.trim() === '') {
      logger.warn('[MAC Auth] No MAC address provided');
      return {
        valid: false,
        deviceId: null,
        error: 'MAC address is required'
      };
    }

    if (!accountId || accountId.trim() === '') {
      logger.warn('[MAC Auth] No account ID provided');
      return {
        valid: false,
        deviceId: null,
        error: 'Account ID is required'
      };
    }

    // Normalize MAC address
    let normalizedMac: string;
    try {
      normalizedMac = normalizeMacAddress(macAddress);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid MAC address format';
      logger.warn('[MAC Auth] Invalid MAC address format', {
        macAddress,
        error: errorMessage
      });
      return {
        valid: false,
        deviceId: null,
        error: errorMessage
      };
    }

    // Find device with matching MAC address and account ID
    // We need to check both exact match and case-insensitive match
    // Since Prisma doesn't support case-insensitive search directly for all databases,
    // we'll try exact match first, then case-insensitive if needed
    let device = await client.device.findFirst({
      where: {
        macAddress: normalizedMac,
        accountId: accountId
      },
      select: {
        id: true,
        name: true,
        accountId: true,
        macAddress: true,
        status: true
      }
    });

    // If exact match not found, try case-insensitive search
    // This handles cases where MAC address might be stored in different case
    if (!device) {
      // Get all devices for the account and filter in memory
      // This is less efficient but ensures we catch case variations
      const accountDevices = await client.device.findMany({
        where: {
          accountId: accountId
        },
        select: {
          id: true,
          name: true,
          accountId: true,
          macAddress: true,
          status: true
        }
      });

      // Find case-insensitive match
      device = accountDevices.find(
        d => d.macAddress && normalizeMacAddress(d.macAddress) === normalizedMac
      ) || null;
    }

    if (!device) {
      logger.warn('[MAC Auth] MAC address not found or does not belong to account', {
        macAddress: normalizedMac,
        accountId,
        // Log partial MAC for security (first 8 chars)
        macPrefix: normalizedMac.substring(0, 8) + '...'
      });
      return {
        valid: false,
        deviceId: null,
        error: 'MAC address does not belong to this account'
      };
    }

    // Check if device is active (optional - you may want to allow inactive devices)
    // Uncomment if you want to restrict to active devices only
    // if (device.status !== 'ACTIVE') {
    //   logger.warn('[MAC Auth] Device is not active', {
    //     deviceId: device.id,
    //     status: device.status
    //   });
    //   return {
    //     valid: false,
    //     deviceId: null,
    //     error: 'Device is not active'
    //   };
    // }

    logger.info('[MAC Auth] MAC address validated successfully', {
      macAddress: normalizedMac,
      deviceId: device.id,
      deviceName: device.name,
      accountId
    });

    return {
      valid: true,
      deviceId: device.id
    };
  } catch (error) {
    logger.error('[MAC Auth] Error validating MAC address', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      macAddress,
      accountId
    });
    return {
      valid: false,
      deviceId: null,
      error: 'Error validating MAC address'
    };
  }
}

