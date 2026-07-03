# A Million Plateaus — dev image (D7).
#
# Provisions the full toolchain in one place: Rust (cargo), Node (JS lint/tests),
# Python (the no-cache web dev server), and a headless-capable Godot 4.4 on PATH.
#
# Build:
#   docker build -t amp-dev .
#
# Serve the web client (default) → http://localhost:8145
#   docker run --rm -p 8145:8145 amp-dev
#
# Run the JS lint + test gate:
#   docker run --rm -w /app/apps/web amp-dev sh -c "npm ci && npm run lint && npm test"
#
# Run the Godot headless tests:
#   docker run --rm amp-dev godot --headless --path apps/godot --script res://test/run_tests.gd
#
# NOTE: `cargo build -p mp-godot --features gdext` needs the sibling garust source
# at ../garust (see Cargo.toml) — mount or clone it next to /app to build the
# GDExtension inside the container. Pure-JS/Godot workflows need no Rust build.

FROM rust:1-bookworm

ARG GODOT_VERSION=4.4-stable
ARG NODE_MAJOR=20

# System deps: python3 for scripts/serve.py; the X/GL/font libs the stock Godot
# linux build dynamically links even in --headless mode; node from NodeSource.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 curl unzip ca-certificates \
        libfontconfig1 libgl1 libxi6 libxrandr2 libxinerama1 libxcursor1 \
    && curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Godot 4.4 on PATH as both `godot` and `godot4` (what scripts/start-godot.sh
# looks for). Same release scripts/install-godot.sh fetches for local dev.
RUN curl -fsSL -o /tmp/godot.zip \
        "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}/Godot_v${GODOT_VERSION}_linux.x86_64.zip" \
    && unzip -q /tmp/godot.zip -d /tmp \
    && mv "/tmp/Godot_v${GODOT_VERSION}_linux.x86_64" /usr/local/bin/godot \
    && chmod +x /usr/local/bin/godot \
    && ln -sf /usr/local/bin/godot /usr/local/bin/godot4 \
    && rm /tmp/godot.zip

WORKDIR /app
COPY . .

# Pre-install web dev deps when the lockfile is present, so `npm test`/`npm run
# lint` are ready to go without a cold install at run time.
RUN if [ -f apps/web/package-lock.json ]; then \
        (cd apps/web && npm ci); \
    fi

EXPOSE 8145

# Default: the no-cache web dev server. Override the command for tests/other work.
CMD ["python3", "scripts/serve.py", "8145"]
