# Branching workflow

Use the git-flow branching model for this project:

- `main` holds production releases.
- `develop` is the integration branch.
- Create `feature/<name>` branches from `develop` and merge completed work back into `develop`.
- Use `release/<version>` branches to prepare releases, then merge into both `main` and `develop`.
- Create `hotfix/<name>` branches from `main` for production fixes, then merge into both `main` and `develop`.

Keep routine development commits on feature branches. Do not merge, push, or publish a release unless the user requests it.
