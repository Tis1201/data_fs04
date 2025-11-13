const MQTT_NAMESPACE = 'mqtt';
const DEFAULT_SHARED_GROUP = process.env.MQTT_SHARED_GROUP ?? 'server';

export function userTopic(userId: string): string {
    return `${MQTT_NAMESPACE}/web/${userId}`;
}

export function deviceTopic(deviceId: string): string {
    return `${MQTT_NAMESPACE}/device/${deviceId}`;
}

export function accountTopic(accountId: string): string {
    return `${MQTT_NAMESPACE}/account/${accountId}`;
}

export function systemTopic(event: string): string {
    return `${MQTT_NAMESPACE}/system/${event}`;
}

export function sharedSubscription(topic: string, group: string = DEFAULT_SHARED_GROUP): string {
    return `$share/${group}/${topic}`;
}
