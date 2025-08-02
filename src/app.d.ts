/// <reference types="lucia" />
import type { PrismaClient } from '@prisma/client';
import type { ExtendedWebSocketServer } from '$lib/server/websocket/WebSocketUtils';
import type { DefaultDeviceManager } from '$lib/server/device/deviceManager';
import type Redis from 'ioredis';

declare global {
	namespace App {
		interface Locals {
			auth: {
				validate: () => Promise<{
					user: {
						id: string
						userId: string;
						email: string;
						name: string | null;
						rolesString: string;
						systemRole: string;
					};
					session: {
						id: string;
						userId: string;
						expiresAt: Date;
					};
				} | null>;
				createSession: (userId: string, attributes?: Record<string, any>) => Promise<{
					id: string;
					userId: string;
					expiresAt: Date;
				}>;
				setSession: (session: { id: string }) => void;
			};
			prisma: PrismaClient;
			wss?: ExtendedWebSocketServer;
			deviceManager: DefaultDeviceManager;
			redis: Redis;
		}
	}
	namespace Lucia {
		type Auth = import("$lib/server/auth/lucia").Auth;
		type DatabaseUserAttributes = {
			email: string;
			systemRole: string;
			rolesString: string;
		};
		type DatabaseSessionAttributes = {};
	}
}

export {};
