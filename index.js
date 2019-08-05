const createError = require('http-errors');

class DynamicGroupPlugin {
  constructor(config, stuff) {
    this.logger = stuff.logger;
  }

  allow_action(action) {
    return function (user, pkg, callback) {
      const {
        name,
        groups
      } = user;
      const hasPermission = pkg[action].some(group => name === group || groups.includes(group));

      const pkgName = pkg.name;
      const isOrgPackage = pkgName.startsWith('@');
      const orgEnd = pkgName.indexOf('/');
      if (isOrgPackage && orgEnd > 0) {
        // scoped package, check for special scoping rules
        const orgName = pkgName.slice(1, orgEnd);
        if (groups.includes(orgName) && pkg[action].includes('$group')) {
          // User is in the group named like the package scope, allow it.
          return callback(null, true);
        }
      }

      if (hasPermission) {
        return callback(null, true);
      }

      if (name) {
        callback(createError(403, `user ${name} is not allowed to ${action} package ${pkg.name}`));
      } else {
        callback(createError(401, `authorization required to ${action} package ${pkg.name}`));
      }
    };
  }

  allow_access(user, pkg, callback) {
    this.allow_action('access')(user, pkg, callback);
  }
  allow_publish(user, pkg, callback) {
    this.allow_action('publish')(user, pkg, callback);
  }
  allow_unpublish(user, pkg, callback) {
    const action = 'unpublish';
    const hasSupport = pkg[action] == null ? false : pkg[action];

    if (hasSupport === false) {
      return callback(null, undefined);
    }

    return this.allow_action(action)(user, pkg, callback);
  }
}

module.exports = (cfg, stuff) => new DynamicGroupPlugin(cfg, stuff);
