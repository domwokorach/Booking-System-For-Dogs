export function appointmentRoom(userId) {
    return `user:${userId}`;
}
export function emitAppointmentEvent(req, userId, event, payload) {
    req.app.get("io").to(appointmentRoom(userId)).emit(event, payload);
}
