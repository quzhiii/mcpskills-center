# Skill Fixtures

This directory contains small synthetic skill fixtures kept in git for documentation and future tests.

Rules for this directory:

- Files here are authored for this repository.
- They are not copied from the user's live `.claude/skills/` directory.
- They avoid proprietary bundled assets and third-party restricted payloads.
- They exist to show expected skill structure, not to act as the user's real installed skills.

Why this exists:

- The repository previously tracked a large hidden `.claude/skills/` tree.
- That tree mixed local machine state with vendor/proprietary payloads.
- The project now treats `.claude/` as local config and ignores it in git.
- Only minimal representative fixtures remain in a non-hidden, documented location.

Current fixture set:

- `minimal-valid/`: smallest valid skill with required frontmatter.
- `bundled-reference/`: valid skill with a referenced bundled resource.

If future tests need malformed or missing-file cases, prefer generating them in temp directories inside tests rather than tracking broken repository fixtures.
