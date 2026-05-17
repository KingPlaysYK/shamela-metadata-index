# GitHub Setup

The local project is ready, but online repository creation requires GitHub authentication.

## Option A: Use the included API script

Create a GitHub fine-grained token with permissions:

- Repository creation
- Contents read/write
- Issues read/write

Then run:

```powershell
cd D:\ShamelaMetadataIndex
$env:GITHUB_TOKEN="paste_token_here"
npm.cmd run github:create-repo -- --name=shamela-metadata-index
```

Add the new remote and push:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/shamela-metadata-index.git
git push -u origin master
```

Create the issue backlog:

```powershell
npm.cmd run github:create-issues -- --repo=YOUR_USERNAME/shamela-metadata-index
```

## Option B: Use GitHub CLI

Install GitHub CLI, then run:

```powershell
gh auth login
gh repo create shamela-metadata-index --private --source . --remote origin --push
```

Then create issues from the local issue files using the included API script or manually from `issues/`.

## PowerShell note

If plain `npm` says scripts are disabled, use `npm.cmd` or run the Node scripts directly:

```powershell
node scripts/create-github-repo.mjs --name=shamela-metadata-index
node scripts/create-github-issues.mjs --repo=YOUR_USERNAME/shamela-metadata-index
```
