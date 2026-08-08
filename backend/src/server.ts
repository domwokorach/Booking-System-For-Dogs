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

function startServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use. Stop the other backend process or set PORT to a different value.`);
        reject(error);
        return;
      }

      console.error("Failed to start the backend server.", error);
      reject(error);
    };

    httpServer.once("error", onError);
    httpServer.listen(port, () => {
      httpServer.off("error", onError);
      console.log(`Backend API listening on port ${port}`);
      resolve();
    });
  });
}

async function bootstrap() {
  try {
    await prisma.$connect();
    await startServer(env.PORT);
  } catch (error) {
    console.error("Failed to connect to the database. Check DATABASE_URL and ensure PostgreSQL is running.", error);
    process.exit(1);
  }
}

bootstrap();
