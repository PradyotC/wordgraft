FROM jenkins/jenkins:lts-jdk17

USER root

# Install dependencies for Docker, kubectl, kind, and git
RUN apt-get update && \
    apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Install Docker CLI (We will mount the host's Docker socket)
RUN curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && \
    apt-get install -y docker-ce-cli

# Install kubectl
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/$(dpkg --print-architecture)/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/

# Install kind (Kubernetes in Docker)
RUN curl -Lo ./kind https://kind.sigs.k8s.io/dl/latest/kind-linux-$(dpkg --print-architecture) && \
    chmod +x ./kind && \
    mv ./kind /usr/local/bin/kind

# Ensure Jenkins user can run docker commands by adding to docker group (Group ID typically 999 or 998, but we will rely on socket mounting permissions)
RUN groupadd -g 999 docker && usermod -aG docker jenkins || true

USER jenkins
