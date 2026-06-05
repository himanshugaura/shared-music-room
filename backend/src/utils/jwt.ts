import jwt from "jsonwebtoken";
import { ApiError } from "./apiError.js";

export interface TokenPayload {
  userId: string;
}

export const generateAccessToken = (
  payload: TokenPayload
): string => {
  return jwt.sign(
    payload,
    process.env.ACCESS_TOKEN_SECRET!,
    {
      expiresIn: "1h",
    }
  );
};

export const generateRefreshToken = (
  payload: TokenPayload
): string => {
  return jwt.sign(
    payload,
    process.env.REFRESH_TOKEN_SECRET!,
    {
      expiresIn: "7d",
    }
  );
};

export const verifyAccessToken = (
  token: string
): TokenPayload => {
  try {
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
        "Invalid access token"
      );
    }

    return {
      userId: decoded.userId,
    };
  } catch {
    throw new ApiError(
      401,
      "Access token expired or invalid"
    );
  }
};

export const verifyRefreshToken = (
  token: string
): TokenPayload => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.REFRESH_TOKEN_SECRET!
    );

    if (
      typeof decoded === "string" ||
      !("userId" in decoded)
    ) {
      throw new ApiError(
        401,
        "Invalid refresh token"
      );
    }

    return {
      userId: decoded.userId,
    };
  } catch {
    throw new ApiError(
      401,
      "Refresh token expired or invalid"
    );
  }
};