import type { PrismaClient } from '@prisma/client';
import { registerRpcClient } from '../index';
import { handleClaimDevice } from './handle_claim_device';
import { handleScreenshotDevice } from './handle_screenshot_device';
import { handleResetDevice } from './handle_reset_device';
import {
    handleRefreshDevice,
    handleRebootDevice,
    handleUpdateFirmware,
    handleInstallApp,
    handlePullFile,
    handlePushFile,
    handleGetLogs
} from './handle_device_action';
import {
    handleTerminalConnect,
    handleTerminalInput,
    handleTerminalResize,
    handleTerminalDisconnect
} from './handle_terminal';
import {
    handleRDPStart,
    handleRDPStop,
    handleRDPControl
} from './handle_rdp';
import {
    handleWebRTCConnect,
    handleWebRTCAnswer,
    handleWebRTCICECandidate,
    handleWebRTCVideoRequest
} from './handle_webrtc';

/********************************************************************************************
 * Register web-side MQTT RPC handlers for user topics (user/<subject>/...).
 ********************************************************************************************/
export function registerWebHandlers(prisma: PrismaClient): void {
    registerRpcClient(
        'User',
        'user/',
        {
            'device.claim': handleClaimDevice as any,
            'device.screenshot': handleScreenshotDevice as any,
            'device.reset': handleResetDevice as any,
            'device.refresh': handleRefreshDevice as any,
            'device.reboot': handleRebootDevice as any,
            'device.firmware.update': handleUpdateFirmware as any,
            'device.app.install': handleInstallApp as any,
            'device.file.pull': handlePullFile as any,
            'device.file.push': handlePushFile as any,
            'device.logs.get': handleGetLogs as any,
            'terminal.connect': handleTerminalConnect as any,
            'terminal.input': handleTerminalInput as any,
            'terminal.resize': handleTerminalResize as any,
            'terminal.disconnect': handleTerminalDisconnect as any,
            'rdp.start': handleRDPStart as any,
            'rdp.stop': handleRDPStop as any,
            'rdp.control': handleRDPControl as any,
            'webrtc.connect': handleWebRTCConnect as any,
            'webrtc.answer': handleWebRTCAnswer as any,
            'webrtc.icecandidate': handleWebRTCICECandidate as any,
            'webrtc.video-request': handleWebRTCVideoRequest as any
        },
        prisma
    );
}
