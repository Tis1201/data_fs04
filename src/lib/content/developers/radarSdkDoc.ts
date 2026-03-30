/**
 * Static copy for /user/developers/sdks/radar — aligned with Web App prototype.
 */
import { Cpu, Monitor, Smartphone } from 'lucide-svelte';

export type RequirementCard = {
	lang: string;
	/** Lucide Svelte icon constructor */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	icon: any;
	color: string;
	bg: string;
	comingSoon: boolean;
	items: { label: string; value: string }[];
};

export const radarRequirements: RequirementCard[] = [
	{
		lang: 'C++',
		icon: Cpu,
		color: 'text-blue-600',
		bg: 'bg-blue-50',
		comingSoon: false,
		items: [
			{ label: 'OS', value: 'Linux (Debian 11+, Ubuntu 20.04+)' },
			{ label: 'Architecture', value: 'AMD64 (x86_64) or AArch64 (ARM64)' },
			{ label: 'Compiler', value: 'GCC 10+ or Clang 12+ (C++17 required)' },
			{ label: 'Hardware', value: 'DR6000 Radar sensor via USB' },
			{ label: 'Permissions', value: 'dialout group access to serial devices' }
		]
	},
	{
		lang: 'Node.js',
		icon: Monitor,
		color: 'text-green-600',
		bg: 'bg-green-50',
		comingSoon: false,
		items: [
			{ label: 'Runtime', value: 'Node.js 18+ (LTS recommended)' },
			{ label: 'OS', value: 'Windows 10+, Linux (Ubuntu 18.04+), macOS 10.15+' },
			{ label: 'Package', value: 'radar-node.js-sdk (.tgz / sample from developer download)' },
			{ label: 'Hardware', value: 'DR6000 Radar sensor via USB' }
		]
	},
	{
		lang: 'Python',
		icon: Monitor,
		color: 'text-yellow-600',
		bg: 'bg-yellow-50',
		comingSoon: true,
		items: [
			{ label: 'Version', value: 'TBD' },
			{ label: 'OS', value: 'Windows, Linux, macOS' },
			{ label: 'Package', value: 'Not shipped in current catalog' },
			{ label: 'Hardware', value: 'DR6000 Radar sensor via USB' }
		]
	},
	{
		lang: 'Android',
		icon: Smartphone,
		color: 'text-orange-600',
		bg: 'bg-orange-50',
		comingSoon: false,
		items: [
			{ label: 'Language', value: 'Java (Android)' },
			{ label: 'Min SDK', value: 'API 21 (Android 5.0+)' },
			{ label: 'Library', value: 'datarealities-radar-1.0.aar (local AAR)' },
			{ label: 'Hardware', value: 'DR6000 Radar sensor via USB' },
			{ label: 'Dependencies', value: 'usb-serial-for-android 3.8.1, gson 2.10.1' }
		]
	},
	{
		lang: 'Go',
		icon: Monitor,
		color: 'text-cyan-600',
		bg: 'bg-cyan-50',
		comingSoon: true,
		items: [
			{ label: 'Version', value: 'Go 1.21+' },
			{ label: 'OS', value: 'Windows, Linux, macOS' }
		]
	},
	{
		lang: '.NET',
		icon: Monitor,
		color: 'text-violet-600',
		bg: 'bg-violet-50',
		comingSoon: true,
		items: [
			{ label: 'Version', value: '.NET 6+ · C#' },
			{ label: 'OS', value: 'Windows, Linux, macOS' }
		]
	}
];

export const radarCapabilities = [
	{
		label: 'Presence detection',
		desc: 'Detect when people enter or leave a defined zone with stable UUID-based tracking.'
	},
	{
		label: 'Motion tracking',
		desc: 'Track motion trajectories with persistent target IDs across frames (~200ms intervals).'
	},
	{
		label: 'Dwell time analytics',
		desc: 'Measure how long individuals remain in a zone; configurable minimum dwell threshold.'
	},
	{
		label: 'Path tracking',
		desc: 'Record full movement paths per session — all detection points stored with timestamps.'
	},
	{
		label: 'Real-time event triggers',
		desc: 'Listener-based architecture fires events instantly on detection or session completion.'
	},
	{
		label: 'Edge processing (low latency)',
		desc: 'All processing runs on-device via static library — no cloud round-trips required.'
	},
	{
		label: 'Automatic reconnection',
		desc: 'Handles device disconnection and reconnection automatically without manual intervention.'
	}
] as const;

export type RadarTabId = 'cpp' | 'nodejs' | 'android';
export type CppSubTab = 'structure' | 'quickstart' | 'compile';

export const radarCodeExamples: Record<
	RadarTabId,
	{ setup: string; code: string; compile?: string }
> = {
	cpp: {
		setup: `# SDK structure
Radar_CPP_SDK_1.0.0/
├── include/
│   ├── RadarSDK.h           # Main header (includes RadarTypes.h)
│   ├── RadarTypes.h         # Data structures
│   └── RadarJsonHelpers.h   # Optional helper listeners
├── lib/
│   ├── amd64/libradarsdk.a
│   └── aarch64/libradarsdk.a
└── examples/main.cpp`,
		code: `#include "RadarSDK.h"
#include "RadarJsonHelpers.h"
#include <iostream>
#include <thread>
#include <chrono>
#include <signal.h>
#include <atomic>

std::atomic<bool> running{true};

void signal_handler(int signum) {
    (void)signum;
    running = false;
}

int main() {
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);

    RadarSDK sdk;
    RadarSDKHelpers::PrettyRealtimeListener realtimeListener;
    RadarSDKHelpers::PrettySessionListener sessionListener;
    RadarSDKHelpers::JsonErrorListener errorListener;

    sdk.register_realtime_listener(&realtimeListener);
    sdk.register_session_listener(&sessionListener);
    sdk.register_error_listener(&errorListener);

    auto devices = RadarSDK::list_devices();
    if (devices.empty()) {
        std::cerr << "No radar devices found." << std::endl;
        return 1;
    }

    const std::string json_config = R"({
        "tracking_area": {
            "x_min": -4.0, "x_max": 4.0,
            "y_min":  0.0, "y_max": 7.0
        },
        "min_dwell_sec": 5.0,
        "path_tracking": true,
        "sensor_id": "radar-001",
        "organization_id": "org_abc123"
    })";

    if (!sdk.set_params(json_config)) {
        std::cerr << "Invalid configuration." << std::endl;
        return 1;
    }

    if (!sdk.start(devices[0].path)) {
        std::cerr << "Failed to start SDK." << std::endl;
        return 1;
    }

    std::cout << "SDK started. Press Ctrl+C to stop." << std::endl;

    while (running && sdk.is_running())
        std::this_thread::sleep_for(std::chrono::milliseconds(100));

    sdk.unregister_realtime_listener(&realtimeListener);
    sdk.unregister_session_listener(&sessionListener);
    sdk.unregister_error_listener(&errorListener);
    sdk.stop();
    return 0;
}`,
		compile: `# AMD64 (x86_64)
g++ -std=c++17 -O2 \\
    -I./include \\
    -o radar_app main.cpp \\
    -L./lib/amd64 -lradarsdk -lpthread

# AArch64 (ARM64 / Raspberry Pi / BrightSign)
g++ -std=c++17 -O2 \\
    -I./include \\
    -o radar_app main.cpp \\
    -L./lib/aarch64 -lradarsdk -lpthread`
	},
	nodejs: {
		setup: `# package.json
{
  "name": "my-radar-app",
  "version": "1.0.0",
  "dependencies": {
    "@datarealities/radar-node": "file:./datarealities-radar-node-1.0.0.tgz"
  }
}

# Install
npm install`,
		code: `const { createTracker, RadarConfig } = require('@datarealities/radar-node');

const config = new RadarConfig({
    trackingArea: { xMin: -4, xMax: 4, yMin: 0, yMax: 7 },
    minDwellSec: 5,
    filterProximityM: 6.0,
    pathTracking: true,
    sensorId: 'radar-001',
    organizationId: 'org_abc123'
});

const tracker = createTracker();

tracker.on('connectionStatus', (connected) => {
    console.log('Radar', connected ? 'CONNECTED' : 'DISCONNECTED');
});

tracker.on('detection', (event) => {
    console.log('[detection]', JSON.stringify(event, null, 2));
});

tracker.on('session', (sessionLogs) => {
    sessionLogs.forEach((log) => console.log('[session]', log));
});

(async () => {
    await tracker.start(config);
    process.on('SIGINT', () => {
        tracker.stop();
        process.exit(0);
    });
})();`
	},
	android: {
		setup: `// settings.gradle
repositories {
    google()
    mavenCentral()
    maven { url 'https://jitpack.io' }
}

// app/build.gradle
dependencies {
    implementation 'com.github.mik3y:usb-serial-for-android:3.8.1'
    implementation 'com.google.code.gson:gson:2.10.1'
    implementation files('libs/datarealities-radar-1.0.aar')
}`,
		code: `import com.datarealities.radar.android.RadarTracker;
import com.datarealities.radar.android.RadarConfig;
import com.datarealities.radar.android.RadarCallback;

public class MainActivity extends AppCompatActivity {
    private RadarTracker radarTracker;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        radarTracker = new RadarTracker(this);
        requestRadarPermission();
    }

    private void startRadar() {
        RadarConfig config = new RadarConfig.Builder()
            .trackingArea(-4, 4, 0, 7)
            .minDwellSec(5)
            .filterProximityM(6.0)
            .pathTracking(true)
            .sensorId("radar-001")
            .organizationId("org_abc123")
            .build();

        radarTracker.start(config, new RadarCallback() {
            @Override
            public void onDetection(RealtimeTrackerEvent event) {
                Log.d("Radar", "[detection] " + event.toJson());
            }
            @Override
            public void onSession(List<SessionLog> sessionLogs) {
                for (SessionLog log : sessionLogs)
                    Log.d("Radar", "[session] " + log.toJson());
            }
            @Override
            public void onConnectionChanged(boolean connected) { /* … */ }
            @Override
            public void onError(String error) {
                Log.e("Radar", "Error: " + error);
            }
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (radarTracker != null) radarTracker.stop();
    }
}`
	}
};

export const radarDetectionEventJson = `{
  "event_type": "realtime_tracker",
  "timestamp_utc": "2025-07-12T18:32:44Z",
  "targets": [
    {
      "target_id": "550e8400-e29b-41d4-a716-446655440000",
      "x_m": 1.2,
      "y_m": 3.4,
      "z_m": 0.0,
      "proximity_m": 0.85
    }
  ]
}`;

export const radarSessionEventJson = `{
  "log_type": "session_log",
  "log_version": "v1.1",
  "timestamp_utc": "2025-07-12T18:32:45Z",
  "timezone": "America/New_York",
  "sensor_id": "radar-001",
  "organization_id": "org_abc123",
  "target_id": "550e8400-e29b-41d4-a716-446655440000",
  "proximity_m": 0.85,
  "dwell_time_sec": 3.2,
  "path_tracking": [
    { "timestamp_utc": "2025-07-12T18:32:42.100Z", "x_m": 1.2, "y_m": 3.4, "z_m": 0.0, "proximity_m": 0.85 }
  ]
}`;

/**
 * Must match `Resource.packageName` on catalog rows (`shareScope` = PUBLIC_DEVELOPER).
 * For each of C++, Node.js, and Android, the loader accepts an exact id or a versioned
 * `packageName` starting with `{catalogPackageName}-` or `{catalogPackageName}_` (e.g. `radar-node.js-sdk-2.1.0`).
 * `Resource.type` stays the file category (e.g. archive).
 */
export type RadarCatalogPackageName = 'radar-c++-sdk' | 'radar-node.js-sdk' | 'radar-android-sdk';

/** @deprecated Use RadarCatalogPackageName */
export type RadarSdkResourceType = RadarCatalogPackageName;

export const radarDownloadPackages = [
	{
		catalogPackageName: 'radar-c++-sdk' as const,
		name: 'Radar C++ SDK',
		version: 'v1.0.0',
		platforms: 'Linux AMD64 + AArch64',
		size: '—',
		/** Suggested download filename when using signed URL from `/api/resources/[id]` */
		downloadFileName: 'radar-c++-sdk.zip'
	},
	{
		catalogPackageName: 'radar-node.js-sdk' as const,
		name: 'Radar Node.js SDK',
		version: 'v1.0.0',
		platforms: 'Windows · Linux · macOS',
		size: '—',
		downloadFileName: 'radar-node.js-sdk.zip'
	},
	{
		catalogPackageName: 'radar-android-sdk' as const,
		name: 'Radar Android SDK',
		version: 'v1.0.0',
		platforms: 'Android 5.0+ (API 21+)',
		size: '—',
		downloadFileName: 'radar-android-sdk.zip'
	}
] as const;
