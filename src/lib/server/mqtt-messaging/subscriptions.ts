import { sharedSubscription } from './topics';

const SHARED_GROUP = process.env.MQTT_SHARED_GROUP ?? 'server';

const WORKER_TOPIC_PATTERNS = [
    'mqtt/device/+/requests',
    'mqtt/device/+/events',
    'mqtt/web/+/requests',
    'mqtt/web/+/events'
] as const;

export function getWorkerSubscriptions(group: string = SHARED_GROUP): string[] {
    return WORKER_TOPIC_PATTERNS.map((pattern) => sharedSubscription(pattern, group));
}
