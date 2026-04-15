/** Custom trigger rules stored on `Sensor.config.triggerRules` (edge execution is out of scope). */

export type RadarTriggerRuleAuthType = 'none' | 'header';

export interface RadarTriggerRuleConditions {
    dwell_time_sec?: number;
    proximity?: { min?: number; max?: number };
    /** `"entire"` or a zone key: zone id or `zone-${zoneNumber}` */
    tracking_area?: string;
}

export interface RadarTriggerRule {
    id: string;
    name: string;
    enabled: boolean;
    conditions: RadarTriggerRuleConditions;
    trigger: {
        once_per_target?: boolean;
        /** Minimum seconds between successive triggers (0 = no cooldown). */
        cooldown_sec?: number;
    };
    action: {
        type: 'webhook';
        url: string;
        auth?: { type: RadarTriggerRuleAuthType; key?: string; value?: string };
    };
}
