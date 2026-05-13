import { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { AuditActionType } from '$lib/constants/system';

export interface LogAuditOptions {
    prisma: PrismaClient | Omit<PrismaClient<Prisma.PrismaClientOptions, never>, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
    actionType: AuditActionType;
    tableName: string;
    recordId: string | string[];
    oldData: Record<string, any> | null;
    newData: Record<string, any> | null;
    userId: string;
    ipAddress?: string;
    changeSummary?: string;
}

/** Make a plain object safe for Prisma Json: dates to string, no undefined/circular. */
function sanitizeForJson(value: Record<string, any> | null): Record<string, any> | null {
    if (value == null) return null;
    try {
        const out = JSON.parse(JSON.stringify(value, (_, v) => {
            if (v instanceof Date) return v.toISOString();
            if (typeof v === 'bigint') return Number(v);
            return v;
        }));
        return out as Record<string, any>;
    } catch {
        return {};
    }
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
    } = options;

    const safeOld = sanitizeForJson(oldData);
    const safeNew = sanitizeForJson(newData);
    const generatedChangeSummary = changeSummary || generateChangeSummary(safeOld || {}, safeNew || {});

    const oldJson = safeOld === null ? Prisma.JsonNull : safeOld;
    const newJson = safeNew === null ? Prisma.JsonNull : safeNew;

    if (Array.isArray(recordId)) {
        await prisma.auditLog.createMany({
            data: recordId.map(id => ({
                actionType,
                tableName,
                recordId: id,
                userId,
                ipAddress,
                changeSummary: generatedChangeSummary,
                oldData: oldJson,
                newData: newJson
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
                oldData: oldJson,
                newData: newJson
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
