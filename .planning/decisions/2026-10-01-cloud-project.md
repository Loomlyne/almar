# ALMAR moves to a Claude cloud project (owner, 2026-10-01)

His words: "I am moving ALMAR to a Claude cloud project, the way I did with Vamos Taxi today."

1. **The cloud project.** General: a name, a goal, the coordinator model and the thread model, both
   Opus 5.5 High (not Fable). Memory → Project instructions: one text of at most 16,000 characters
   that every new thread reads. Environment: the GitHub repository `Loomlyne/almar`. No Mac is
   connected, so threads run in the cloud only.
2. **Shipping stays on his Mac.** Cloud threads cannot deploy or write to the live database. When the
   coordinator says a job is ready, he starts the "ALMAR control session" on his Mac. It checks the
   work in a clean copy, applies any database change, deploys and checks the live site.
3. **A thread** works on its own branch, cut from `origin/main` (from `origin/host/cloudflare-frontsite`
   until Phase 3.1 lands on `main`), and pushes it. It never pushes `main`, never deploys, never writes
   to the live database and never reads or prints a secret. Live probes are plain GET requests unless
   he says yes. No PR unless he asks.
4. **A job ends** with main merged in, the full check set, and a hand-over file: every check and its
   result, what was not verified, any migration and whether it is safe on live data, and his numbered
   test steps with the expected result of each.
5. **He decides** every choice through the question form, one decision per question, with an example.
   He signs discuss, design, plan, test and ship. Prices and legal wording are never invented.
6. **How the threads work:** one thread per job, each with its own branch and its own hand-over; he
   signs before any build; two threads never edit the same files at once; Opus for planning and
   reviews, Sonnet for routine building; a fresh reviewer thread after every change to money, sign-in
   or the database.

The project instructions and the coordinator's first message were prepared by the control session on
2026-10-01 and handed to him as files; they are not stored in the repo.

> Replaced: the owner ended the cloud project at 2026-10-01 19:27 UTC; all work runs on the Mac, one controller plus worker sessions in `.claude/worktrees/<job>` (`2026-10-02-cleanup.md`).
