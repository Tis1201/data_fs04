import type { PageServerLoad } from './$types';
import type { SortOrder, UserStatus } from '@prisma/client';
import { dev } from '$app/environment';
import { logger } from '$lib/server/logger';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { error, fail } from '@sveltejs/kit';
import { generateId } from 'lucia';
import { hash } from '@node-rs/argon2';
import { superValidate } from 'sveltekit-superforms/server';
import { userSchema } from '$lib/schemas/user';
import { zod } from 'sveltekit-superforms/adapters';
import type { Actions } from './$types';

type SortField = 'email' | 'rolesString' | 'createdAt' | 'systemRole';

export const load: PageServerLoad = async ({ locals, url, parent }) => {
    const parentData = await parent();
    console.log('Parent data:', parentData);
    if (!parentData?.user) {
        throw error(401, "Unauthorized");
    }

    try {
        const page = Number(url.searchParams.get('page')) || 1;
        const per_page = Number(url.searchParams.get('per_page')) || 10;
        const search = url.searchParams.get('search') || '';
        const roles = url.searchParams.get('roles')?.split(',').filter(Boolean) || [];
        const statuses = url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];
        const sortField = (url.searchParams.get('sort') as SortField) || 'email';
        const sortOrder = (url.searchParams.get('order') as 'asc' | 'desc') || 'asc';

        // Use enhanced prisma with user context
        const prisma = getEnhancedPrisma({
            id: parentData.user.id,
            rolesString: parentData.user.rolesString
        });
        console.log('Auth context:', { id: parentData.user.id, rolesString: parentData.user.rolesString });

        // Build where clause
        const whereConditions = [];
        
        if (search) {
            whereConditions.push({
                OR: [
                    { email: { contains: search, mode: 'insensitive' } }
                ]
            });
        }
        
        if (roles.length > 0) {
            whereConditions.push({ rolesString: { in: roles } });
        }
        
        if (statuses.length > 0) {
            whereConditions.push({ systemRole: { in: statuses } });
        }

        const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

        // Get total count
        const totalRecords = await prisma.user.count({ where });

        // Get users with pagination and sorting
        const records = await prisma.user.findMany({
            where,
            orderBy: { [sortField]: sortOrder },
            skip: (page - 1) * per_page,
            take: per_page,
            select: {
                id: true,
                email: true,
                rolesString: true,
                systemRole: true,
                createdAt: true,
                updatedAt: true
            }
        });

        logger.debug('Loading users:', { totalRecords, records, sort: { field: sortField, order: sortOrder } });

        return {
            data: records,
            meta: {
                pagination: {
                    page,
                    per_page,
                    total_records: totalRecords,
                    total_pages: Math.ceil(totalRecords / per_page)
                },
                sort: {
                    field: sortField,
                    order: sortOrder
                },
                filters: {
                    search,
                    roles,
                    statuses
                }
            }
        };

    } catch (e) {
        logger.error('Error loading users:', e);
        throw error(500, 'Failed to load users');
    }
};

export const actions = {
    create: async ({ request, locals }) => {
        const form = await superValidate(request, zod(userSchema));
        if (!form.valid) {
            return fail(400, { form });
        }

        try {
            const prisma = getEnhancedPrisma(locals.user);
            const { email, name, role, password } = form.data;

            // Check if user already exists
            const existingUser = await prisma.user.findUnique({
                where: { email }
            });

            if (existingUser) {
                return fail(400, {
                    form,
                    error: "User with this email already exists"
                });
            }

            // Create user
            const userId = generateId(15);
            const hashedPassword = await hash(password);

            const user = await prisma.user.create({
                data: {
                    id: userId,
                    email,
                    name,
                    role,
                    hashedPassword,
                    status: 'ACTIVE'
                }
            });

            return { form };
        } catch (e) {
            logger.error('Error creating user:', e);
            return fail(500, {
                form,
                error: "Failed to create user"
            });
        }
    }
};
