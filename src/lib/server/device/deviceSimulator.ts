import { logger } from '$lib/server/logger';
import { deviceCommandProcessor, type DeviceCommand } from './deviceCommandProcessor';
import { sseService } from '../sse/sseService';

export interface SimulatedDevice {
  id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'INSTALLING' | 'ERROR';
  connected: boolean;
  lastSeen: Date;
  firmwareVersion: string;
  osVersion: string;
  installedApps: string[];
  bundleInstallSessions: string[];
}

class DeviceSimulator {
  private devices: Map<string, SimulatedDevice> = new Map();
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT = 60000; // 60 seconds

  constructor() {
    this.initializeSimulatedDevices();
    this.startHeartbeat();
  }

  private initializeSimulatedDevices(): void {
    // Create some simulated devices
    const simulatedDevices: SimulatedDevice[] = [
      {
        id: 'device-sim-001',
        name: 'Kiosk Terminal 1',
        status: 'ONLINE',
        connected: true,
        lastSeen: new Date(),
        firmwareVersion: '2.1.0',
        osVersion: 'Android 11',
        installedApps: ['com.example.kiosk', 'com.example.browser'],
        bundleInstallSessions: []
      },
      {
        id: 'device-sim-002',
        name: 'Display Monitor 1',
        status: 'ONLINE',
        connected: true,
        lastSeen: new Date(),
        firmwareVersion: '1.8.5',
        osVersion: 'Linux 5.4',
        installedApps: ['com.example.display', 'com.example.media'],
        bundleInstallSessions: []
      },
      {
        id: 'device-sim-003',
        name: 'Smart Terminal 1',
        status: 'OFFLINE',
        connected: false,
        lastSeen: new Date(Date.now() - 120000), // 2 minutes ago
        firmwareVersion: '2.0.1',
        osVersion: 'Android 10',
        installedApps: ['com.example.terminal'],
        bundleInstallSessions: []
      },
      {
        id: 'device-sim-004',
        name: 'Digital Signage 1',
        status: 'ONLINE',
        connected: true,
        lastSeen: new Date(),
        firmwareVersion: '1.9.2',
        osVersion: 'Windows 10 IoT',
        installedApps: ['com.example.signage', 'com.example.content'],
        bundleInstallSessions: []
      },
      {
        id: 'device-sim-005',
        name: 'POS Terminal 1',
        status: 'ONLINE',
        connected: true,
        lastSeen: new Date(),
        firmwareVersion: '2.2.0',
        osVersion: 'Android 12',
        installedApps: ['com.example.pos', 'com.example.payment'],
        bundleInstallSessions: []
      }
    ];

    simulatedDevices.forEach(device => {
      this.devices.set(device.id, device);
    });

    logger.info(`Initialized ${simulatedDevices.length} simulated devices`);
  }

  private startHeartbeat(): void {
    setInterval(() => {
      this.updateDeviceStatus();
    }, this.HEARTBEAT_INTERVAL);

    // Check for disconnected devices
    setInterval(() => {
      this.checkDeviceConnections();
    }, this.CONNECTION_TIMEOUT);
  }

  private updateDeviceStatus(): void {
    this.devices.forEach((device, deviceId) => {
      if (device.connected) {
        device.lastSeen = new Date();
        
        // Simulate occasional disconnections
        if (Math.random() < 0.01) { // 1% chance
          device.connected = false;
          device.status = 'OFFLINE';
          logger.info(`Simulated device ${deviceId} went offline`);
        }
      } else {
        // Simulate reconnections
        if (Math.random() < 0.05) { // 5% chance
          device.connected = true;
          device.status = 'ONLINE';
          device.lastSeen = new Date();
          logger.info(`Simulated device ${deviceId} came back online`);
        }
      }
    });
  }

  private checkDeviceConnections(): void {
    const now = new Date();
    this.devices.forEach((device, deviceId) => {
      const timeSinceLastSeen = now.getTime() - device.lastSeen.getTime();
      
      if (device.connected && timeSinceLastSeen > this.CONNECTION_TIMEOUT) {
        device.connected = false;
        device.status = 'OFFLINE';
        logger.info(`Device ${deviceId} marked as offline due to timeout`);
      }
    });
  }

  async processCommand(command: DeviceCommand): Promise<any> {
    const device = this.devices.get(command.deviceId);
    
    if (!device) {
      return {
        success: false,
        message: 'Device not found',
        error: `Simulated device ${command.deviceId} not found`
      };
    }

    if (!device.connected) {
      return {
        success: false,
        message: 'Device is offline',
        error: `Simulated device ${command.deviceId} is not connected`
      };
    }

    // Update device status to INSTALLING if it's a bundle install command
    if (command.type === 'bundle_install') {
      device.status = 'INSTALLING';
      device.bundleInstallSessions.push(command.payload.sessionId);
    }

    // Process the command using the real command processor
    const result = await deviceCommandProcessor.processCommand(command);

    // Update device status back to ONLINE after processing
    if (command.type === 'bundle_install') {
      setTimeout(() => {
        device.status = 'ONLINE';
        logger.info(`Simulated device ${command.deviceId} finished bundle installation`);
      }, 5000); // Simulate 5-second installation time
    }

    return result;
  }

  getSimulatedDevices(): SimulatedDevice[] {
    return Array.from(this.devices.values());
  }

  getSimulatedDevice(deviceId: string): SimulatedDevice | undefined {
    return this.devices.get(deviceId);
  }

  addSimulatedDevice(device: SimulatedDevice): void {
    this.devices.set(device.id, device);
    logger.info(`Added simulated device: ${device.name} (${device.id})`);
  }

  removeSimulatedDevice(deviceId: string): boolean {
    const removed = this.devices.delete(deviceId);
    if (removed) {
      logger.info(`Removed simulated device: ${deviceId}`);
    }
    return removed;
  }

  simulateDeviceFailure(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.status = 'ERROR';
      device.connected = false;
      logger.info(`Simulated device failure: ${deviceId}`);
    }
  }

  simulateDeviceRecovery(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      device.status = 'ONLINE';
      device.connected = true;
      device.lastSeen = new Date();
      logger.info(`Simulated device recovery: ${deviceId}`);
    }
  }

  // Simulate bundle installation progress
  async simulateBundleInstallation(
    deviceId: string,
    sessionId: string,
    bundleId: string,
    progressCallback: (progress: number, message: string) => void
  ): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    device.status = 'INSTALLING';
    
    const steps = [
      { progress: 10, message: 'Downloading bundle...' },
      { progress: 25, message: 'Verifying bundle integrity...' },
      { progress: 50, message: 'Installing applications...' },
      { progress: 75, message: 'Configuring settings...' },
      { progress: 90, message: 'Verifying installation...' },
      { progress: 100, message: 'Installation completed' }
    ];

    for (const step of steps) {
      await this.delay(1000 + Math.random() * 2000); // 1-3 seconds per step
      progressCallback(step.progress, step.message);
      
      // Simulate occasional failures
      if (Math.random() < 0.05) { // 5% chance of failure
        throw new Error(`Simulated failure during ${step.message}`);
      }
    }

    device.status = 'ONLINE';
    logger.info(`Simulated bundle installation completed for device ${deviceId}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get device statistics for monitoring
  getDeviceStatistics(): {
    total: number;
    online: number;
    offline: number;
    installing: number;
    error: number;
  } {
    const devices = Array.from(this.devices.values());
    
    return {
      total: devices.length,
      online: devices.filter(d => d.status === 'ONLINE').length,
      offline: devices.filter(d => d.status === 'OFFLINE').length,
      installing: devices.filter(d => d.status === 'INSTALLING').length,
      error: devices.filter(d => d.status === 'ERROR').length
    };
  }
}

export const deviceSimulator = new DeviceSimulator();
