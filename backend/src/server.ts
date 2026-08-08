import { createServer } from "node:http";

import { Server } from "socket.io";

import app from "./app.js";
import { env } from "./config/env.js";

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.CLIENT_ORIGIN,
    methods: ["GET", "POST", "PATCH"],
  },
});

io.on("connection", (socket) => {
  socket.emit("server:connected", { message: "Realtime channel connected." });
});

app.set("io", io);

httpServer.listen(env.PORT, () => {
  console.log(`Backend API listening on port ${env.PORT}`);
});
