import createError from 'http-errors';
import { Client } from 'ldapts';
import { AllowAccess, AuthAccessCallback, AuthCallback, IPluginAuth, Logger, PackageAccess, PluginOptions, RemoteUser } from '@verdaccio/types';

export type LDAPConfig = {
  ldapURL: string;
  allowNonexistingLdapGroups?: boolean;
  bindDN: string;
  bindPW: string;
  groupDN: string;

  syncInterval?: number;
};


export default class DynamicGroupPlugin implements IPluginAuth<LDAPConfig> {
  private logger: Logger;
  private allGroups: string[] = [];
  public constructor(private config: LDAPConfig, stuff: PluginOptions<LDAPConfig>) {
    this.logger = stuff.logger;

    if (config.allowNonexistingLdapGroups) {
      const ldap = new Client({
        url: config.ldapURL,
      });
      this.allGroups = [];
      setInterval(() => {
        ldap.bind(config.bindDN, config.bindPW).then(() => {
          return ldap.search(config.groupDN, {
            scope: 'one',
          });
        }).then(result => {
            this.allGroups = result.searchEntries.map(j => j.cn as string);
            this.logger.info(`Synced groupnames, got ${this.allGroups.length} groups`);
            return ldap.unbind();
        }).catch(err => {
            this.logger.warn({ err }, `Groupname sync failed: ${err}`);
        });
      }, config.syncInterval || 60000);
    }
    return this;
  }

  public authenticate(user: string, password: string, cb: AuthCallback): void {
    cb(null, false);
  }

  allow_action(action: 'access' | 'publish' | 'unpublish') {
    return (user: RemoteUser, p: (AllowAccess | LDAPConfig) & PackageAccess, callback: AuthAccessCallback) => {
      const {
        name: userName,
        groups: userGroups
      } = user;

      // FIXME: Unpublish?!
      const pkg = p as any;

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
      const hasPermission = pkg[action].some((group: string) => userName === group || userGroups.includes(group));
      if (hasPermission) {
        return callback(null, true);
      }

      if (userName) {
        const err: any = createError(403, `user ${userName} is not allowed to ${action} package ${pkg.name}`);
        err.code = 403;
        callback(err, false);
      } else {
        const err: any = createError(401, `authorization required to ${action} package ${pkg.name}`);
        err.code = 401;
        callback(err, false);
      }
    };
  }

  allow_access(user: RemoteUser, pkg: PackageAccess & (AllowAccess | LDAPConfig), cb: AuthAccessCallback): void {
    this.allow_action('access')(user, pkg, cb);
  }

  allow_publish(user: RemoteUser, pkg: PackageAccess & (AllowAccess | LDAPConfig), cb: AuthAccessCallback): void {
    this.allow_action('publish')(user, pkg, cb);
  }
  allow_unpublish(user: RemoteUser, p: PackageAccess & (AllowAccess | LDAPConfig), cb: AuthAccessCallback): void {
    const action = 'unpublish';
    const pkg = p as any;
    const isDefined = pkg[action] === null || pkg[action] === undefined;

    const hasSupport = isDefined ? pkg[action] : false;

    if (hasSupport === false) {
      return cb(null, false);
    }

    return this.allow_action(action)(user, p, cb);
  }
}
