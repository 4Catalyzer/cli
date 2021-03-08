# Hook'em - simple git hook configuration

`hookem` turns simple simple CLI commands into git hooks. It's similar to Husky version 4,
but even more minimal.

### Setup

In your `package.json` add a gitHooks key mapping the hook to a command

```json
{
  "gitHooks": {
    "precommit": "eslint ."
  }
}
```

Then add `hookem` to your package, it will install your configured hooks:

```sh
yarn add hookem
```

If you also have hookem installed, you can run

```sh
yarn hookem install
```

to update the locally configured hooks ourside of a yarn/npm install.

### How it works

When `hookem install` runs it creates a hook file in your `.git/hooks` directory
that calls `yarn` or `npx` with the command. That's it!
