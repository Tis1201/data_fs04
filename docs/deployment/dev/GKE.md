# GKE POC Cluster - Development Environment

> **Last Updated**: January 2026

## Quick Reference

| Property | Value |
|----------|-------|
| **Cluster Name** | `dr-iot-dev` |
| **Project ID** | `cs-poc-vlkpvg5seziflnwq2ni7x3l` |
| **Region/Zone** | `us-central1-a` (Zonal) |
| **Kubernetes Context** | `gke_cs-poc-vlkpvg5seziflnwq2ni7x3l_us-central1-a_dr-iot-dev` |
| **Node Pool** | `dr-iot-dev-node-pool` (2 × e2-medium, 20GB disk) |
| **Kubernetes Version** | v1.33.5-gke.1162000 |
| **Primary Namespace** | `fs04` |

---

## Cluster Architecture

```mermaid
graph TB
    subgraph GKE["GKE Cluster: dr-iot-dev (us-central1-a)"]
        subgraph Node1["Node 1: e106ea13-51fu"]
            N1IP["Internal: 10.128.0.56<br/>External: 34.9.68.185"]
            CH["clickhouse-0"]
            EMQX["emqx-core"]
            WEB["fs04-web"]
            PG["pgadmin"]
            PP["pushpin"]
            RI["redis-insight"]
        end
        
        subgraph Node2["Node 2: e106ea13-r74t"]
            N2IP["Internal: 10.128.0.57<br/>External: 130.211.237.19"]
            NGX["nginx"]
            RD["redis"]
            SS["superset"]
            SSW["superset-worker"]
            VEC["vector-agent"]
        end
    end
    
    style GKE fill:#e3f2fd
    style Node1 fill:#fff3e0
    style Node2 fill:#e8f5e9
```

---

## Network Architecture

```mermaid
flowchart TB
    subgraph Internet["Internet"]
        Users["👤 Users"]
        IoT["📡 IoT Devices"]
        WS["🔌 WebSocket Clients"]
    end
    
    subgraph CF["Cloudflare"]
        CDN["SSL/CDN"]
    end
    
    subgraph GCP["GCP Network"]
        subgraph LB["Load Balancers"]
            ING["GKE Ingress<br/>34.160.154.49"]
            NGINXLB["nginx-svc LB<br/>35.223.242.55"]
            EMQXLB["emqx-listeners LB<br/>34.67.198.252"]
            PPLB["pushpin-l4-v2 LB<br/>34.56.71.164"]
        end
        
        subgraph K8S["GKE Cluster (fs04 namespace)"]
            NGX["nginx Pod"]
            APP["fs04-web:3000"]
            PGA["pgadmin:80"]
            VEC["vector:80"]
            EMQXP["emqx-core"]
            PPP["pushpin"]
            PPT["pushpin-tracker"]
        end
    end
    
    Users --> CDN --> ING --> NGINXLB --> NGX
    NGX --> APP
    NGX --> PGA
    NGX --> VEC
    
    IoT --> EMQXLB --> EMQXP
    WS --> PPLB --> PPP --> PPT
    
    style LB fill:#bbdefb
    style K8S fill:#c8e6c9
```

---

## DNS & Traffic Flow

```mermaid
flowchart LR
    subgraph DNS["DNS Records (datarealities-gcp.com)"]
        D1["iot-dev-2"]
        D2["pgadmin-dev"]
        D3["vector-dev"]
        D4["nginx"]
        D5["pushpin-dev-v4"]
    end
    
    subgraph IPs["External IPs"]
        IP1["34.160.154.49<br/>(Ingress)"]
        IP2["34.160.174.106<br/>(Pushpin)"]
    end
    
    subgraph Services["Backend Services"]
        S1["fs04-web:3000"]
        S2["pgadmin-svc:80"]
        S3["vector-svc:80"]
        S4["nginx-svc"]
        S5["pushpin-l4-v2"]
    end
    
    D1 --> IP1 --> S1
    D2 --> IP1 --> S2
    D3 --> IP1 --> S3
    D4 --> IP1 --> S4
    D5 --> IP2 --> S5
    
    style DNS fill:#fff9c4
    style IPs fill:#ffccbc
```

---

## Service Dependencies

```mermaid
flowchart TB
    subgraph Frontend["Frontend Layer"]
        WEB["fs04-web<br/>:3000"]
        SS["superset<br/>:8088"]
        PGA["pgadmin<br/>:80"]
    end
    
    subgraph Proxy["Proxy Layer"]
        NGX["nginx<br/>:80/:443"]
        PP["pushpin<br/>:443/:7999"]
    end
    
    subgraph Messaging["Messaging Layer"]
        EMQX["emqx<br/>:1883/:8883"]
        RD["redis<br/>:6379"]
        PPT["pushpin-tracker<br/>:8081"]
    end
    
    subgraph Data["Data Layer"]
        CH["clickhouse<br/>:8123/:9000"]
        PG["PostgreSQL<br/>(Cloud SQL)"]
    end
    
    subgraph Observability["Observability"]
        VEC["vector<br/>:80"]
        RI["redis-insight<br/>:5540"]
    end
    
    NGX --> WEB
    NGX --> PGA
    NGX --> VEC
    PP --> WEB
    PP --> PPT
    
    WEB --> RD
    WEB --> PG
    WEB --> EMQX
    
    PPT --> RD
    SS --> PG
    SS --> CH
    VEC --> CH
    RI --> RD
    
    style Frontend fill:#e1bee7
    style Proxy fill:#b2dfdb
    style Messaging fill:#ffe0b2
    style Data fill:#c5cae9
    style Observability fill:#f0f4c3
```

---

## External IPs & LoadBalancers

```mermaid
graph LR
    subgraph External["External LoadBalancers"]
        L1["nginx-svc<br/>35.223.242.55<br/>:80/:443"]
        L2["emqx-listeners<br/>34.67.198.252<br/>:1883/:8883/:8083/:8084"]
        L3["pushpin-l4-v2<br/>34.56.71.164<br/>:443/:7999"]
    end
    
    subgraph Ingress["GKE Ingress (L7)"]
        ING["34.160.154.49<br/>HTTP(S) LB"]
    end
    
    subgraph Pending["Pending"]
        L4["pushpin-l4<br/>⏳ pending"]
    end
    
    style L1 fill:#a5d6a7
    style L2 fill:#81d4fa
    style L3 fill:#ce93d8
    style ING fill:#ffcc80
    style L4 fill:#e0e0e0
```

---

## Namespace Organization

```mermaid
pie title Namespace Distribution
    "fs04 (Application)" : 11
    "kube-system" : 8
    "gmp-system" : 3
    "cert-manager" : 3
    "doppler-operator" : 1
    "emqx-operator" : 2
```

---

## Pod Status (fs04 Namespace)

```mermaid
gantt
    title Pod Age & Status (All Running)
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d
    
    section StatefulSets
    clickhouse-0           :done, 2024-08-22, 2025-01-08
    emqx-core              :done, 2024-12-08, 2025-01-08
    
    section Deployments
    pgadmin                :done, 2024-11-06, 2025-01-08
    superset               :done, 2024-11-06, 2025-01-08
    superset-worker        :done, 2024-11-06, 2025-01-08
    vector-agent           :done, 2024-11-06, 2025-01-08
    pushpin                :done, 2024-11-06, 2025-01-08
    redis                  :done, 2024-12-09, 2025-01-08
    redis-insight          :done, 2024-12-09, 2025-01-08
    fs04-web               :done, 2025-01-06, 2025-01-08
    nginx                  :done, 2025-01-07, 2025-01-08
```

---

## Services Overview

| Service | Type | Cluster IP | Ports | Target |
|---------|------|------------|-------|--------|
| `fs04-web` | ClusterIP | 34.118.229.151 | 3000 | Main app |
| `nginx-svc` | **LoadBalancer** | 34.118.232.96 | 80, 443 | Reverse proxy |
| `emqx-listeners` | **LoadBalancer** | 34.118.239.4 | 1883, 8883, 8083, 8084 | MQTT |
| `pushpin-l4-v2` | **LoadBalancer** | 34.118.238.214 | 443, 7999 | WebSocket |
| `clickhouse` | ClusterIP | 34.118.236.12 | 8123, 9000, 9009 | Analytics DB |
| `redis` | ClusterIP | 34.118.226.207 | 6379 | Cache |
| `superset` | ClusterIP | 34.118.234.247 | 8088 | BI Dashboard |
| `pushpin` | ClusterIP | 34.118.229.237 | 443, 5561, 5662, 7999 | GRIP proxy |

---

## Storage (PVCs)

```mermaid
graph LR
    subgraph PVC["Persistent Volume Claims"]
        CH["clickhouse-data<br/>5Gi - standard-rwo"]
        SS["superset-postgresql<br/>8Gi - standard-rwo"]
        E1["emqx-core-data<br/>10Gi - standard"]
    end
    
    subgraph Pods["Bound Pods"]
        CHP["clickhouse-0"]
        SSP["superset (Helm)"]
        EMQXP["emqx-core"]
    end
    
    CH --> CHP
    SS --> SSP
    E1 --> EMQXP
    
    style PVC fill:#e8eaf6
```

---

## Secrets & ConfigMaps

```mermaid
mindmap
  root((fs04 Secrets))
    TLS Certificates
      cloudflare-origin-tls
      pushpin-tls
      emqx-tls
    Doppler-Synced
      fs04-web-secrets
      pushpin-tracker-secrets
      doppler-token
    Application
      redis-auth
      pgadmin-admin
      superset-env
      emqx-bootstrap-api-key
    Registry
      gitlab-regcred
```

```mermaid
mindmap
  root((fs04 ConfigMaps))
    Proxy
      nginx-config
      pushpin-config
    Application
      pushpin-tracker-config
      emqx-configs
    Observability
      vector-config
      vector-vrl
```

---

## MQTT Architecture (EMQX)

```mermaid
flowchart TB
    subgraph Clients["IoT Clients"]
        D1["Device 1"]
        D2["Device 2"]
        D3["Device N"]
    end
    
    subgraph LB["LoadBalancer: 34.67.198.252"]
        P1[":1883 MQTT"]
        P2[":8883 MQTT+TLS"]
        P3[":8083 WS"]
        P4[":8084 WSS"]
    end
    
    subgraph EMQX["EMQX Cluster"]
        CORE["emqx-core<br/>(StatefulSet)"]
        DASH["Dashboard :18083"]
        HEAD["emqx-headless<br/>:4370/:5369"]
    end
    
    subgraph Storage["Persistence"]
        PVC["10Gi PVC"]
    end
    
    D1 & D2 & D3 --> P1 & P2 & P3 & P4
    P1 & P2 & P3 & P4 --> CORE
    CORE --> PVC
    CORE --> HEAD
    CORE --> DASH
    
    style LB fill:#bbdefb
    style EMQX fill:#c8e6c9
```

---

## WebSocket/SSE Flow (Pushpin)

```mermaid
sequenceDiagram
    participant Browser
    participant Cloudflare
    participant Pushpin LB as pushpin-l4-v2<br/>34.56.71.164
    participant Pushpin as pushpin Pod
    participant Tracker as pushpin-tracker
    participant Redis
    participant App as fs04-web
    
    Browser->>Cloudflare: WSS Connect
    Cloudflare->>Pushpin LB: Forward :443
    Pushpin LB->>Pushpin: Route
    Pushpin->>Tracker: Subscribe
    Tracker->>Redis: Track Connection
    
    Note over Pushpin,App: GRIP Protocol
    
    App->>Tracker: Publish Event
    Tracker->>Pushpin: Push via GRIP
    Pushpin->>Browser: SSE/WS Message
```

---

## Terraform Resources

```mermaid
graph TB
    subgraph TF["Terraform (05_nginx_gke_v2)"]
        subgraph Compute["Compute"]
            CL["google_container_cluster<br/>dr-iot-dev"]
            NP["google_container_node_pool<br/>2 × e2-medium"]
        end
        
        subgraph Network["Network"]
            IP["google_compute_global_address<br/>34.160.154.49"]
        end
        
        subgraph DNS["Cloud DNS"]
            Z["datarealities-gcp-com zone"]
            R1["iot-dev-2.*.com"]
            R2["pgadmin-dev.*.com"]
            R3["vector-dev.*.com"]
            R4["nginx.*.com"]
        end
    end
    
    CL --> NP
    IP --> R1 & R2 & R3 & R4
    Z --> R1 & R2 & R3 & R4
    
    style Compute fill:#fff3e0
    style Network fill:#e8f5e9
    style DNS fill:#e3f2fd
```

---

## Connecting to the Cluster

### Quick Switch to POC Context

```bash
# Switch to POC GKE context
kubectl config use-context gke_cs-poc-vlkpvg5seziflnwq2ni7x3l_us-central1-a_dr-iot-dev
```

### Available Contexts

| Context Name | Cluster | Environment |
|--------------|---------|-------------|
| `gke_cs-poc-vlkpvg5seziflnwq2ni7x3l_us-central1-a_dr-iot-dev` | dr-iot-dev | **POC (GCP)** |
| `gke_dr-iot-prd_us-central1-a_iot-prd-gke` | iot-prd-gke | Production (GCP) |
| `arn:aws:eks:us-west-2:781895395657:cluster/inreality-dev-eks` | inreality-dev-eks | Dev (AWS) |
| `arn:aws:eks:us-west-2:781895395657:cluster/inreality-sandbox-eks` | inreality-sandbox-eks | Sandbox (AWS) |
| `docker-desktop` | docker-desktop | Local |

### First-Time Setup

```bash
# Get credentials for POC cluster (run once)
gcloud container clusters get-credentials dr-iot-dev \
  --zone us-central1-a \
  --project cs-poc-vlkpvg5seziflnwq2ni7x3l

# Verify current context
kubectl config current-context

# List all available contexts
kubectl config get-contexts
```

---

## Common Commands

```bash
# View all pods
kubectl get pods -n fs04 -o wide

# Check resource usage
kubectl top pods -n fs04 --use-protocol-buffers

# View deployment logs
kubectl logs -n fs04 deployment/fs04-web -f

# Restart a deployment
kubectl rollout restart -n fs04 deployment/fs04-web

# Check ingress status
kubectl get ingress -n fs04

# Apply manifests
kubectl apply -f app/10_fs04_web/

# Check Doppler secret sync
kubectl get dopplersecrets -n doppler-operator-system
```

---

## Cost Optimization

| Strategy | Savings |
|----------|---------|
| Zonal cluster (vs regional) | ~66% control plane |
| 2× e2-medium (vs larger) | Variable |
| Shared nginx LoadBalancer | ~$36/month |
| Standard GKE (vs Autopilot) | Better for small workloads |

---

## Related Documentation

- [Terraform README](file:///Users/bernard/CascadeProjects/fs04/fs04_cloud/sandbox/gcp/05_nginx_gke_v2/README.md)
- [EMQX Manifests](file:///Users/bernard/CascadeProjects/fs04/fs04_cloud/sandbox/gcp/05_nginx_gke_v2/app/02_emqx/)
- [Pushpin Config](file:///Users/bernard/CascadeProjects/fs04/fs04_cloud/sandbox/gcp/05_nginx_gke_v2/app/07_pushpin/)
