# Wordcraft DevOps & GitOps Project

This repository hosts a full-stack web application—a clone of Neal.fun's *Infinite Craft*—along with a comprehensive, enterprise-grade DevOps and GitOps lifecycle implementation. The game utilizes a Machine Learning service to logically combine words and create new elements, and it stores game sessions and objectives in a MySQL database.

## 🏗️ Architecture & CI/CD Flow (GitOps)

This project strictly adheres to GitOps best practices by decoupling the application source code from the deployment state. 

* **Main Repository (`wordgraft`):** Contains the application microservices (`app`, `ml`, `database`), infrastructure as code (Terraform), and CI/CD pipelines (`Jenkinsfile`).
* **GitOps Repository (`wordgraft-gitops`):** Contains exclusively Kubernetes deployment manifests and ArgoCD configurations.

### CI/CD Workflow Diagram


```

```text
README.md created successfully.

```text
+-----------------+       1. Push Code     +--------------------------+
|   Developer     | ---------------------> |  GitHub (Main Repo)      |
+-----------------+                        |  (App + TF + Jenkins)    |
                                           +--------------------------+
                                                        |
                                                        | 2. Webhook / Polling triggers Build
                                                        v
                                           +--------------------------+
                                           |       Jenkins CI         |
                                           |  (Build & Tag Docker)    |
                                           +--------------------------+
                                            /           |
                             3. Push Images/            | 4. Update Manifests (sed K8s YAMLs)
                                          v             v
+-----------------+       +-----------------+     +--------------------------+
|  DockerHub      | <---- |   Jenkins CI    |     |  GitHub (GitOps Repo)    |
| (Image Registry)|       | (Push & Commit) | --> |  (K8s YAMLs + ArgoCD)    |
+-----------------+       +-----------------+     +--------------------------+
        ^                                                   |
        |                                                   | 5. GitOps Pull (Automated Sync)
        | 6. Pull Images                                    v
+------------------------------------------------------------------------+
|                         AWS EKS Cluster                                |
|                                                                        |
|  +---------------+      +-------------------------------------------+  |
|  |   ArgoCD      | ---> |  Wordcraft Application Pods (App, ML, DB) |  |
|  +---------------+      +-------------------------------------------+  |
+------------------------------------------------------------------------+

```

## 🚀 Tech Stack

* **Frontend & Backend**: Vanilla JS, Node.js (Express)
* **Machine Learning**: Python, Flask, spaCy (`en_core_web_md`)
* **Database**: MySQL 8.0
* **Containerization**: Docker
* **Orchestration**: Kubernetes (AWS EKS / local KinD)
* **CI/CD**: Jenkins, ArgoCD
* **Infrastructure as Code (IaC)**: Terraform

## 📂 Directory Structure (Main Repository)

* **`app/`**: Node.js web application and static frontend files.
* **`ml/`**: Python Flask microservice using spaCy for vector-based word combinations.
* **`database/`**: MySQL Dockerfile and database initialization scripts (`init.sql`).
* **`terraform/`**: Terraform configurations for provisioning AWS EKS, VPC, and the Jenkins EC2 Jump Server.
* **`local-env/`**: Scripts and Docker Compose files for running the stack locally (Docker Compose or KinD).
* **`Jenkinsfile`**: Declarative Jenkins pipeline definition for building images, pushing to DockerHub, and updating the GitOps repository.
* **`commands.sh`**: Post-provisioning setup script for EKS, EBS CSI, and ArgoCD.

---

## 🛠️ First-Time Setup & Deployment Guide

Follow these steps to provision the cloud infrastructure, configure the jump server, and establish the CI/CD pipeline from scratch.

### Phase 1: Provision Infrastructure via Terraform

The Terraform configuration creates a custom VPC, an AWS EKS cluster, and a `t3.medium` EC2 instance that acts as our Jenkins server and Jump host. The EC2 instance is pre-configured via `user_data` to install Docker, Jenkins, Java, Git, `kubectl`, and `eksctl`.

1. Navigate to the Terraform directory:
```bash
cd terraform

```


2. Initialize and apply the configuration:
```bash
terraform init
terraform plan
terraform apply --auto-approve

```


3. Note the output values (e.g., `jenkins_public_ip`, `eks_cluster_name`).

### Phase 2: Jump Server & EKS Post-Provisioning

SSH into your newly provisioned Jenkins EC2 instance using the key pair specified in your Terraform variables.

1. **Connect to the EKS Cluster:**
Execute the `commands.sh` script (or run the commands manually) to link your jump server's `kubectl` context to the new EKS cluster:
```bash
aws eks update-kubeconfig --region us-east-1 --name wordcraft-eks

```


2. **Setup EBS CSI Driver (Required for MySQL Persistent Volumes):**
The database requires dynamic volume provisioning. Run the commands in `commands.sh` to create the necessary IAM service account and install the AWS EBS CSI driver addon via `eksctl`.

3. **Install ArgoCD:**
Deploy ArgoCD into the cluster and apply the root Application manifest that points to your `wordgraft-gitops` repository:
```bash
kubectl create namespace argocd
kubectl apply -n argocd --server-side --force-conflicts -f [https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml](https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml)

# Wait for CRDs to establish, then apply your ArgoCD Application tracker
kubectl apply -f [https://raw.githubusercontent.com/PradyotC/wordgraft-gitops/main/k8s/argocd-application.yaml](https://raw.githubusercontent.com/PradyotC/wordgraft-gitops/main/k8s/argocd-application.yaml)

```



### Phase 3: Jenkins Configuration & Credentials

Access the Jenkins web UI at `http://<jenkins_public_ip>:8080`. Retrieve the initial admin password from `/var/lib/jenkins/secrets/initialAdminPassword` on the EC2 instance.

1. **Install Required Plugins:**
Navigate to *Manage Jenkins > Plugins* and install:
* **Docker Commons Plugin**
* **Git Plugin**

2. **Add Credentials:**
Navigate to *Manage Jenkins > Credentials > System > Global credentials* and add the following:
* **DockerHub Credentials:**
* **Kind:** Username with password
* **Username:** Your DockerHub username
* **Password:** DockerHub Personal Access Token (PAT)
* **ID:** `dockerhub-id`


* **GitHub Credentials:**
* **Kind:** Username with password
* **Username:** Your GitHub username
* **Password:** GitHub Fine-Grained Personal Access Token (Requires *Read/Write* access to code for both the main and GitOps repositories).
* **ID:** `github-id`





### Phase 4: Jenkins Pipeline Setup

1. On the Jenkins dashboard, click **New Item** -> **Pipeline** -> Name it `Wordcraft-CI`.
2. Scroll down to the **Pipeline** section.
3. Select **Pipeline script from SCM**.
4. SCM: **Git**.
5. Repository URL: `https://github.com/PradyotC/wordgraft.git`.
6. Script Path: `Jenkinsfile` (Default).
7. Save and click **Build Now**.

Jenkins will build the Docker images, tag them with the Git commit hash, push them to DockerHub, and commit the new tags to the `wordgraft-gitops` repository. ArgoCD will detect the updated manifests and deploy the fresh pods to EKS!

---

## 💻 Local Development Environments

You can test the application locally before pushing code to the repository.

### Option A: Using Local Kubernetes (KinD)

A setup script is available to simulate the production Kubernetes environment locally. It builds the images natively and applies the K8s manifests directly from the raw GitOps repository while overriding the image tags to use your local builds.

```bash
bash local-env/kind/setup-kind.sh

```

### Option B: Using Docker Compose

For rapid application development without Kubernetes overhead, spin up the stack using Docker Compose:

```bash
cd local-env
docker compose up --build
```
