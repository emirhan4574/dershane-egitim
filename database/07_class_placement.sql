-- Şube başına yerleştirme kotası (deneme listesi → otomatik sınıf atama)
IF COL_LENGTH('dbo.Institutions', 'ClassPlacementSize') IS NULL
BEGIN
  ALTER TABLE dbo.Institutions ADD ClassPlacementSize INT NULL;
END
GO

UPDATE dbo.Institutions
SET ClassPlacementSize = 10
WHERE ClassPlacementSize IS NULL AND IsDeleted = 0;
GO
