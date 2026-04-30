<#
.SYNOPSIS
    Applies the SidebarLayout.tsx profile panel redesign on a feat branch,
    commits, pushes, and opens (or creates) the PR.

.DESCRIPTION
    Defaults to operating on the current directory (assumed to be the repo
    root). Pass -RepoPath to point at a different clone, or omit it and run
    the script from inside the repo.

    Requires git in PATH and push access to Cover-Guard/Main.
    If gh CLI is installed + authenticated, the PR is created via API;
    otherwise the compare page is opened in the default browser.

.EXAMPLE
    cd "C:\CoverGuard Repo Clone\Main"
    .\Create-ProfilePanelPR.ps1
#>
[CmdletBinding()]
param(
    [string]$RepoPath   = (Get-Location).Path,
    [string]$BaseBranch = "main",
    [string]$BranchName = "feat/profile-panel-redesign"
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Write-Ok  ([string]$m) { Write-Host "    $m" -ForegroundColor Green }
function Write-Warn([string]$m) { Write-Host "    $m" -ForegroundColor Yellow }

# Wrapper: PowerShell with `$ErrorActionPreference = 'Stop'` treats native-
# command stderr (e.g. git's progress messages) as terminating errors. We
# relax that just for git invocations and rely on $LASTEXITCODE for actual
# failures. Returns nothing; check $LASTEXITCODE after each call.
function Invoke-Git {
    [CmdletBinding()]
    param([Parameter(ValueFromRemainingArguments = $true)] [string[]]$GitArgs)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & git @GitArgs
    } finally {
        $ErrorActionPreference = $prev
    }
}

# ---------------------------------------------------------------------------
# 1. Preflight
# ---------------------------------------------------------------------------
Write-Step "Preflight checks"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "git not found in PATH."
}
$ghAvailable = [bool](Get-Command gh -ErrorAction SilentlyContinue)
if ($ghAvailable) { Write-Ok "gh CLI detected - will create PR via API" }
else              { Write-Warn "gh CLI not found - will open PR page in browser" }

if (-not (Test-Path $RepoPath)) {
    throw "RepoPath does not exist: $RepoPath"
}
$WorkDir = (Resolve-Path $RepoPath).Path
Write-Step "Working in $WorkDir"

Push-Location $WorkDir
try {
    # Sanity-check: are we actually in a git repo for Cover-Guard/Main?
    if (-not (Test-Path ".git")) {
        throw "$WorkDir is not a git repository. cd into your clone first or pass -RepoPath."
    }

    # -----------------------------------------------------------------------
    # 2. Refuse dirty working tree (tracked changes only — untracked files
    #    are fine because the script only `git add`s the one file it edits)
    # -----------------------------------------------------------------------
    $dirty = git status --porcelain --untracked-files=no
    if ($dirty) {
        Write-Host "Tracked file changes detected:" -ForegroundColor Red
        $dirty | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
        throw "Tracked working-tree changes present. Commit or stash them first."
    }

    # -----------------------------------------------------------------------
    # 3. Fetch + create branch from origin/main
    # -----------------------------------------------------------------------
    Write-Step "Fetching latest origin/$BaseBranch"
    Invoke-Git fetch origin $BaseBranch
    if ($LASTEXITCODE -ne 0) { throw "git fetch failed" }

    $existingBranch = & git branch --list $BranchName
    if ($existingBranch) {
        throw "Branch '$BranchName' already exists locally. Delete it (git branch -D $BranchName) or use -BranchName."
    }

    Write-Step "Creating branch $BranchName from origin/$BaseBranch"
    Invoke-Git checkout -b $BranchName "origin/$BaseBranch"
    if ($LASTEXITCODE -ne 0) { throw "git checkout -b failed" }

    # -----------------------------------------------------------------------
    # 4. Locate target file
    # -----------------------------------------------------------------------
    $TargetFile = "apps/web/src/components/layout/SidebarLayout.tsx"
    if (-not (Test-Path $TargetFile)) {
        throw "Expected file not found: $TargetFile"
    }

    # -----------------------------------------------------------------------
    # 5. Old + new blocks (single-quoted here-strings: NO interpolation)
    # -----------------------------------------------------------------------
    $OldBlock = @'
                <div className="space-y-1">
                  <div className="flex items-center gap-2 px-1 py-1">
                    <div className="h-7 w-7 shrink-0 rounded-full bg-teal-500 flex items-center justify-center text-[10px] font-bold text-white">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-white truncate">{displayName}</p>
                      <p className="text-[9px] text-white/65 capitalize truncate">{user.role?.toLowerCase()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      href="/account"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <Settings className="h-3 w-3" />
                      Settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <LogOut className="h-3 w-3" />
                      Sign out
                    </button>
                  </div>
                </div>
'@

    $NewBlock = @'
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 px-1 py-1">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-teal-500 flex items-center justify-center text-[11px] font-semibold text-[#04342C]">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate tracking-tight">{displayName}</p>
                      <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-teal-500/15 px-1.5 py-px text-[9px] capitalize text-teal-300">
                        <span className="h-1 w-1 rounded-full bg-teal-400" />
                        {user.role?.toLowerCase()}
                      </span>
                    </div>
                  </div>
                  <div className="-mx-2 border-t border-white/[0.07]" />
                  <div className="space-y-0.5">
                    <Link
                      href="/account"
                      className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium text-white/75 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <Settings className="h-3 w-3 shrink-0" />
                      <span className="flex-1 truncate">Settings</span>
                      <ChevronRight className="h-3 w-3 shrink-0 opacity-30 group-hover:opacity-60 transition-opacity" />
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium text-red-300/80 hover:bg-red-500/10 hover:text-red-200 transition-colors"
                    >
                      <LogOut className="h-3 w-3 shrink-0" />
                      <span className="flex-1 truncate text-left">Sign out</span>
                    </button>
                  </div>
                </div>
'@

    # -----------------------------------------------------------------------
    # 6. Read file, normalize line endings for matching
    # -----------------------------------------------------------------------
    Write-Step "Reading $TargetFile"
    $RawBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $TargetFile))
    $Content  = [System.Text.Encoding]::UTF8.GetString($RawBytes)
    $WasCRLF  = $Content -match "`r`n"

    $ContentLF  = $Content   -replace "`r`n", "`n"
    $OldBlockLF = $OldBlock  -replace "`r`n", "`n"
    $NewBlockLF = $NewBlock  -replace "`r`n", "`n"

    # -----------------------------------------------------------------------
    # 7. Verify the old block is present exactly once
    # -----------------------------------------------------------------------
    $hits = ([regex]::Matches($ContentLF, [regex]::Escape($OldBlockLF)))
    if ($hits.Count -eq 0) {
        throw "Could not find the expected block in $TargetFile. The file has likely drifted upstream. Aborting."
    }
    if ($hits.Count -gt 1) {
        throw "Found $($hits.Count) occurrences of the target block (expected 1). Aborting."
    }
    Write-Ok "Target block matched exactly once"

    # -----------------------------------------------------------------------
    # 8. Replace, restore line endings, write back as UTF-8 (no BOM)
    # -----------------------------------------------------------------------
    Write-Step "Applying redesign"
    $NewContentLF = $ContentLF.Replace($OldBlockLF, $NewBlockLF)
    if ($NewContentLF -eq $ContentLF) { throw "Replacement produced no change." }
    $NewContent = if ($WasCRLF) { $NewContentLF -replace "`n", "`r`n" } else { $NewContentLF }
    $Utf8NoBom  = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Resolve-Path $TargetFile), $NewContent, $Utf8NoBom)

    # -----------------------------------------------------------------------
    # 9. Show diff
    # -----------------------------------------------------------------------
    Write-Step "Diff"
    git --no-pager diff -- $TargetFile

    # -----------------------------------------------------------------------
    # 10. Commit
    # -----------------------------------------------------------------------
    Write-Step "Committing"
    Invoke-Git add $TargetFile
    if ($LASTEXITCODE -ne 0) { throw "git add failed" }
    $CommitTitle = "feat(ui): polish sidebar profile panel"
    $CommitBody  = @"
Refines the user identity footer in SidebarLayout.tsx (expanded mode only;
the collapsed icon-only branch is unchanged).

- Avatar bumped from h-7 to h-8 with darker text on teal for better contrast
- Display name uses tracking-tight + font-medium for a cleaner read
- Role becomes a teal status pill with a presence dot
- Hairline divider separates identity from actions
- Action rows are full-width with a chevron affordance on Settings
- Sign out gets a soft red so destructive intent is legible at a glance
"@
    Invoke-Git commit -m $CommitTitle -m $CommitBody
    if ($LASTEXITCODE -ne 0) { throw "git commit failed" }

    # -----------------------------------------------------------------------
    # 11. Push
    # -----------------------------------------------------------------------
    Write-Step "Pushing $BranchName to origin"
    Invoke-Git push -u origin $BranchName
    if ($LASTEXITCODE -ne 0) { throw "git push failed. Check push access and credentials." }

    # -----------------------------------------------------------------------
    # 12. Create PR or open compare page
    # -----------------------------------------------------------------------
    if ($ghAvailable) {
        Write-Step "Creating PR via gh"
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            & gh pr create --base $BaseBranch --head $BranchName --title $CommitTitle --body $CommitBody
        } finally {
            $ErrorActionPreference = $prevEAP
        }
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "gh pr create failed (exit $LASTEXITCODE) — falling back to compare page"
            Start-Process "https://github.com/Cover-Guard/Main/compare/${BaseBranch}...${BranchName}?expand=1"
        }
    } else {
        $PrUrl = "https://github.com/Cover-Guard/Main/compare/${BaseBranch}...${BranchName}?expand=1"
        Write-Step "Opening PR creation page"
        Write-Host "    $PrUrl"
        Start-Process $PrUrl
    }

    Write-Host ""
    Write-Host "Done." -ForegroundColor Green
}
finally {
    Pop-Location
}
