// import { prisma } from '$lib/server/database';
// import { logger } from '$lib/server/logger';
// import { bundleInstallService } from '$lib/server/bundle-install/bundleInstallService';
// import type { BundleInstallSession, BundleInstallBatch, BundleInstallDevice, BundleInstallBundle } from '@prisma/client';
//
// export interface BundleInstallCommand {
//   type: 'bundle_install';
//   sessionId: string;
//   batchId: string;
//   deviceId: string;
//   bundles: Array<{
//     id: string;
//     name: string;
//     order: number;
//   }>;
//   options: {
//     reboot: boolean;
//     autoOpen: boolean;
//   };
// }
//
// export interface BundleInstallStatus {
//   sessionId: string;
//   batchId: string;
//   deviceId: string;
//   bundleId: string;
//   status: 'PENDING' | 'STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
//   progress: number;
//   message?: string;
//   error?: string;
// }
//
// class BundleInstallHandler {
//   private readonly MAX_RETRIES = 3;
//   private readonly RETRY_DELAY = 5000; // 5 seconds
//
//   async handleInstallCommand(command: BundleInstallCommand): Promise<void> {
//     const { sessionId, batchId, deviceId, bundles, options } = command;
//
//     logger.info(`Starting bundle installation for device ${deviceId}`, {
//       sessionId,
//       batchId,
//       deviceId,
//       bundleCount: bundles.length,
//       options
//     });
//
//     try {
//       // Update device status to IN_PROGRESS
//       await this.updateDeviceStatus(sessionId, batchId, deviceId, 'IN_PROGRESS', 0);
//
//       // Install bundles in order
//       for (let i = 0; i < bundles.length; i++) {
//         const bundle = bundles[i];
//
//         try {
//           await this.installBundle(sessionId, batchId, deviceId, bundle, i + 1, bundles.length);
//         } catch (error) {
//           logger.error(`Failed to install bundle ${bundle.id} on device ${deviceId}`, {
//             sessionId,
//             batchId,
//             deviceId,
//             bundleId: bundle.id,
//             error: error.message
//           });
//
//           // Update bundle status to failed
//           await this.updateBundleStatus(sessionId, batchId, deviceId, bundle.id, 'FAILED', 0, error.message);
//
//           // Continue with next bundle (don't stop the entire process)
//           continue;
//         }
//       }
//
//       // Check if all bundles were installed successfully
//       const deviceRecord = await prisma.bundleInstallDevice.findFirst({
//         where: { sessionId, batchId, deviceId },
//         include: { bundles: true }
//       });
//
//       if (deviceRecord) {
//         const successfulBundles = deviceRecord.bundles.filter(b => b.status === 'COMPLETED').length;
//         const failedBundles = deviceRecord.bundles.filter(b => b.status === 'FAILED').length;
//
//         if (failedBundles === 0) {
//           // All bundles installed successfully
//           await this.updateDeviceStatus(sessionId, batchId, deviceId, 'COMPLETED', 100);
//           logger.info(`Bundle installation completed successfully for device ${deviceId}`, {
//             sessionId,
//             batchId,
//             deviceId,
//             successfulBundles
//           });
//         } else {
//           // Some bundles failed
//           await this.updateDeviceStatus(sessionId, batchId, deviceId, 'FAILED',
//             Math.round((successfulBundles / deviceRecord.totalBundles) * 100),
//             `${failedBundles} bundles failed to install`
//           );
//           logger.warn(`Bundle installation partially failed for device ${deviceId}`, {
//             sessionId,
//             batchId,
//             deviceId,
//             successfulBundles,
//             failedBundles
//           });
//         }
//       }
//
//     } catch (error) {
//       logger.error(`Bundle installation failed for device ${deviceId}`, {
//         sessionId,
//         batchId,
//         deviceId,
//         error: error.message
//       });
//
//       await this.updateDeviceStatus(sessionId, batchId, deviceId, 'FAILED', 0, error.message);
//     }
//   }
//
//   private async installBundle(
//     sessionId: string,
//     batchId: string,
//     deviceId: string,
//     bundle: any,
//     currentIndex: number,
//     totalBundles: number
//   ): Promise<void> {
//     const bundleId = bundle.id;
//     const bundleName = bundle.name;
//
//     logger.info(`Installing bundle ${bundleName} (${currentIndex}/${totalBundles}) on device ${deviceId}`, {
//       sessionId,
//       batchId,
//       deviceId,
//       bundleId
//     });
//
//     // Update bundle status to STARTED
//     await this.updateBundleStatus(sessionId, batchId, deviceId, bundleId, 'STARTED', 0, 'Starting installation...');
//
//     try {
//       // Simulate bundle installation process
//       await this.simulateBundleInstallation(sessionId, batchId, deviceId, bundleId, bundleName);
//
//       // Update bundle status to COMPLETED
//       await this.updateBundleStatus(sessionId, batchId, deviceId, bundleId, 'COMPLETED', 100, 'Installation completed successfully');
//
//       logger.info(`Bundle ${bundleName} installed successfully on device ${deviceId}`, {
//         sessionId,
//         batchId,
//         deviceId,
//         bundleId
//       });
//
//     } catch (error) {
//       logger.error(`Bundle ${bundleName} installation failed on device ${deviceId}`, {
//         sessionId,
//         batchId,
//         deviceId,
//         bundleId,
//         error: error.message
//       });
//
//       await this.updateBundleStatus(sessionId, batchId, deviceId, bundleId, 'FAILED', 0, error.message);
//       throw error;
//     }
//   }
//
//   private async simulateBundleInstallation(
//     sessionId: string,
//     batchId: string,
//     deviceId: string,
//     bundleId: string,
//     bundleName: string
//   ): Promise<void> {
//     // This is a simulation of the actual bundle installation process
//     // In a real implementation, this would:
//     // 1. Download the bundle from the server
//     // 2. Verify bundle integrity
//     // 3. Install applications in the bundle
//     // 4. Configure settings
//     // 5. Verify installation
//
//     const steps = [
//       { name: 'Downloading bundle', progress: 10 },
//       { name: 'Verifying bundle integrity', progress: 25 },
//       { name: 'Installing applications', progress: 50 },
//       { name: 'Configuring settings', progress: 75 },
//       { name: 'Verifying installation', progress: 90 },
//       { name: 'Finalizing', progress: 100 }
//     ];
//
//     for (const step of steps) {
//       // Simulate processing time
//       await this.delay(1000 + Math.random() * 2000);
//
//       // Update progress
//       await this.updateBundleStatus(
//         sessionId,
//         batchId,
//         deviceId,
//         bundleId,
//         'IN_PROGRESS',
//         step.progress,
//         step.name
//       );
//
//       // Simulate occasional failures (for testing)
//       if (Math.random() < 0.05) { // 5% chance of failure
//         throw new Error(`Simulated failure during ${step.name}`);
//       }
//     }
//   }
//
//   private async updateDeviceStatus(
//     sessionId: string,
//     batchId: string,
//     deviceId: string,
//     status: string,
//     progress: number,
//     error?: string
//   ): Promise<void> {
//     try {
//       await prisma.bundleInstallDevice.updateMany({
//         where: { sessionId, batchId, deviceId },
//         data: {
//           status,
//           progress,
//           error,
//           ...(status === 'IN_PROGRESS' && !error ? { startedAt: new Date() } : {}),
//           ...(status === 'COMPLETED' || status === 'FAILED' ? { completedAt: new Date() } : {})
//         }
//       });
//
//       // Update batch statistics
//       await this.updateBatchStatistics(sessionId, batchId);
//
//       // Update session statistics
//       await this.updateSessionStatistics(sessionId);
//
//     } catch (error) {
//       logger.error('Failed to update device status', {
//         sessionId,
//         batchId,
//         deviceId,
//         status,
//         error: error.message
//       });
//     }
//   }
//
//   private async updateBundleStatus(
//     sessionId: string,
//     batchId: string,
//     deviceId: string,
//     bundleId: string,
//     status: string,
//     progress: number,
//     message?: string,
//     error?: string
//   ): Promise<void> {
//     try {
//       await prisma.bundleInstallBundle.updateMany({
//         where: { sessionId, batchId, deviceId, bundleId },
//         data: {
//           status,
//           progress,
//           message,
//           error,
//           ...(status === 'STARTED' ? { startedAt: new Date() } : {}),
//           ...(status === 'COMPLETED' || status === 'FAILED' ? { completedAt: new Date() } : {})
//         }
//       });
//
//       // Update device statistics
//       await this.updateDeviceStatistics(sessionId, batchId, deviceId);
//
//     } catch (error) {
//       logger.error('Failed to update bundle status', {
//         sessionId,
//         batchId,
//         deviceId,
//         bundleId,
//         status,
//         error: error.message
//       });
//     }
//   }
//
//   private async updateBatchStatistics(sessionId: string, batchId: string): Promise<void> {
//     try {
//       const devices = await prisma.bundleInstallDevice.findMany({
//         where: { sessionId, batchId }
//       });
//
//       const successfulDevices = devices.filter(d => d.status === 'COMPLETED').length;
//       const failedDevices = devices.filter(d => d.status === 'FAILED').length;
//       const pendingDevices = devices.filter(d => d.status === 'PENDING').length;
//
//       await prisma.bundleInstallBatch.update({
//         where: { id: batchId },
//         data: {
//           successfulDevices,
//           failedDevices,
//           pendingDevices
//         }
//       });
//
//     } catch (error) {
//       logger.error('Failed to update batch statistics', { sessionId, batchId, error: error.message });
//     }
//   }
//
//   private async updateSessionStatistics(sessionId: string): Promise<void> {
//     try {
//       const devices = await prisma.bundleInstallDevice.findMany({
//         where: { sessionId }
//       });
//
//       const successfulDevices = devices.filter(d => d.status === 'COMPLETED').length;
//       const failedDevices = devices.filter(d => d.status === 'FAILED').length;
//       const pendingDevices = devices.filter(d => d.status === 'PENDING').length;
//
//       const batches = await prisma.bundleInstallBatch.findMany({
//         where: { sessionId }
//       });
//
//       const completedBatches = batches.filter(b => b.status === 'COMPLETED').length;
//
//       await prisma.bundleInstallSession.update({
//         where: { id: sessionId },
//         data: {
//           successfulDevices,
//           failedDevices,
//           pendingDevices,
//           completedBatches
//         }
//       });
//
//     } catch (error) {
//       logger.error('Failed to update session statistics', { sessionId, error: error.message });
//     }
//   }
//
//   private async updateDeviceStatistics(sessionId: string, batchId: string, deviceId: string): Promise<void> {
//     try {
//       const bundles = await prisma.bundleInstallBundle.findMany({
//         where: { sessionId, batchId, deviceId }
//       });
//
//       const successfulBundles = bundles.filter(b => b.status === 'COMPLETED').length;
//       const failedBundles = bundles.filter(b => b.status === 'FAILED').length;
//       const currentBundle = bundles.find(b => b.status === 'IN_PROGRESS');
//
//       await prisma.bundleInstallDevice.updateMany({
//         where: { sessionId, batchId, deviceId },
//         data: {
//           successfulBundles,
//           failedBundles,
//           currentBundle: currentBundle?.bundleId,
//           currentBundleIdx: currentBundle?.order || 0,
//           progress: Math.round((successfulBundles / bundles.length) * 100)
//         }
//       });
//
//     } catch (error) {
//       logger.error('Failed to update device statistics', {
//         sessionId,
//         batchId,
//         deviceId,
//         error: error.message
//       });
//     }
//   }
//
//   private delay(ms: number): Promise<void> {
//     return new Promise(resolve => setTimeout(resolve, ms));
//   }
//
//   async handleStatusUpdate(statusUpdate: BundleInstallStatus): Promise<void> {
//     const { sessionId, batchId, deviceId, bundleId, status, progress, message, error } = statusUpdate;
//
//     try {
//       await bundleInstallService.updateDeviceStatus(
//         sessionId,
//         batchId,
//         deviceId,
//         bundleId,
//         status,
//         progress,
//         message,
//         error
//       );
//
//       logger.debug('Status update processed', {
//         sessionId,
//         batchId,
//         deviceId,
//         bundleId,
//         status,
//         progress
//       });
//
//     } catch (error) {
//       logger.error('Failed to process status update', {
//         sessionId,
//         batchId,
//         deviceId,
//         bundleId,
//         error: error.message
//       });
//     }
//   }
// }
//
// export const bundleInstallHandler = new BundleInstallHandler();
