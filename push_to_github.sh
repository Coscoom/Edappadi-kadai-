#!/usr/bin/env bash

# ==============================================================================
# GitHub Push Tool / கிட்ஹப் பதிவேற்ற கருவி
# Handles heavy file cache issues, manages environment variables & secure Git credentials
# ==============================================================================

# ANSI Color Codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================================================${NC}"
echo -e "${YELLOW}   🚀 GITHUB PUSH & CREDITIALS MANAGER / கிட்ஹப் பதிவேற்ற கருவி${NC}"
echo -e "${CYAN}======================================================================${NC}"

# Ensure we are in a Git repository
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}📡 Git is not initialized. Initializing dynamic repository...${NC}"
    git init
    git branch -M main
fi

# ------------------------------------------------------------------------------
# STEP 1: SOLVE THE HEAVY BUILD FILE BLOCKS (The Root Cause / தீர்வாக அமைப்பது)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[Step 1/4] Cleaning up heavy build files from Git cached index...${NC}"
echo -e "          (பெரிய கம்ப்யூட்டர் கோப்புகளை Git நினைவகத்தில் இருந்து நீக்குகிறது...)"

# Force remove heavy folders/files from git cache that bypass .gitignore on previous tracking
git rm -r --cached .gradle/ 2>/dev/null || true
git rm -r --cached **/build/ 2>/dev/null || true
git rm -r --cached build/ 2>/dev/null || true
git rm -r --cached .build-outputs/ 2>/dev/null || true
git rm -r --cached *.apk *.aar *.ap_ *.aab 2>/dev/null || true
git rm -r --cached debug.keystore debug.keystore.base64 2>/dev/null || true
git rm -r --cached local.properties 2>/dev/null || true
git rm -r --cached .env 2>/dev/null || true

echo -e "${GREEN}✓ Git cache index optimized! High-weight assets excluded.${NC}"

# ------------------------------------------------------------------------------
# STEP 2: STAGE & SECURE LOCAL REPO STATE
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[Step 2/4] Staging source files for commit...${NC}"
git add .
echo -e "${GREEN}✓ All clean source files staged.${NC}"

# Prompt for a commit message
DEFAULT_MSG="feat: update coordinates and optimize interactive satellite maps"
echo -e "\nEnter commit message / பதிவேற்ற குறிப்பு:"
echo -e "Default: [${YELLOW}${DEFAULT_MSG}${NC}]"
read -p ">> " USER_MSG
COMMIT_MSG="${USER_MSG:-$DEFAULT_MSG}"

# Perform commit
git commit -m "$COMMIT_MSG" 2>/dev/null || echo -e "${YELLOW}ℹ No new differences to commit or already committed.${NC}"

# Detect current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
echo -e "Current branch name: ${GREEN}${CURRENT_BRANCH}${NC}"

# ------------------------------------------------------------------------------
# STEP 3: CREDENTIALS & AUTHN COMPLIANCE (கிட்ஹப் நற்சான்றிதழ்கள்)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[Step 3/4] Secure Credentials Check / நற்சான்றிதழ்கள் சரிபார்ப்பு...${NC}"

# Ask for Git username
echo -e "Enter your GitHub Username / உங்கள் கிட்ஹப் பயனர் பெயர்:"
read -p ">> " GH_USERNAME
if [ -z "$GH_USERNAME" ]; then
    echo -e "${RED}❌ Username cannot be empty. Script terminated.${NC}"
    exit 1
fi

# Ask for Repository Name
echo -e "\nEnter your GitHub Repository Name / உங்கள் களஞ்சியப் பெயர் (e.g. Edappadi-kadai):"
read -p ">> " GH_REPO
if [ -z "$GH_REPO" ]; then
    echo -e "${RED}❌ Repository name cannot be empty. Script terminated.${NC}"
    exit 1
fi

# Enter Personal Access Token (PAT)
echo -e "\nEnter your GitHub Personal Access Token (PAT) / கிட்ஹப் அணுகல் டோக்கன்:"
echo -e "${YELLOW}ℹ (Create a PAT at: https://github.com/settings/tokens with 'repo' privileges)${NC}"
read -s -p "Token (input is hidden for security): " GH_TOKEN
echo -e "" # newline after hidden input

if [ -z "$GH_TOKEN" ]; then
    echo -e "${RED}❌ Personal Access Token (PAT) cannot be empty. Script terminated.${NC}"
    exit 1
fi

# ------------------------------------------------------------------------------
# STEP 4: RECONFIGURING REMOTE & EXECUTING PUSH
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[Step 4/4] Setting secure endpoint & pushing metadata...${NC}"

# Formulate safe authenticated HTTPS endpoint
AUTH_URL="https://${GH_USERNAME}:${GH_TOKEN}@github.com/${GH_USERNAME}/${GH_REPO}.git"

# Set remote origin
git remote remove origin 2>/dev/null || true
git remote add origin "$AUTH_URL"

echo -e "Pushing commits to Remote branch '${CURRENT_BRANCH}'..."
echo -e "கிட்ஹப்பிற்கு கோப்புகள் அனுப்பப்படுகின்றன, தயவுசெய்து காத்திருக்கவும்..."

# Push to Github
if git push -u origin "$CURRENT_BRANCH" --force; then
    echo -e "\n${GREEN}======================================================================${NC}"
    echo -e "${GREEN}🎉 SUCCESS! App repository has been successfully pushed to GitHub!${NC}"
    echo -e "   உங்களது அப்ளிகேஷன் கோடுகள் கிட்ஹப்பில் வெற்றிகரமாக பதிவேற்றப்பட்டது!"
    echo -e "${GREEN}======================================================================${NC}"
    echo -e "Check your online repo: ${CYAN}https://github.com/${GH_USERNAME}/${GH_REPO}${NC}\n"
else
    echo -e "\n${RED}======================================================================${NC}"
    echo -e "${RED}❌ PUSH FAILED! Ensure your PAT is valid and has proper permissions.${NC}"
    echo -e "   பதிவேற்றம் தோல்வியடைந்தது! உங்களது டோக்கன் மற்றும் நெட்வொர்க்கை சரிபார்க்கவும்."
    echo -e "${RED}======================================================================${NC}"
fi

# Clean up remote credential trace for local privacy and safety
git remote remove origin 2>/dev/null || true
# Restore clean public remote pointer
PUBLIC_URL="https://github.com/${GH_USERNAME}/${GH_REPO}.git"
git remote add origin "$PUBLIC_URL"
echo -e "🔐 ${CYAN}Security check: Plaintext tokens cleared from active Git remotes repository config successfully.${NC}"
