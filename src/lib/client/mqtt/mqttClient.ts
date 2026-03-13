import { browser } from '$app/environment';
import type { MqttClient, IClientOptions } from 'mqtt';
import { decodeNotificationJwtPayload } from './notificationUtils';

export type UserMqttStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

type StatusListener = (status: UserMqttStatus, error: Error | null) => void;

type AuthState = 'unauthenticated' | 'authenticated';

interface MintResult {
  brokerUrl: string;
  clientId: string;
  username: string;
  jwt: string;
}

interface UserMqttClientOptions {
  mintEndpoint?: string;
  maxReconnectAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: ReturnType<typeof setTimeout>;
}

type NotificationHandler = (payload: any) => void;

/** Refresh JWT 5 minutes before it expires (matches mqtt-store.ts) */
const TOKEN_REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

class UserMqttClient {
  private readonly mintEndpoint: string;
  private readonly maxReconnectAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;

  private client: MqttClient | null = null;
  private status: UserMqttStatus = 'idle';
  private readonly statusListeners = new Set<StatusListener>();

  private authState: AuthState = 'unauthenticated';
  private allowConnections = false;

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualDisconnect = false;

  private mintResult: MintResult | null = null;
  private subject: string | null = null;
  private jwtExpiryMs = 0;
  private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly pendingRequests = new Map<string, PendingRequest>();
  private readonly notificationHandlers = new Map<string, Set<NotificationHandler>>();

  constructor(options: UserMqttClientOptions = {}) {
    this.mintEndpoint = options.mintEndpoint ?? '/api/user/mqtt/mint';
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
    this.baseDelayMs = options.baseDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 30000;
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status, null);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private setStatus(status: UserMqttStatus, error: Error | null = null): void {
    this.status = status;
    for (const listener of this.statusListeners) {
      try {
        listener(status, error);
      } catch {
        // ignore listener errors
      }
    }
  }

  setAuthState(state: AuthState): void {
    console.log('[MQTT Client] setAuthState() called', {
      oldState: this.authState,
      newState: state,
      willAllowConnections: state === 'authenticated'
    });
    
    this.authState = state;
    this.allowConnections = state === 'authenticated';

    if (!this.allowConnections) {
      console.log('[MQTT Client] Connections not allowed, disconnecting');
      this.disconnect(true);
    }
  }

  async connect(): Promise<void> {
    console.log('[MQTT Client] connect() called', {
      browser,
      allowConnections: this.allowConnections,
      authState: this.authState,
      clientConnected: this.client?.connected,
      status: this.status
    });
    
    if (!browser) {
      console.log('[MQTT Client] Skipping connect: not in browser');
      return;
    }
    
    if (!this.allowConnections || this.authState !== 'authenticated') {
      console.log('[MQTT Client] Skipping connect: not allowed or not authenticated', {
        allowConnections: this.allowConnections,
        authState: this.authState
      });
      return;
    }

    if (this.client && this.client.connected) {
      console.log('[MQTT Client] Already connected');
      return;
    }
    
    if (this.status === 'connecting' || this.status === 'reconnecting') {
      console.log('[MQTT Client] Already connecting/reconnecting, waiting for completion...');
      // Wait for connection to complete
      return new Promise<void>((resolve, reject) => {
        const checkConnection = () => {
          if (this.status === 'connected') {
            console.log('[MQTT Client] Connection completed while waiting');
            resolve();
          } else if (this.status === 'error') {
            console.log('[MQTT Client] Connection failed while waiting');
            reject(new Error('MQTT connection failed'));
          } else {
            // Check again in 100ms
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.manualDisconnect = false;
    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting', null);

    console.log('[MQTT Client] Starting connection process', {
      hasMintResult: !!this.mintResult,
      reconnectAttempts: this.reconnectAttempts
    });

    try {
      if (!this.mintResult) {
        console.log('[MQTT Client] Minting credentials...');
        this.mintResult = await this.mint();
        console.log('[MQTT Client] Credentials minted successfully', {
          brokerUrl: this.mintResult.brokerUrl,
          clientId: this.mintResult.clientId,
          username: this.mintResult.username
        });
      }

      console.log('[MQTT Client] Opening MQTT connection...');
      await this.openMqttConnection();
      console.log('[MQTT Client] MQTT connection opened');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('MQTT connect failed');
      console.error('[MQTT Client] Connection failed:', error);
      this.setStatus('error', error);
      this.scheduleReconnect();
    }
  }

  disconnect(permanent = true): void {
    this.manualDisconnect = permanent;
    this.clearTokenRefresh();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.client) {
      try {
        this.client.removeAllListeners();
        this.client.end(true);
      } catch {
        // ignore
      }
      this.client = null;
    }

    this.failAllPending(new Error('MQTT client disconnected'));

    if (permanent) {
      this.reconnectAttempts = 0;
      this.mintResult = null;
      this.subject = null;
    }

    this.setStatus('idle', null);
  }

  async request<T = any>(
    op: string,
    params: Record<string, any>,
    opts?: { timeoutMs?: number }
  ): Promise<T> {
    if (!browser) {
      throw new Error('MQTT client not available on server');
    }

    if (!this.client || !this.client.connected || !this.subject) {
      throw new Error('MQTT client not connected');
    }

    const timeoutMs = opts?.timeoutMs ?? 5000;
    const requestId = this.makeRequestId();
    const message = {
      op,
      params,
      requestId,
      timestamp: new Date().toISOString()
    };

    const topic = `user/${this.subject}/requests`;
    const payload = JSON.stringify(message);

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request ${requestId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      this.client!.publish(topic, payload, { qos: 1 }, (err?: Error) => {
        if (err) {
          clearTimeout(timer);
          this.pendingRequests.delete(requestId);
          reject(err);
        }
      });
    });
  }

  onNotification(type: string, handler: NotificationHandler): () => void {
    const key = type || '*';
    let set = this.notificationHandlers.get(key);
    if (!set) {
      set = new Set<NotificationHandler>();
      this.notificationHandlers.set(key, set);
    }
    set.add(handler);

    console.log('[MQTT Client] Registered notification handler for type:', key, 'Total handlers:', set.size);

    return () => {
      const current = this.notificationHandlers.get(key);
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) {
        this.notificationHandlers.delete(key);
      }
      console.log('[MQTT Client] Unregistered notification handler for type:', key);
    };
  }

  private makeRequestId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `req_${Math.random().toString(36).slice(2, 10)}`;
  }

  private async mint(): Promise<MintResult> {
    if (!browser) {
      throw new Error('Cannot mint MQTT credentials on server');
    }

    const res = await fetch(this.mintEndpoint, {
      method: 'POST',
      credentials: 'include'
    });

    if (!res.ok) {
      throw new Error(`Mint failed: ${res.status} ${res.statusText}`);
    }

    const response = await res.json();

    // Unwrap the API response: {success: true, data: {...}}
    const data = response.success ? response.data : response;

    if (!data || !data.brokerUrl || !data.clientId || !data.username || !data.jwt) {
      console.error('[MQTT Client] Mint response missing fields:', data);
      throw new Error('Mint response missing required fields');
    }

    // Parse JWT expiry from the token payload
    try {
      const [, payloadSegment] = data.jwt.split('.');
      if (payloadSegment) {
        const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        const decoded = JSON.parse(atob(padded));
        if (decoded?.exp) {
          this.jwtExpiryMs = decoded.exp * 1000;
          console.log('[MQTT Client] JWT expires at', new Date(this.jwtExpiryMs).toISOString());
        }
      }
    } catch (err) {
      console.warn('[MQTT Client] Failed to decode JWT expiry, using fallback 50min', err);
      this.jwtExpiryMs = Date.now() + 50 * 60 * 1000;
    }

    return {
      brokerUrl: data.brokerUrl,
      clientId: data.clientId,
      username: data.username,
      jwt: data.jwt
    };
  }

  private async openMqttConnection(): Promise<void> {
    console.log('[MQTT Client] openMqttConnection() called', {
      browser,
      hasMintResult: !!this.mintResult
    });
    
    if (!browser) {
      console.log('[MQTT Client] Not in browser, skipping');
      return;
    }
    
    if (!this.mintResult) {
      console.log('[MQTT Client] No mint result, skipping');
      return;
    }

    if (this.client) {
      console.log('[MQTT Client] Cleaning up existing client');
      try {
        this.client.removeAllListeners();
        this.client.end(true);
      } catch {
        // ignore
      }
      this.client = null;
    }

    const { brokerUrl, clientId, username, jwt } = this.mintResult;
    this.subject = username;

    console.log('[MQTT Client] Connecting to broker', {
      brokerUrl,
      clientId,
      username
    });

    const mqttModule = await import('mqtt');

    // Try different import styles
    const connectFn = mqttModule.connect || mqttModule.default?.connect || (mqttModule.default as any);
    if (typeof connectFn !== 'function') {
      console.error('[MQTT Client] Could not find connect function in mqtt module');
      throw new Error('MQTT library did not export connect function');
    }

    const options: IClientOptions = {
      clientId,
      username,
      password: jwt,
      clean: true,
      reconnectPeriod: 0
    };

    console.log('[MQTT Client] Creating MQTT client with options:', {
      clientId: options.clientId,
      username: options.username,
      clean: options.clean,
      reconnectPeriod: options.reconnectPeriod
    });

    const client = connectFn(brokerUrl, options);
    this.client = client;
    
    console.log('[MQTT Client] MQTT client created, waiting for connection...');

    client.on('connect', () => {
      console.log('[MQTT Client] ✅ Connected to broker');
      this.reconnectAttempts = 0;
      this.setStatus('connected', null);
      this.subscribeTopics();
      // this.scheduleTokenRefresh();
    });

    client.on('message', (topic, payload) => {
      this.handleMessage(topic, payload);
    });

    client.on('close', () => {
      console.log('[MQTT Client] Connection closed', {
        manualDisconnect: this.manualDisconnect,
        allowConnections: this.allowConnections,
        authState: this.authState
      });
      this.clearTokenRefresh();
      this.client = null;
      this.failAllPending(new Error('MQTT connection closed'));

      if (this.manualDisconnect || !this.allowConnections || this.authState !== 'authenticated') {
        console.log('[MQTT Client] Not reconnecting (manual disconnect or not authenticated)');
        this.setStatus('idle', null);
        return;
      }

      console.log('[MQTT Client] Scheduling reconnect');
      this.setStatus('error', new Error('MQTT connection closed'));
      this.scheduleReconnect();
    });

    client.on('error', (err: Error) => {
      console.error('[MQTT Client] ❌ Connection error:', err);
      console.error('[MQTT Client] Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      this.clearTokenRefresh();
      this.setStatus('error', err);
      try {
        client.end(true);
      } catch (endErr) {
        console.error('[MQTT Client] Error ending client:', endErr);
      }
    });
  }

  private subscribeTopics(): void {
    if (!this.client || !this.subject) return;

    const base = `user/${this.subject}`;
    const topics = [`${base}/response`, `${base}/notifications`];

    console.log('[MQTT Client] Subscribing to topics:', topics);

    this.client.subscribe(topics, { qos: 1 }, (err) => {
      if (err) {
        console.error('[MQTT Client] Subscription error:', err);
        this.setStatus('error', err);
      } else {
        console.log('[MQTT Client] ✅ Successfully subscribed to topics');
      }
    });
  }

  private handleMessage(topic: string, payload: Uint8Array): void {
    let data: any;
    try {
      const text = new TextDecoder().decode(payload);
      data = JSON.parse(text);
    } catch (err) {
      console.warn('[MQTT Client] Failed to parse message:', err);
      return;
    }

    const isResponse = topic.endsWith('/response');
    const isNotification = topic.endsWith('/notifications');

    if (isResponse) {
      const requestId = data?.requestId;
      if (requestId && this.pendingRequests.has(requestId)) {
        const pending = this.pendingRequests.get(requestId)!;
        clearTimeout(pending.timer);
        this.pendingRequests.delete(requestId);
        try {
          if (data?.error != null && data.error !== '') {
            pending.reject(new Error(typeof data.error === 'string' ? data.error : String(data.error)));
          } else {
            pending.resolve(data);
          }
        } catch {
          // ignore
        }
        return;
      }
    }

    if (isNotification) {
      // Decode JWT ticket if present
      let type = data?.type || data?.payload?.type;
      let payloadData = data?.payload ?? data;

      if (data?.ticket) {
        try {
          // Decode JWT ticket (just parse the payload, don't verify signature in client)
          // JWT uses base64url encoding, not base64, so we use the utility function
          const payload = decodeNotificationJwtPayload(data.ticket);
          if (payload) {
            // Use params.type if available (the actual event type), otherwise fall back to payload.type
            const decodedType = payload.params?.type || payload.type;
            if (decodedType) {
              type = decodedType;
              payloadData = payload.params || {};
              if (payload.flowId && typeof payloadData === 'object') {
                payloadData = { ...payloadData, flowId: payload.flowId };
              }
            } else if (!type) {
              // If JWT decoding succeeded but no type found, and no type in data, use wildcard
              type = '*';
            }
          } else if (!type) {
            // JWT decoding failed and no type in data, use wildcard
            console.warn('[MQTT Client] JWT decoding failed and no type field found, using wildcard');
            type = '*';
          }
        } catch (err) {
          console.warn('[MQTT Client] Failed to decode notification ticket:', err);
          if (!type) {
            type = '*';
          }
        }
      }

      if (!type) {
        type = '*';
      }

      const handlers = this.notificationHandlers.get(type);
      const wildcard = this.notificationHandlers.get('*');

      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(payloadData);
          } catch (err) {
            console.error('[MQTT Client] Handler error:', err);
          }
        }
      }

      if (wildcard && type !== '*') {
        for (const handler of wildcard) {
          try {
            handler(payloadData);
          } catch (err) {
            console.error('[MQTT Client] Wildcard handler error:', err);
          }
        }
      }
    }
  }

  /** Schedule a proactive JWT refresh before the token expires */
  private scheduleTokenRefresh(): void {
    this.clearTokenRefresh();

    if (!this.jwtExpiryMs) return;

    const now = Date.now();
    const refreshAt = this.jwtExpiryMs - TOKEN_REFRESH_BEFORE_EXPIRY_MS;
    const delayMs = Math.max(refreshAt - now, 0);

    console.log('[MQTT Client] Scheduling token refresh in', Math.round(delayMs / 1000), 'seconds',
      '(JWT expires at', new Date(this.jwtExpiryMs).toISOString() + ')');

    this.tokenRefreshTimer = setTimeout(() => {
      this.tokenRefreshTimer = null;
      this.performTokenRefresh();
    }, delayMs);
  }

  private clearTokenRefresh(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  /** Tear down current connection, clear cached JWT, and reconnect with fresh credentials */
  private performTokenRefresh(): void {
    console.log('[MQTT Client] Token refresh triggered — reconnecting with fresh JWT');

    // Tear down existing connection without marking as manual/permanent disconnect
    if (this.client) {
      try {
        this.client.removeAllListeners();
        this.client.end(true);
      } catch {
        // ignore
      }
      this.client = null;
    }

    this.failAllPending(new Error('MQTT token refresh'));

    // Clear cached credentials so a fresh JWT is minted
    this.mintResult = null;
    this.jwtExpiryMs = 0;
    this.reconnectAttempts = 0;

    // Reconnect immediately with fresh credentials
    this.connect().catch((err) => {
      console.error('[MQTT Client] Token refresh reconnect failed:', err);
    });
  }

  private scheduleReconnect(): void {
    if (!browser) return;
    if (!this.allowConnections || this.authState !== 'authenticated') return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus('error', new Error('Max MQTT reconnection attempts reached'));
      return;
    }

    if (this.reconnectTimer) {
      return;
    }

    const base = this.baseDelayMs * 2 ** this.reconnectAttempts;
    const jitter = Math.floor(Math.random() * 1000);
    const delay = Math.min(base, this.maxDelayMs) + jitter;

    this.reconnectAttempts += 1;
    this.mintResult = null;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {
        // errors are handled in connect()
      });
    }, delay);
  }

  private failAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timer);
      try {
        pending.reject(error);
      } catch {
        // ignore
      }
      this.pendingRequests.delete(id);
    }
  }
}

export const mqttClient = new UserMqttClient();
