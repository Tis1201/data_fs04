import type { RoutingMessage } from './message';

export interface Publisher {
    publish(message: RoutingMessage): Promise<void>;
}