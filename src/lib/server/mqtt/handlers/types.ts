import type { PrismaClient } from '@prisma/client';

/********************************************************************************************
 * Raw RPC handler types shared across device/web clients.
 ********************************************************************************************/
export type RpcHandlerArgs<P extends PrismaClient = PrismaClient> = {
    topic: string;
    requestId: string;
    op: string;
    params: Record<string, any>;
    prisma: P;
    sub: string | null;
};

export type RpcHandler<P extends PrismaClient = PrismaClient> = (args: RpcHandlerArgs<P>) => Promise<any>;

export type RpcResponse<T> = {
    status?: string;
    error?: string;
    flowId?: string;
    result: T;
};

/********************************************************************************************
 * Registry state for mapping topic prefixes to RPC handlers.
 ********************************************************************************************/
export type RegisteredRpcHandler = {
    handler: RpcHandler<PrismaClient>;
    prisma: PrismaClient;
};
