var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ApiExceptionFilter_1;
import { Catch, HttpException, HttpStatus, Logger, } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { MulterError } from "multer";
import { ZodError } from "zod";
let ApiExceptionFilter = ApiExceptionFilter_1 = class ApiExceptionFilter {
    logger = new Logger(ApiExceptionFilter_1.name);
    catch(exception, host) {
        const response = host.switchToHttp().getResponse();
        if (exception instanceof ZodError) {
            response.status(HttpStatus.BAD_REQUEST).json({
                message: "Validation failed.",
                errors: exception.flatten(),
            });
            return;
        }
        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            const body = exception.getResponse();
            response
                .status(status)
                .json(typeof body === "string" ? { message: body } : body);
            return;
        }
        if (exception instanceof MulterError) {
            const status = exception.code === "LIMIT_FILE_SIZE"
                ? HttpStatus.PAYLOAD_TOO_LARGE
                : HttpStatus.BAD_REQUEST;
            response.status(status).json({
                message: exception.code === "LIMIT_FILE_SIZE"
                    ? "Uploaded files must be 5 MB or smaller."
                    : exception.message,
            });
            return;
        }
        if (exception instanceof Prisma.PrismaClientKnownRequestError &&
            exception.code === "P2002") {
            response.status(HttpStatus.CONFLICT).json({
                message: "A record with these details already exists.",
            });
            return;
        }
        this.logger.error(exception instanceof Error ? exception.stack : String(exception));
        response
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .json({ message: "Internal server error." });
    }
};
ApiExceptionFilter = ApiExceptionFilter_1 = __decorate([
    Catch()
], ApiExceptionFilter);
export { ApiExceptionFilter };
