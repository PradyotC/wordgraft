#!/bin/bash
set -e

CLUSTER_NAME="wordcraft-local"

echo "🚀 Starting WordCraft Local Kubernetes (KinD) Setup..."

# 1. Create KinD cluster if it doesn't exist
if kind get clusters | grep -q "$CLUSTER_NAME"; then
    echo "✅ Cluster '$CLUSTER_NAME' already exists."
else
    echo "📦 Creating KinD cluster '$CLUSTER_NAME'..."
    kind create cluster --config local-env/kind/kind-config.yaml
fi

# 2. Build local Docker images
echo "🐳 Building Docker images locally (using architecture matching your host)..."
docker build -t pradyotc/wordcraft-db:latest ./database
docker build -t pradyotc/wordcraft-app:latest ./app
docker build -t pradyotc/wordcraft-ml:latest ./ml

# 3. Load images into KinD
echo "📥 Loading images into KinD cluster..."
kind load docker-image pradyotc/wordcraft-db:latest --name $CLUSTER_NAME
kind load docker-image pradyotc/wordcraft-app:latest --name $CLUSTER_NAME
kind load docker-image pradyotc/wordcraft-ml:latest --name $CLUSTER_NAME

# 4. Apply Kubernetes Manifests
echo "☸️ Applying Kubernetes manifests..."
kubectl apply -f ./k8s/db-pvc.yaml
kubectl apply -f ./k8s/db-deployment.yaml
kubectl apply -f ./k8s/db-service.yaml

kubectl apply -f ./k8s/ml-deployment.yaml
kubectl apply -f ./k8s/ml-service.yaml

kubectl apply -f ./k8s/app-deployment.yaml
kubectl apply -f ./k8s/app-service.yaml

echo "🎉 Setup Complete! Waiting for pods to become ready..."
kubectl wait --for=condition=ready pod -l app=wordcraft-app --timeout=90s

echo ""
echo "🔗 Access your app:"
echo "Note: Since LoadBalancer services stay pending in KinD without MetalLB,"
echo "you can port-forward to access the app locally:"
echo "  kubectl port-forward svc/wordcraft-app-service 3000:80"
echo "Then visit http://localhost:3000 in your browser."
