#!/usr/bin/env python3
"""Start only the isolated P0 backend; credentials are read without logging."""
from pathlib import Path
import os
root = Path(__file__).resolve().parents[1]
secrets = dict(line.split("=", 1) for line in (root / ".p0/runtime.env").read_text().splitlines() if "=" in line)
env = dict(os.environ)
env.update(JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home", SERVER_PORT="18080", DB_URL="jdbc:postgresql://127.0.0.1:15432/procurement_agency_p0", DB_USERNAME="procurement", DB_PASSWORD=secrets["P0_DB_PASSWORD"], MINIO_ENDPOINT="http://127.0.0.1:19020", MINIO_ACCESS_KEY="p0minio", MINIO_SECRET_KEY=secrets["P0_MINIO_PASSWORD"], MINIO_BUCKET="24bm-p0-attachments", JWT_SECRET=secrets["JWT_SECRET"], APP_SEED_LOCATIONS="classpath:db/demo", ALLOW_DEMO_JWT_SECRET="false", SELF_LOGIN_ENABLED="true", CORS_ALLOWED_ORIGINS="http://localhost:15173,http://127.0.0.1:15173")
os.chdir(root / "backend-java")
os.execvpe("mvn", ["mvn", "-q", "spring-boot:run", "-Dspring-boot.run.profiles=local"], env)
