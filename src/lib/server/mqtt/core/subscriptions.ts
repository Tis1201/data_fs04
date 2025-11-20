/********************************************************************************************
 * Resolve shared subscription group for worker consumers.
 ********************************************************************************************/
const SHARED_GROUP = process.env.MQTT_SHARED_GROUP ?? 'server';

console.log('group', SHARED_GROUP, process.env.MQTT_SHARED_GROUP);
    
/********************************************************************************************
 * Topic templates the worker should join under a shared group.
 ********************************************************************************************/
const WORKER_TOPIC_PATTERNS = [
    'device/+/requests',
    'device/+/events',
    'device/+/replies',
    'user/+/requests',
    'user/+/events',
    'user/+/replies'
] as const;

/********************************************************************************************
 * Materialize MQTT subscription topics scoped to the shared group.
 ********************************************************************************************/
export function getWorkerSubscriptions(group: string = SHARED_GROUP): string[] {
    return WORKER_TOPIC_PATTERNS.map((pattern) => `$share/${group}/${pattern}`);
    // return WORKER_TOPIC_PATTERNS.map((pattern) => `$share/server_10/${pattern}`);
    
}
