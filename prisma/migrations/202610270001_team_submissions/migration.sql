BEGIN;

ALTER TABLE "Submission" ADD COLUMN "contentFormat" TEXT NOT NULL DEFAULT 'PLAIN';
ALTER TABLE "Submission" ADD COLUMN "driveUrl" TEXT;
CREATE UNIQUE INDEX "Submission_id_activityId_key" ON "Submission"("id", "activityId");

CREATE TABLE "SubmissionMember" (
    "submissionId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    CONSTRAINT "SubmissionMember_pkey" PRIMARY KEY ("submissionId", "studentId"),
    CONSTRAINT "SubmissionMember_submissionId_activityId_fkey" FOREIGN KEY ("submissionId", "activityId") REFERENCES "Submission"("id", "activityId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SubmissionMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SubmissionMember_activityId_studentId_key" ON "SubmissionMember"("activityId", "studentId");
CREATE INDEX "SubmissionMember_studentId_idx" ON "SubmissionMember"("studentId");

INSERT INTO "SubmissionMember" ("submissionId", "activityId", "studentId")
SELECT "id", "activityId", "studentId" FROM "Submission";

ALTER TABLE "Exam" ADD COLUMN "studentId" TEXT;
UPDATE "Exam" e SET "studentId" = s."studentId" FROM "Submission" s WHERE s."id" = e."submissionId";
ALTER TABLE "Exam" ALTER COLUMN "studentId" SET NOT NULL;
DROP INDEX "Exam_submissionId_key";
CREATE UNIQUE INDEX "Exam_submissionId_studentId_key" ON "Exam"("submissionId", "studentId");
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_submissionId_studentId_fkey" FOREIGN KEY ("submissionId", "studentId") REFERENCES "SubmissionMember"("submissionId", "studentId") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
