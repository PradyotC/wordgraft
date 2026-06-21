#!/bin/bash
set -e

echo "🚀 Starting Post-Provisioning Setup..."

# Set AWS region for eksctl and aws cli
export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1

# 1. Configure kubectl to connect to the EKS cluster
echo "⚙️ Attaching EKS cluster to kubectl..."
# Using the AWS region variable from your setup (default us-east-1)
aws eks update-kubeconfig --region us-east-1 --name wordcraft-eks

# 2. Setup Namespace
echo "📂 Creating default namespaces..."
kubectl create namespace wordcraft || true
kubectl config set-context --current --namespace=wordcraft

# 3. Setup AWS EBS CSI Driver for Persistent Storage (Required for db-pvc)
echo "💾 Configuring AWS EBS CSI Driver..."
# Create IAM Service Account for the EBS CSI Driver
eksctl create iamserviceaccount \
  --name ebs-csi-controller-sa \
  --namespace kube-system \
  --cluster wordcraft-eks \
  --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy \
  --approve \
  --role-only \
  --role-name AmazonEKS_EBS_CSI_DriverRole

# Get the AWS Account ID dynamically to format the Role ARN
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Install the EBS CSI Driver Addon
eksctl create addon \
  --name aws-ebs-csi-driver \
  --cluster wordcraft-eks \
  --service-account-role-arn arn:aws:iam::${ACCOUNT_ID}:role/AmazonEKS_EBS_CSI_DriverRole \
  --force

# 4. Install ArgoCD
echo "🐙 Installing ArgoCD..."
kubectl create namespace argocd || true
kubectl apply -n argocd --server-side --force-conflicts -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

echo "⏳ Waiting for ArgoCD CRDs to establish..."
sleep 15

# 5. Apply ArgoCD Application Manifest
echo "📄 Applying ArgoCD Application to manage the Wordcraft GitOps lifecycle..."
# Apply directly from your GitHub repository so you don't need to manually clone it on the EC2 server
kubectl apply -f https://raw.githubusercontent.com/PradyotC/wordgraft-gitops/main/k8s/argocd-application.yaml

echo "✅ All post-provisioning steps completed successfully!"
