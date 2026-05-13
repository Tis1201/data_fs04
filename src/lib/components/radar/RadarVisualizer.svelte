<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import * as THREE from "three";
    import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

    export let radarObjects: {
        id: number;
        dist: number;
        x: number;
        y: number;
    }[] = [];

    let containerEl: HTMLDivElement;
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let controls: OrbitControls;
    let animationId: number | null = null;

    const gridSize = 8;
    const markers = new Map<
        number,
        {
            group: THREE.Group;
            trail: THREE.Line;
            trailPositions: { x: number; z: number }[];
            pulsePhase: number;
        }
    >();

    const COLORS = [
        0x00ffff, // Cyan
        0xff6b6b, // Coral Red
        0x4ade80, // Green
        0xfbbf24, // Amber/Gold
        0xa78bfa, // Violet
        0xf472b6, // Pink
        0x38bdf8, // Sky Blue
        0xff8c42, // Orange
    ];

    onMount(() => {
        initScene();
        animate();

        const handleResize = () => resize();
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    });

    onDestroy(() => {
        dispose();
    });

    $: updateMarkers(radarObjects);

    function initScene() {
        const width = containerEl.clientWidth;
        const height = containerEl.clientHeight;

        // Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x09090b);
        scene.fog = new THREE.Fog(0x09090b, 18, 35);

        // Camera
        camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
        camera.position.set(12, 8, 8);
        camera.lookAt(gridSize / 2, 0, 0);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        containerEl.appendChild(renderer.domElement);

        // Controls
        controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(gridSize / 2, 0, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 5;
        controls.maxDistance = 25;
        controls.maxPolarAngle = Math.PI / 2.1;
        controls.autoRotate = true;
        controls.autoRotateSpeed = -0.5;
        controls.update();

        // Build scene elements
        createFloor();
        createGrid();
        createZones();
        createBoundary();
        createWalls();
        createSensor();
        createLighting();
    }

    function createFloor() {
        const geometry = new THREE.PlaneGeometry(gridSize, gridSize);
        const material = new THREE.MeshStandardMaterial({
            color: 0x18181b,
            roughness: 0.9,
            metalness: 0.1,
        });
        const floor = new THREE.Mesh(geometry, material);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(gridSize / 2, 0, 0);
        floor.receiveShadow = true;
        scene.add(floor);
    }

    function createGrid() {
        const gridHelper = new THREE.GridHelper(
            gridSize,
            16,
            0x3f3f46,
            0x27272a,
        );
        gridHelper.position.set(gridSize / 2, 0.01, 0);
        scene.add(gridHelper);
        addMeterMarkers();
    }

    function addMeterMarkers() {
        const createLabel = (text: string) => {
            const canvas = document.createElement("canvas");
            canvas.width = 64;
            canvas.height = 32;
            const ctx = canvas.getContext("2d")!;
            ctx.fillStyle = "#71717a";
            ctx.font = "20px -apple-system, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, 32, 16);
            return new THREE.CanvasTexture(canvas);
        };

        // X axis labels
        for (let i = 0; i <= gridSize; i += 2) {
            const sprite = new THREE.Sprite(
                new THREE.SpriteMaterial({
                    map: createLabel(`${i}m`),
                    transparent: true,
                }),
            );
            sprite.position.set(i, 0.1, -gridSize / 2 - 0.5);
            sprite.scale.set(1, 0.5, 1);
            scene.add(sprite);
        }

        // Z axis labels
        for (let i = -gridSize / 2; i <= gridSize / 2; i += 2) {
            const val = -i;
            const sprite = new THREE.Sprite(
                new THREE.SpriteMaterial({
                    map: createLabel(`${val}m`),
                    transparent: true,
                }),
            );
            sprite.position.set(-0.5, 0.1, i);
            sprite.scale.set(1, 0.5, 1);
            scene.add(sprite);
        }
    }

    function createZones() {
        // Zone A (Left)
        const zoneAGeom = new THREE.PlaneGeometry(gridSize, gridSize / 2);
        const zoneAMat = new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.06,
        });
        const zoneA = new THREE.Mesh(zoneAGeom, zoneAMat);
        zoneA.rotation.x = -Math.PI / 2;
        zoneA.position.set(gridSize / 2, 0.02, -gridSize / 4);
        scene.add(zoneA);

        // Zone B (Right)
        const zoneBGeom = new THREE.PlaneGeometry(gridSize, gridSize / 2);
        const zoneBMat = new THREE.MeshBasicMaterial({
            color: 0xa78bfa,
            transparent: true,
            opacity: 0.06,
        });
        const zoneB = new THREE.Mesh(zoneBGeom, zoneBMat);
        zoneB.rotation.x = -Math.PI / 2;
        zoneB.position.set(gridSize / 2, 0.02, gridSize / 4);
        scene.add(zoneB);
    }

    function createBoundary() {
        const points = [
            new THREE.Vector3(0, 0.05, -gridSize / 2),
            new THREE.Vector3(gridSize, 0.05, -gridSize / 2),
            new THREE.Vector3(gridSize, 0.05, gridSize / 2),
            new THREE.Vector3(0, 0.05, gridSize / 2),
            new THREE.Vector3(0, 0.05, -gridSize / 2),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x22d3ee,
            linewidth: 2,
        });
        scene.add(new THREE.Line(geometry, material));
    }

    function createWalls() {
        const wallHeight = 0.8;
        const wallMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.15,
            roughness: 0.1,
            metalness: 0.0,
            side: THREE.DoubleSide,
            depthWrite: false,
        });

        const walls = [
            {
                pos: [0, wallHeight / 2, 0] as [number, number, number],
                rot: [0, Math.PI / 2, 0] as [number, number, number],
                size: [gridSize, wallHeight],
            },
            {
                pos: [gridSize, wallHeight / 2, 0] as [number, number, number],
                rot: [0, Math.PI / 2, 0] as [number, number, number],
                size: [gridSize, wallHeight],
            },
            {
                pos: [gridSize / 2, wallHeight / 2, -gridSize / 2] as [
                    number,
                    number,
                    number,
                ],
                rot: [0, 0, 0] as [number, number, number],
                size: [gridSize, wallHeight],
            },
            {
                pos: [gridSize / 2, wallHeight / 2, gridSize / 2] as [
                    number,
                    number,
                    number,
                ],
                rot: [0, 0, 0] as [number, number, number],
                size: [gridSize, wallHeight],
            },
        ];

        for (const wall of walls) {
            const geom = new THREE.PlaneGeometry(wall.size[0], wall.size[1]);
            const mesh = new THREE.Mesh(geom, wallMaterial);
            mesh.position.set(...wall.pos);
            mesh.rotation.set(...wall.rot);
            scene.add(mesh);
        }

        // Top edge lines
        const edgeMaterial = new THREE.LineBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.8,
        });
        const topEdges = [
            [
                new THREE.Vector3(0, wallHeight, -gridSize / 2),
                new THREE.Vector3(gridSize, wallHeight, -gridSize / 2),
            ],
            [
                new THREE.Vector3(gridSize, wallHeight, -gridSize / 2),
                new THREE.Vector3(gridSize, wallHeight, gridSize / 2),
            ],
            [
                new THREE.Vector3(gridSize, wallHeight, gridSize / 2),
                new THREE.Vector3(0, wallHeight, gridSize / 2),
            ],
            [
                new THREE.Vector3(0, wallHeight, gridSize / 2),
                new THREE.Vector3(0, wallHeight, -gridSize / 2),
            ],
        ];

        for (const edge of topEdges) {
            const geom = new THREE.BufferGeometry().setFromPoints(edge);
            scene.add(new THREE.Line(geom, edgeMaterial));
        }

        // Vertical corner lines
        const corners: [number, number][] = [
            [0, -gridSize / 2],
            [gridSize, -gridSize / 2],
            [gridSize, gridSize / 2],
            [0, gridSize / 2],
        ];
        for (const [x, z] of corners) {
            const geom = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(x, 0, z),
                new THREE.Vector3(x, wallHeight, z),
            ]);
            scene.add(new THREE.Line(geom, edgeMaterial));
        }
    }

    function createSensor() {
        const sensorX = 0,
            sensorY = 1.8,
            sensorZ = 0;

        // Body
        const bodyGeom = new THREE.BoxGeometry(0.25, 0.15, 0.35);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x18181b,
            roughness: 0.2,
            metalness: 0.9,
        });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.position.set(sensorX, sensorY, sensorZ);
        scene.add(body);

        // Lens
        const lensGeom = new THREE.CircleGeometry(0.08, 16);
        const lensMat = new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.95,
        });
        const lens = new THREE.Mesh(lensGeom, lensMat);
        lens.position.set(sensorX + 0.13, sensorY, sensorZ);
        lens.rotation.y = Math.PI / 2;
        scene.add(lens);

        // Glow ring
        const glowRingGeom = new THREE.RingGeometry(0.08, 0.12, 32);
        const glowRingMat = new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
        });
        const glowRing = new THREE.Mesh(glowRingGeom, glowRingMat);
        glowRing.position.set(sensorX + 0.13, sensorY, sensorZ);
        glowRing.rotation.y = Math.PI / 2;
        scene.add(glowRing);

        // Bracket
        const bracketGeom = new THREE.BoxGeometry(0.08, 0.4, 0.08);
        const bracketMat = new THREE.MeshStandardMaterial({
            color: 0x3f3f46,
            roughness: 0.4,
            metalness: 0.6,
        });
        const bracket = new THREE.Mesh(bracketGeom, bracketMat);
        bracket.position.set(sensorX - 0.1, sensorY, sensorZ);
        scene.add(bracket);

        // Plate
        const plateGeom = new THREE.BoxGeometry(0.02, 0.5, 0.5);
        const plate = new THREE.Mesh(plateGeom, bracketMat);
        plate.position.set(sensorX - 0.15, sensorY, sensorZ);
        scene.add(plate);

        // FOV lines
        const fovMat = new THREE.LineBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.3,
        });
        const fovAngle = Math.PI / 3;
        const fovLength = gridSize;

        const fovLine1 = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0.02, sensorZ),
            new THREE.Vector3(
                fovLength,
                0.02,
                sensorZ - Math.tan(fovAngle / 2) * fovLength,
            ),
        ]);
        scene.add(new THREE.Line(fovLine1, fovMat));

        const fovLine2 = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0.02, sensorZ),
            new THREE.Vector3(
                fovLength,
                0.02,
                sensorZ + Math.tan(fovAngle / 2) * fovLength,
            ),
        ]);
        scene.add(new THREE.Line(fovLine2, fovMat));

        // Label
        const labelCanvas = document.createElement("canvas");
        labelCanvas.width = 128;
        labelCanvas.height = 32;
        const ctx = labelCanvas.getContext("2d")!;
        ctx.fillStyle = "#22d3ee";
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("RADAR", 64, 16);
        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelMat = new THREE.SpriteMaterial({
            map: labelTexture,
            transparent: true,
        });
        const label = new THREE.Sprite(labelMat);
        label.position.set(sensorX, sensorY + 0.4, sensorZ);
        label.scale.set(1.2, 0.3, 1);
        scene.add(label);
    }

    function createLighting() {
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        const directional = new THREE.DirectionalLight(0xffffff, 0.8);
        directional.position.set(10, 15, 10);
        directional.castShadow = true;
        directional.shadow.mapSize.width = 1024;
        directional.shadow.mapSize.height = 1024;
        scene.add(directional);

        const fillLight = new THREE.DirectionalLight(0x6366f1, 0.3);
        fillLight.position.set(-5, 10, -5);
        scene.add(fillLight);
    }

    function animate() {
        animationId = requestAnimationFrame(animate);
        controls.update();

        // Animate markers
        for (const [id, marker] of markers) {
            marker.pulsePhase += 0.025;
            const group = marker.group;

            // Rotate elements
            group.children.forEach((child) => {
                if (child.userData.rotate) {
                    child.rotation.y += 0.02;
                }
            });

            // Pulse ring
            const ring = group.children.find((c) => c.userData.isRing) as
                | THREE.Mesh
                | undefined;
            if (ring) {
                const scale = 1 + Math.sin(marker.pulsePhase * 2) * 0.15;
                ring.scale.set(scale, scale, 1);
                (ring.material as THREE.MeshBasicMaterial).opacity =
                    0.6 - Math.sin(marker.pulsePhase * 2) * 0.2;
            }
        }

        renderer.render(scene, camera);
    }

    function updateMarkers(objects: typeof radarObjects) {
        if (!scene) return;

        const currentIds = new Set(objects.map((p) => p.id));

        // Remove old markers
        for (const [id, marker] of markers) {
            if (!currentIds.has(id)) {
                scene.remove(marker.group);
                scene.remove(marker.trail);
                markers.delete(id);
            }
        }

        // Update or create markers
        for (const obj of objects) {
            // Map coordinates: input x -> visualZ (lateral), input y (dist) -> visualX (depth)
            const visualX = obj.y;
            const visualZ = -obj.x;

            if (markers.has(obj.id)) {
                const marker = markers.get(obj.id)!;
                // Lerp position
                const lerpFactor = 0.15;
                marker.group.position.x +=
                    (visualX - marker.group.position.x) * lerpFactor;
                marker.group.position.z +=
                    (visualZ - marker.group.position.z) * lerpFactor;

                // Update trail
                marker.trailPositions.unshift({
                    x: marker.group.position.x,
                    z: marker.group.position.z,
                });
                marker.trailPositions.pop();

                const positions = marker.trail.geometry.attributes.position
                    .array as Float32Array;
                for (let i = 0; i < marker.trailPositions.length; i++) {
                    const pos = marker.trailPositions[i];
                    positions[i * 3] = pos.x;
                    positions[i * 3 + 1] = 0.05;
                    positions[i * 3 + 2] = pos.z;
                }
                marker.trail.geometry.attributes.position.needsUpdate = true;
            } else {
                createMarker(obj.id, visualX, visualZ);
            }
        }
    }

    function createMarker(id: number, x: number, z: number) {
        const color = COLORS[markers.size % COLORS.length];
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        const holoMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        const wireMat = new THREE.MeshBasicMaterial({
            color,
            wireframe: true,
            transparent: true,
            opacity: 0.9,
        });

        // Head
        const headGeom = new THREE.SphereGeometry(0.12, 16, 12);
        const head = new THREE.Mesh(headGeom, holoMat);
        head.position.y = 0.92;
        head.userData.rotate = true;
        group.add(head);

        const headWireGeom = new THREE.IcosahedronGeometry(0.13, 1);
        const headWire = new THREE.Mesh(headWireGeom, wireMat);
        headWire.position.y = 0.92;
        headWire.userData.rotate = true;
        group.add(headWire);

        // Body (inverted cone)
        const bodyGeom = new THREE.ConeGeometry(0.18, 0.55, 4);
        const body = new THREE.Mesh(bodyGeom, holoMat);
        body.position.y = 0.48;
        body.rotation.x = Math.PI;
        body.rotation.y = Math.PI / 4;
        body.userData.rotate = true;
        group.add(body);

        const bodyWire = new THREE.Mesh(bodyGeom, wireMat);
        bodyWire.position.y = 0.48;
        bodyWire.rotation.x = Math.PI;
        bodyWire.rotation.y = Math.PI / 4;
        bodyWire.userData.rotate = true;
        group.add(bodyWire);

        // Ring
        const ringGeom = new THREE.RingGeometry(0.25, 0.3, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthTest: false,
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02;
        ring.renderOrder = 1;
        ring.userData.isRing = true;
        group.add(ring);

        // Dot
        const dotGeom = new THREE.CircleGeometry(0.06, 16);
        const dotMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthTest: false,
        });
        const dot = new THREE.Mesh(dotGeom, dotMat);
        dot.rotation.x = -Math.PI / 2;
        dot.position.y = 0.02;
        dot.renderOrder = 2;
        group.add(dot);

        scene.add(group);

        // Trail
        const trailLength = 20;
        const trailGeom = new THREE.BufferGeometry();
        const trailPositions = new Float32Array(trailLength * 3);
        for (let i = 0; i < trailLength; i++) {
            trailPositions[i * 3] = x;
            trailPositions[i * 3 + 1] = 0.05;
            trailPositions[i * 3 + 2] = z;
        }
        trailGeom.setAttribute(
            "position",
            new THREE.BufferAttribute(trailPositions, 3),
        );
        const trailMat = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0.3,
        });
        const trail = new THREE.Line(trailGeom, trailMat);
        scene.add(trail);

        markers.set(id, {
            group,
            trail,
            trailPositions: Array(trailLength).fill({ x, z }),
            pulsePhase: Math.random() * Math.PI * 2,
        });
    }

    function resize() {
        if (!containerEl || !camera || !renderer) return;
        const width = containerEl.clientWidth;
        const height = containerEl.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    function dispose() {
        if (animationId) cancelAnimationFrame(animationId);
        controls?.dispose();
        renderer?.dispose();
        if (
            renderer?.domElement &&
            containerEl?.contains(renderer.domElement)
        ) {
            containerEl.removeChild(renderer.domElement);
        }
    }
</script>

<div bind:this={containerEl} class="w-full h-full min-h-[400px]"></div>
