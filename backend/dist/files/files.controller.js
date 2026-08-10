var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors, } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { StorageService } from "../storage/storage.service.js";
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOADS = new Map([
    ["image/jpeg", new Set([".jpg", ".jpeg"])],
    ["image/png", new Set([".png"])],
    ["image/webp", new Set([".webp"])],
    ["application/pdf", new Set([".pdf"])],
]);
function validateUpload(_request, file, callback) {
    const extensionIndex = file.originalname.lastIndexOf(".");
    const extension = extensionIndex >= 0
        ? file.originalname.slice(extensionIndex).toLowerCase()
        : "";
    const allowedExtensions = ALLOWED_UPLOADS.get(file.mimetype);
    if (!allowedExtensions?.has(extension)) {
        callback(new BadRequestException("Unsupported file type. Upload a JPEG, PNG, WebP, or PDF file."), false);
        return;
    }
    callback(null, true);
}
let FilesController = class FilesController {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    upload(file) {
        if (!file) {
            throw new BadRequestException("No file uploaded.");
        }
        return this.storage.upload({
            filename: file.originalname,
            mimeType: file.mimetype,
            buffer: file.buffer,
        });
    }
};
__decorate([
    Post("upload"),
    UseInterceptors(FileInterceptor("file", {
        limits: { files: 1, fileSize: MAX_UPLOAD_SIZE_BYTES },
        fileFilter: validateUpload,
    })),
    __param(0, UploadedFile()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FilesController.prototype, "upload", null);
FilesController = __decorate([
    Controller("api/files"),
    UseGuards(JwtAuthGuard),
    __metadata("design:paramtypes", [StorageService])
], FilesController);
export { FilesController };
