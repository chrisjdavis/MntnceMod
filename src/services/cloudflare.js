const { Cloudflare } = require('cloudflare');

class CloudflareService {
  constructor() {
    this.client = new Cloudflare({
      token: process.env.CLOUDFLARE_API_TOKEN
    });
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    this.zoneId = process.env.CLOUDFLARE_ZONE_ID;
    this.kvNamespaceId = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
  }

  /**
   * Deploy a maintenance page for a domain
   */
  async deployMaintenancePage(domain, pageData) {
    try {
      // Store the page data in KV
      await this.client.kv.put(this.kvNamespaceId, domain, JSON.stringify(pageData));

      // Create DNS record if needed
      await this.createDNSRecord(domain);

      // Create worker route
      await this.createWorkerRoute(domain);

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
  async createWorkerRoute(domain) {
    try {
      const route = await this.client.workers.createRoute({
        pattern: `*${domain}/*`,
        script: 'maintenance-worker'
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
      await this.client.kv.put(this.kvNamespaceId, domain, JSON.stringify(pageData));
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
      // Remove KV data
      await this.client.kv.delete(this.kvNamespaceId, domain);

      // Remove DNS record
      const records = await this.client.dnsRecords.browse(this.zoneId);
      const record = records.find(r => r.name === domain);
      if (record) {
        await this.client.dnsRecords.del(this.zoneId, record.id);
      }

      // Remove worker route
      const routes = await this.client.workers.listRoutes();
      const route = routes.find(r => r.pattern.includes(domain));
      if (route) {
        await this.client.workers.deleteRoute(route.id);
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