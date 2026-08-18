var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { WebSocketGateway, WebSocketServer, } from "@nestjs/websockets";
import { AuthTokenService } from "../auth/auth-token.service.js";
import { env } from "../config/env.js";
export function appointmentRoom(userId) {
    return `user:${userId}`;
}
let RealtimeGateway = class RealtimeGateway {
    authTokens;
    server;
    constructor(authTokens) {
        this.authTokens = authTokens;
    }
    handleConnection(client) {
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
            const expiryTimer = setTimeout(() => client.disconnect(true), Math.min(remainingLifetime, 2147483647));
            client.once("disconnect", () => clearTimeout(expiryTimer));
        }
        catch {
            client.disconnect(true);
        }
    }
    emitToUser(userId, event, payload) {
        this.server?.to(appointmentRoom(userId)).emit(event, payload);
    }
};
__decorate([
    WebSocketServer(),
    __metadata("design:type", Function)
], RealtimeGateway.prototype, "server", void 0);
RealtimeGateway = __decorate([
    WebSocketGateway({
        cors: {
            origin: env.CLIENT_ORIGINS,
            methods: ["GET", "POST", "PATCH"],
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [AuthTokenService])
], RealtimeGateway);
export { RealtimeGateway };
