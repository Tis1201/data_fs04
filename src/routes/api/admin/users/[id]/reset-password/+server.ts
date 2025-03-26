import { error, json } from '@sveltejs/kit';
import { randomBytes } from 'crypto';
import { hash } from '@node-rs/argon2';
import { logger } from '$lib/server/logger';

// Generate a secure temporary password
function generateSecureTempPassword(): string {
    const bytes = randomBytes(16); // 16 bytes = 128 bits
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    // Ensure we have at least one of each required character type
    password += chars.charAt(Math.floor(Math.random() * 26)); // Uppercase
    password += chars.charAt(Math.floor(Math.random() * 26) + 26); // Lowercase
    password += chars.charAt(Math.floor(Math.random() * 10) + 52); // Number
    password += chars.charAt(Math.floor(Math.random() * 8) + 62); // Special char
    
    // Fill the rest of the password
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Shuffle the password to ensure randomness
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

export async function POST({ params, locals }) {
    // Check if the user is authenticated and has admin role
    const auth = await locals.auth.validate();
    if (!auth?.user || auth.user.systemRole !== 'ADMIN') {
        throw error(403, 'Not authorized to reset user passwords');
    }
    
    const userId = params.id;
    if (!userId) {
        throw error(400, 'User ID is required');
    }
    
    try {
        // Get the Zenstack-enhanced Prisma client from locals
        const prisma = locals.prisma;
        
        // Check if the user exists
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        
        if (!user) {
            throw error(404, 'User not found');
        }
        
        // Generate a new secure temporary password
        const tempPassword = generateSecureTempPassword();
        
        // Hash the password using @node-rs/argon2
        const hashedPassword = await hash(tempPassword);
        logger.debug('Password hashed successfully for reset', { 
            userId,
            passwordLength: tempPassword.length 
        });
        
        // Update the user's password
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });
        
        logger.info('User password reset successfully', { 
            userId,
            email: user.email
        });
        
        // Return the new temporary password to be displayed to the admin
        return json({ 
            success: true, 
            message: 'Password reset successfully',
            password: tempPassword 
        });
    } catch (err) {
        logger.error('Error resetting user password', { 
            userId,
            error: err 
        });
        throw error(500, 'Failed to reset user password');
    }
}
