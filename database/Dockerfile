FROM mysql:8.0

# Set default password for development (override via ENV in production/K8s)
ENV MYSQL_ROOT_PASSWORD=password
ENV MYSQL_DATABASE=wordcraft

# Copy the initialization script
# Docker MySQL image automatically executes .sql scripts found in this directory on startup
COPY init.sql /docker-entrypoint-initdb.d/
