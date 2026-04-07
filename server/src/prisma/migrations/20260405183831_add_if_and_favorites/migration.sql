-- AlterTable
ALTER TABLE "FoodLog" ADD COLUMN     "isFavorite" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fastingHours" INTEGER,
ADD COLUMN     "intermittentFasting" BOOLEAN NOT NULL DEFAULT false;
