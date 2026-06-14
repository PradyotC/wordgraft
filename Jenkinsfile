pipeline {
    agent any

    triggers {
        githubPush()
    }

    environment {
        // DockerHub credentials configured in Jenkins
        DOCKERHUB_CREDENTIALS = credentials('dockerhub-id')
        // GitHub credentials configured in Jenkins
        GITHUB_CREDENTIALS = credentials('github-id')
        
        DOCKER_IMAGE_APP = "pradyotc/wordcraft-app"
        DOCKER_IMAGE_ML = "pradyotc/wordcraft-ml"
        DOCKER_IMAGE_DB = "pradyotc/wordcraft-db"
        GIT_REPO_URL = "https://github.com/PradyotC/wordgraft.git"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    // Get the short Git commit hash to use as the image tag
                    env.GIT_COMMIT_HASH = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                dir('app') {
                    script {
                        sh "docker build --platform linux/amd64 -t ${DOCKER_IMAGE_APP}:${GIT_COMMIT_HASH} ."
                        sh "docker tag ${DOCKER_IMAGE_APP}:${GIT_COMMIT_HASH} ${DOCKER_IMAGE_APP}:latest"
                    }
                }
                dir('ml') {
                    script {
                        sh "docker build --platform linux/amd64 -t ${DOCKER_IMAGE_ML}:${GIT_COMMIT_HASH} ."
                        sh "docker tag ${DOCKER_IMAGE_ML}:${GIT_COMMIT_HASH} ${DOCKER_IMAGE_ML}:latest"
                    }
                }
                dir('database') {
                    script {
                        sh "docker build --platform linux/amd64 -t ${DOCKER_IMAGE_DB}:${GIT_COMMIT_HASH} ."
                        sh "docker tag ${DOCKER_IMAGE_DB}:${GIT_COMMIT_HASH} ${DOCKER_IMAGE_DB}:latest"
                    }
                }
            }
        }

        stage('Push Docker Images') {
            steps {
                script {
                    sh "echo \$DOCKERHUB_CREDENTIALS_PSW | docker login -u \$DOCKERHUB_CREDENTIALS_USR --password-stdin"
                    
                    sh "docker push ${DOCKER_IMAGE_APP}:${GIT_COMMIT_HASH}"
                    sh "docker push ${DOCKER_IMAGE_APP}:latest"
                    
                    sh "docker push ${DOCKER_IMAGE_ML}:${GIT_COMMIT_HASH}"
                    sh "docker push ${DOCKER_IMAGE_ML}:latest"
                    
                    sh "docker push ${DOCKER_IMAGE_DB}:${GIT_COMMIT_HASH}"
                    sh "docker push ${DOCKER_IMAGE_DB}:latest"
                }
            }
        }

        stage('Update Kubernetes Manifests') {
            steps {
                script {
                    // Update the image tag in app-deployment.yaml, ml-deployment.yaml, and db-deployment.yaml
                    sh """
                    sed -i "s|image: ${DOCKER_IMAGE_APP}:.*|image: ${DOCKER_IMAGE_APP}:${GIT_COMMIT_HASH}|g" k8s/app-deployment.yaml
                    sed -i "s|image: ${DOCKER_IMAGE_ML}:.*|image: ${DOCKER_IMAGE_ML}:${GIT_COMMIT_HASH}|g" k8s/ml-deployment.yaml
                    sed -i "s|image: ${DOCKER_IMAGE_DB}:.*|image: ${DOCKER_IMAGE_DB}:${GIT_COMMIT_HASH}|g" k8s/db-deployment.yaml
                    """
                }
            }
        }

        stage('Commit to Git for ArgoCD') {
            steps {
                script {
                    // Authenticate with GitHub using Jenkins credentials
                    sh """
                    git config user.email "jenkins@example.com"
                    git config user.name "Jenkins CI"
                    
                    git add k8s/app-deployment.yaml k8s/ml-deployment.yaml k8s/db-deployment.yaml
                    git commit -m "Update app, ml, and db images to commit ${GIT_COMMIT_HASH} [skip ci]"
                    
                    # Extract the domain and path from GIT_REPO_URL to inject credentials
                    REPO_DOMAIN_PATH=\$(echo \$GIT_REPO_URL | sed 's|https://||')
                    
                    # Push using credentials
                    git push https://\$GITHUB_CREDENTIALS_USR:\$GITHUB_CREDENTIALS_PSW@\${REPO_DOMAIN_PATH} HEAD:main
                    """
                }
            }
        }
    }

    post {
        always {
            // Clean up Docker images and credentials
            sh "docker logout"
            sh "docker rmi ${DOCKER_IMAGE_APP}:${GIT_COMMIT_HASH} || true"
            sh "docker rmi ${DOCKER_IMAGE_ML}:${GIT_COMMIT_HASH} || true"
            sh "docker rmi ${DOCKER_IMAGE_DB}:${GIT_COMMIT_HASH} || true"
        }
    }
}
