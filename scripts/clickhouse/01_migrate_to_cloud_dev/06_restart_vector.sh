#!/bin/bash
kubectl -n fs04 scale deployment vector-agent --replicas=1
echo "✅ Restarted vector-agent"