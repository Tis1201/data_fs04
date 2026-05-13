/**
 * Shared IANA timezone options for device/profile configuration.
 * Use across EditDeviceModal, AddEditProfileModal, ProfileSettingsEditor, etc.
 */

export interface TimezoneOption {
    id: string;
    label: string;
}

/** Full list of common IANA timezones for dropdowns (id/label format) */
export const timezoneOptions: TimezoneOption[] = [
    { id: 'UTC', label: 'UTC' },
    // Americas - North America
    { id: 'America/New_York', label: 'America/New_York (EST/EDT)' },
    { id: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
    { id: 'America/Denver', label: 'America/Denver (MST/MDT)' },
    { id: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
    { id: 'America/Toronto', label: 'America/Toronto (EST/EDT)' },
    { id: 'America/Vancouver', label: 'America/Vancouver (PST/PDT)' },
    { id: 'America/Detroit', label: 'America/Detroit (EST/EDT)' },
    { id: 'America/Indiana/Indianapolis', label: 'America/Indiana/Indianapolis (EST/EDT)' },
    { id: 'America/Phoenix', label: 'America/Phoenix (MST)' },
    { id: 'America/Anchorage', label: 'America/Anchorage (AKST/AKDT)' },
    { id: 'America/Honolulu', label: 'America/Honolulu (HST)' },
    // Americas - Central & South America
    { id: 'America/Mexico_City', label: 'America/Mexico_City (CST/CDT)' },
    { id: 'America/Guatemala', label: 'America/Guatemala (CST)' },
    { id: 'America/Bogota', label: 'America/Bogota (COT)' },
    { id: 'America/Caracas', label: 'America/Caracas (VET)' },
    { id: 'America/Sao_Paulo', label: 'America/Sao_Paulo (BRT)' },
    { id: 'America/Buenos_Aires', label: 'America/Buenos_Aires (ART)' },
    { id: 'America/Santiago', label: 'America/Santiago (CLT)' },
    { id: 'America/Lima', label: 'America/Lima (PET)' },
    { id: 'America/La_Paz', label: 'America/La_Paz (BOT)' },
    { id: 'America/Montevideo', label: 'America/Montevideo (UYT)' },
    // Europe
    { id: 'Europe/London', label: 'Europe/London (GMT/BST)' },
    { id: 'Europe/Dublin', label: 'Europe/Dublin (GMT/IST)' },
    { id: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
    { id: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
    { id: 'Europe/Rome', label: 'Europe/Rome (CET/CEST)' },
    { id: 'Europe/Madrid', label: 'Europe/Madrid (CET/CEST)' },
    { id: 'Europe/Amsterdam', label: 'Europe/Amsterdam (CET/CEST)' },
    { id: 'Europe/Brussels', label: 'Europe/Brussels (CET/CEST)' },
    { id: 'Europe/Vienna', label: 'Europe/Vienna (CET/CEST)' },
    { id: 'Europe/Zurich', label: 'Europe/Zurich (CET/CEST)' },
    { id: 'Europe/Stockholm', label: 'Europe/Stockholm (CET/CEST)' },
    { id: 'Europe/Oslo', label: 'Europe/Oslo (CET/CEST)' },
    { id: 'Europe/Copenhagen', label: 'Europe/Copenhagen (CET/CEST)' },
    { id: 'Europe/Helsinki', label: 'Europe/Helsinki (EET/EEST)' },
    { id: 'Europe/Warsaw', label: 'Europe/Warsaw (CET/CEST)' },
    { id: 'Europe/Prague', label: 'Europe/Prague (CET/CEST)' },
    { id: 'Europe/Budapest', label: 'Europe/Budapest (CET/CEST)' },
    { id: 'Europe/Athens', label: 'Europe/Athens (EET/EEST)' },
    { id: 'Europe/Istanbul', label: 'Europe/Istanbul (TRT)' },
    { id: 'Europe/Moscow', label: 'Europe/Moscow (MSK)' },
    { id: 'Europe/Kiev', label: 'Europe/Kiev (EET/EEST)' },
    { id: 'Europe/Bucharest', label: 'Europe/Bucharest (EET/EEST)' },
    { id: 'Europe/Sofia', label: 'Europe/Sofia (EET/EEST)' },
    { id: 'Europe/Lisbon', label: 'Europe/Lisbon (WET/WEST)' },
    // Asia - East Asia
    { id: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
    { id: 'Asia/Seoul', label: 'Asia/Seoul (KST)' },
    { id: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
    { id: 'Asia/Beijing', label: 'Asia/Beijing (CST)' },
    { id: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong (HKT)' },
    { id: 'Asia/Taipei', label: 'Asia/Taipei (CST)' },
    { id: 'Asia/Macau', label: 'Asia/Macau (CST)' },
    // Asia - Southeast Asia
    { id: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
    { id: 'Asia/Kuala_Lumpur', label: 'Asia/Kuala_Lumpur (MYT)' },
    { id: 'Asia/Jakarta', label: 'Asia/Jakarta (WIB)' },
    { id: 'Asia/Bangkok', label: 'Asia/Bangkok (ICT)' },
    { id: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (ICT)' },
    { id: 'Asia/Manila', label: 'Asia/Manila (PHT)' },
    { id: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
    { id: 'Asia/Dhaka', label: 'Asia/Dhaka (BST)' },
    { id: 'Asia/Karachi', label: 'Asia/Karachi (PKT)' },
    { id: 'Asia/Kathmandu', label: 'Asia/Kathmandu (NPT)' },
    // Asia - Middle East
    { id: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
    { id: 'Asia/Riyadh', label: 'Asia/Riyadh (AST)' },
    { id: 'Asia/Tehran', label: 'Asia/Tehran (IRST)' },
    { id: 'Asia/Baghdad', label: 'Asia/Baghdad (AST)' },
    { id: 'Asia/Jerusalem', label: 'Asia/Jerusalem (IST/IDT)' },
    { id: 'Asia/Beirut', label: 'Asia/Beirut (EET/EEST)' },
    { id: 'Asia/Damascus', label: 'Asia/Damascus (EET/EEST)' },
    { id: 'Asia/Amman', label: 'Asia/Amman (EET/EEST)' },
    // Australia/Oceania
    { id: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
    { id: 'Australia/Melbourne', label: 'Australia/Melbourne (AEST/AEDT)' },
    { id: 'Australia/Brisbane', label: 'Australia/Brisbane (AEST)' },
    { id: 'Australia/Perth', label: 'Australia/Perth (AWST)' },
    { id: 'Australia/Adelaide', label: 'Australia/Adelaide (ACST/ACDT)' },
    { id: 'Australia/Darwin', label: 'Australia/Darwin (ACST)' },
    { id: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST/NZDT)' },
    { id: 'Pacific/Fiji', label: 'Pacific/Fiji (FJT)' },
    { id: 'Pacific/Guam', label: 'Pacific/Guam (ChST)' },
    { id: 'Pacific/Honolulu', label: 'Pacific/Honolulu (HST)' },
    // Africa
    { id: 'Africa/Cairo', label: 'Africa/Cairo (EET)' },
    { id: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST)' },
    { id: 'Africa/Lagos', label: 'Africa/Lagos (WAT)' },
    { id: 'Africa/Casablanca', label: 'Africa/Casablanca (WET)' },
    { id: 'Africa/Algiers', label: 'Africa/Algiers (CET)' },
    { id: 'Africa/Tunis', label: 'Africa/Tunis (CET)' },
    { id: 'Africa/Tripoli', label: 'Africa/Tripoli (EET)' },
    { id: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT)' },
    { id: 'Africa/Addis_Ababa', label: 'Africa/Addis_Ababa (EAT)' },
    { id: 'Africa/Dar_es_Salaam', label: 'Africa/Dar_es_Salaam (EAT)' },
    { id: 'Africa/Kampala', label: 'Africa/Kampala (EAT)' },
    { id: 'Africa/Accra', label: 'Africa/Accra (GMT)' },
    { id: 'Africa/Abidjan', label: 'Africa/Abidjan (GMT)' },
    { id: 'Africa/Dakar', label: 'Africa/Dakar (GMT)' },
    { id: 'Africa/Bamako', label: 'Africa/Bamako (GMT)' },
    { id: 'Africa/Ouagadougou', label: 'Africa/Ouagadougou (GMT)' },
    { id: 'Africa/Conakry', label: 'Africa/Conakry (GMT)' },
    { id: 'Africa/Freetown', label: 'Africa/Freetown (GMT)' },
    { id: 'Africa/Monrovia', label: 'Africa/Monrovia (GMT)' },
    { id: 'Africa/Banjul', label: 'Africa/Banjul (GMT)' },
    { id: 'Africa/Bissau', label: 'Africa/Bissau (GMT)' },
    { id: 'Africa/Nouakchott', label: 'Africa/Nouakchott (GMT)' },
    { id: 'Africa/Sao_Tome', label: 'Africa/Sao_Tome (GMT)' },
    { id: 'Africa/Luanda', label: 'Africa/Luanda (WAT)' },
    { id: 'Africa/Kinshasa', label: 'Africa/Kinshasa (WAT)' },
    { id: 'Africa/Brazzaville', label: 'Africa/Brazzaville (WAT)' },
    { id: 'Africa/Douala', label: 'Africa/Douala (WAT)' },
    { id: 'Africa/Libreville', label: 'Africa/Libreville (WAT)' },
    { id: 'Africa/Malabo', label: 'Africa/Malabo (WAT)' },
    { id: 'Africa/Niamey', label: 'Africa/Niamey (WAT)' },
    { id: 'Africa/Porto-Novo', label: 'Africa/Porto-Novo (WAT)' },
    { id: 'Africa/Ndjamena', label: 'Africa/Ndjamena (WAT)' },
    { id: 'Africa/Bangui', label: 'Africa/Bangui (WAT)' },
    { id: 'Africa/Bujumbura', label: 'Africa/Bujumbura (CAT)' },
    { id: 'Africa/Gaborone', label: 'Africa/Gaborone (CAT)' },
    { id: 'Africa/Harare', label: 'Africa/Harare (CAT)' },
    { id: 'Africa/Kigali', label: 'Africa/Kigali (CAT)' },
    { id: 'Africa/Lubumbashi', label: 'Africa/Lubumbashi (CAT)' },
    { id: 'Africa/Lusaka', label: 'Africa/Lusaka (CAT)' },
    { id: 'Africa/Maputo', label: 'Africa/Maputo (CAT)' },
    { id: 'Africa/Blantyre', label: 'Africa/Blantyre (CAT)' },
    { id: 'Africa/Windhoek', label: 'Africa/Windhoek (WAT/CAT)' }
];

/** For components using { value, label } (e.g. SettingsMatrix Select) */
export const timezoneOptionsForSelect = timezoneOptions.map((o) => ({
    value: o.id,
    label: o.label
}));

/**
 * Get display label for an IANA timezone id.
 * Uses the shared list when available; otherwise returns the raw id (e.g. "America/New_York").
 */
export function formatTimezoneLabel(ianaId: string | null | undefined): string {
    if (!ianaId) return '—';
    const opt = timezoneOptions.find((o) => o.id === ianaId);
    return opt?.label ?? ianaId;
}
