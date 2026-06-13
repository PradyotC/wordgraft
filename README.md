# Wordcraft DevOps Project

This repository hosts a full-stack web application—a clone of Neal.fun's Infinite Craft—along with a complete DevOps lifecycle implementation. The game utilizes a Machine Learning service to logically combine words and create new elements, and it stores game sessions and objectives in a MySQL database.

## 🚀 Tech Stack
- **Frontend & Backend**: Vanilla JS, Node.js (Express)
- **Machine Learning**: Python, spaCy (en_core_web_md)
- **Database**: MySQL
- **Containerization**: Docker
- **Orchestration**: Kubernetes (EKS / KinD)
- **CI/CD**: Jenkins, ArgoCD
- **Infrastructure as Code (IaC)**: Terraform

## 📂 Directory Structure
- **`app/`**: Node.js web application and static frontend files.
- **`ml/`**: Python Flask microservice using spaCy for vector-based word combinations.
- **`database/`**: MySQL Dockerfile and database initialization scripts (`init.sql`).
- **`k8s/`**: Kubernetes manifests (Deployments, Services, PVCs). Serves as the watched directory for ArgoCD (GitOps).
- **`terraform/`**: Terraform configurations for provisioning AWS EKS and the Jenkins CI server.
- **`local-env/`**: Scripts and Docker Compose files for running the stack locally (e.g., via Docker Compose or KinD).
- **`Jenkinsfile`**: Jenkins pipeline definition for building images, pushing to DockerHub, and updating K8s manifests.

## 🛠️ Local Development

### Using Docker Compose
Navigate to the local environment folder and spin up the database, machine learning service, and web app:

```bash
cd local-env
docker compose up --build
```
The application will be accessible at `http://localhost:3000`.

### Using local Kubernetes (KinD)
A setup script is available to deploy the stack to a local KinD cluster:
```bash
bash local-env/kind/setup-kind.sh
```

## 🌐 Cloud Infrastructure (Terraform)
To provision the AWS environment (EKS Cluster and Jenkins EC2 instance):
```bash
cd terraform
terraform init
terraform apply
```
