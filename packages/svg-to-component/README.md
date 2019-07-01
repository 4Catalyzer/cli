# `svg2c`

Optimize and convert SVG files into React components via SVGO.

```sh
svg2c 'svgs/**' --out-dir src/assets
```

That's it, `svg2c` will make sure to convert attributes to the proper case and any
other React specific things that need to be done. You can then require the generated files in your react app and they will render as normal. `refs` are automatically forwarded to the `<svg>` element.

## Customizing

If you want to customize the output a bit more you can provide a [SVGO](https://github.com/svg/svgo) config with any plugins or settings you like.

```json
{
  "plugins": [
    {
      "addAttributesToSVGElement": {
        "attributes": [{ "fill": "currentColor" }, { "aria-hidden": true }]
      }
    }
  ]
}
```

and

```sh
svg2c 'svgs/**' --out-dir src/assets --config ./config.json
```

## webpack loader

If you want integrate your svg to components into your apps webpack build pipeline
there is a loader for you.

```js
{
  // ...
  module: {
    rules: [
      // ...
      {
        test: /.+\.svg$/,
        include: 'svgs/',
        use: {
          loader: 'svg2c/loader',
          options: {
            esModules: true, // output es modules instead of commonJs
            config: {
              // any optional customizing SVGO config can be added
            },
          },
        },
      },
    ];
  }
}
```
