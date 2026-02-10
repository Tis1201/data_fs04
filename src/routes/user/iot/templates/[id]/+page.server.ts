import type { PageServerLoad, Actions } from './$types';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';

/**
 * Template config shape (mirrors radar sensor config: tracking area + zones).
 * Placeholder until templates API exists.
 */
export interface TemplateConfig {
    trackingArea?: {
        startX: number;
        startY: number;
        endX: number;
        endY: number;
    };
    zones?: Array<{
        id?: string;
        name: string;
        zoneNumber: number;
        startX: number;
        startY: number;
        endX: number;
        endY: number;
        color?: string;
        active?: boolean;
    }>;
}

export interface TemplateDetail {
    id: string;
    name: string;
    type: 'Alert' | 'Configuration';
    description: string | null;
    createdBy: string;
    createdAt: string;
    updatedBy: string;
    updatedAt: string;
    config: TemplateConfig | null;
}

/** Placeholder row for Assigned Sensor table (no API yet). */
export interface AssignedSensorRow {
    id: string;
    name: string;
    location: string;
    status: string;
    lastSeen: string;
}

export const load = restrict(
    async ({ params, depends }: AuthenticatedLoadEvent) => {
        depends('app:userTemplates');

        const id = params?.id ?? '';
        // Placeholder: return one template with sample config for Configuration tab
        const template: TemplateDetail | null = id
            ? {
                  id,
                  name: '<Device Name>',
                  type: 'Configuration',
                  description: null,
                  createdBy: 'John P. Doe',
                  createdAt: '2026-01-01T13:21:00.000Z',
                  updatedBy: 'John P. Doe',
                  updatedAt: '2026-01-01T14:30:00.000Z',
                  config: {
                      trackingArea: { startX: -5, startY: 0, endX: 5, endY: 10 },
                      zones: [
                          {
                              name: 'Zone 1',
                              zoneNumber: 1,
                              startX: 1,
                              startY: 1,
                              endX: 4,
                              endY: 4,
                              active: true
                          },
                          {
                              name: 'Zone 2',
                              zoneNumber: 2,
                              startX: 3,
                              startY: 5,
                              endX: 6,
                              endY: 8,
                              active: true
                          }
                      ]
                  }
              }
            : null;

        // Placeholder: assigned sensors list and pagination for Assigned Sensor tab (design: "1 - 10 of 439")
        const assignedPage = 1;
        const assignedPerPage = 10;
        const assignedTotal = 439;
        const assignedSensors: AssignedSensorRow[] = [
            { id: '1', name: '<Sensor Name>', location: '<Value 1>, <Value 2>, <Value 3>', status: 'Online', lastSeen: '2 minutes ago' },
            { id: '2', name: '<Sensor Name>', location: '<Value 1>, <Value 2>, <Value 3>', status: 'Online', lastSeen: '5 minutes ago' },
            { id: '3', name: '<Sensor Name>', location: '<Value 1>, <Value 2>, <Value 3>', status: 'Online', lastSeen: '1 hour ago' },
            { id: '4', name: '<Sensor Name>', location: '<Value 1>, <Value 2>, <Value 3>', status: 'Offline', lastSeen: '3 hours ago' },
            { id: '5', name: '<Sensor Name>', location: '<Value 1>, <Value 2>, <Value 3>', status: 'Online', lastSeen: '10 minutes ago' }
        ];

        return {
            template,
            assignedSensors,
            assignedPagination: {
                page: assignedPage,
                per_page: assignedPerPage,
                total_records: assignedTotal,
                total_pages: Math.max(1, Math.ceil(assignedTotal / assignedPerPage))
            }
        };
    },
    [SystemRole.USER]
) satisfies PageServerLoad;

export const actions: Actions = {
    removeSensor: restrict(
        async ({ request }: AuthenticatedEvent) => {
            const form = await request.formData();
            const sensorId = form.get('sensorId') as string | null;
            const templateId = form.get('templateId') as string | null;
            if (!sensorId || !templateId) return { success: false, error: 'Missing sensor or template id' };
            // TODO: call API when available
            return { success: true };
        },
        [SystemRole.USER]
    )
};
