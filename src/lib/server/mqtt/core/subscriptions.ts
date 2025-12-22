/********************************************************************************************
 * Resolve shared subscription group for worker consumers.
 ********************************************************************************************/
const SHARED_GROUP = process.env.MQTT_SHARED_GROUP ?? 'server';

console.log('group', SHARED_GROUP, process.env.MQTT_SHARED_GROUP);

/********************************************************************************************
 * Topic templates the worker should join under a shared group.
 ********************************************************************************************/
const WORKER_TOPIC_PATTERNS = [
    // Device topics
    'device/+/requests',
    'device/+/events',
    'device/+/replies',
    // User topics
    'user/+/requests',
    'user/+/events',
    'user/+/replies',
    // Controller topics (device:<id>/controller/<type>:<controllerId>/...)
    // Uses + at root since controller topics start with device:<id> (varying)
    '+/controller/+/requests',
    '+/controller/+/replies',
    '+/controller/+/data',
    // System events
    '$events/client/connected',
    '$events/client/disconnected'
] as const;

/********************************************************************************************
 * Materialize MQTT subscription topics scoped to the shared group.
 ********************************************************************************************/
export function getWorkerSubscriptions(group: string = SHARED_GROUP): string[] {
    return WORKER_TOPIC_PATTERNS.map((pattern) => `$share/${group}/${pattern}`);
    // return WORKER_TOPIC_PATTERNS.map((pattern) => `$share/server_10/${pattern}`);

}
