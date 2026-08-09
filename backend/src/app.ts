import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/error-handler.js";
import appointmentsRoutes from "./routes/appointments.routes.js";
import authRoutes from "./routes/auth.routes.js";
import bookingsRoutes from "./routes/bookings.routes.js";
import filesRoutes from "./routes/files.routes.js";
import servicesRoutes from "./routes/services.routes.js";
import slotsRoutes from "./routes/slots.routes.js";
import usersRoutes from "./routes/users.routes.js";

const app = express();

app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "Pawside booking API is running.",
    endpoints: {
      health: "/health",
      auth: "/api/auth",
      appointments: "/api/appointments",
      bookings: "/api/bookings",
      services: "/api/services",
      slots: "/api/slots",
      users: "/api/users",
      files: "/api/files",
    },
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/slots", slotsRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/files", filesRoutes);

app.use(errorHandler);

export default app;
