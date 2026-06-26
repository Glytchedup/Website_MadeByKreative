#!/usr/bin/env bash
# Lightweight secret scanner — fails if anything that looks like a real
# credential is staged for commit. Run manually (`npm run check:secrets`) or wire
# as a pre-commit hook:  ln -s ../../scripts/check-secrets.sh .git/hooks/pre-commit
#
# Intentionally dependency-free (grep only). For a stronger guarantee add gitleaks
# or detect-secrets to CI.
set -euo pipefail

# Patterns that should NEVER be committed.
PATTERNS=(
  'sk_live_[0-9a-zA-Z]+'          # Stripe live secret key
  'sk_test_[0-9a-zA-Z]+'          # Stripe test secret key
  'rk_live_[0-9a-zA-Z]+'          # Stripe restricted live key
  'whsec_[0-9a-zA-Z]+'            # Stripe webhook signing secret
  're_[0-9a-zA-Z]{16,}'           # Resend API key
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
)

# Only scan staged changes if in a git hook context; else scan tracked files.
if git rev-parse --verify HEAD >/dev/null 2>&1; then
  FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)
  [ -z "$FILES" ] && FILES=$(git ls-files)
else
  FILES=$(git ls-files)
fi

# Never scan env files or lockfiles (env is gitignored; lockfiles are noisy).
FILES=$(echo "$FILES" | grep -vE '(^|/)\.env($|\.)|package-lock\.json|\.nvmrc$|check-secrets\.sh$' || true)

found=0
for f in $FILES; do
  [ -f "$f" ] || continue
  for p in "${PATTERNS[@]}"; do
    if grep -nEI "$p" "$f" >/dev/null 2>&1; then
      echo "✗ Potential secret ($p) in: $f"
      grep -nEI "$p" "$f" | head -3
      found=1
    fi
  done
done

if [ "$found" -ne 0 ]; then
  echo ""
  echo "Refusing: remove the secret(s) above (use env vars). Override with --no-verify only if you are certain."
  exit 1
fi
echo "✓ No committed secrets detected."
