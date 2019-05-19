# verdaccio-groupnames

Verdaccio Plugin to handle $group in package access specifications

## Installation

```bash
$ npm i -g verdaccio-groupnames
```

## Configuration

```yaml
# config.yaml

auth:
  groupnames: {}
  # Use other authentication plugins here.
packages:
  '@*/*':
    access: '$group'
    publish: '$group'
    unpublish: false
```

The above configuration will allow access, when the user is a member of the scope of the npm package.
For example, when user `martin` is member of group `deinstapel`, he has access to packages in `@deinstapel/*`
but not to `@company/*`.

