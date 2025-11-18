import { writable, get } from 'svelte/store';
import { sseStore } from '$lib/stores/sse-store';
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

  // Event-driven room message handling via SSE
  if (browser) {
    sseStore.on('room', (message: any) => {
      console.log('[roomStore] Received room message via SSE:', message);
      
      // Extract payload from SSE message format
      const payload = message.data?.payload || message.data || message.payload;
      const action = payload?.action;
      
      if (!action) {
        console.warn('[roomStore] No action in room message:', message);
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
    // // Backward compatibility for legacy 'room:create' messages
    // socketStore.on('room:create', (msg: any) => {
    //   update(r => ({ ...r, roomId: msg.roomId, status: msg.status, error: undefined }));
    // });
    // socketStore.on('room:join', (msg: any) => {
    //   update(state => ({ ...state, ...msg }));
    // });
    // socketStore.on('room:list', (msg: any) => {
    //   update(state => ({ ...state, rooms: msg.rooms }));
    // });
    // socketStore.on('room', (msg: any) => {
    //   update(state => ({ ...state, error: msg.error }));
    // });
  }

  function clearError() {
    update(r => ({ ...r, error: undefined }));
  }

  async function createRoom() {
    if (!browser) return;
    try {
      await sseStore.sendRequest({
        type: 'room',
        scope: 'user:self',
        payload: {
          action: 'create',
          data: {}
        }
      }, 10000, 'room_create');
    } catch (error) {
      console.error('[roomStore] Failed to create room:', error);
      update(r => ({ ...r, error: error instanceof Error ? error.message : 'Failed to create room' }));
    }
  }

  async function joinRoom(roomId: string, role: string = 'viewer', password?: string) {
    if (!browser) return;
    try {
      await sseStore.sendRequest({
        type: 'room',
        scope: 'user:self',
        payload: {
          action: 'join',
          data: {
            roomId,
            role,
            password
          }
        }
      }, 10000, 'room_join');
    } catch (error) {
      console.error('[roomStore] Failed to join room:', error);
      update(r => ({ ...r, error: error instanceof Error ? error.message : 'Failed to join room' }));
    }
  }

  async function leaveRoom(roomId: string) {
    if (!browser) return;
    try {
      await sseStore.sendRequest({
        type: 'room',
        scope: 'user:self',
        payload: {
          action: 'leave',
          data: {
            roomId
          }
        }
      }, 10000, 'room_leave');
    } catch (error) {
      console.error('[roomStore] Failed to leave room:', error);
      update(r => ({ ...r, error: error instanceof Error ? error.message : 'Failed to leave room' }));
    }
  }

  async function listRooms() {
    if (!browser) return;
    try {
      await sseStore.sendRequest({
        type: 'room',
        scope: 'user:self',
        payload: {
          action: 'list'
        }
      }, 10000, 'room_list');
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