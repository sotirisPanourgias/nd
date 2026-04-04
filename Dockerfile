FROM node:21-alpine

WORKDIR /app

# Copy root package.json (workspaces)
COPY package.json ./
COPY games/impostor/backend/package.json ./games/impostor/backend/
COPY games/impostor/frontend/package.json ./games/impostor/frontend/

RUN npm install

COPY games/impostor/backend ./games/impostor/backend
COPY games/impostor/frontend ./games/impostor/frontend
COPY games/impostor/db ./games/impostor/db

ENV PORT=8081
EXPOSE 8081

CMD ["npm", "start"]
