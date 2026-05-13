import { writable, get } from 'svelte/store';
import { mqttClient } from '$lib/client/mqtt/mqttClient';
import { browser } from '$app/environment';

interface RoomState {
  roomId?: string;
  participants?: any[];
  status?: any;
  rooms?: any[];
  error?: string;
  [key: string]: any;
}

function createRoomStore() {
  const { subscribe, set, update } = writable<RoomState>({});

  // Event-driven room message handling via MQTT
  if (browser) {
    mqttClient.onNotification('room:*', (payload: any) => {
      console.log('[roomStore] Received room notification via MQTT:', payload);
      
      // Extract action from payload
      const action = payload?.action || payload?.type?.replace('room:', '');
      
      if (!action) {
        console.warn('[roomStore] No action in room notification:', payload);
        return;
      }
      
      switch (action) {
        case 'created': {
          // Accept both legacy (status) and new flat payloads
          if (payload.status) {
            update(r => ({
              ...r,
              roomId: payload.roomId,
              status: {
                ...payload.status,
                participants: payload.status.participants || [],
                password: payload.status.password ?? payload.password // always include password if present
              },
              error: undefined // Only clear error on successful creation
            }));
          } else {
            update(r => ({
              ...r,
              roomId: payload.id,
              status: {
                id: payload.id,
                name: payload.name,
                description: payload.description,
                participantCount: payload.participantCount,
                maxParticipants: payload.maxParticipants,
                hasPassword: payload.hasPassword,
                lastActivity: payload.lastActivity,
                createdAt: payload.createdAt,
                metadata: payload.metadata,
                admins: payload.admins,
                createdBy: payload.createdBy,
                participants: payload.participants || [],
                password: payload.password // always include password if present
              },
              error: undefined // Only clear error on successful creation
            }));
          }
          break;
        }
        case 'joined': {
          console.log('[roomStore] Room joined:', payload);
          // Update room status if needed
          break;
        }
        case 'left': {
          console.log('[roomStore] Room left:', payload);
          // Update room status if needed
          break;
        }
        case 'error': {
          update(r => ({ ...r, error: payload.error }));
          break;
        }
        case 'list': {
          if (payload.rooms) {
            update(r => ({ ...r, rooms: payload.rooms }));
          }
          break;
        }
        // Add more cases as needed
        default:
          console.log('[roomStore] Unknown room action:', action);
          break;
      }
      // Do not clear error on other room actions
    });
  }

  function clearError() {
    update(r => ({ ...r, error: undefined }));
  }

  async function createRoom() {
    if (!browser) return;
    try {
      const result = await mqttClient.request('room.create', {}, { timeoutMs: 10000 });
      // Result will be handled by the notification handler
      console.log('[roomStore] Room creation request sent:', result);
    } catch (error) {
      console.error('[roomStore] Failed to create room:', error);
      update(r => ({ ...r, error: error instanceof Error ? error.message : 'Failed to create room' }));
    }
  }

  async function joinRoom(roomId: string, role: string = 'viewer', password?: string) {
    if (!browser) return;
    try {
      const result = await mqttClient.request('room.join', {
        roomId,
        role,
        password
      }, { timeoutMs: 10000 });
      // Result will be handled by the notification handler
      console.log('[roomStore] Room join request sent:', result);
    } catch (error) {
      console.error('[roomStore] Failed to join room:', error);
      update(r => ({ ...r, error: error instanceof Error ? error.message : 'Failed to join room' }));
    }
  }

  async function leaveRoom(roomId: string) {
    if (!browser) return;
    try {
      const result = await mqttClient.request('room.leave', {
        roomId
      }, { timeoutMs: 10000 });
      // Result will be handled by the notification handler
      console.log('[roomStore] Room leave request sent:', result);
    } catch (error) {
      console.error('[roomStore] Failed to leave room:', error);
      update(r => ({ ...r, error: error instanceof Error ? error.message : 'Failed to leave room' }));
    }
  }

  async function listRooms() {
    if (!browser) return;
    try {
      const result = await mqttClient.request('room.list', {}, { timeoutMs: 10000 });
      // Handle list response directly
      if (result?.rooms) {
        update(r => ({ ...r, rooms: result.rooms }));
      }
      console.log('[roomStore] Room list request sent:', result);
    } catch (error) {
      console.error('[roomStore] Failed to list rooms:', error);
      update(r => ({ ...r, error: error instanceof Error ? error.message : 'Failed to list rooms' }));
    }
  }

  function reset() {
    set({});
  }

  return {
    subscribe,
    createRoom,
    joinRoom,
    leaveRoom,
    listRooms,
    reset,
    clearError
  };

}

export const roomStore = createRoomStore();