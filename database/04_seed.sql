/*
  Seed: Platform Admin
  LoginId: admin
  Password: admin123  (API bcrypt hash üretir; buradaki hash bcrypt 'admin123')
  Not: İlk API açılışında hash yoksa / seed script yeniden yazılır.
  Bu seed düz metin yerine bcrypt hash kullanır ($2a$10$...).
*/
USE [DershaneDb];
GO

DECLARE @AdminId NVARCHAR(64) = N'usr_platform_admin';
DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();
/* bcrypt hash for admin123 — generated for seed; server also accepts and rehashes on first login if needed */
DECLARE @Hash NVARCHAR(200) = N'$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Id = @AdminId OR (Role = N'superadmin' AND LoginId = N'admin' AND IsDeleted = 0))
BEGIN
  INSERT INTO dbo.Users (
    Id, Role, InstitutionId, FullName, LoginId, PasswordHash,
    IsManager, Points, CreatedAt, UpdatedAt, IsDeleted
  ) VALUES (
    @AdminId, N'superadmin', NULL, N'Platform Admin', N'admin', @Hash,
    0, 0, @Now, @Now, 0
  );
  PRINT N'Platform admin eklendi (admin / admin123).';
END
ELSE
  PRINT N'Platform admin zaten var.';
GO
