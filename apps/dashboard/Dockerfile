FROM node:22-alpine

WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY integrations/mcp-server/package.json integrations/mcp-server/package.json
COPY packages/sdk-js/package.json packages/sdk-js/package.json
RUN npm ci --workspace apps/dashboard

COPY apps/dashboard apps/dashboard

WORKDIR /repo/apps/dashboard

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

USER node

EXPOSE 3000

CMD ["npm", "run", "start"]
