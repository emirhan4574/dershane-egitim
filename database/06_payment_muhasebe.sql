/*
  Ödeme alanları + muhasebe yetkisi + ödeme bildirimleri
  Mevcut kurulumlara güvenli ALTER (kolon yoksa ekler)
*/
USE [DershaneDb];
GO

IF COL_LENGTH(N'dbo.Institutions', N'PaymentOverdueIntervalDays') IS NULL
  ALTER TABLE dbo.Institutions
    ADD PaymentOverdueIntervalDays INT NOT NULL
      CONSTRAINT DF_Institutions_OverdueInterval DEFAULT 7;
GO

IF COL_LENGTH(N'dbo.Users', N'IsMuhasebe') IS NULL
  ALTER TABLE dbo.Users
    ADD IsMuhasebe BIT NOT NULL CONSTRAINT DF_Users_IsMuhasebe DEFAULT 0;
GO

IF COL_LENGTH(N'dbo.Users', N'ParentName') IS NULL
  ALTER TABLE dbo.Users ADD ParentName NVARCHAR(200) NULL;
GO

IF COL_LENGTH(N'dbo.Users', N'FeeAmount') IS NULL
  ALTER TABLE dbo.Users ADD FeeAmount DECIMAL(12, 2) NULL;
GO

IF COL_LENGTH(N'dbo.Users', N'PaymentType') IS NULL
  ALTER TABLE dbo.Users ADD PaymentType NVARCHAR(20) NULL;
GO

IF COL_LENGTH(N'dbo.Users', N'PaymentDay') IS NULL
  ALTER TABLE dbo.Users ADD PaymentDay INT NULL;
GO

IF COL_LENGTH(N'dbo.Users', N'InstallmentCount') IS NULL
  ALTER TABLE dbo.Users ADD InstallmentCount INT NULL;
GO

IF OBJECT_ID(N'dbo.PaymentNotices', N'U') IS NULL
CREATE TABLE dbo.PaymentNotices (
  Id             NVARCHAR(64)  NOT NULL CONSTRAINT PK_PaymentNotices PRIMARY KEY,
  InstitutionId  NVARCHAR(64)  NOT NULL,
  StudentId      NVARCHAR(64)  NOT NULL,
  Kind           NVARCHAR(20)  NOT NULL,
  Message        NVARCHAR(500) NOT NULL,
  DaysLate       INT           NULL,
  PeriodKey      NVARCHAR(64)  NOT NULL,
  CreatedAt      DATETIME2(3)  NOT NULL CONSTRAINT DF_PaymentNotices_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_PaymentNotices_Kind CHECK (Kind IN (N'approaching', N'due', N'overdue')),
  CONSTRAINT UQ_PaymentNotices_Period UNIQUE (StudentId, PeriodKey),
  CONSTRAINT FK_PaymentNotices_Inst FOREIGN KEY (InstitutionId)
    REFERENCES dbo.Institutions(Id),
  CONSTRAINT FK_PaymentNotices_Student FOREIGN KEY (StudentId)
    REFERENCES dbo.Users(Id)
);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_PaymentNotices_Inst' AND object_id = OBJECT_ID(N'dbo.PaymentNotices')
)
CREATE INDEX IX_PaymentNotices_Inst ON dbo.PaymentNotices (InstitutionId, CreatedAt DESC);
GO
