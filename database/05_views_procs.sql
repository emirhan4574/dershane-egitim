USE [DershaneDb];
GO

/* Aktif öğrenciler görünümü */
CREATE OR ALTER VIEW dbo.vw_ActiveStudents
AS
SELECT
  u.Id, u.InstitutionId, u.FullName, u.LoginId, u.Phone, u.ParentPhone,
  u.ClassId, u.ClassName, u.Points, u.CreatedAt
FROM dbo.Users u
WHERE u.IsDeleted = 0 AND u.Role = N'student';
GO

/* Yoklama oturumu + gelmeyen sayısı */
CREATE OR ALTER VIEW dbo.vw_AttendanceSummary
AS
SELECT
  s.Id AS SessionId,
  s.InstitutionId,
  s.ClassId,
  s.ClassName,
  s.SessionDate,
  s.TeacherId,
  s.TeacherName,
  s.Subject,
  s.CreatedAt,
  SUM(CASE WHEN e.Status = N'absent' THEN 1 ELSE 0 END) AS AbsentCount,
  SUM(CASE WHEN e.Status = N'present' THEN 1 ELSE 0 END) AS PresentCount,
  COUNT(e.Id) AS EntryCount
FROM dbo.AttendanceSessions s
LEFT JOIN dbo.AttendanceEntries e ON e.SessionId = s.Id
WHERE s.IsDeleted = 0
GROUP BY
  s.Id, s.InstitutionId, s.ClassId, s.ClassName, s.SessionDate,
  s.TeacherId, s.TeacherName, s.Subject, s.CreatedAt;
GO

/*
  Yoklama kaydı: session + entries tek transaction (örnek prosedür)
*/
CREATE OR ALTER PROCEDURE dbo.usp_SaveAttendanceSession
  @SessionId NVARCHAR(64),
  @InstitutionId NVARCHAR(64),
  @ClassId NVARCHAR(64),
  @ClassName NVARCHAR(120),
  @SessionDate DATE,
  @TeacherId NVARCHAR(64),
  @TeacherName NVARCHAR(200),
  @Subject NVARCHAR(120),
  @EntriesJson NVARCHAR(MAX) -- [{"studentId","studentName","status","note","parentMessage"}]
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  BEGIN TRAN;

  IF EXISTS (SELECT 1 FROM dbo.AttendanceSessions WHERE Id = @SessionId AND IsDeleted = 0)
  BEGIN
    RAISERROR(N'Bu yoklama oturumu zaten var.', 16, 1);
    ROLLBACK;
    RETURN;
  END

  INSERT INTO dbo.AttendanceSessions (
    Id, InstitutionId, ClassId, ClassName, SessionDate,
    TeacherId, TeacherName, Subject, CreatedAt, UpdatedAt, IsDeleted
  ) VALUES (
    @SessionId, @InstitutionId, @ClassId, @ClassName, @SessionDate,
    @TeacherId, @TeacherName, @Subject, SYSUTCDATETIME(), SYSUTCDATETIME(), 0
  );

  INSERT INTO dbo.AttendanceEntries (Id, SessionId, StudentId, StudentName, Status, Note, ParentMessage)
  SELECT
    CONCAT(N'atte_', LOWER(REPLACE(CONVERT(NVARCHAR(36), NEWID()), N'-', N''))),
    @SessionId,
    j.studentId,
    j.studentName,
    j.status,
    j.note,
    j.parentMessage
  FROM OPENJSON(@EntriesJson)
  WITH (
    studentId NVARCHAR(64) '$.studentId',
    studentName NVARCHAR(200) '$.studentName',
    status NVARCHAR(20) '$.status',
    note NVARCHAR(500) '$.note',
    parentMessage NVARCHAR(MAX) '$.parentMessage'
  ) j;

  COMMIT;
END
GO

PRINT N'View / prosedürler hazır.';
GO
