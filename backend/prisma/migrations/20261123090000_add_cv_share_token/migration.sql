-- Public volunteer CV link: the random token in the URL (null = not shared).
ALTER TABLE "users" ADD COLUMN "cv_share_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_cv_share_token_key" ON "users"("cv_share_token");
