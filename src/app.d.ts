/// <reference types="lucia" />
import type { PrismaClient } from '@prisma/client';
import type { ExtendedWebSocketServer } from '$lib/server/websocket/WebSocketUtils';
import type { DefaultDeviceManager } from '$lib/server/device/deviceManager';
import type Redis from 'ioredis';
import type { RequestContext } from '$lib/server/context/requestContext';

declare global {
	namespace App {
		interface Locals {
			auth: {
				validate: () => Promise<{
					user: {
						id: string;
						email: string;
						rolesString: string;
						systemRole: string;
					};
					session: {
						id: string;
						userId: string;
						expiresAt: Date;
					};
					memberships: Array<{
						id: string;
						userId: string;
						accountId: string;
						role: string;
						account: {
							id: string;
							name: string;
							slug: string;
						};
					}>;
					currentAccount: {
						id: string;
						userId: string;
						accountId: string;
						role: string;
						account: {
							id: string;
							name: string;
							slug: string;
						};
					} | null;
				} | null>;
				createSession: (userId: string, attributes?: Record<string, any>) => Promise<{
					id: string;
					userId: string;
					expiresAt: Date;
				}>;
				setSession: (session: { id: string }) => void;
				switchAccount: (accountId: string) => Promise<boolean>;
				hasPermission: (requiredRoles: string | string[]) => Promise<boolean>;
			};
			user?: {
				id: string;
				email: string;
				rolesString: string;
				systemRole: string;
			};
			accountMemberships?: Array<{
				id: string;
				userId: string;
				accountId: string;
				role: string;
				account: {
					id: string;
					name: string;
					slug: string;
				};
			}>;
			currentAccount?: {
				id: string;
				userId: string;
				accountId: string;
				role: string;
				account: {
					id: string;
					name: string;
					slug: string;
				};
			} | null;
			prisma: PrismaClient;
			wss?: ExtendedWebSocketServer;
			deviceManager: DefaultDeviceManager;
			redis: Redis;
			requestId: string;
			requestContext: RequestContext;
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
