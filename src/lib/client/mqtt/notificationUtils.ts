export function decodeNotificationJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) {
      console.warn('[MQTT Notification] Invalid JWT format: missing parts');
      return null;
    }
    const payloadSegment = parts[1];
    
    // JWT uses base64url encoding (RFC 7515)
    // Base64url uses - and _ instead of + and /, and omits padding
    // We need to convert to standard base64 for atob()
    let normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed (base64 requires padding to be a multiple of 4)
    const paddingNeeded = (4 - (normalized.length % 4)) % 4;
    if (paddingNeeded > 0) {
      normalized = normalized + '='.repeat(paddingNeeded);
    }
    
    try {
      const json = atob(normalized);
      return JSON.parse(json);
    } catch (decodeErr) {
      // If atob fails, try without padding (some JWTs might have correct padding already)
      const withoutPadding = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
      try {
        const json2 = atob(withoutPadding);
        return JSON.parse(json2);
      } catch {
        console.warn('[MQTT Notification] Failed to decode JWT payload after retry:', decodeErr);
        return null;
      }
    }
  } catch (err) {
    console.warn('[MQTT Notification] Failed to decode JWT payload', err);
    return null;
  }
}
