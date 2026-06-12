/*
  Warnings:

  - You are about to drop the `RoomAdmin` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RoomAdmin" DROP CONSTRAINT "RoomAdmin_roomId_fkey";

-- DropForeignKey
ALTER TABLE "RoomAdmin" DROP CONSTRAINT "RoomAdmin_userId_fkey";

-- DropTable
DROP TABLE "RoomAdmin";
