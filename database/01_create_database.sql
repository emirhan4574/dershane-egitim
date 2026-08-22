/*
  Dershane — Microsoft SQL Server
  01_create_database.sql
  Turkish_CI_AS collation (Türkçe karşılaştırma)
*/
IF DB_ID(N'DershaneDb') IS NULL
BEGIN
  CREATE DATABASE [DershaneDb]
    COLLATE Turkish_CI_AS;
END
GO

ALTER DATABASE [DershaneDb] SET RECOVERY SIMPLE;
GO

USE [DershaneDb];
GO

PRINT N'DershaneDb hazır.';
GO
