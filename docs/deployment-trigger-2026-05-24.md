# Deployment Trigger

Purpose: trigger Vercel Git deployment after the Holdings output validation and section-readiness audit commits.

Target latest functional commit before this trigger:

```txt
68b585110a4ea9a931184987147068fd0a6d3cfb
Audit Holdings and Opportunity section readiness
```

Expected deployment should include:

- removal of `node scripts/strip-holdings-role-method-home.cjs` from active Holdings commands
- addition of `node scripts/validate-holdings-home-output.cjs`
- `outputs/holdings-home-output-validation-report.json`
- `docs/homepage-section-cleanup-readiness-audit.md`
