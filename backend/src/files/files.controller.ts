import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { StorageService } from "../storage/storage.service.js";

type UploadedMemoryFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOADS = new Map<string, Set<string>>([
  ["image/jpeg", new Set([".jpg", ".jpeg"])],
  ["image/png", new Set([".png"])],
  ["image/webp", new Set([".webp"])],
  ["application/pdf", new Set([".pdf"])],
]);

function validateUpload(
  _request: unknown,
  file: { mimetype: string; originalname: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  const extensionIndex = file.originalname.lastIndexOf(".");
  const extension =
    extensionIndex >= 0
      ? file.originalname.slice(extensionIndex).toLowerCase()
      : "";
  const allowedExtensions = ALLOWED_UPLOADS.get(file.mimetype);

  if (!allowedExtensions?.has(extension)) {
    callback(
      new BadRequestException(
        "Unsupported file type. Upload a JPEG, PNG, WebP, or PDF file.",
      ),
      false,
    );
    return;
  }

  callback(null, true);
}

@Controller("api/files")
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { files: 1, fileSize: MAX_UPLOAD_SIZE_BYTES },
      fileFilter: validateUpload,
    }),
  )
  upload(@UploadedFile() file?: UploadedMemoryFile) {
    if (!file) {
      throw new BadRequestException("No file uploaded.");
    }

    return this.storage.upload({
      filename: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });
  }
}
