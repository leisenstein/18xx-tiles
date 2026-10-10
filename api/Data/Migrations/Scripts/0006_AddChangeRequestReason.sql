-- Phase 4: the submitter's explanation for a change ("why"), shown to the admin who reviews it.
ALTER TABLE ChangeRequests ADD COLUMN Reason TEXT NULL;

-- "My requests" looks up requests by submitter.
CREATE INDEX IX_ChangeRequests_SubmittedBy ON ChangeRequests(SubmittedBy);
