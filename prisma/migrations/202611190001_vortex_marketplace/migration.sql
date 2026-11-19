-- CreateEnum
CREATE TYPE "VortexListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VortexFileKind" AS ENUM ('PHOTO', 'PDF', 'SPREADSHEET');

-- CreateTable
CREATE TABLE "VortexListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "minimumQuantity" INTEGER NOT NULL,
    "status" "VortexListingStatus" NOT NULL DEFAULT 'DRAFT',
    "photoId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VortexListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VortexEnquiry" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quoteQuantity" INTEGER,
    "quoteUnitPrice" DECIMAL(12,2),
    "deliveryDays" INTEGER,
    "repliedAt" TIMESTAMP(3),

    CONSTRAINT "VortexEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VortexFile" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "kind" "VortexFileKind" NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VortexFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VortexListing_sellerId_updatedAt_idx" ON "VortexListing"("sellerId", "updatedAt");

-- CreateIndex
CREATE INDEX "VortexListing_status_category_idx" ON "VortexListing"("status", "category");

-- CreateIndex
CREATE INDEX "VortexListing_photoId_idx" ON "VortexListing"("photoId");

-- CreateIndex
CREATE INDEX "VortexEnquiry_buyerId_createdAt_idx" ON "VortexEnquiry"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "VortexEnquiry_listingId_createdAt_idx" ON "VortexEnquiry"("listingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VortexEnquiry_buyerId_requestId_key" ON "VortexEnquiry"("buyerId", "requestId");

-- CreateIndex
CREATE INDEX "VortexFile_sellerId_kind_createdAt_idx" ON "VortexFile"("sellerId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "VortexListing" ADD CONSTRAINT "VortexListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VortexListing" ADD CONSTRAINT "VortexListing_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "VortexFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VortexEnquiry" ADD CONSTRAINT "VortexEnquiry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "VortexListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VortexEnquiry" ADD CONSTRAINT "VortexEnquiry_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VortexFile" ADD CONSTRAINT "VortexFile_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Only the server-side application role accesses marketplace tables.
REVOKE ALL ON "VortexListing", "VortexEnquiry", "VortexFile" FROM PUBLIC, anon, authenticated;
