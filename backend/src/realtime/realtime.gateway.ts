import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

import { AuthTokenService } from "../auth/auth-token.service.js";
import { env } from "../config/env.js";

export type AppointmentEvent =
  | "appointments:created"
  | "appointments:updated"
  | "appointments:rescheduled"
  | "appointments:confirmed"
  | "appointments:cancelled"
  | "appointments:deleted";

export function appointmentRoom(userId: string): string {
  return `user:${userId}`;
}

@WebSocketGateway({
  cors: {
    origin: env.CLIENT_ORIGIN,
    methods: ["GET", "POST", "PATCH"],
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  constructor(private readonly authTokens: AuthTokenService) {}

  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.token;

    if (typeof token !== "string") {
      client.disconnect(true);
      return;
    }

    try {
      const user = this.authTokens.verifyAccessToken(token);
      const remainingLifetime = user.expiresAt - Date.now();
      if (remainingLifetime <= 0) {
        client.disconnect(true);
        return;
      }

      void client.join(appointmentRoom(user.userId));
      client.emit("server:connected", {
        message: "Realtime channel connected.",
      });
      const expiryTimer = setTimeout(
        () => client.disconnect(true),
        Math.min(remainingLifetime, 2_147_483_647),
      );
      client.once("disconnect", () => clearTimeout(expiryTimer));
    } catch {
      client.disconnect(true);
    }
  }

  emitToUser(
    userId: string,
    event: AppointmentEvent,
    payload: Record<string, unknown>,
  ): void {
    this.server?.to(appointmentRoom(userId)).emit(event, payload);
  }
}
