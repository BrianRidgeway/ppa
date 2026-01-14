FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src
COPY public ./public

RUN npm run build

ENV PORT=3000
ENV DATA_DIR=/app/data

EXPOSE 3000

CMD ["node", "dist/server.js"]
