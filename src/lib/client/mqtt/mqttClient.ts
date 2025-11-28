import { browser } from '$app/environment';
import type { MqttClient, IClientOptions } from 'mqtt';

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
    this.authState = state;
    this.allowConnections = state === 'authenticated';

    if (!this.allowConnections) {
      this.disconnect(true);
    }
  }

  async connect(): Promise<void> {
    if (!browser) return;
    if (!this.allowConnections || this.authState !== 'authenticated') return;

    if (this.client && this.client.connected) return;
    if (this.status === 'connecting' || this.status === 'reconnecting') return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.manualDisconnect = false;
    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting', null);

    try {
      if (!this.mintResult) {
        this.mintResult = await this.mint();
      }

      await this.openMqttConnection();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('MQTT connect failed');
      this.setStatus('error', error);
      this.scheduleReconnect();
    }
  }

  disconnect(permanent = true): void {
    this.manualDisconnect = permanent;

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

    return () => {
      const current = this.notificationHandlers.get(key);
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) {
        this.notificationHandlers.delete(key);
      }
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

    const data = await res.json();

    if (!data || !data.brokerUrl || !data.clientId || !data.username || !data.jwt) {
      throw new Error('Mint response missing required fields');
    }

    return {
      brokerUrl: data.brokerUrl,
      clientId: data.clientId,
      username: data.username,
      jwt: data.jwt
    };
  }

  private async openMqttConnection(): Promise<void> {
    if (!browser) return;
    if (!this.mintResult) return;

    if (this.client) {
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

    const mqtt = await import('mqtt');

    const options: IClientOptions = {
      clientId,
      username,
      password: jwt,
      clean: true,
      reconnectPeriod: 0
    };

    const client = mqtt.connect(brokerUrl, options);
    this.client = client;

    client.on('connect', () => {
      this.reconnectAttempts = 0;
      this.setStatus('connected', null);
      this.subscribeTopics();
    });

    client.on('message', (topic, payload) => {
      this.handleMessage(topic, payload);
    });

    client.on('close', () => {
      this.client = null;
      this.failAllPending(new Error('MQTT connection closed'));

      if (this.manualDisconnect || !this.allowConnections || this.authState !== 'authenticated') {
        this.setStatus('idle', null);
        return;
      }

      this.setStatus('error', new Error('MQTT connection closed'));
      this.scheduleReconnect();
    });

    client.on('error', (err: Error) => {
      this.setStatus('error', err);
      try {
        client.end(true);
      } catch {
        // ignore
      }
    });
  }

  private subscribeTopics(): void {
    if (!this.client || !this.subject) return;

    const base = `user/${this.subject}`;
    const topics = [`${base}/response`, `${base}/notifications`];

    this.client.subscribe(topics, { qos: 1 }, (err) => {
      if (err) {
        this.setStatus('error', err);
      }
    });
  }

  private handleMessage(topic: string, payload: Uint8Array): void {
    let data: any;
    try {
      const text = new TextDecoder().decode(payload);
      data = JSON.parse(text);
    } catch {
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
          pending.resolve(data);
        } catch {
          // ignore
        }
        return;
      }
    }

    if (isNotification) {
      const type = data?.type || data?.payload?.type || '*';
      const payloadData = data?.payload ?? data;

      const handlers = this.notificationHandlers.get(type);
      const wildcard = this.notificationHandlers.get('*');

      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(payloadData);
          } catch {
            // ignore
          }
        }
      }

      if (wildcard && type !== '*') {
        for (const handler of wildcard) {
          try {
            handler(payloadData);
          } catch {
            // ignore
          }
        }
      }
    }
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
