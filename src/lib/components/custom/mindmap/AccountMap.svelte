<!-- src/lib/components/custom/mindmap/AccountMap.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import Konva from 'konva';

    export let data: any;
    let stage: Konva.Stage;
    let layer: Konva.Layer;
    let container: HTMLDivElement;

    const COLORS = {
        account: '#4CAF50',
        store: '#2196F3',
        aoi: '#9C27B0',
        device: '#FF9800',
        sensorController: '#E91E63',
        sensor: '#00BCD4',
        dataSource: '#795548'
    };

    function createNode(x: number, y: number, text: string, color: string) {
        const group = new Konva.Group({
            x,
            y,
            draggable: true
        });

        const circle = new Konva.Circle({
            radius: 30,
            fill: color,
            opacity: 0.7,
            stroke: '#ffffff',
            strokeWidth: 2
        });

        const label = new Konva.Text({
            text,
            fontSize: 12,
            fill: '#ffffff',
            align: 'center',
            width: 100,
            offsetX: 50,
            offsetY: -40
        });

        group.add(circle);
        group.add(label);
        return group;
    }

    function createConnection(from: Konva.Group, to: Konva.Group) {
        const line = new Konva.Line({
            points: [
                from.x(),
                from.y(),
                to.x(),
                to.y()
            ],
            stroke: '#cccccc',
            strokeWidth: 1,
            opacity: 0.5
        });

        // Update line positions when nodes are dragged
        from.on('dragmove', () => {
            line.points([from.x(), from.y(), to.x(), to.y()]);
            layer.batchDraw();
        });

        to.on('dragmove', () => {
            line.points([from.x(), from.y(), to.x(), to.y()]);
            layer.batchDraw();
        });

        return line;
    }

    onMount(() => {
        const width = container.clientWidth;
        const height = container.clientHeight;

        stage = new Konva.Stage({
            container: container,
            width,
            height
        });

        layer = new Konva.Layer();
        stage.add(layer);

        // Create account node at center
        const centerX = width / 2;
        const centerY = height / 2;
        const accountNode = createNode(centerX, centerY, data.account.name, COLORS.account);
        layer.add(accountNode);

        // Calculate positions for child nodes
        const radius = 200;
        const numChildren = 6; // stores, aois, devices, sensorControllers, sensors, dataSources
        const angleStep = (2 * Math.PI) / numChildren;

        // Create store nodes
        data.stores.forEach((store: any, i: number) => {
            const angle = angleStep * i;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            const storeNode = createNode(x, y, store.name, COLORS.store);
            layer.add(storeNode);
            layer.add(createConnection(accountNode, storeNode));
        });

        // Create AOI nodes
        data.aois.forEach((aoi: any, i: number) => {
            const angle = angleStep * (i + 1);
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            const aoiNode = createNode(x, y, aoi.name, COLORS.aoi);
            layer.add(aoiNode);
            layer.add(createConnection(accountNode, aoiNode));
        });

        // Create device nodes
        data.devices.forEach((device: any, i: number) => {
            const angle = angleStep * (i + 2);
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            const deviceNode = createNode(x, y, device.name, COLORS.device);
            layer.add(deviceNode);
            layer.add(createConnection(accountNode, deviceNode));
        });

        // Create sensor controller nodes
        data.sensorControllers.forEach((controller: any, i: number) => {
            const angle = angleStep * (i + 3);
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            const controllerNode = createNode(x, y, controller.name, COLORS.sensorController);
            layer.add(controllerNode);
            layer.add(createConnection(accountNode, controllerNode));
        });

        // Create sensor nodes
        data.sensors.forEach((sensor: any, i: number) => {
            const angle = angleStep * (i + 4);
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            const sensorNode = createNode(x, y, sensor.name, COLORS.sensor);
            layer.add(sensorNode);
            layer.add(createConnection(accountNode, sensorNode));
        });

        // Create data source nodes
        data.dataSources.forEach((dataSource: any, i: number) => {
            const angle = angleStep * (i + 5);
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            const dataSourceNode = createNode(x, y, dataSource.name, COLORS.dataSource);
            layer.add(dataSourceNode);
            layer.add(createConnection(accountNode, dataSourceNode));
        });

        // Add zoom functionality
        stage.on('wheel', (e) => {
            e.evt.preventDefault();
            const scaleBy = 1.1;
            const oldScale = stage.scaleX();

            const pointer = stage.getPointerPosition();
            if (!pointer) return;

            const mousePointTo = {
                x: (pointer.x - stage.x()) / oldScale,
                y: (pointer.y - stage.y()) / oldScale,
            };

            const newScale = e.evt.deltaY > 0 ? oldScale * scaleBy : oldScale / scaleBy;

            stage.scale({ x: newScale, y: newScale });

            const newPos = {
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
            };
            stage.position(newPos);
            stage.batchDraw();
        });

        // Add drag functionality for the entire stage
        stage.draggable(true);
    });
</script>

<div class="w-full h-full" bind:this={container}></div>

<style>
    div {
        touch-action: none;
    }
</style>
