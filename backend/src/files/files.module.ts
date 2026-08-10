import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { FilesController } from "./files.controller.js";

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [FilesController],
})
export class FilesModule {}
