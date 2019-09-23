const createError = require('http-errors');
const { Client } = require('ldapts');

class DynamicGroupPlugin {
  constructor(config, stuff) {
    this.logger = stuff.logger;
    this.config = config;

    if (config.allowNonexistingLdapGroups) {
      this.ldap = new Client({
        url: config.ldapURL,
      });
      this.allGroups = [];
      setInterval(() => {
        this.ldap.bind(config.bindDN, config.bindPW).then(() => {
          return this.ldap.search(config.groupDN, {
            scope: 'one',
          });
        }).then(result => {
            this.allGroups = result.searchEntries.map(j => j.cn);
            this.logger.info(`Synced groupnames, got ${this.allGroups.length} groups`);
            return this.ldap.unbind();
        }).catch(err => {
            this.logger.warn({ err }, `Groupname sync failed: ${err}`);
        });
      }, config.syncInterval || 60000);
    }
  }

  allow_action(action) {
    return function (user, pkg, callback) {
      const {
        name: userName,
        groups: userGroups
      } = user;


      // Split pkgName
      const pkgName = pkg.name;
      const isOrgPackage = pkgName.startsWith('@');
      const orgEnd = pkgName.indexOf('/');

      if (isOrgPackage && orgEnd > 0) {
        // scoped package, check for special scoping rules
        // orgName contains the organization name.
        const orgName = pkgName.slice(1, orgEnd);

        // Wildcard group access
        const userHasDirectAccess = userGroups.includes(orgName) && pkg[action].includes('$group');

        // Groups which are not contained in the ldap server
        const groupNotManagedByLdap = this.config.allowNonexistingLdapGroups && this.allGroups.findIndex(g => g === orgName) === -1;

        if (userHasDirectAccess || groupNotManagedByLdap) {
          // User is in the group named like the package scope, allow it.
          return callback(null, true);
        }
      }

      // Direct group access.
      const hasPermission = pkg[action].some(group => userName === group || userGroups.includes(group));
      if (hasPermission) {
        return callback(null, true);
      }

      if (userName) {
        callback(createError(403, `user ${userName} is not allowed to ${action} package ${pkg.name}`));
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
    const isDefined = pkg[action] === null || pkg[action] === undefined;

    const hasSupport = isDefined ? pkg[action] : false;

    if (hasSupport === false) {
      return callback(null, undefined);
    }

    return this.allow_action(action)(user, pkg, callback);
  }
}

module.exports = (cfg, stuff) => new DynamicGroupPlugin(cfg, stuff);
