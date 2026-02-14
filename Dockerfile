FROM node:24-slim

WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci

# Copy source (public/swiftlatex mounted separately or downloaded at build)
COPY . .

# Download engine if not present
RUN bash scripts/download-engine.sh

EXPOSE 5173

CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]
