-- CreateTable
CREATE TABLE "AccountAssignment" (
    "id" TEXT NOT NULL,
    "parentAccountId" TEXT NOT NULL,
    "childAccountId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountAssignment_parentAccountId_idx" ON "AccountAssignment"("parentAccountId");

-- CreateIndex
CREATE INDEX "AccountAssignment_childAccountId_idx" ON "AccountAssignment"("childAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountAssignment_parentAccountId_childAccountId_relationsh_key" ON "AccountAssignment"("parentAccountId", "childAccountId", "relationshipType");

-- AddForeignKey
ALTER TABLE "AccountAssignment" ADD CONSTRAINT "AccountAssignment_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountAssignment" ADD CONSTRAINT "AccountAssignment_childAccountId_fkey" FOREIGN KEY ("childAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountAssignment" ADD CONSTRAINT "AccountAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
