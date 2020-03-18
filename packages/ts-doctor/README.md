# `ts-doctor`

A CLI of TypeScript related scripts for managing and updating TypeScript repos

## `ts-doctor workspaces`

Configures typescript [project references](https://www.typescriptlang.org/docs/handbook/project-references.html) for a yarn, bolt, or pnpm monorepo.

Monorepo setups can be...complex, with TypeScript. Ideally you want all the locally
interdependent packages to act as if they were part of one TS project, otherwise you have
to watch and build each package in order to have up to date type information everywhere.
In addition editor tooling should show source files not generated
`.d.ts` files, for "go to definition" and intellisense. Project references allow
for this, but come at the cost of a lot of arcane setup. Luckily `ts-doctor` can automate
the vast majority of it!

There are two prequisites for running the command.

1. Your workspaces need to be defined defined. Follow the instructions for your tool of choice, we'll use yarn workspaces in the example.
2. Each package in your monorepo that should have it's own `tsconfig.json`. This is how the command knows which
   packages are relevant typescript packages.

**package.json**

```json
{
  "workspaces": {
    "packages": ["packages/*"]
  }
}
```

Once you've added and built packages, run:

```sh
npx ts-doctor workspaces
```

And you are done. Everything should be set up. Remember to run regularly to keep
configuration up to date. `ts-doctor` will surgically edit your config files, only
updating the bits that are relevant so you can feel to edit them further.

### What it does in detail:

- add a `references` array in the root `tsconfig.json` enumerating each package path
- add a `references` array in every package `tsconfig.json` _that depends on another local ts package_
- set the compilerOption: `composite: true` array in every package `tsconfig.json`
- set the compilerOption: `declarationMap: true` array in every package `tsconfig.json`
- For packages that specify a `publishConfig.directory` key in their package.json ts `paths` are added
  to consuming packages for resolving "deep" imports to the right directory

### Additional options

- `--with-build-configs`: additionally generates a `tsconfig.build.json` config file in each package.
  This is useful for Babel based flows that only use `tsc` to generate type definition files, not compile source.
  running `tsc -p tsconfig.build.json --declaration --noEmit` locally in the workspace
  for building type defs. This is unfortunately necessary because of how compiler flags
  interact badly with composite projects, making it impossible to build _just_ type
  definitions from the repo root.

- `--with-sources-metadata`: Adds a workspace-sources key to the root package.json with
  metadata about how imports map to source files, e.g. `lib` -> `src`, maybe useful for
  other tools, such as webpack, for building aliases.
