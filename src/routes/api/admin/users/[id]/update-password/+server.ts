import { error, json } from '@sveltejs/kit';
import { hash } from '@node-rs/argon2';
import { logger } from '$lib/server/logger';
import { z } from 'zod';

// Schema for password validation
const passwordSchema = z.object({
    password: z.string().min(8, "Password must be at least 8 characters")
});

export async function POST({ params, locals, request }) {
    // Check if the user is authenticated and has admin role
    const auth = await locals.auth.validate();
    if (!auth?.user || auth.user.systemRole !== 'ADMIN') {
        throw error(403, 'Not authorized to update user passwords');
    }
    
    const userId = params.id;
    if (!userId) {
        throw error(400, 'User ID is required');
    }
    
    try {
        // Parse and validate the request body
        const body = await request.json();
        const result = passwordSchema.safeParse(body);
        
        if (!result.success) {
            return json({ 
                success: false, 
                message: 'Invalid password format' 
            }, { status: 400 });
        }
        
        const { password } = result.data;
        
        // Get the Zenstack-enhanced Prisma client from locals
        const prisma = locals.prisma;
        
        // Check if the user exists
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        
        if (!user) {
            throw error(404, 'User not found');
        }
        
        // Hash the password using @node-rs/argon2
        const hashedPassword = await hash(password);
        logger.debug('Password hashed successfully for update', { 
            userId,
            passwordLength: password.length 
        });
        
        // Update the user's password
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });
        
        logger.info('User password updated successfully', { 
            userId,
            email: user.email
        });
        
        return json({ 
            success: true, 
            message: 'Password updated successfully'
        });
    } catch (err) {
        logger.error('Error updating user password', { 
            userId,
            error: err 
        });
        throw error(500, 'Failed to update user password');
    }
}
