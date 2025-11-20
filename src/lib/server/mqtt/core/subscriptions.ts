const SHARED_GROUP = process.env.MQTT_SHARED_GROUP ?? 'server';

console.log('group', SHARED_GROUP, process.env.MQTT_SHARED_GROUP);
    

const WORKER_TOPIC_PATTERNS = [
    'device/+/requests',
    'device/+/events',
    'device/+/replies',
    'user/+/requests',
    'user/+/events',
    'user/+/replies'
] as const;

export function getWorkerSubscriptions(group: string = SHARED_GROUP): string[] {
    return WORKER_TOPIC_PATTERNS.map((pattern) => `$share/${group}/${pattern}`);
    // return WORKER_TOPIC_PATTERNS.map((pattern) => `$share/server_10/${pattern}`);
    
}
