import { Body, Controller, Post } from "@nestjs/common";
import {
  loginInputSchema,
  refreshInputSchema,
  registerInputSchema,
} from "@orbit/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body(new ZodValidationPipe(registerInputSchema)) body: unknown) {
    return this.authService.register(body as never);
  }

  @Post("login")
  login(@Body(new ZodValidationPipe(loginInputSchema)) body: unknown) {
    return this.authService.login(body as never);
  }

  @Post("refresh")
  refresh(@Body(new ZodValidationPipe(refreshInputSchema)) body: unknown) {
    return this.authService.refresh((body as { refreshToken: string }).refreshToken);
  }
}
