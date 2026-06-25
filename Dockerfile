FROM node:20-bookworm-slim AS deps

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/workflow-ai/package.json packages/workflow-ai/package.json
COPY packages/workflow-ir/package.json packages/workflow-ir/package.json
RUN npm ci

FROM deps AS build

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=build /app ./

EXPOSE 3000
CMD ["npm", "run", "start", "-w", "apps/web"]
