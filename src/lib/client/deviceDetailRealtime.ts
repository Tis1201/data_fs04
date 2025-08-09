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
               : evt;

    // Connection events: update device connected state is handled by page (skip here)

    // Firmware status updates
    if (evtType === 'device:firmwareStatus' || data?.type === 'device:firmwareStatus') {
      if (!data || data.deviceId !== deviceId) return;
      const logId = data.logId as string | undefined;
      const mapStatus = (s?: string) => (s === 'success' ? 'success' : s === 'failed' ? 'failed' : 'in_progress');
      const newStatus = mapStatus(data.status);
      const progress = typeof data.progress === 'number' ? data.progress : undefined;
      const message = data.message as string | undefined;

      const logs = getLogs();
      if (logId) {
        const idx = logs.findIndex((l) => l.id === logId);
        if (idx >= 0) {
          const existing = logs[idx];
          logs[idx] = {
            ...existing,
            status: newStatus,
            progress: (progress ?? existing.progress) ?? null,
            message: message ?? existing.message ?? null,
            completedAt: (newStatus === 'success' || newStatus === 'failed') ? new Date().toISOString() : existing.completedAt ?? null
          } as ActionLog;
          return setLogs([...logs]);
        }
      }

      setLogs([
        {
          id: logId ?? `temp-${Date.now()}`,
          deviceId,
          actionType: 'firmware_update',
          status: newStatus,
          progress: progress ?? null,
          initiatedAt: new Date().toISOString(),
          completedAt: null,
          durationMs: null,
          message: message ?? null,
          user: null
        },
        ...logs
      ].slice(0, MAX_ACTION_LOGS));
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
  });

  return () => {
    try { unsubscribe(); } catch {}
  };
}


