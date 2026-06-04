import jwt from "jsonwebtoken";
import { ApiError } from "./apiError.js";

export interface AccessTokenPayload {
  userId: string;
}

export const verifyAccessToken = (
  token: string
): AccessTokenPayload => {
  const decoded = jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SECRET!
  );

  if (
    typeof decoded === "string" ||
    !("userId" in decoded)
  ) {
    throw new ApiError(
      401,
      "Invalid token"
    );
  }

  return decoded as AccessTokenPayload;
};