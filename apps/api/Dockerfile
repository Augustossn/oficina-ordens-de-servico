FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci
COPY apps/api apps/api
RUN npm run db:generate && npm run build -w api
EXPOSE 3000
CMD ["sh","-c","npm run db:migrate && npm run db:seed && npm run start -w api"]