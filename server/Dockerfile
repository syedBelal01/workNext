FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY server/package.json ./
RUN npm install

FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY server/ ./
RUN npx prisma generate

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/api ./api
EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push && node prisma/seed.js && node src/index.js"]
