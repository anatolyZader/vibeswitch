#!/usr/bin/env bash
# Setup branch protection rules for VibeSwitch repository.
# Run once after repo creation: bash .github/setup-branch-protection.sh
#
# Requires: gh CLI authenticated with admin permissions.
# Docs: https://docs.github.com/en/rest/branches/branch-protection

set -euo pipefail

REPO="anatolyZader/vibeswitch"

echo "=== Setting up branch protection for $REPO ==="

# Protect main branch
echo ""
echo "--- Protecting 'main' branch ---"
gh api -X PUT "repos/${REPO}/branches/main/protection" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Lint & Test (18)", "Lint & Test (20)", "Build & Package"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
echo "  ✓ main branch protected"

# Protect dev branch (lighter rules)
echo ""
echo "--- Protecting 'dev' branch ---"
gh api -X PUT "repos/${REPO}/branches/dev/protection" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": false,
    "contexts": ["Lint & Test (20)"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
echo "  ✓ dev branch protected"

# Enable auto-delete head branches
echo ""
echo "--- Enabling auto-delete head branches ---"
gh api -X PATCH "repos/${REPO}" \
  --field delete_branch_on_merge=true \
  --field allow_squash_merge=true \
  --field allow_merge_commit=false \
  --field allow_rebase_merge=true \
  --field squash_merge_commit_title=PR_TITLE \
  --field squash_merge_commit_message=PR_BODY \
  --silent
echo "  ✓ Auto-delete branches enabled"
echo "  ✓ Squash merge enabled (default), rebase allowed, merge commit disabled"

echo ""
echo "=== Branch protection setup complete ==="
echo ""
echo "Summary:"
echo "  main: PR required, CI required, linear history, no force push"
echo "  dev:  CI required (lint+test), no force push"
echo "  Merge: squash (default) or rebase; auto-delete branches"
echo ""
echo "Next steps:"
echo "  1. Verify at: https://github.com/${REPO}/settings/branches"
echo "  2. Run: node .github/sync-labels.js (to create labels)"
echo "  3. Start using branch workflow: feat/scope/description"
