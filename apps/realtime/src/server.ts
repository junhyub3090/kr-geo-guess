import { defineRoom, defineServer } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "node:http";
import { createApiApp } from "./http/createApiApp.js";
import { KoreaClassicRoom } from "./rooms/KoreaClassicRoom.js";

const port = Number.parseInt(
  process.env.PORT ?? process.env.REALTIME_PORT ?? "2567",
  10,
);

const app = createApiApp();
const httpServer = createServer(app);

const server = defineServer({
  transport: new WebSocketTransport({
    server: httpServer,
    pingInterval: 6000,
    pingMaxRetries: 4,
    maxPayload: 1024 * 1024,
  }),
  rooms: {
    korea_classic: defineRoom(KoreaClassicRoom),
  },
});

server.listen(port);
console.log(`Realtime server listening on port ${port}`);
