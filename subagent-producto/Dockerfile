FROM mcr.microsoft.com/playwright:v1.46.0-jammy AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
COPY data ./data
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.46.0-jammy
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/data ./data
RUN mkdir -p /app/.sessions
EXPOSE 4001
CMD ["node", "dist/server.js"]
