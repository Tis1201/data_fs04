import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { radarSensorSchema } from './radar-sensor';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

export const load = restrict(
    async ({ locals }) => {
        try {
            const form = await superValidate(zod(radarSensorSchema), {
                id: 'radar-sensor-form',
                defaults: {
                    status: 'INACTIVE'
                }
            });
            
            const accounts = await locals.prisma.account.findMany({
                where: { isSystem: false },
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: 'asc'
                }
            });
            
            const devices = await locals.prisma.device.findMany({
                where: {
                    radarSensor: null
                },
                select: {
                    id: true,
                    name: true,
                    hardwareId: true
                },
                orderBy: {
                    name: 'asc'
                }
            });
            
            return {
                form,
                accounts,
                devices
            };
        } catch (err) {
            logger.error(`Error loading radar sensor form: ${err}`);
            throw error(500, 'Failed to load radar sensor form');
        }
    },
    [SystemRole.ADMIN]
) satisfies PageServerLoad;

export const actions: Actions = {
    create: restrict(
        async ({ request, locals }) => {
            const form = await superValidate(request, zod(radarSensorSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }
            
            try {
                const account = await locals.prisma.account.findUnique({
                    where: { id: form.data.accountId }
                });
                
                if (!account) {
                    return fail(400, { 
                        form, 
                        error: 'The selected account does not exist' 
                    });
                }
                
                const existingSensor = await locals.prisma.radarSensor.findUnique({
                    where: { serialNumber: form.data.serialNumber }
                });
                
                if (existingSensor) {
                    return fail(400, {
                        form,
                        error: 'A radar sensor with this serial number already exists'
                    });
                }
                
                if (form.data.deviceId) {
                    const device = await locals.prisma.device.findUnique({
                        where: { id: form.data.deviceId },
                        include: { radarSensor: true }
                    });
                    
                    if (!device) {
                        return fail(400, {
                            form,
                            error: 'The selected device does not exist'
                        });
                    }
                    
                    if (device.radarSensor) {
                        return fail(400, {
                            form,
                            error: 'The selected device is already linked to another radar sensor'
                        });
                    }
                }
                
                const radarSensor = await locals.prisma.radarSensor.create({
                    data: {
                        name: form.data.name,
                        serialNumber: form.data.serialNumber,
                        description: form.data.description,
                        location: form.data.location,
                        firmware: form.data.firmware,
                        status: form.data.status,
                        accountId: form.data.accountId,
                        deviceId: form.data.deviceId || null,
                        createdBy: locals.user.id
                    }
                });
                
                logger.info(`Radar Sensor created: ${radarSensor.id} (${radarSensor.serialNumber})`);

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'RadarSensor',
                    recordId: radarSensor.id,
                    oldData: null,
                    newData: radarSensor,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });
                
                return { 
                    form,
                    success: true,
                    message: {
                        type: 'success' as const,
                        text: 'Radar Sensor registered successfully',
                        details: `Radar Sensor '${radarSensor.name}' (${radarSensor.serialNumber}) has been registered.`
                    }
                };
            } catch (err) {
                logger.error(`Error creating radar sensor: ${err}`);
                return fail(500, { 
                    form, 
                    error: 'Failed to register radar sensor. Please try again.' 
                });
            }
        },
        [SystemRole.ADMIN]
    )
};
