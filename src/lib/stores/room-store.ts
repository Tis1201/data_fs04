import { writable } from 'svelte/store';
import { socketStore } from '$lib/stores/websocket-store';
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

  // Event-driven room message handling (consistent with webrtc-store)
  if (browser) {
    socketStore.on('room', (msg: any) => {
      console.log('[roomStore] Received room message:', msg);
      switch (msg.action) {
        case 'created': {
          // Accept both legacy (status) and new flat payloads
          if (msg.status) {
  update(r => ({
    ...r,
    roomId: msg.roomId,
    status: {
      ...msg.status,
      participants: msg.status.participants || [],
      password: msg.status.password ?? msg.password // always include password if present
    },
    error: undefined // Only clear error on successful creation
  }));
} else {
  update(r => ({
    ...r,
    roomId: msg.id,
    status: {
      id: msg.id,
      name: msg.name,
      description: msg.description,
      participantCount: msg.participantCount,
      maxParticipants: msg.maxParticipants,
      hasPassword: msg.hasPassword,
      lastActivity: msg.lastActivity,
      createdAt: msg.createdAt,
      metadata: msg.metadata,
      admins: msg.admins,
      createdBy: msg.createdBy,
      participants: msg.participants || [],
      password: msg.password // always include password if present
    },
    error: undefined // Only clear error on successful creation
  }));
}
          break;
        }
        case 'error': {
          update(r => ({ ...r, error: msg.error }));
          break;
        }
        case 'list': {
          if (msg.rooms) {
            update(r => ({ ...r, rooms: msg.rooms }));
          }
          break;
        }
        // Add more cases as needed
        default:
          // Optionally handle unknown actions or status
          break;
      }
      // Do not clear error on other room actions

      // Add other room actions as needed
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

  function sendOrWarn(payload: any, label: string) {
    if (typeof socketStore.send === 'function') {
      socketStore.send(payload);
      console.log(`${label} sent via socketStore.send`);
    } else {
      console.warn(`[roomStore] socketStore.send is not available, cannot send:`, payload);
    }
  }

  function clearError() {
    update(r => ({ ...r, error: undefined }));
  }

  return {
    subscribe,
    createRoom: () => sendOrWarn({ type: 'room', action: 'create', data: {  } }, 'Create'),
    joinRoom: (roomId: string, role: string = 'viewer') =>
      sendOrWarn({ type: 'room', action: 'join', roomId, role }, 'Join'),
    leaveRoom: (roomId: string) =>
      sendOrWarn({ type: 'room', action: 'leave', roomId }, 'Leave'),
    listRooms: () =>
      sendOrWarn({ type: 'room', action: 'list' }, 'List'),
    reset: () => set({}),
    clearError
  };

}

export const roomStore = createRoomStore();