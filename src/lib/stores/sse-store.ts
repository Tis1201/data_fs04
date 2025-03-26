import { writable } from 'svelte/store';

export type SSEMessage = {
    id: string;
    event: string;
    content?: string;
    data: any;
    timestamp: string;
    sender?: {
        email: string;
        name: string | null;
    };
};

function createSSEStore() {
    const { subscribe, update } = writable<SSEMessage[]>([]);

    return {
        subscribe,
        addMessage: (message: SSEMessage) => {
            update(messages => [message, ...messages].slice(0, 100)); // Keep last 100 messages
        },
        clear: () => {
            update(() => []);
        }
    };
}

export const sseMessages = createSSEStore();
