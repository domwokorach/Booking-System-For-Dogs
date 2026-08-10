import { createParamDecorator, HttpException, HttpStatus, } from "@nestjs/common";
export const CurrentUser = createParamDecorator((_data, context) => {
    const request = context.switchToHttp().getRequest();
    if (!request.user) {
        throw new HttpException("Authentication required.", HttpStatus.UNAUTHORIZED);
    }
    return request.user;
});
