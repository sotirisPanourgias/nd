# nd

A simple Node.js project.

## Project structure

- `backend/`: Node.js API server (Express + SQLite)
- `frontend/`: Static web UI served by the backend

## Getting Started

Install dependencies for both projects:

```bash
npm install
```

### Run the backend API server

```bash
npm run start:backend
```

### Run the frontend (static web UI)

```bash
npm run start:frontend
```

## API Endpoints

- `GET /players` — list all players
- `GET /players/:id` — get a player by ID
- `POST /players` — create a player (`{ "name": "Alice" }`)
- `PUT /players/:id` — update a player
- `DELETE /players/:id` — delete a player

### Game endpoints (impostor-style)

- `POST /game/reset` — start a new round (chooses a new impostor and binds userId 1..3 to the first 3 players)
- `GET /game?userId=1` — get your assigned player and whether you're impostor or crewmate (userId must be 1..3)
- `POST /game/end` — end game and delete all players

## Web UI

Start the server and open http://localhost:3000/ to use a simple web UI that can interact with the API.
