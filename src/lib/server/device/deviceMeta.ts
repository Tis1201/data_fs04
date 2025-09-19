//Device metadata
export interface DeviceMeta {
    id: string;
    deviceType?: string;
    os?: string;
    osVersion?: string;
    model?: string; 
    connectionId?: string;
    
    // Network identifiers
    macAddress?: string;
    wifiMac?: string;
    lanMac?: string;

    claimedByConnectionId?: string;
    claimedById?: string;
    claimedAt?: Date;
}