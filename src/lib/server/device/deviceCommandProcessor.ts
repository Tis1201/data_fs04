import { logger } from '$lib/server/logger';
import { bundleInstallHandler, type BundleInstallCommand } from './bundleInstallHandler';
import { deviceService } from './deviceService';

export interface DeviceCommand {
  type: string;
  deviceId: string;
  payload: any;
}

export interface CommandResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

class DeviceCommandProcessor {
  private readonly SUPPORTED_COMMANDS = [
    'bundle_install',
    'device_restart',
    'device_shutdown',
    'device_status',
    'firmware_update',
    'app_install',
    'app_uninstall'
  ];

  async processCommand(command: DeviceCommand): Promise<CommandResponse> {
    const { type, deviceId, payload } = command;

    logger.info(`Processing device command`, {
      deviceId,
      commandType: type,
      payload: payload ? 'present' : 'missing'
    });

    try {
      // Validate device exists and is online
      const device = await deviceService.getDeviceById(deviceId);
      if (!device) {
        return {
          success: false,
          message: 'Device not found',
          error: `Device ${deviceId} not found`
        };
      }

      if (!device.connected) {
        return {
          success: false,
          message: 'Device is offline',
          error: `Device ${deviceId} is not connected`
        };
      }

      // Route command to appropriate handler
      switch (type) {
        case 'bundle_install':
          return await this.handleBundleInstall(deviceId, payload);

        case 'device_restart':
          return await this.handleDeviceRestart(deviceId, payload);

        case 'device_shutdown':
          return await this.handleDeviceShutdown(deviceId, payload);

        case 'device_status':
          return await this.handleDeviceStatus(deviceId, payload);

        case 'firmware_update':
          return await this.handleFirmwareUpdate(deviceId, payload);

        case 'app_install':
          return await this.handleAppInstall(deviceId, payload);

        case 'app_uninstall':
          return await this.handleAppUninstall(deviceId, payload);

        default:
          return {
            success: false,
            message: 'Unsupported command type',
            error: `Command type '${type}' is not supported`
          };
      }

    } catch (error) {
      logger.error('Error processing device command', {
        deviceId,
        commandType: type,
        error: error.message
      });

      return {
        success: false,
        message: 'Command processing failed',
        error: error.message
      };
    }
  }

  private async handleBundleInstall(deviceId: string, payload: any): Promise<CommandResponse> {
    try {
      const command: BundleInstallCommand = {
        type: 'bundle_install',
        deviceId,
        sessionId: payload.sessionId,
        batchId: payload.batchId,
        bundles: payload.bundles || [],
        options: payload.options || {
          reboot: false,
          autoOpen: false
        }
      };

      // Validate required fields
      if (!command.sessionId || !command.batchId || !command.bundles.length) {
        return {
          success: false,
          message: 'Invalid bundle install command',
          error: 'Missing required fields: sessionId, batchId, or bundles'
        };
      }

      // Process the bundle installation asynchronously
      bundleInstallHandler.handleInstallCommand(command).catch(error => {
        logger.error('Bundle installation failed', {
          deviceId,
          sessionId: command.sessionId,
          batchId: command.batchId,
          error: error.message
        });
      });

      return {
        success: true,
        message: 'Bundle installation started',
        data: {
          sessionId: command.sessionId,
          batchId: command.batchId,
          bundleCount: command.bundles.length
        }
      };

    } catch (error) {
      return {
        success: false,
        message: 'Bundle installation failed',
        error: error.message
      };
    }
  }

  private async handleDeviceRestart(deviceId: string, payload: any): Promise<CommandResponse> {
    try {
      logger.info(`Restarting device ${deviceId}`, { payload });

      // Simulate device restart
      await this.delay(2000);

      return {
        success: true,
        message: 'Device restart initiated',
        data: {
          deviceId,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      return {
        success: false,
        message: 'Device restart failed',
        error: error.message
      };
    }
  }

  private async handleDeviceShutdown(deviceId: string, payload: any): Promise<CommandResponse> {
    try {
      logger.info(`Shutting down device ${deviceId}`, { payload });

      // Simulate device shutdown
      await this.delay(1000);

      return {
        success: true,
        message: 'Device shutdown initiated',
        data: {
          deviceId,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      return {
        success: false,
        message: 'Device shutdown failed',
        error: error.message
      };
    }
  }

  private async handleDeviceStatus(deviceId: string, payload: any): Promise<CommandResponse> {
    try {
      const device = await deviceService.getDeviceById(deviceId);
      
      return {
        success: true,
        message: 'Device status retrieved',
        data: {
          deviceId,
          status: device?.status || 'UNKNOWN',
          connected: device?.connected || false,
          lastSeen: device?.lastUsedAt,
          firmwareVersion: device?.firmwareVersion,
          osVersion: device?.osVersion
        }
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to get device status',
        error: error.message
      };
    }
  }

  private async handleFirmwareUpdate(deviceId: string, payload: any): Promise<CommandResponse> {
    try {
      const { firmwareId, version } = payload;

      if (!firmwareId || !version) {
        return {
          success: false,
          message: 'Invalid firmware update command',
          error: 'Missing firmwareId or version'
        };
      }

      logger.info(`Updating firmware for device ${deviceId}`, {
        firmwareId,
        version,
        payload
      });

      // Simulate firmware update process
      await this.delay(5000);

      return {
        success: true,
        message: 'Firmware update initiated',
        data: {
          deviceId,
          firmwareId,
          version,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      return {
        success: false,
        message: 'Firmware update failed',
        error: error.message
      };
    }
  }

  private async handleAppInstall(deviceId: string, payload: any): Promise<CommandResponse> {
    try {
      const { appId, appName, appVersion } = payload;

      if (!appId || !appName) {
        return {
          success: false,
          message: 'Invalid app install command',
          error: 'Missing appId or appName'
        };
      }

      logger.info(`Installing app on device ${deviceId}`, {
        appId,
        appName,
        appVersion,
        payload
      });

      // Simulate app installation
      await this.delay(3000);

      return {
        success: true,
        message: 'App installation initiated',
        data: {
          deviceId,
          appId,
          appName,
          appVersion,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      return {
        success: false,
        message: 'App installation failed',
        error: error.message
      };
    }
  }

  private async handleAppUninstall(deviceId: string, payload: any): Promise<CommandResponse> {
    try {
      const { appId, appName } = payload;

      if (!appId || !appName) {
        return {
          success: false,
          message: 'Invalid app uninstall command',
          error: 'Missing appId or appName'
        };
      }

      logger.info(`Uninstalling app from device ${deviceId}`, {
        appId,
        appName,
        payload
      });

      // Simulate app uninstallation
      await this.delay(2000);

      return {
        success: true,
        message: 'App uninstallation initiated',
        data: {
          deviceId,
          appId,
          appName,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      return {
        success: false,
        message: 'App uninstallation failed',
        error: error.message
      };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getSupportedCommands(): string[] {
    return this.SUPPORTED_COMMANDS;
  }
}

export const deviceCommandProcessor = new DeviceCommandProcessor();
