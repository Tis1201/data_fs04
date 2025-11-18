const SHARED_GROUP = process.env.MQTT_SHARED_GROUP ?? 'server';

const WORKER_TOPIC_PATTERNS = [
    'device/+/requests',
    'device/+/events',
    'web/+/requests',
    'web/+/events'
] as const;

export function getWorkerSubscriptions(group: string = SHARED_GROUP): string[] {
    return WORKER_TOPIC_PATTERNS.map((pattern) => `$share/${group}/${pattern}`);
}
