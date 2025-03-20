const Cloudflare = require('cloudflare');
const CloudflareConfig = require('../models/CloudflareConfig');

class CloudflareService {
  constructor() {
    // Initialize without credentials - they will be set per user
    this.client = null;
  }

  /**
   * Initialize the client with user-specific credentials
   */
  async initializeForUser(userId) {
    try {
      const config = await CloudflareConfig.findOne({ user: userId });
      if (!config) {
        throw new Error('Cloudflare configuration not found');
      }

      // Initialize Cloudflare client with API token
      this.client = new Cloudflare({
        token: config.apiToken,
        email: config.email
      });

      this.accountId = config.accountId;
      this.zoneId = config.zoneId;
      this.kvNamespaceId = config.kvNamespaceId;
      this.workerName = config.workerName;

      // Update last used timestamp
      config.lastUsed = new Date();
      await config.save();

      return true;
    } catch (error) {
      console.error('Error initializing Cloudflare client:', error);
      throw error;
    }
  }

  /**
   * Deploy a maintenance page for a domain
   */
  async deployMaintenancePage(userId, pageData) {
    try {
      await this.initializeForUser(userId);
      const config = await CloudflareConfig.findOne({ user: userId });

      // Create or update the worker
      const workerScript = this.generateWorkerScript(pageData);
      await this.client.workers.putScript(config.workerName, {
        script: workerScript,
        bindings: [
          {
            type: 'kv_namespace',
            name: 'MAINTENANCE_PAGE',
            namespace_id: config.kvNamespaceId
          }
        ]
      });

      // Create or update the route
      await this.createWorkerRoute(config.zoneId, config.workerName);

      return true;
    } catch (error) {
      console.error('Error deploying maintenance page:', error);
      throw error;
    }
  }

  /**
   * Create DNS record for the domain
   */
  async createDNSRecord(domain) {
    try {
      const record = await this.client.dnsRecords.add(this.zoneId, {
        type: 'CNAME',
        name: domain,
        content: `${domain}.workers.dev`,
        proxied: true
      });
      return record;
    } catch (error) {
      console.error('Error creating DNS record:', error);
      throw error;
    }
  }

  /**
   * Create worker route for the domain
   */
  async createWorkerRoute(zoneId, workerName) {
    try {
      const route = await this.client.workers.createRoute({
        pattern: `*${zoneId}/*`,
        script: workerName
      });
      return route;
    } catch (error) {
      console.error('Error creating worker route:', error);
      throw error;
    }
  }

  /**
   * Update maintenance page data
   */
  async updateMaintenancePage(domain, pageData) {
    try {
      await this.client.kv.put(this.kvNamespaceId, `page:${domain}`, JSON.stringify(pageData));
      return true;
    } catch (error) {
      console.error('Error updating maintenance page:', error);
      throw error;
    }
  }

  /**
   * Delete maintenance page
   */
  async deleteMaintenancePage(domain) {
    try {
      // Delete from KV store
      await this.client.kv.deleteValue(this.kvNamespaceId, `page:${domain}`);

      // Delete DNS record
      const records = await this.client.dns.list(this.zoneId);
      const record = records.result.find(r => r.name === domain);
      if (record) {
        await this.client.dns.delete(this.zoneId, record.id);
      }

      // Delete worker route
      const routes = await this.client.workers.listRoutes(this.zoneId);
      const route = routes.result.find(r => r.pattern === domain);
      if (route) {
        await this.client.workers.deleteRoute(this.zoneId, route.id);
      }

      return true;
    } catch (error) {
      console.error('Error deleting maintenance page:', error);
      throw error;
    }
  }

  async storeMaintenancePage(domain, page) {
    try {
      // Store the page data in KV
      const pageData = {
        ...page.toObject(),
        backgroundColor: page.backgroundColor,
        textColor: page.textColor,
        statusBadgeColor: page.statusBadgeColor,
        statusTextColor: page.statusTextColor,
        design: {
          fontFamily: page.design?.fontFamily,
          maxWidth: page.design?.maxWidth,
          layout: page.design?.layout,
          logo: page.design?.logo,
          logoSize: page.design?.logoSize,
          customCSS: page.design?.customCSS
        }
      };
      
      await this.client.kv.put(this.kvNamespaceId, domain, JSON.stringify(pageData));
      
      // Update DNS settings
      await this.updateDNS(domain);
      
      return true;
    } catch (error) {
      console.error('Error storing maintenance page:', error);
      throw error;
    }
  }
}

module.exports = new CloudflareService(); 