import type { Response } from "express";

export class ApiResponse<T = unknown> {
  readonly success: boolean;

  constructor(
    public readonly statusCode: number,
    public readonly data?: T,
    public readonly message = "Success"
  ) {
    this.success = statusCode < 400;
  }

  send(res: Response) {
    return res.status(this.statusCode).json({
      success: this.success,
      message: this.message,
      data: this.data ?? null,
    });
  }
}