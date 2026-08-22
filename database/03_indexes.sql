USE [DershaneDb];
GO

/* Performans / arama indeksleri */

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_Institution_Role' AND object_id = OBJECT_ID(N'dbo.Users'))
CREATE INDEX IX_Users_Institution_Role
  ON dbo.Users (InstitutionId, Role)
  INCLUDE (FullName, LoginId, ClassId, IsDeleted)
  WHERE IsDeleted = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_FullName' AND object_id = OBJECT_ID(N'dbo.Users'))
CREATE INDEX IX_Users_FullName
  ON dbo.Users (InstitutionId, FullName)
  WHERE IsDeleted = 0 AND Role = N'student';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Users_ClassId' AND object_id = OBJECT_ID(N'dbo.Users'))
CREATE INDEX IX_Users_ClassId
  ON dbo.Users (ClassId)
  WHERE IsDeleted = 0 AND Role = N'student';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Classes_Institution' AND object_id = OBJECT_ID(N'dbo.Classes'))
CREATE INDEX IX_Classes_Institution
  ON dbo.Classes (InstitutionId, Grade, Section, Track)
  WHERE IsDeleted = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Deneme_Student_Date' AND object_id = OBJECT_ID(N'dbo.DenemeResults'))
CREATE INDEX IX_Deneme_Student_Date
  ON dbo.DenemeResults (InstitutionId, StudentId, ExamDate DESC)
  WHERE IsDeleted = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Deneme_Filter' AND object_id = OBJECT_ID(N'dbo.DenemeResults'))
CREATE INDEX IX_Deneme_Filter
  ON dbo.DenemeResults (InstitutionId, ClassGrade, ClassSection, ClassTrack, ExamDate DESC)
  WHERE IsDeleted = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Chat_Class_Created' AND object_id = OBJECT_ID(N'dbo.ChatMessages'))
CREATE INDEX IX_Chat_Class_Created
  ON dbo.ChatMessages (ClassId, CreatedAt DESC)
  WHERE IsDeleted = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Hw_Class' AND object_id = OBJECT_ID(N'dbo.Homeworks'))
CREATE INDEX IX_Hw_Class
  ON dbo.Homeworks (InstitutionId, ClassId, CreatedAt DESC)
  WHERE IsDeleted = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Att_Class_Date' AND object_id = OBJECT_ID(N'dbo.AttendanceSessions'))
CREATE INDEX IX_Att_Class_Date
  ON dbo.AttendanceSessions (InstitutionId, ClassId, SessionDate DESC)
  WHERE IsDeleted = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AttEntry_Student' AND object_id = OBJECT_ID(N'dbo.AttendanceEntries'))
CREATE INDEX IX_AttEntry_Student
  ON dbo.AttendanceEntries (StudentId, SessionId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Sch_Target' AND object_id = OBJECT_ID(N'dbo.LessonSchedules'))
CREATE UNIQUE INDEX IX_Sch_Target_Active
  ON dbo.LessonSchedules (InstitutionId, TargetType, TargetId)
  WHERE IsDeleted = 0;
GO

PRINT N'İndeksler oluşturuldu.';
GO
