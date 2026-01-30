# Release Process

This document describes how to release a new version of the `@tspng/webpack-console-forward-plugin`.

## Steps

1. **Update Version**
    
    Run the `npm version` command. This will update `package.json`, create a git commit, and create a git tag.

    * For a patch release (bug fixes):
        ```sh
        npm version patch -m "Bump version to %s"
        ```
    * For a minor release (new features, backward compatible):
        ```sh
        npm version minor -m "Bump version to %s"
        ```
    * For a major release (breaking changes):
        ```sh
        npm version major -m "Bump version to %s"
        ```

2. **Push Changes**

    Push the commit created by the version command as well as the new tag to trigger the release workflow.
    ```sh
    git push origin HEAD
    git push origin --tags
    ```

## Automated Workflow

After pushing the tags, the GitHub Action [npm-publish.yml](.github/workflows/npm-publish.yml) will automatically:
1. Install dependencies (`npm ci`).
2. Run tests (`npm test`).
3. Publish the package to npm.
