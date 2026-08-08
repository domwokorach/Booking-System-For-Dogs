import { createServer } from "node:http";

import { Server } from "socket.io";

import app from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";

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

async function bootstrap() {
  try {
    await prisma.$connect();
    httpServer.listen(env.PORT, () => {
      console.log(`Backend API listening on port ${env.PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to the database. Check DATABASE_URL and ensure PostgreSQL is running.", error);
    process.exit(1);
  }
}

bootstrap();
