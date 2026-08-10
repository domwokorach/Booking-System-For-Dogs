import { Injectable } from "@nestjs/common";

import { uploadFileToCloud } from "../services/storage.service.js";

@Injectable()
export class StorageService {
  upload(input: {
    filename: string;
    mimeType: string;
    buffer: Buffer;
  }) {
    return uploadFileToCloud(input);
  }
}
