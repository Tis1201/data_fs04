/**
 * Registration / reclaim flows: block only when a radar sensor row still exists.
 * The radar list delete action removes the Sensor but leaves the Controller — those devices
 * must be allowed to go through Add Device / PIN again.
 */

export type RadarControllerForGuard = {
    type: string;
    isDeleted: boolean;
    sensors: Array<{ type: string }>;
};

export function deviceHasActiveRadarSensor(controllers: RadarControllerForGuard[]): boolean {
    for (const c of controllers) {
        if (c.type !== 'radar' || c.isDeleted) continue;
        if (c.sensors.some((s) => s.type === 'radar')) return true;
    }
    return false;
}
