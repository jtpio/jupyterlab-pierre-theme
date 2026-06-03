# Making a new release of jupyterlab-pierre-theme

This repository ships two packages (`jupyterlab-pierre-light` and
`jupyterlab-pierre-dark`). They can be published to `PyPI` and `npm` manually or
using the [Jupyter Releaser](https://github.com/jupyter-server/jupyter_releaser).

## Manual release

### Python package

All of the Python packaging instructions are in each package's `pyproject.toml`
file. Before generating a package, install the build tools:

```bash
pip install build twine hatch
```

Bump the version of a package using `hatch` (run it from the package directory).
See the docs on [hatch-nodejs-version](https://github.com/agoose77/hatch-nodejs-version#semver)
for details. Keep both packages on the same version, then sync the root version:

```bash
python scripts/sync_version.py
```

Clean up the development files before building:

```bash
pnpm clean:all
```

To create the source package (`.tar.gz`) and the wheel (`.whl`) in each
package's `dist/` directory, run from the package directory:

```bash
python -m build
```

Then upload to PyPI:

```bash
twine upload packages/*/dist/*
```

### NPM package

To publish the frontend part of a package as an NPM package, run from the
package directory:

```bash
npm login
npm publish --access public
```

## Automated releases with the Jupyter Releaser

The repository is configured for the Jupyter Releaser, but the GitHub repository
and the package managers need to be set up. Follow the Jupyter Releaser
[checklist](https://jupyter-releaser.readthedocs.io/en/latest/how_to_guides/convert_repo_from_repo.html).

To cut a new release:

- Go to the Actions panel
- Run the "Step 1: Prep Release" workflow
- Check the draft changelog
- Run the "Step 2: Publish Release" workflow

> [!NOTE]
> See the [workflow documentation](https://jupyter-releaser.readthedocs.io/en/latest/get_started/making_release_from_repo.html)
> for more information.
