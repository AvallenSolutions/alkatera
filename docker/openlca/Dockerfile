# Build gdt-server from latest source (Nov 2025: openLCA 2.5 / Derby 10.17)
# The GHCR pre-built images are from March 2023 and too old for ecoinvent 3.12
# Reference: https://github.com/GreenDelta/gdt-server

# Stage 1: Build from source
FROM eclipse-temurin:21-jdk-jammy AS builder

RUN apt-get update && apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

# Install Maven 3.9.x
RUN curl -fsSL https://dlcdn.apache.org/maven/maven-3/3.9.12/binaries/apache-maven-3.9.12-bin.tar.gz -o /tmp/maven.tar.gz && \
    tar xzf /tmp/maven.tar.gz -C /opt && \
    ln -s /opt/apache-maven-3.9.12/bin/mvn /usr/local/bin/mvn && \
    rm /tmp/maven.tar.gz

WORKDIR /build

# Clone and build olca-modules first (required dependency)
RUN git clone --depth 1 https://github.com/GreenDelta/olca-modules.git && \
    cd olca-modules && \
    mvn install -DskipTests=true -q

# Clone and build gdt-server
RUN git clone --depth 1 https://github.com/GreenDelta/gdt-server.git && \
    cd gdt-server && \
    mvn package -DskipTests=true -q

# Stage 2: Get native libraries from pre-built images (UMFPACK/OpenBLAS for sparse matrix)
FROM ghcr.io/greendelta/gdt-server-native AS native

# Stage 3: Runtime - Ubuntu-based for GLIBC 2.28+ native library compatibility
FROM eclipse-temurin:21-jre-jammy

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built jar and dependencies from builder
COPY --from=builder /build/gdt-server/target/gdt-server.jar /app/gdt-server.jar
COPY --from=builder /build/gdt-server/target/lib /app/lib

# Copy native calculation libraries (UMFPACK/OpenBLAS for sparse matrix)
COPY --from=native /app/native /app/native
# Symlink v0.0.1 to v0.0.2 for version compatibility
RUN cd /app/native/olca-native && ln -sf 0.0.1 0.0.2

# Create data directory for database mounts
RUN mkdir -p /app/data/databases

# JVM memory configuration
# JAVA_MAX_RAM_PERCENTAGE controls heap as % of container memory
# With 10.5GB container limit, 80% = ~8.4GB heap (sufficient for ecoinvent 3.12)
ENV JAVA_MAX_RAM_PERCENTAGE=80

# Expose the REST API port
EXPOSE 8080

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=180s \
    CMD curl -f http://localhost:8080/api/version || exit 1

# Use shell form so environment variables are expanded
CMD java \
    -XX:MaxRAMPercentage=${JAVA_MAX_RAM_PERCENTAGE} \
    -XX:+UseG1GC \
    -XX:+ExitOnOutOfMemoryError \
    -cp "/app/gdt-server.jar:/app/lib/*" \
    org.openlca.gdt.server.Server \
    -data /app/data -native /app/native -db ecoinvent_312_cutoff --readonly -port 8080
