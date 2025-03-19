import { dev } from '$app/environment';
import { Lucia } from "lucia";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import prisma from '../prisma';

// Create a new adapter with the correct field mappings
const adapter = new PrismaAdapter(
    prisma.session,
    prisma.user,
    {
        user: {
            id: "id",
            attributes: ["email", "rolesString", "systemRole"]
        },
        session: {
            id: "id",
            userId: "userId",
            expiresAt: "expiresAt"
        }
    }
);

export const lucia = new Lucia(adapter, {
    sessionCookie: {
        attributes: {
            secure: !dev,
            sameSite: "lax"
        }
    },
    getUserAttributes: (attributes) => {
        return {
            id: attributes.id,
            email: attributes.email,
            rolesString: attributes.rolesString,
            systemRole: attributes.systemRole
        };
    }
});

declare module "lucia" {
    interface Register {
        Lucia: typeof lucia;
        DatabaseUserAttributes: {
            id: string;
            email: string;
            rolesString: string;
            systemRole: string;
        };
    }
}

export default lucia;
