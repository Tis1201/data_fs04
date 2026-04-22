-- Unique API key display name per account (NULL accountId rows are unchanged; PG allows multiple (NULL, same name)).
CREATE UNIQUE INDEX "ApiKey_accountId_name_key" ON "ApiKey"("accountId", "name");
