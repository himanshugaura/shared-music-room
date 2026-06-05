import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import argon from "argon2";
import { prisma } from "../config/prisma.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../utils/jwt.js";
import { OAuth2Client } from "google-auth-library/build/src/auth/oauth2client.js";
import { verificationEmailSender } from "../utils/sendMail.js";

export const register = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ApiError(
      409,
      existingUser.provider === "google"
        ? "Account already exists. Continue with Google."
        : "Account already exists.",
    );
  }

  const hashedPassword = await argon.hash(password);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
    },
  });

  await verificationEmailSender({
    to: user.email,
    url: `${process.env.FRONTEND_URL}/verify-email?token=${generateAccessToken({ userId: user.id })}`,
  });

  const sanitizedUser = {
    id: user.id,
    email: user.email,
  };

  return new ApiResponse(
    201,
    sanitizedUser,
    "User registered successfully",
  ).send(res);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (user.provider === "google") {
    throw new ApiError(401, "This account uses Google sign-in");
  }

  const isPasswordValid = await argon.verify(user.password!, password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const accessToken = generateAccessToken({ userId: user.id });
  const refreshToken = generateRefreshToken({ userId: user.id });

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 *  60 * 1000,
    path: "/",
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });

  const hashedRefreshToken = await argon.hash(refreshToken);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken : hashedRefreshToken },
  });

  const sanitizedUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
  };

  return new ApiResponse(
    200,
    sanitizedUser,
    "User logged in successfully",
  ).send(res);
});

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleAuth = asyncHandler(async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    throw new ApiError(400, "Google credential is required");
  }

  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID!,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.email || !payload.sub) {
    throw new ApiError(401, "Invalid Google token");
  }

  let user = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });

  if (user && user.provider !== "google") {
    throw new ApiError(409, "Account already exists with email/password");
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: payload.email,
        name: payload.name ?? "",
        googleId: payload.sub,
        avatarUrl: payload.picture ?? null,
        provider: "google",
        isVerified: true,
      },
    });
  }

  const accessToken = generateAccessToken({
    userId: user.id,
  });

  const refreshToken = generateRefreshToken({
    userId: user.id,
  });

  const hashedRefreshToken = await argon.hash(refreshToken);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken : hashedRefreshToken },
  });

  res
    .cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    })
    .cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

  const sanitizedUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
  };
  return new ApiResponse(
    200,
    sanitizedUser,
    "User authenticated with Google successfully",
  ).send(res);
});

export const logout = asyncHandler(async (req, res) => {
  res
    .clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    })
    .clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    await prisma.user.update({
    where: { id: req.user!.id },
    data: { refreshToken: null },
  });
  return new ApiResponse(200, null, "User logged out successfully").send(res);
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized");
  }

  const payload = verifyRefreshToken(incomingRefreshToken);

  if (!payload) {
    throw new ApiError(401, "Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    throw new ApiError(401, "User not found");
  }

  if (!user.refreshToken) {
  throw new ApiError(
    401,
    "Unauthorized"
  );
}

const isValidRefreshToken =
  await argon.verify(
    user.refreshToken,
    incomingRefreshToken
  );

if (!isValidRefreshToken) {
  throw new ApiError(
    401,
    "Unauthorized"
  );
}

  const newAccessToken = generateAccessToken({ userId: user.id });
  const newRefreshToken = generateRefreshToken({ userId: user.id });
  
  const hashedNewRefreshToken = await argon.hash(newRefreshToken);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken : hashedNewRefreshToken },
  });

  res.cookie("accessToken", newAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 *  60 * 1000,
  });

  res.cookie("refreshToken", newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });


  return new ApiResponse(
    200,
    null,
    "Tokens refreshed successfully",
  ).send(res);
});


export const sendVerificationEmail = asyncHandler(async (req, res) => {
  const userId = req.body;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  }); 

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.isVerified) {
    throw new ApiError(400, "Email is already verified");
  }

  const verificationToken = generateAccessToken({ userId: user.id });
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;    
  await verificationEmailSender({
    to: user.email,
    url: verificationUrl,
  }); 
  return new ApiResponse(200, null, "Verification email sent").send(res);
});
  

export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;
  if (typeof token !== "string") {
    throw new ApiError(400, "Verification token is required");
  } 
  const payload = verifyAccessToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  if (user.isVerified) {
    throw new ApiError(400, "Email is already verified");
  } 

  await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true },
  });
  return new ApiResponse(200, null, "Email verified successfully").send(res);
});
