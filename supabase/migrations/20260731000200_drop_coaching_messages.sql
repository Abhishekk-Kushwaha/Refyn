-- Drops coaching_messages, added earlier the same day and superseded before it
-- ever served a request.
--
-- It cached one message per (concept, band), shared by every learner in that
-- state — free forever, but necessarily impersonal: a shared row cannot name
-- anyone's accuracy. daily_focus replaced it with one row per learner per day,
-- which can cite real figures and compare them against the learner's previous
-- visit. That is worth the cost, which is one generation per active user per
-- day rather than per login.
DROP TABLE IF EXISTS coaching_messages;
