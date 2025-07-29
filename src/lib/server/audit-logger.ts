import { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { AuditActionType } from '$lib/constants/system';

export interface LogAuditOptions {
    prisma: PrismaClient;
    actionType: AuditActionType;
    tableName: string;
    recordId: string | string[];
    oldData: Record<string, any> | null;
    newData: Record<string, any> | null;
    userId: string;
    ipAddress?: string;
    changeSummary?: string;
}

export async function logAudit(options: LogAuditOptions): Promise<void> {
    const {
        actionType,
        tableName,
        recordId,
        oldData,
        newData,
        userId,
        ipAddress,
        prisma,
        changeSummary
    } = options

    const generatedChangeSummary = changeSummary || generateChangeSummary(oldData || {}, newData || {});

    if (Array.isArray(recordId)) {
        await prisma.auditLog.createMany({
            data: recordId.map(id => ({
                actionType,
                tableName,
                recordId: id,
                userId,
                ipAddress,
                changeSummary: generatedChangeSummary,
                oldData: oldData === null ? Prisma.JsonNull : oldData,
                newData: newData === null ? Prisma.JsonNull : newData
            }))
        });
    } else {
        await prisma.auditLog.create({
            data: {
                actionType,
                tableName,
                recordId,
                userId,
                ipAddress,
                changeSummary: generatedChangeSummary,
                oldData: oldData === null ? Prisma.JsonNull : oldData,
                newData: newData === null ? Prisma.JsonNull : newData
            }
        });
    }
}

/**
 * Compare oldData and newData field by field.
 * For fields that differ, log the changes in the format: Field: 'old_value' → 'new_value
 */
function generateChangeSummary(oldData: Record<string, any>, newData: Record<string, any>): string {
    const ignoredFields = ['createdAt', 'updatedAt'];
    const changes: string[] = [];

    for (const key of Object.keys({ ...oldData, ...newData })) {
        if (ignoredFields.includes(key)) continue;

        const oldVal = oldData?.[key];
        const newVal = newData?.[key];

        // Skip if both values are null or undefined
        if (
            (oldVal === null || oldVal === undefined) &&
            (newVal === null || newVal === undefined)
        ) {
            continue;
        }

        // Skip nested objects or arrays
        if (typeof oldVal === 'object' || typeof newVal === 'object') {
            continue;
        }

        if (oldVal !== newVal) {
            changes.push(`${key}: '${oldVal}' → '${newVal}'`);
        }
    }

    return changes.length > 0 ? changes.join(", ") : "No changes";
}
