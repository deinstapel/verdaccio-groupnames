[![npm version](https://badge.fury.io/js/verdaccio-groupnames.svg)](https://badge.fury.io/js/verdaccio-groupnames)

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
    unpublish:
```

The above configuration will allow access, when the user is a member of the scope of the npm package.
For example, when user `martin` is member of group `deinstapel`, he has access to packages in `@deinstapel/*`
but not to `@company/*`.

```yaml
# config.yaml

auth:
  groupnames: {}
  # Use other authentication plugins here.
packages:
  '@company/*:
    access: 'fancyCompany-owner fancyCompany-employee'
    publish: 'fancyCompany-owner'
  '@*/*':
    access: '$group'
    publish: '$group'
    unpublish:
```

The above configuration will allow access to packages for @company whenever the user is member of `fancyCompany-owner` or `fancyCompany-employee`, but publish only to `fancyCompany-owner`.
For all other scopes, access is granted when the scope name matches the group name.
