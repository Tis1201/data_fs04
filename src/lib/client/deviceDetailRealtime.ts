import { sseStore } from '$lib/stores/sse-store';

const MAX_ACTION_LOGS = 15;

type ActionLog = {
  id: string;
  deviceId: string;
  actionType: string;
  status: string;
  progress: number | null;
  initiatedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  message: string | null;
  user: any | null;
};

/**
 * Subscribes to device detail realtime events and updates action logs.
 * Returns an unsubscribe function.
 */
export function subscribeDeviceDetailEvents(
  deviceId: string,
  getLogs: () => ActionLog[],
  setLogs: (logs: ActionLog[]) => void
): () => void {
  const unsubscribe = sseStore.on('*', (msg: any) => {
    const evt = msg?.data ?? msg;
    const evtType = evt?.type || msg?.event || evt?.payload?.type;
    const data = evt?.payload?.action === 'firmwareStatus' ? { ...evt.payload, type: 'device:firmwareStatus' }
               : evt?.payload?.action === 'snapshotStatus' ? { ...evt.payload, type: 'device:snapshotStatus' }
               : evt?.payload?.action === 'terminalStatus' ? { ...evt.payload, type: 'device:terminalStatus' }
               : evt?.payload?.action === 'logsStatus' ? { ...evt.payload, type: 'device:logsStatus' }
               : evt;
    
    // Debug logging for all events
    if (evtType?.includes('firmware') || data?.type?.includes('firmware') || evt?.payload?.action === 'firmwareStatus') {
      console.log('[DeviceDetailRealtime] Received firmware-related event:', { evtType, dataType: data?.type, msg, evt, data });
    }

    // Connection events: update device connected state is handled by page (skip here)

    // Firmware status updates
    if (evtType === 'device:firmwareStatus' || data?.type === 'device:firmwareStatus') {
      console.log('[DeviceDetailRealtime] Firmware status update received:', { evtType, dataType: data?.type, data, deviceId });
      if (!data || data.deviceId !== deviceId) {
        console.log('[DeviceDetailRealtime] Skipping firmware update - wrong device:', { dataDeviceId: data?.deviceId, targetDeviceId: deviceId });
        return;
      }
      const logId = data.logId as string | undefined;
      const mapStatus = (s?: string) => (s === 'success' ? 'success' : s === 'failed' ? 'failed' : 'in_progress');
      const newStatus = mapStatus(data.status);
      const progress = typeof data.progress === 'number' ? data.progress : undefined;
      const message = data.message as string | undefined;

      const logs = getLogs();
      console.log('[DeviceDetailRealtime] Firmware update - Looking for logId:', logId, 'in', logs.length, 'logs');
      
      if (logId) {
        const idx = logs.findIndex((l) => l.id === logId);
        console.log('[DeviceDetailRealtime] Found log at index:', idx);
        
        if (idx >= 0) {
          const existing = logs[idx];
          console.log('[DeviceDetailRealtime] Updating existing log:', existing);
          
          const completedAt = (newStatus === 'success' || newStatus === 'failed') ? new Date().toISOString() : existing.completedAt ?? null;
          
          // Calculate duration if completed
          let durationMs = existing.durationMs;
          if (completedAt && existing.initiatedAt) {
            const startTime = new Date(existing.initiatedAt).getTime();
            const endTime = new Date(completedAt).getTime();
            durationMs = endTime - startTime;
          }
          
          logs[idx] = {
            ...existing,
            status: newStatus,
            progress: (progress ?? existing.progress) ?? null,
            message: message ?? existing.message ?? null,
            completedAt,
            durationMs
          } as ActionLog;
          console.log('[DeviceDetailRealtime] Updated log:', logs[idx]);
          return setLogs([...logs]);
        } else {
          console.log('[DeviceDetailRealtime] Log not found with logId:', logId);
          console.log('[DeviceDetailRealtime] Looking for any firmware_update log in progress...');
          
          // Look for any existing firmware_update log that's in progress
          const firmwareLogIdx = logs.findIndex((l) => 
            l.actionType === 'firmware_update' && 
            (l.status === 'initiated' || l.status === 'in_progress')
          );
          
          if (firmwareLogIdx >= 0) {
            console.log('[DeviceDetailRealtime] Found existing firmware log at index:', firmwareLogIdx);
            const existing = logs[firmwareLogIdx];
            const completedAt = (newStatus === 'success' || newStatus === 'failed') ? new Date().toISOString() : existing.completedAt ?? null;
            
            // Calculate duration if completed
            let durationMs = existing.durationMs;
            if (completedAt && existing.initiatedAt) {
              const startTime = new Date(existing.initiatedAt).getTime();
              const endTime = new Date(completedAt).getTime();
              durationMs = endTime - startTime;
            }
            
            logs[firmwareLogIdx] = {
              ...existing,
              status: newStatus,
              progress: (progress ?? existing.progress) ?? null,
              message: message ?? existing.message ?? null,
              completedAt,
              durationMs
            } as ActionLog;
            console.log('[DeviceDetailRealtime] Updated existing firmware log:', logs[firmwareLogIdx]);
            return setLogs([...logs]);
          } else {
            console.log('[DeviceDetailRealtime] No firmware log found, creating new one');
            // Only create a new log if no firmware log exists at all
            const completedAt = (newStatus === 'success' || newStatus === 'failed') ? new Date().toISOString() : null;
            const newLog = {
              id: logId,
              deviceId,
              actionType: 'firmware_update',
              status: newStatus,
              progress: progress ?? null,
              initiatedAt: new Date().toISOString(),
              completedAt,
              durationMs: null,
              message: message ?? null,
              user: null
            } as ActionLog;
            console.log('[DeviceDetailRealtime] Created new log:', newLog);
            setLogs([newLog, ...logs].slice(0, MAX_ACTION_LOGS));
            return;
          }
        }
      }

      // Only create a new log if we don't have a logId (shouldn't happen in normal flow)
      // This is a fallback for cases where the device reports status without a logId
      if (!logId) {
        console.log('[DeviceDetailRealtime] No logId provided, looking for existing firmware log...');
        
        // Look for any existing firmware_update log that's in progress
        const firmwareLogIdx = logs.findIndex((l) => 
          l.actionType === 'firmware_update' && 
          (l.status === 'initiated' || l.status === 'in_progress')
        );
        
        if (firmwareLogIdx >= 0) {
          console.log('[DeviceDetailRealtime] Found existing firmware log at index:', firmwareLogIdx);
          const existing = logs[firmwareLogIdx];
          const completedAt = (newStatus === 'success' || newStatus === 'failed') ? new Date().toISOString() : existing.completedAt ?? null;
          
          // Calculate duration if completed
          let durationMs = existing.durationMs;
          if (completedAt && existing.initiatedAt) {
            const startTime = new Date(existing.initiatedAt).getTime();
            const endTime = new Date(completedAt).getTime();
            durationMs = endTime - startTime;
          }
          
          logs[firmwareLogIdx] = {
            ...existing,
            status: newStatus,
            progress: (progress ?? existing.progress) ?? null,
            message: message ?? existing.message ?? null,
            completedAt,
            durationMs
          } as ActionLog;
          console.log('[DeviceDetailRealtime] Updated existing firmware log:', logs[firmwareLogIdx]);
          return setLogs([...logs]);
        } else {
          console.log('[DeviceDetailRealtime] No firmware log found, creating new one');
          setLogs([
            {
              id: `temp-${Date.now()}`,
              deviceId,
              actionType: 'firmware_update',
              status: newStatus,
              progress: progress ?? null,
              initiatedAt: new Date().toISOString(),
              completedAt: (newStatus === 'success' || newStatus === 'failed') ? new Date().toISOString() : null,
              durationMs: null,
              message: message ?? null,
              user: null
            },
            ...logs
          ].slice(0, MAX_ACTION_LOGS));
        }
      }
      return;
    }

    // Snapshot status updates
    if (evtType === 'device:snapshotStatus' || data?.type === 'device:snapshotStatus') {
      const s = data;
      if (!s || s.deviceId !== deviceId) return;
      const mapStatus = (v?: string) => (v === 'success' ? 'success' : v === 'failed' ? 'failed' : 'in_progress');
      const newStatus = mapStatus(s.status);
      const message = s.message as string | undefined;
      const completedAt = s.completedAt || null;
      const durationMs = typeof s.durationMs === 'number' ? s.durationMs : null;
      const logId = s.logId as string | undefined;

      const logs = getLogs();
      let updated = false;
      if (logId) {
        const idxById = logs.findIndex((l) => l.id === logId);
        if (idxById >= 0) {
          const existing = logs[idxById];
          logs[idxById] = {
            ...existing,
            status: newStatus,
            message: message ?? existing.message ?? null,
            completedAt: completedAt || ((newStatus === 'success' || newStatus === 'failed') ? new Date().toISOString() : existing.completedAt ?? null),
            durationMs: (durationMs ?? existing.durationMs) ?? null
          } as ActionLog;
          setLogs([...logs]);
          updated = true;
        }
      }
      if (!updated) {
        const latestSnapIdx = logs.findIndex((l) => l.actionType === 'snapshot');
        if (latestSnapIdx >= 0) {
          const existing = logs[latestSnapIdx];
          logs[latestSnapIdx] = {
            ...existing,
            id: logId ?? existing.id,
            status: newStatus,
            message: message ?? existing.message ?? null,
            completedAt: completedAt || ((newStatus === 'success' || newStatus === 'failed') ? new Date().toISOString() : existing.completedAt ?? null),
            durationMs: (durationMs ?? existing.durationMs) ?? null
          } as ActionLog;
          setLogs([...logs]);
          updated = true;
        }
      }
      if (!updated) {
        setLogs([
          {
            id: logId ?? `temp-${Date.now()}`,
            deviceId,
            actionType: 'snapshot',
            status: newStatus,
            progress: null,
            initiatedAt: new Date().toISOString(),
            completedAt: completedAt || ((newStatus === 'success' || newStatus === 'failed') ? new Date().toISOString() : null),
            durationMs,
            message: message ?? null,
            user: null
          },
          ...logs
        ].slice(0, MAX_ACTION_LOGS));
      }
      return;
    }

    // Terminal status updates
    if (evtType === 'device:terminalStatus' || data?.type === 'device:terminalStatus') {
      const t = data;
      if (!t || t.deviceId !== deviceId) return;
      const logId = t.logId as string | undefined;
      const mapStatus = (v?: string) => (v === 'success' ? 'success' : v === 'failed' ? 'failed' : 'in_progress');
      const newStatus = mapStatus(t.status);
      const message = t.message as string | undefined;
      const completedAt = t.completedAt || null;
      const durationMs = typeof t.durationMs === 'number' ? t.durationMs : null;

      const logs = getLogs();
      if (logId) {
        const idx = logs.findIndex((l) => l.id === logId);
        if (idx >= 0) {
          const existing = logs[idx];
          logs[idx] = {
            ...existing,
            status: newStatus,
            message: message ?? existing.message ?? null,
            completedAt: completedAt || ((newStatus === 'success' || newStatus === 'failed') ? new Date().toISOString() : existing.completedAt ?? null),
            durationMs: (durationMs ?? existing.durationMs) ?? null
          } as ActionLog;
          setLogs([...logs]);
          return;
        }
      }

      const pendingIdx = logs.findIndex((l) => l.actionType === 'terminal' && (l.status === 'initiated' || l.status === 'in_progress'));
      if (pendingIdx >= 0) {
        const existing = logs[pendingIdx];
        logs[pendingIdx] = {
          ...existing,
          id: logId ?? existing.id,
          status: newStatus,
          message: message ?? existing.message ?? null,
          completedAt: completedAt || ((newStatus === 'success' || newStatus === 'failed') ? new Date().toISOString() : existing.completedAt ?? null),
          durationMs: (durationMs ?? existing.durationMs) ?? null
        } as ActionLog;
        setLogs([...logs]);
        return;
      }

      setLogs([
        {
          id: logId ?? `temp-${Date.now()}`,
          deviceId,
          actionType: 'terminal',
          status: newStatus,
          progress: null,
          initiatedAt: new Date().toISOString(),
          completedAt: completedAt || ((newStatus === 'success' || newStatus === 'failed') ? new Date().toISOString() : null),
          durationMs,
          message: message ?? 'Terminal session established',
          user: null
        },
        ...logs
      ].slice(0, MAX_ACTION_LOGS));
      return;
    }

    // Logs status updates
    if (evtType === 'device:logsStatus' || data?.type === 'device:logsStatus') {
      if (!data || data.deviceId !== deviceId) return;
      const logId = data.logId as string | undefined;
      const mapStatus = (s?: string) => (s === 'success' ? 'success' : s === 'failed' ? 'failed' : 'in_progress');
      const newStatus = mapStatus(data.status);
      const message = data.message as string | undefined;
      const durationMs = typeof data.durationMs === 'number' ? data.durationMs : null;

      const logs = getLogs();
      if (logId) {
        const idx = logs.findIndex((l) => l.id === logId);
        if (idx >= 0) {
          const existing = logs[idx];
          logs[idx] = {
            ...existing,
            status: newStatus,
            message: message ?? existing.message ?? null,
            completedAt: (newStatus === 'success' || newStatus === 'failed') ? new Date().toISOString() : existing.completedAt ?? null,
            durationMs: (durationMs ?? existing.durationMs) ?? null
          } as ActionLog;
          return setLogs([...logs]);
        }
      }

      // If no existing log found, create a new one
      setLogs([
        {
          id: logId ?? `temp-${Date.now()}`,
          deviceId,
          actionType: 'logs',
          status: newStatus,
          progress: null,
          initiatedAt: new Date().toISOString(),
          completedAt: (newStatus === 'success' || newStatus === 'failed') ? new Date().toISOString() : null,
          durationMs: durationMs,
          message: message ?? null,
          user: null
        },
        ...logs
      ].slice(0, MAX_ACTION_LOGS));
      return;
    }
  });

  return () => {
    try { unsubscribe(); } catch {}
  };
}


