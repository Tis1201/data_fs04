import { logger } from '../logger';
import { EventEmitter } from 'events';

/**
 * Error types for room operations
 */
export enum RoomError {
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  ROOM_FULL = 'ROOM_FULL',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  ALREADY_JOINED = 'ALREADY_JOINED',
  NOT_ADMIN = 'NOT_ADMIN',
  PARTICIPANT_NOT_FOUND = 'PARTICIPANT_NOT_FOUND'
}

/**
 * Room operation results
 */
export interface RoomResult<T> {
  success: boolean;
  data?: T;
  error?: RoomError;
  message?: string;
}

/**
 * Participant information in a room
 */
export interface RoomParticipant {
  userId: string;
  socketId?: string; // optional, for session tracking
  isAdmin: boolean;
  joinedAt: Date;
  lastActive: Date;
  metadata?: Record<string, any>;
}

/**
 * Room configuration options
 */
export interface RoomConfig {
  maxParticipants?: number;
  password?: string;
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * Room status information
 */
export interface RoomStatus {
  id: string;
  name: string | undefined;
  description: string | undefined;
  participantCount: number;
  maxParticipants: number | undefined;
  hasPassword: boolean;
  lastActivity: Date;
  createdAt: Date;
  metadata: Record<string, any>;
  admins: string[];
}

/**
 * WebRTC Room class
 * Manages room state, participants, and admin privileges
 */
export class Room {
  private participants: Map<string, RoomParticipant> = new Map();
  private readonly roomId: string;
  private readonly secret: string;
  private readonly config: RoomConfig;
  private readonly createdAt: Date;
  private lastActivity: Date;
  private readonly eventEmitter: EventEmitter;
  public readonly createdBy?: string;

  constructor(roomId: string, secret: string, config: RoomConfig = {}, createdBy?: string) {
    this.roomId = roomId;
    this.secret = secret;
    this.config = config;
    this.createdAt = new Date();
    this.lastActivity = new Date();
    this.eventEmitter = new EventEmitter();
    this.createdBy = createdBy;
  }

  /**
   * Get the room ID
   */
  get id(): string {
    return this.roomId;
  }

  /**
   * Get the room secret
   */
  get secretKey(): string {
    return this.secret;
  }

  /**
   * Get room configuration
   */
  get configuration(): RoomConfig {
    return { ...this.config };
  }

  /**
   * Get room creation time
   */
  get created(): Date {
    return this.createdAt;
  }

  /**
   * Get room last activity time
   */
  get lastActive(): Date {
    return this.lastActivity;
  }

  /**
   * Get all participants in the room
   */
  getParticipants(): RoomParticipant[] {
    // Always include both userId and socketId for each participant, set socketId to null if missing
    return Array.from(this.participants.values()).map(p => ({
      userId: p.userId,
      socketId: p.socketId ?? null,
      isAdmin: p.isAdmin,
      joinedAt: p.joinedAt,
      lastActive: p.lastActive,
      metadata: p.metadata
    }));
  }

  /**
   * Get participant count
   */
  getParticipantCount(): number {
    return this.participants.size;
  }

  /**
   * Check if the room is full
   */
  isFull(): boolean {
    return this.config.maxParticipants && this.participants.size >= this.config.maxParticipants;
  }

  /**
   * Check if a participant exists in the room
   */
  hasParticipant(socketId: string): boolean {
    return this.participants.has(socketId);
  }

  /**
   * Add a participant to the room
   * @param userId Canonical user ID
   * @param socketId Client socket ID (optional, for session tracking)
   * @param isAdmin Whether the participant is an admin
   * @param metadata Additional participant metadata
   */
  addParticipant(
    userId: string,
    socketId?: string,
    isAdmin: boolean = false,
    metadata?: Record<string, any>
  ): RoomResult<RoomParticipant> {
    if (this.isFull()) {
      return {
        success: false,
        error: RoomError.ROOM_FULL,
        message: 'Room is at maximum capacity'
      };
    }

    if (this.participants.has(userId)) {
      return {
        success: false,
        error: RoomError.ALREADY_JOINED,
        message: 'Participant is already in room'
      };
    }

    const participant: RoomParticipant = {
      userId,
      socketId,
      isAdmin: !!isAdmin,
      joinedAt: new Date(),
      lastActive: new Date(),
      metadata
    };

    this.participants.set(userId, participant);
    this.updateLastActivity();
    this.emit('participant:joined', { participant, room: this });
    
    logger.info(`[WebRTC:Room] Participant ${userId} joined room ${this.roomId}`);
    return {
      success: true,
      data: participant
    };
  }

  /**
   * Remove a participant from the room
   */
  removeParticipant(socketId: string): RoomResult<void> {
    const participant = this.participants.get(socketId);
    if (!participant) {
      return {
        success: false,
        error: RoomError.PARTICIPANT_NOT_FOUND,
        message: 'Participant not found in room'
      };
    }

    this.participants.delete(socketId);
    this.updateLastActivity();
    this.emit('participant:left', { participant, room: this });
    
    logger.info(`[WebRTC:Room] Participant ${socketId} left room ${this.roomId}`);
    return {
      success: true
    };
  }

  /**
   * Update participant's last active time
   */
  updateParticipantActivity(socketId: string): RoomResult<void> {
    const participant = this.participants.get(socketId);
    if (!participant) {
      return {
        success: false,
        error: RoomError.PARTICIPANT_NOT_FOUND,
        message: 'Participant not found in room'
      };
    }

    participant.lastActive = new Date();
    this.updateLastActivity();
    return {
      success: true
    };
  }

  /**
   * Update the room's last activity time
   */
  private updateLastActivity(): void {
    this.lastActivity = new Date();
  }

  /**
   * Validate room access with password
   */
  validateAccess(password?: string): RoomResult<void> {
    if (!this.config.password) {
      return {
        success: true
      };
    }

    if (this.config.password === password) {
      return {
        success: true
      };
    }

    return {
      success: false,
      error: RoomError.INVALID_PASSWORD,
      message: 'Invalid room password'
    };
  }

  /**
   * Get admin participants
   */
  getAdmins(): RoomParticipant[] {
    // Only return participants who are admins (with valid userId)
    return Array.from(this.participants.values()).filter(p => p.isAdmin && p.userId);
  }

  /**
   * Check if a participant is an admin
   */
  isParticipantAdmin(socketId: string): boolean {
    const participant = this.participants.get(socketId);
    return participant?.isAdmin || false;
  }

  /**
   * Promote a participant to admin
   */
  promoteToAdmin(socketId: string): RoomResult<RoomParticipant> {
    const participant = this.participants.get(socketId);
    if (!participant) {
      return {
        success: false,
        error: RoomError.PARTICIPANT_NOT_FOUND,
        message: 'Participant not found in room'
      };
    }

    participant.isAdmin = true;
    this.updateLastActivity();
    this.emit('participant:promoted', { participant, room: this });
    
    logger.info(`[WebRTC:Room] Participant ${socketId} promoted to admin in room ${this.roomId}`);
    return {
      success: true,
      data: participant
    };
  }

  /**
   * Demote an admin to regular participant
   */
  demoteFromAdmin(socketId: string): RoomResult<RoomParticipant> {
    const participant = this.participants.get(socketId);
    if (!participant || !participant.isAdmin) {
      return {
        success: false,
        error: RoomError.NOT_ADMIN,
        message: 'Participant is not an admin'
      };
    }

    participant.isAdmin = false;
    this.updateLastActivity();
    this.emit('participant:demoted', { participant, room: this });
    
    logger.info(`[WebRTC:Room] Participant ${socketId} demoted from admin in room ${this.roomId}`);
    return {
      success: true,
      data: participant
    };
  }

  /**
   * Get room status information
   */
  /**
   * Canonical representation of the room for API responses
   */
  toJSON() {
    const base = {
      id: this.roomId,
      name: this.config.name,
      description: this.config.description,
      participantCount: this.getParticipantCount(),
      maxParticipants: this.config.maxParticipants,
      hasPassword: !!this.config.password,
      lastActivity: this.lastActivity,
      createdAt: this.createdAt,
      metadata: this.config.metadata || {},
      admins: this.getAdmins().map(p => p.socketId),
      createdBy: this.createdBy,
      participants: this.getParticipants()
    };
    if (this.config.password) {
      // Expose password only if set
      return { ...base, password: this.config.password };
    }
    return base;
  }

  getStatus(): RoomStatus & { password?: string } {
    const base = {
      id: this.roomId,
      name: this.config.name,
      description: this.config.description,
      participantCount: this.getParticipantCount(),
      maxParticipants: this.config.maxParticipants,
      hasPassword: !!this.config.password,
      lastActivity: this.lastActivity,
      createdAt: this.createdAt,
      metadata: this.config.metadata || {},
      admins: this.getAdmins().map(p => p.socketId),
      createdBy: this.createdBy,
      participants: this.getParticipants()
    };
    if (this.config.password) {
      return { ...base, password: this.config.password };
    }
    return base;
  }

  /**
   * Emit an event
   */
  private emit(event: string, data: any): void {
    this.eventEmitter.emit(event, data);
  }

  /**
   * Add event listener
   */
  on(event: string, listener: (data: any) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: (data: any) => void): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.eventEmitter.removeAllListeners();
    this.participants.clear();
  }
}
