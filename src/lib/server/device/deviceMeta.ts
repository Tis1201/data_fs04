//Device metadata
export interface DeviceMeta {
    id: string;
    deviceType?: string;
    os?: string;
    osVersion?: string;
    model?: string; 
    connectionId?: string;

    claimedByConnectionId?: string;
    claimedAt?: Date;
}