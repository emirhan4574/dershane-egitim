/*
  Dershane — tablolar, PK / FK / CHECK / UNIQUE / soft-delete
*/
USE [DershaneDb];
GO

/* ---------- Institutions ---------- */
IF OBJECT_ID(N'dbo.Institutions', N'U') IS NULL
CREATE TABLE dbo.Institutions (
  Id            NVARCHAR(64)  NOT NULL CONSTRAINT PK_Institutions PRIMARY KEY,
  Name          NVARCHAR(200) NOT NULL,
  Code          NVARCHAR(64)  NOT NULL,
  PaymentOverdueIntervalDays INT NOT NULL CONSTRAINT DF_Institutions_OverdueInterval DEFAULT 7,
  ClassPlacementSize INT NOT NULL CONSTRAINT DF_Institutions_ClassPlacement DEFAULT 10,
  CreatedAt     DATETIME2(3)  NOT NULL CONSTRAINT DF_Institutions_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt     DATETIME2(3)  NOT NULL CONSTRAINT DF_Institutions_UpdatedAt DEFAULT SYSUTCDATETIME(),
  IsDeleted     BIT           NOT NULL CONSTRAINT DF_Institutions_IsDeleted DEFAULT 0,
  CONSTRAINT UQ_Institutions_Code UNIQUE (Code)
);
GO

/* ---------- Users ---------- */
IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
CREATE TABLE dbo.Users (
  Id             NVARCHAR(64)  NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
  Role           NVARCHAR(20)  NOT NULL,
  InstitutionId  NVARCHAR(64)  NULL,
  FullName       NVARCHAR(200) NOT NULL,
  LoginId        NVARCHAR(64)  NOT NULL,
  PasswordHash   NVARCHAR(200) NOT NULL,
  Phone          NVARCHAR(32)  NULL,
  ParentName     NVARCHAR(200) NULL,
  ParentPhone    NVARCHAR(32)  NULL,
  ClassId        NVARCHAR(64)  NULL,
  ClassName      NVARCHAR(120) NULL,
  IsManager      BIT           NOT NULL CONSTRAINT DF_Users_IsManager DEFAULT 0,
  IsMuhasebe     BIT           NOT NULL CONSTRAINT DF_Users_IsMuhasebe DEFAULT 0,
  FeeAmount      DECIMAL(12,2) NULL,
  PaymentType    NVARCHAR(20)  NULL,
  InstallmentCount INT         NULL,
  PaymentDay     INT           NULL,
  Points         INT           NOT NULL CONSTRAINT DF_Users_Points DEFAULT 0,
  CreatedAt      DATETIME2(3)  NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt      DATETIME2(3)  NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT SYSUTCDATETIME(),
  IsDeleted      BIT           NOT NULL CONSTRAINT DF_Users_IsDeleted DEFAULT 0,
  CONSTRAINT CK_Users_Role CHECK (Role IN (N'superadmin', N'teacher', N'student', N'muhasebe')),
  CONSTRAINT CK_Users_Points CHECK (Points >= 0),
  CONSTRAINT FK_Users_Institution FOREIGN KEY (InstitutionId)
    REFERENCES dbo.Institutions(Id)
);
GO

/* Login unique: superadmin global; others per institution */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_Users_Inst_Login' AND object_id = OBJECT_ID(N'dbo.Users'))
CREATE UNIQUE INDEX UQ_Users_Inst_Login
  ON dbo.Users (InstitutionId, LoginId)
  WHERE IsDeleted = 0;
GO

/* ---------- UserSubjects ---------- */
IF OBJECT_ID(N'dbo.UserSubjects', N'U') IS NULL
CREATE TABLE dbo.UserSubjects (
  UserId   NVARCHAR(64)  NOT NULL,
  Subject  NVARCHAR(80)  NOT NULL,
  SortOrder INT          NOT NULL CONSTRAINT DF_UserSubjects_Sort DEFAULT 0,
  CONSTRAINT PK_UserSubjects PRIMARY KEY (UserId, Subject),
  CONSTRAINT FK_UserSubjects_User FOREIGN KEY (UserId)
    REFERENCES dbo.Users(Id) ON DELETE CASCADE
);
GO

/* ---------- Classes ---------- */
IF OBJECT_ID(N'dbo.Classes', N'U') IS NULL
CREATE TABLE dbo.Classes (
  Id             NVARCHAR(64)  NOT NULL CONSTRAINT PK_Classes PRIMARY KEY,
  InstitutionId  NVARCHAR(64)  NOT NULL,
  Name           NVARCHAR(120) NOT NULL,
  Grade          NVARCHAR(16)  NULL,   -- '4'..'12' veya 'mezun'
  Section        NVARCHAR(8)   NULL,
  Track          NVARCHAR(32)  NULL,
  CreatedAt      DATETIME2(3)  NOT NULL CONSTRAINT DF_Classes_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt      DATETIME2(3)  NOT NULL CONSTRAINT DF_Classes_UpdatedAt DEFAULT SYSUTCDATETIME(),
  IsDeleted      BIT           NOT NULL CONSTRAINT DF_Classes_IsDeleted DEFAULT 0,
  CONSTRAINT FK_Classes_Institution FOREIGN KEY (InstitutionId)
    REFERENCES dbo.Institutions(Id),
  CONSTRAINT CK_Classes_Track CHECK (
    Track IS NULL OR Track IN (N'sayisal', N'sozel', N'esit_agirlik', N'dil', N'ortaokul')
  )
);
GO

IF OBJECT_ID(N'dbo.FK_Users_Class', N'F') IS NULL
  AND COL_LENGTH(N'dbo.Users', N'ClassId') IS NOT NULL
BEGIN
  ALTER TABLE dbo.Users WITH NOCHECK
    ADD CONSTRAINT FK_Users_Class FOREIGN KEY (ClassId)
    REFERENCES dbo.Classes(Id);
END
GO

/* ---------- ClassTeachers ---------- */
IF OBJECT_ID(N'dbo.ClassTeachers', N'U') IS NULL
CREATE TABLE dbo.ClassTeachers (
  ClassId   NVARCHAR(64) NOT NULL,
  TeacherId NVARCHAR(64) NOT NULL,
  AssignedAt DATETIME2(3) NOT NULL CONSTRAINT DF_ClassTeachers_AssignedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_ClassTeachers PRIMARY KEY (ClassId, TeacherId),
  CONSTRAINT FK_ClassTeachers_Class FOREIGN KEY (ClassId)
    REFERENCES dbo.Classes(Id) ON DELETE CASCADE,
  CONSTRAINT FK_ClassTeachers_Teacher FOREIGN KEY (TeacherId)
    REFERENCES dbo.Users(Id)
);
GO

/* ---------- Chat ---------- */
IF OBJECT_ID(N'dbo.ChatMessages', N'U') IS NULL
CREATE TABLE dbo.ChatMessages (
  Id                NVARCHAR(64)   NOT NULL CONSTRAINT PK_ChatMessages PRIMARY KEY,
  InstitutionId     NVARCHAR(64)   NOT NULL,
  ClassId           NVARCHAR(64)   NOT NULL,
  SenderId          NVARCHAR(64)   NOT NULL,
  SenderName        NVARCHAR(200)  NOT NULL,
  TextBody           NVARCHAR(MAX)  NOT NULL,
  IsHomeworkNotice  BIT            NOT NULL CONSTRAINT DF_Chat_IsHw DEFAULT 0,
  CreatedAt         DATETIME2(3)   NOT NULL CONSTRAINT DF_Chat_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt         DATETIME2(3)   NOT NULL CONSTRAINT DF_Chat_UpdatedAt DEFAULT SYSUTCDATETIME(),
  IsDeleted         BIT            NOT NULL CONSTRAINT DF_Chat_IsDeleted DEFAULT 0,
  CONSTRAINT FK_Chat_Institution FOREIGN KEY (InstitutionId) REFERENCES dbo.Institutions(Id),
  CONSTRAINT FK_Chat_Class FOREIGN KEY (ClassId) REFERENCES dbo.Classes(Id),
  CONSTRAINT FK_Chat_Sender FOREIGN KEY (SenderId) REFERENCES dbo.Users(Id)
);
GO

IF OBJECT_ID(N'dbo.ChatAttachments', N'U') IS NULL
CREATE TABLE dbo.ChatAttachments (
  Id        NVARCHAR(64)  NOT NULL CONSTRAINT PK_ChatAttachments PRIMARY KEY,
  MessageId NVARCHAR(64)  NOT NULL,
  Type      NVARCHAR(20)  NOT NULL,
  Label     NVARCHAR(200) NOT NULL,
  Uri       NVARCHAR(1000) NOT NULL,
  SortOrder INT           NOT NULL CONSTRAINT DF_ChatAtt_Sort DEFAULT 0,
  CONSTRAINT FK_ChatAtt_Message FOREIGN KEY (MessageId)
    REFERENCES dbo.ChatMessages(Id) ON DELETE CASCADE,
  CONSTRAINT CK_ChatAtt_Type CHECK (Type IN (N'image', N'pdf', N'file', N'link'))
);
GO

/* ---------- Deneme ---------- */
IF OBJECT_ID(N'dbo.DenemeResults', N'U') IS NULL
CREATE TABLE dbo.DenemeResults (
  Id              NVARCHAR(64)  NOT NULL CONSTRAINT PK_DenemeResults PRIMARY KEY,
  InstitutionId   NVARCHAR(64)  NOT NULL,
  StudentId       NVARCHAR(64)  NOT NULL,
  Title           NVARCHAR(200) NOT NULL,
  ExamDate        DATE          NOT NULL,
  Net             DECIMAL(10,3) NOT NULL CONSTRAINT DF_Deneme_Net DEFAULT 0,
  Score           DECIMAL(10,3) NOT NULL CONSTRAINT DF_Deneme_Score DEFAULT 0,
  Note            NVARCHAR(500) NULL,
  Source          NVARCHAR(20)  NOT NULL,
  DocumentUri     NVARCHAR(1000) NULL,
  DocumentName    NVARCHAR(200) NULL,
  StudentName     NVARCHAR(200) NULL,
  ExamType        NVARCHAR(20)  NULL,
  AverageScore    DECIMAL(10,3) NULL,
  ClassGrade      NVARCHAR(16)  NULL,
  ClassSection    NVARCHAR(8)   NULL,
  ClassTrack      NVARCHAR(32)  NULL,
  CreatedAt       DATETIME2(3)  NOT NULL CONSTRAINT DF_Deneme_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt       DATETIME2(3)  NOT NULL CONSTRAINT DF_Deneme_UpdatedAt DEFAULT SYSUTCDATETIME(),
  IsDeleted       BIT           NOT NULL CONSTRAINT DF_Deneme_IsDeleted DEFAULT 0,
  CONSTRAINT FK_Deneme_Institution FOREIGN KEY (InstitutionId) REFERENCES dbo.Institutions(Id),
  CONSTRAINT FK_Deneme_Student FOREIGN KEY (StudentId) REFERENCES dbo.Users(Id),
  CONSTRAINT CK_Deneme_Source CHECK (Source IN (N'institution', N'student'))
);
GO

IF OBJECT_ID(N'dbo.DenemeSubjects', N'U') IS NULL
CREATE TABLE dbo.DenemeSubjects (
  Id              NVARCHAR(64)  NOT NULL CONSTRAINT PK_DenemeSubjects PRIMARY KEY,
  DenemeId        NVARCHAR(64)  NOT NULL,
  Subject         NVARCHAR(80)  NOT NULL,
  Correct         INT           NOT NULL CONSTRAINT DF_DenemeSub_C DEFAULT 0,
  Wrong           INT           NOT NULL CONSTRAINT DF_DenemeSub_W DEFAULT 0,
  Blank           INT           NOT NULL CONSTRAINT DF_DenemeSub_B DEFAULT 0,
  Net             DECIMAL(10,3) NOT NULL CONSTRAINT DF_DenemeSub_N DEFAULT 0,
  SuccessPercent  DECIMAL(10,3) NULL,
  ClassAvg        DECIMAL(10,3) NULL,
  InstitutionAvg  DECIMAL(10,3) NULL,
  GeneralAvg      DECIMAL(10,3) NULL,
  SortOrder       INT           NOT NULL CONSTRAINT DF_DenemeSub_Sort DEFAULT 0,
  CONSTRAINT FK_DenemeSub_Deneme FOREIGN KEY (DenemeId)
    REFERENCES dbo.DenemeResults(Id) ON DELETE CASCADE
);
GO

IF OBJECT_ID(N'dbo.DenemeRanks', N'U') IS NULL
CREATE TABLE dbo.DenemeRanks (
  Id        NVARCHAR(64)  NOT NULL CONSTRAINT PK_DenemeRanks PRIMARY KEY,
  DenemeId  NVARCHAR(64)  NOT NULL,
  Scope     NVARCHAR(20)  NOT NULL,
  Label     NVARCHAR(80)  NOT NULL,
  RankNo    INT           NOT NULL,
  Total     INT           NOT NULL,
  CONSTRAINT FK_DenemeRank_Deneme FOREIGN KEY (DenemeId)
    REFERENCES dbo.DenemeResults(Id) ON DELETE CASCADE,
  CONSTRAINT CK_DenemeRank_Scope CHECK (
    Scope IN (N'class', N'institution', N'district', N'province', N'general')
  )
);
GO

/* ---------- Homework ---------- */
IF OBJECT_ID(N'dbo.Homeworks', N'U') IS NULL
CREATE TABLE dbo.Homeworks (
  Id             NVARCHAR(64)   NOT NULL CONSTRAINT PK_Homeworks PRIMARY KEY,
  InstitutionId  NVARCHAR(64)   NOT NULL,
  ClassId        NVARCHAR(64)   NOT NULL,
  ClassName      NVARCHAR(120)  NOT NULL,
  Lesson         NVARCHAR(120)  NOT NULL,
  Topic          NVARCHAR(200)  NOT NULL,
  Purpose        NVARCHAR(MAX)  NOT NULL,
  CreatedBy      NVARCHAR(64)   NOT NULL,
  CreatedAt      DATETIME2(3)   NOT NULL CONSTRAINT DF_Hw_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt      DATETIME2(3)   NOT NULL CONSTRAINT DF_Hw_UpdatedAt DEFAULT SYSUTCDATETIME(),
  IsDeleted      BIT            NOT NULL CONSTRAINT DF_Hw_IsDeleted DEFAULT 0,
  CONSTRAINT FK_Hw_Institution FOREIGN KEY (InstitutionId) REFERENCES dbo.Institutions(Id),
  CONSTRAINT FK_Hw_Class FOREIGN KEY (ClassId) REFERENCES dbo.Classes(Id),
  CONSTRAINT FK_Hw_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(Id)
);
GO

IF OBJECT_ID(N'dbo.HomeworkAttachments', N'U') IS NULL
CREATE TABLE dbo.HomeworkAttachments (
  Id         NVARCHAR(64)   NOT NULL CONSTRAINT PK_HwAtt PRIMARY KEY,
  HomeworkId NVARCHAR(64)   NOT NULL,
  Type       NVARCHAR(20)   NOT NULL,
  Label      NVARCHAR(200)  NOT NULL,
  Uri        NVARCHAR(1000) NOT NULL,
  SortOrder  INT            NOT NULL CONSTRAINT DF_HwAtt_Sort DEFAULT 0,
  CONSTRAINT FK_HwAtt_Hw FOREIGN KEY (HomeworkId)
    REFERENCES dbo.Homeworks(Id) ON DELETE CASCADE,
  CONSTRAINT CK_HwAtt_Type CHECK (Type IN (N'image', N'pdf', N'video', N'link', N'file'))
);
GO

IF OBJECT_ID(N'dbo.HomeworkStatuses', N'U') IS NULL
CREATE TABLE dbo.HomeworkStatuses (
  Id             NVARCHAR(64) NOT NULL CONSTRAINT PK_HwStatus PRIMARY KEY,
  InstitutionId  NVARCHAR(64) NOT NULL,
  HomeworkId     NVARCHAR(64) NOT NULL,
  StudentId      NVARCHAR(64) NOT NULL,
  Done           BIT          NULL, -- NULL = bekliyor
  PointsAwarded  INT          NOT NULL CONSTRAINT DF_HwStatus_Pts DEFAULT 0,
  CheckedAt      DATETIME2(3) NULL,
  CreatedAt      DATETIME2(3) NOT NULL CONSTRAINT DF_HwStatus_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt      DATETIME2(3) NOT NULL CONSTRAINT DF_HwStatus_UpdatedAt DEFAULT SYSUTCDATETIME(),
  IsDeleted      BIT          NOT NULL CONSTRAINT DF_HwStatus_IsDeleted DEFAULT 0,
  CONSTRAINT FK_HwStatus_Inst FOREIGN KEY (InstitutionId) REFERENCES dbo.Institutions(Id),
  CONSTRAINT FK_HwStatus_Hw FOREIGN KEY (HomeworkId) REFERENCES dbo.Homeworks(Id) ON DELETE CASCADE,
  CONSTRAINT FK_HwStatus_Student FOREIGN KEY (StudentId) REFERENCES dbo.Users(Id),
  CONSTRAINT UQ_HwStatus_Hw_Student UNIQUE (HomeworkId, StudentId)
);
GO

/* ---------- Attendance ---------- */
IF OBJECT_ID(N'dbo.AttendanceSessions', N'U') IS NULL
CREATE TABLE dbo.AttendanceSessions (
  Id             NVARCHAR(64)  NOT NULL CONSTRAINT PK_AttSessions PRIMARY KEY,
  InstitutionId  NVARCHAR(64)  NOT NULL,
  ClassId        NVARCHAR(64)  NOT NULL,
  ClassName      NVARCHAR(120) NOT NULL,
  SessionDate    DATE          NOT NULL,
  TeacherId      NVARCHAR(64)  NOT NULL,
  TeacherName    NVARCHAR(200) NOT NULL,
  Subject        NVARCHAR(120) NOT NULL,
  CreatedAt      DATETIME2(3)  NOT NULL CONSTRAINT DF_Att_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt      DATETIME2(3)  NOT NULL CONSTRAINT DF_Att_UpdatedAt DEFAULT SYSUTCDATETIME(),
  IsDeleted      BIT           NOT NULL CONSTRAINT DF_Att_IsDeleted DEFAULT 0,
  CONSTRAINT FK_Att_Inst FOREIGN KEY (InstitutionId) REFERENCES dbo.Institutions(Id),
  CONSTRAINT FK_Att_Class FOREIGN KEY (ClassId) REFERENCES dbo.Classes(Id),
  CONSTRAINT FK_Att_Teacher FOREIGN KEY (TeacherId) REFERENCES dbo.Users(Id)
);
GO

IF OBJECT_ID(N'dbo.AttendanceEntries', N'U') IS NULL
CREATE TABLE dbo.AttendanceEntries (
  Id             NVARCHAR(64)   NOT NULL CONSTRAINT PK_AttEntries PRIMARY KEY,
  SessionId      NVARCHAR(64)   NOT NULL,
  StudentId      NVARCHAR(64)   NOT NULL,
  StudentName    NVARCHAR(200)  NOT NULL,
  Status         NVARCHAR(20)   NOT NULL,
  Note           NVARCHAR(500)  NULL,
  ParentMessage  NVARCHAR(MAX)  NULL,
  CONSTRAINT FK_AttEntry_Session FOREIGN KEY (SessionId)
    REFERENCES dbo.AttendanceSessions(Id) ON DELETE CASCADE,
  CONSTRAINT FK_AttEntry_Student FOREIGN KEY (StudentId) REFERENCES dbo.Users(Id),
  CONSTRAINT CK_AttEntry_Status CHECK (Status IN (N'present', N'absent')),
  CONSTRAINT UQ_AttEntry_Session_Student UNIQUE (SessionId, StudentId)
);
GO

/* ---------- Lesson schedules ---------- */
IF OBJECT_ID(N'dbo.LessonSchedules', N'U') IS NULL
CREATE TABLE dbo.LessonSchedules (
  Id             NVARCHAR(64)  NOT NULL CONSTRAINT PK_LessonSchedules PRIMARY KEY,
  InstitutionId  NVARCHAR(64)  NOT NULL,
  TargetType     NVARCHAR(20)  NOT NULL,
  TargetId       NVARCHAR(64)  NOT NULL,
  TargetName     NVARCHAR(200) NOT NULL,
  Title          NVARCHAR(200) NULL,
  CreatedBy      NVARCHAR(64)  NOT NULL,
  CreatedAt      DATETIME2(3)  NOT NULL CONSTRAINT DF_Sch_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt      DATETIME2(3)  NOT NULL CONSTRAINT DF_Sch_UpdatedAt DEFAULT SYSUTCDATETIME(),
  IsDeleted      BIT           NOT NULL CONSTRAINT DF_Sch_IsDeleted DEFAULT 0,
  CONSTRAINT FK_Sch_Inst FOREIGN KEY (InstitutionId) REFERENCES dbo.Institutions(Id),
  CONSTRAINT FK_Sch_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(Id),
  CONSTRAINT CK_Sch_TargetType CHECK (TargetType IN (N'teacher', N'class'))
);
GO

IF OBJECT_ID(N'dbo.LessonSlots', N'U') IS NULL
CREATE TABLE dbo.LessonSlots (
  Id                  NVARCHAR(64)  NOT NULL CONSTRAINT PK_LessonSlots PRIMARY KEY,
  ScheduleId          NVARCHAR(64)  NOT NULL,
  DayOfWeek           TINYINT       NOT NULL,
  StartTime           NVARCHAR(8)   NOT NULL,
  EndTime             NVARCHAR(8)   NOT NULL,
  Subject             NVARCHAR(120) NOT NULL,
  Room                NVARCHAR(80)  NULL,
  Note                NVARCHAR(500) NULL,
  RelatedClassId      NVARCHAR(64)  NULL,
  RelatedClassName    NVARCHAR(120) NULL,
  RelatedTeacherId    NVARCHAR(64)  NULL,
  RelatedTeacherName  NVARCHAR(200) NULL,
  SortOrder           INT           NOT NULL CONSTRAINT DF_Slot_Sort DEFAULT 0,
  CONSTRAINT FK_Slot_Schedule FOREIGN KEY (ScheduleId)
    REFERENCES dbo.LessonSchedules(Id) ON DELETE CASCADE,
  CONSTRAINT CK_Slot_Day CHECK (DayOfWeek BETWEEN 0 AND 6)
);
GO

/* ---------- Study items ---------- */
IF OBJECT_ID(N'dbo.StudyItems', N'U') IS NULL
CREATE TABLE dbo.StudyItems (
  Id             NVARCHAR(64)  NOT NULL CONSTRAINT PK_StudyItems PRIMARY KEY,
  InstitutionId  NVARCHAR(64)  NOT NULL,
  StudentId      NVARCHAR(64)  NOT NULL,
  Lesson         NVARCHAR(120) NOT NULL,
  Topic          NVARCHAR(200) NOT NULL,
  DayOfWeek      TINYINT       NOT NULL,
  TimeText       NVARCHAR(8)   NOT NULL,
  DurationHours  DECIMAL(6,2)  NOT NULL,
  Completed      BIT           NOT NULL CONSTRAINT DF_Study_Completed DEFAULT 0,
  CreatedByRole  NVARCHAR(20)  NOT NULL,
  CreatedAt      DATETIME2(3)  NOT NULL CONSTRAINT DF_Study_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt      DATETIME2(3)  NOT NULL CONSTRAINT DF_Study_UpdatedAt DEFAULT SYSUTCDATETIME(),
  IsDeleted      BIT           NOT NULL CONSTRAINT DF_Study_IsDeleted DEFAULT 0,
  CONSTRAINT FK_Study_Inst FOREIGN KEY (InstitutionId) REFERENCES dbo.Institutions(Id),
  CONSTRAINT FK_Study_Student FOREIGN KEY (StudentId) REFERENCES dbo.Users(Id),
  CONSTRAINT CK_Study_Day CHECK (DayOfWeek BETWEEN 0 AND 6),
  CONSTRAINT CK_Study_CreatedBy CHECK (CreatedByRole IN (N'student', N'teacher'))
);
GO

/* ---------- Payment notices ---------- */
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

PRINT N'Tablolar oluşturuldu.';
GO
