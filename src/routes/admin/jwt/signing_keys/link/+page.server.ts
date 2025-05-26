import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { message, superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { createSuccessResponse } from '$lib/types/api';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../../users/schema';
import { logger } from '$lib/server/logger';
import { listKeys, createKey, rotateKey } from '../service';

// Schema for creating a new key
const createKeySchema = z.object({
  keyType: z.literal('LINK'),
});

// Schema for rotating a key
const rotateKeySchema = z.object({
  keyId: z.string().min(1, 'Key ID is required'),
});

export const load = restrict(
  async ({ url, locals }) => {
    try {
      // Get query parameters for filtering, sorting, and pagination
      const page = parseInt(url.searchParams.get('page') || '1');
      const perPage = parseInt(url.searchParams.get('per_page') || '10');
      let sortField = url.searchParams.get('sort_field') || 'createdAt';
      let sortOrder = url.searchParams.get('sort_order') || 'desc';
      const search = url.searchParams.get('search') || '';
      // We no longer use dateRange parameter, we use start_date and end_date instead
      const statusFilter = url.searchParams.get('status') || '';

      // Get all keys of type LINK
      let allKeys = await listKeys(locals.prisma, 'LINK');
      
      // Get the primary key (active key) - we'll keep this separate from filtering
      const primaryKey = allKeys.find(key => key.isPrimary && key.keyType === 'LINK');
      
      // Create a copy of all keys for filtering
      let keys = [...allKeys];
      
      // Log all keys and their creation dates
      logger.info(`Total keys before filtering: ${keys.length}`);
      if (keys.length > 0) {
        logger.info('All keys with creation dates:');
        keys.forEach((key, index) => {
          const createdAt = new Date(key.createdAt);
          logger.info(`Key ${index + 1}: ${key.keyId} - Created at ${createdAt.toISOString()} - Local time: ${createdAt.toString()}`);
        });
      } else {
        logger.info('No keys found in the database');
      }

      // Apply search filter if provided
      if (search) {
        keys = keys.filter(key => 
          key.keyId.toLowerCase().includes(search.toLowerCase()) ||
          key.algorithm.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Apply date range filter using start_date and end_date parameters
      const startDateParam = url.searchParams.get('start_date');
      const endDateParam = url.searchParams.get('end_date');
      
      // Debug logging
      logger.info('Date filter parameters:', { startDateParam, endDateParam });
      
      // Function to parse date safely with timezone handling
      const parseDate = (dateStr: string | null, isEndDate = false): Date | null => {
        if (!dateStr) return null;
        
        try {
          // For YYYY-MM-DD format, create date in local timezone
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            // Parse as YYYY-MM-DD in local timezone
            const [year, month, day] = dateStr.split('-').map(Number);
            
            // Create date in local timezone (months are 0-indexed in JS)
            let date = new Date(year, month - 1, day);
            
            // Set appropriate time based on whether it's start or end date
            if (isEndDate) {
              date.setHours(23, 59, 59, 999); // End of day
            } else {
              date.setHours(0, 0, 0, 0); // Beginning of day
            }
            
            logger.info(`Parsed date ${dateStr} as ${date.toISOString()} (${isEndDate ? 'end' : 'start'} date)`);
            return date;
          }
          
          // Fall back to standard date parsing for other formats
          let date = new Date(dateStr);
          
          // Check if valid
          if (!isNaN(date.getTime())) {
            // Set appropriate time based on whether it's start or end date
            if (isEndDate) {
              date.setHours(23, 59, 59, 999); // End of day
            } else {
              date.setHours(0, 0, 0, 0); // Beginning of day
            }
            return date;
          }
          
          // Log the issue
          logger.warn(`Invalid date format: ${dateStr}`);
          return null;
        } catch (e) {
          logger.error(`Error parsing date parameter: ${dateStr}`, e);
          return null;
        }
      };
      
      // Parse dates
      const startDate = parseDate(startDateParam);
      const endDate = parseDate(endDateParam, true);
      
      // Log parsed dates
      logger.info('Parsed date range:', { 
        startDate: startDate?.toISOString() || 'null', 
        endDate: endDate?.toISOString() || 'null' 
      });
      
      // Apply date filters
      if (startDate || endDate) {
        // Get the current date for reference
        const now = new Date();
        const todayDateStr = now.toISOString().split('T')[0];
        logger.info(`Current date (today): ${todayDateStr}`);
        logger.info(`Filtering keys by date range: ${startDate?.toISOString() || 'none'} to ${endDate?.toISOString() || 'none'}`);
        
        // Log original keys before filtering
        logger.info('Keys before date filtering:');
        keys.forEach((key, index) => {
          const createdAt = new Date(key.createdAt);
          const createdDateStr = createdAt.toISOString().split('T')[0];
          logger.info(`Key ${index + 1}: ${key.keyId} - Created date: ${createdDateStr} - Full timestamp: ${createdAt.toISOString()}`);
        });
        
        // Check if this is a single day selection
        const isSingleDaySelection = startDateParam && endDateParam && startDateParam === endDateParam;
        logger.info(`Is single day selection: ${isSingleDaySelection}, date: ${startDateParam}`);
        
        // Apply strict date-based filtering
        const filteredKeys = keys.filter(key => {
          // Get the key's creation date
          const keyDate = new Date(key.createdAt);
          
          // For single day selection, we need to compare the date parts directly from the URL parameters
          // This avoids timezone issues when converting to Date objects
          if (isSingleDaySelection && startDateParam) {
            // Extract the date part from the key's creation date in local timezone
            const keyLocalDate = new Date(keyDate.getTime());
            // Format to YYYY-MM-DD in local timezone
            const keyDateYMD = keyLocalDate.toISOString().split('T')[0];
            
            const result = keyDateYMD === startDateParam;
            logger.info(`Single day comparison: key date ${keyDateYMD} with filter date ${startDateParam}, result: ${result}`);
            return result;
          }
          
          // For range filtering, use the standard approach
          // For date comparison, use only the date part (ignore time)
          const keyDateStr = keyDate.toISOString().split('T')[0];
          const startDateStr = startDate ? startDate.toISOString().split('T')[0] : null;
          const endDateStr = endDate ? endDate.toISOString().split('T')[0] : null;
          
          logger.info(`Comparing key date ${keyDateStr} with range ${startDateStr || 'none'} to ${endDateStr || 'none'}`);
          
          // Use range comparison
          const afterStart = !startDateStr || keyDateStr >= startDateStr;
          const beforeEnd = !endDateStr || keyDateStr <= endDateStr;
          const result = afterStart && beforeEnd;
          
          logger.info(`Range comparison for ${keyDateStr}: afterStart=${afterStart}, beforeEnd=${beforeEnd}, result=${result}`);
          return result;
        });
        
        // Update the keys array with filtered results
        keys = filteredKeys;
        
        // Log the filtered keys
        if (keys.length > 0) {
          logger.info(`After date filtering: ${keys.length} keys remain`);
          keys.forEach((key, index) => {
            const createdAt = new Date(key.createdAt);
            const createdDateStr = createdAt.toISOString().split('T')[0];
            logger.info(`Filtered key ${index + 1}: ${key.keyId} - Created date: ${createdDateStr}`);
          });
        } else {
          logger.info('No keys remain after date filtering');
        }
      }
      
      // Log results of filtering
      logger.info(`After date filtering: ${keys.length} keys remain`);
      
      // Log some sample dates from the keys for debugging
      if (keys.length > 0) {
        const sampleDates = keys.slice(0, Math.min(3, keys.length)).map(k => new Date(k.createdAt).toISOString());
        logger.info('Sample key dates after filtering:', sampleDates);
      }
      
      // Log the number of keys after filtering
      logger.info(`Keys after date filtering: ${keys.length}`);
      
      // Check URL parameters
      const sortParam = url.searchParams.get('sort');
      const orderParam = url.searchParams.get('order');
      if (sortParam) {
        // If 'sort' parameter is used instead of 'sort_field'
        sortField = sortParam;
      }
      if (orderParam && (orderParam === 'asc' || orderParam === 'desc')) {
        // If 'order' parameter is used instead of 'sort_order'
        sortOrder = orderParam;
      }
      
      logger.info('Sort parameters:', { sortField, sortOrder });

      // Apply status filter
      if (statusFilter) {
        const statusValues = statusFilter.split(',');
        keys = keys.filter(key => {
          if (statusValues.includes('primary') && key.isPrimary) return true;
          if (statusValues.includes('active') && key.isActive && !key.isPrimary) return true;
          if (statusValues.includes('inactive') && !key.isActive) return true;
          return false;
        });
      }

      // We already have the primary key from the unfiltered list
      
      // Sort the keys based on the sort parameters
      if (sortField && sortOrder) {
        keys = [...keys].sort((a, b) => {
          const aValue = a[sortField as keyof JwtSigningKey];
          const bValue = b[sortField as keyof JwtSigningKey];
          
          if (aValue === bValue) return 0;
          
          // Handle dates and other types appropriately
          if (aValue instanceof Date && bValue instanceof Date) {
            return sortOrder === 'asc' ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime();
          }
          
          // Handle strings and other types
          if (aValue === null || aValue === undefined) return sortOrder === 'asc' ? -1 : 1;
          if (bValue === null || bValue === undefined) return sortOrder === 'asc' ? 1 : -1;
          
          if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
          }
          
          return sortOrder === 'asc' ? (aValue < bValue ? -1 : 1) : (aValue < bValue ? 1 : -1);
        });
      }
      
      // Calculate pagination values for the table
      const totalItems = keys.length;
      const totalPages = Math.ceil(totalItems / perPage);
      const currentPage = Math.min(page, totalPages) || 1;
      
      // Apply pagination
      const startIndex = (currentPage - 1) * perPage;
      const paginatedKeys = keys.slice(startIndex, startIndex + perPage);
      
      // Create empty forms
      const createForm = await superValidate(zod(createKeySchema), {
        id: 'link-create-form'
      });
      const rotateForm = await superValidate(zod(rotateKeySchema), {
        id: 'link-rotate-form'
      });

      return {
        keys: paginatedKeys, // Return the paginated keys for the current page
        allKeys: keys, // Return all keys for reference if needed
        primaryKey, // This is from the unfiltered list, so it's always available
        createForm,
        rotateForm,
        meta: {
          title: 'Link JWT Signing Keys',
          description: 'Manage link JWT signing keys',
          currentPage,
          itemsPerPage: perPage,
          totalItems,
          totalPages
        },
        sort: {
          field: sortField,
          order: sortOrder as 'asc' | 'desc'
        }
      };
    } catch (err) {
      logger.error(`Error loading factory JWT signing keys: ${err}`);
      return {
        keys: [],
        createForm: await superValidate(zod(createKeySchema), {
          id: 'factory-create-form'
        }),
        rotateForm: await superValidate(zod(rotateKeySchema), {
          id: 'factory-rotate-form'
        }),
        error: {
          message: 'Failed to load factory JWT signing keys',
          details: err instanceof Error ? err.message : String(err),
        },
        meta: {
          title: 'Factory JWT Signing Keys',
          description: 'Manage factory JWT signing keys'
        }
      };
    }
  },
  [SystemRole.ADMIN]
) satisfies PageServerLoad;

export const actions: Actions = {
  // Create a new key
  createKey: restrict(
    async ({ request, locals }) => {
      const form = await superValidate(request, zod(createKeySchema), {
        id: 'factory-create-form'
      });

      if (!form.valid) {
        return fail(400, { form });
      }

      try {
        const { keyType } = form.data;
        
        // Check if a key of this type already exists
        const existingKeys = await locals.prisma.jwtSigningKey.findMany({
          where: { keyType }
        });
        
        if (existingKeys.length > 0) {
          return fail(400, {
            form,
            success: false,
            error: {
              message: `A factory key already exists. Please use the rotate function instead.`,
            },
          });
        }

        // Create a new key
        const result = await createKey(locals.prisma, keyType, locals.user.id);
        
        if (!result.success) {
          logger.error('Failed to create factory key:', result.error);
          return fail(400, {
            form,
            success: false,
            error: {
              message: result.error.message || 'Failed to create factory key',
              details: result.error.details,
              code: result.error.code,
              meta: result.error.meta
            },
          });
        }

        // Return a success message with the key data
        logger.info(`Factory key created successfully`);
        return message(
          form,
          createSuccessResponse(`Factory key created successfully`, {
            details: `A new factory key has been created.`,
            data: { 
              keyType,
              key: result.key ? {
                id: result.key.id,
                keyId: result.key.keyId,
                keyType: result.key.keyType,
                algorithm: result.key.algorithm,
                isActive: result.key.isActive,
                isPrimary: result.key.isPrimary,
                createdAt: result.key.createdAt,
                updatedAt: result.key.updatedAt,
                rotatedAt: result.key.rotatedAt,
                expiresAt: result.key.expiresAt
              } : undefined
            }
          })
        );
      } catch (err) {
        logger.error('Error creating factory JWT key:', err);
        return handleFormError({
          error: err,
          form,
          defaultMessage: 'An unexpected error occurred while creating the factory key',
          prisma: locals.prisma,
          requestId: locals.requestId
        });
      }
    },
    [SystemRole.ADMIN]
  ),

  // Rotate an existing key
  rotateKey: restrict(
    async ({ request, locals }) => {
      logger.info('Rotate link key action called');
      logger.info('Request received:', { url: request.url });
      
      const form = await superValidate(request, zod(rotateKeySchema), {
        id: 'link-rotate-form'
      });
      
      logger.info('Form data received:', { formData: form.data, valid: form.valid });

      if (!form.valid) {
        logger.error('Form validation failed:', form.errors);
        return fail(400, { form });
      }

      try {
        const { keyId } = form.data;
        logger.info('Rotating factory key with ID:', keyId);
        
        // Find the existing key to verify it exists
        const existingKey = await locals.prisma.jwtSigningKey.findUnique({
          where: { id: keyId }
        });
        
        if (!existingKey) {
          logger.error('Key not found with ID:', keyId);
          return fail(404, {
            form,
            success: false,
            error: {
              message: `Key not found. Please select a valid key to rotate.`,
            },
          });
        }
        
        if (existingKey.keyType !== 'LINK') {
          logger.error('Key is not a link key:', existingKey.keyType);
          return fail(400, {
            form,
            success: false,
            error: {
              message: `Selected key is not a link key.`,
            },
          });
        }
        
        logger.info('Found existing link key:', {
          id: existingKey.id,
          keyType: existingKey.keyType,
          isPrimary: existingKey.isPrimary
        });

        // Rotate the key using the ID directly from the form
        logger.info('Calling rotateKey service with keyId:', keyId);
        const result = await rotateKey(locals.prisma, keyId, locals.user.id);

        if (!result.success) {
          logger.error(`Failed to rotate factory key: ${JSON.stringify(result.error)}`);
          return fail(400, {
            form,
            success: false,
            error: {
              message: result.error?.message || 'Failed to rotate factory key',
              details: result.error?.details,
              code: result.error?.code || 'UNKNOWN_ERROR',
              meta: result.error?.meta
            },
          });
        }

        // Return a success message with the new key data
        logger.info(`Factory key rotated successfully`);
        return message(
          form,
          createSuccessResponse(`Factory key rotated successfully`, {
            details: `The factory key has been rotated. The old key will remain active for a grace period.`,
            data: { 
              keyType: 'FACTORY',
              key: result.key ? {
                id: result.key.id,
                keyId: result.key.keyId,
                keyType: result.key.keyType,
                algorithm: result.key.algorithm,
                isActive: result.key.isActive,
                isPrimary: result.key.isPrimary,
                createdAt: result.key.createdAt,
                updatedAt: result.key.updatedAt,
                rotatedAt: result.key.rotatedAt,
                expiresAt: result.key.expiresAt
              } : undefined
            }
          })
        );
      } catch (err) {
        logger.error('Error rotating factory JWT key:', err);
        return handleFormError({
          error: err,
          form,
          defaultMessage: 'An unexpected error occurred while rotating the factory key',
          prisma: locals.prisma,
          requestId: locals.requestId
        });
      }
    },
    [SystemRole.ADMIN]
  ),
};
