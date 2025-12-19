# Listener Endpoint (DEPRECATED - Removed)

**⚠️ This endpoint has been removed. SSE has been migrated to MQTT.**

The `/api/listen/[...slug]` endpoint previously implemented Server-Sent Events (SSE) for real-time streaming to clients. This functionality has been migrated to MQTT.

## Migration

- **Old:** SSE connections via `/api/listen/{slug}`
- **New:** MQTT notifications via `mqttClient.onNotification()`

For external integrations, use the MQTT broker connection with appropriate authentication and topic subscriptions.

## Admin Interface

The admin interface for managing listeners is still available at:
```
/admin/settings/listeners
```

However, listeners now use MQTT for real-time communication instead of SSE.
