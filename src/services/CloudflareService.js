const axios = require('axios');
const CloudflareConfig = require('../models/CloudflareConfig');

class CloudflareService {
  constructor(user) {
    this.user = user;
    this.apiToken = null;
    this.email = null;
    this.accountId = null;
    this.zoneId = null;
    this.kvNamespaceId = null;
    this.workerName = 'maintenance-worker';
    this.baseUrl = 'https://api.cloudflare.com/client/v4';
  }

  async initialize() {
    try {
      const config = await CloudflareConfig.findOne({ user: this.user._id }).select('+apiToken');
      if (!config) {
        throw new Error('Cloudflare credentials not configured');
      }

      if (!config.apiToken) {
        throw new Error('Cloudflare API token is missing');
      }

      this.apiToken = config.apiToken;
      this.email = config.email;
      this.accountId = config.accountId;
      this.zoneId = config.zoneId;
      this.kvNamespaceId = config.kvNamespaceId;
      this.workerName = config.workerName || 'maintenance-worker';

      // Test the token immediately
      const response = await axios.get(
        `${this.baseUrl}/user/tokens/verify`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.success) {
        throw new Error('Invalid Cloudflare API token');
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to initialize Cloudflare service: ${error.message}`);
    }
  }

  async testConnection() {
    await this.initialize();
    if (!this.apiToken || !this.zoneId || !this.kvNamespaceId) {
      throw new Error('Cloudflare credentials not configured');
    }

    try {
      // Test API token
      const tokenResponse = await axios.get(
        `${this.baseUrl}/user/tokens/verify`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Test account access
      await this.testAccountAccess();

      // Test zone access
      await this.testZoneAccess();

      // Test KV access
      await this.testKVAccess();

      // Test worker access and create if missing
      try {
        await axios.get(
          `${this.baseUrl}/accounts/${this.accountId}/workers/scripts/${this.workerName}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (error) {
        if (error.response?.status === 404) {
          try {
            // Create a new worker with a basic script
            const workerScript = `addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  return new Response('Maintenance worker is ready', {
    headers: { 'content-type': 'text/plain' },
  })
}`;

            const createResponse = await axios.put(
              `${this.baseUrl}/accounts/${this.accountId}/workers/scripts/${this.workerName}`,
              workerScript,
              {
                headers: {
                  'Authorization': `Bearer ${this.apiToken}`,
                  'Content-Type': 'application/javascript'
                }
              }
            );
            
            if (createResponse.status !== 200) {
              throw new Error('Worker creation failed: ' + JSON.stringify(createResponse.data));
            }
          } catch (createError) {
            throw new Error(`Failed to create worker: ${createError.message}`);
          }
        } else {
          throw error;
        }
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  async deployPage(page) {
    await this.initialize();
    if (!this.apiToken || !this.zoneId || !this.kvNamespaceId) {
      throw new Error('Cloudflare credentials not configured');
    }

    // Clean up the page data before storing in KV
    const pageData = {
      title: page.title,
      description: page.description,
      content: page.content,
      status: page.status,
      domain: page.domain,
      design: {
        backgroundColor: page.design.backgroundColor,
        textColor: page.design.textColor,
        fontFamily: page.design.fontFamily,
        maxWidth: page.design.maxWidth,
        layout: page.design.layout,
        logo: page.design.logo,
        logoSize: page.design.logoSize,
        customCSS: page.design.customCSS
      },
      updatedAt: page.updatedAt
    };

    try {
      try {
        // Store the page data in KV using the correct API endpoint
        await axios.put(
          `${this.baseUrl}/accounts/${this.accountId}/storage/kv/namespaces/${this.kvNamespaceId}/values/${page.domain}`,
          JSON.stringify(pageData),
          {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (error) {
        throw new Error(`Failed to store page data in KV: ${error.message}`);
      }

      try {
        // First, try to delete the existing worker script
        try {
          await axios.delete(
            `${this.baseUrl}/accounts/${this.accountId}/workers/scripts/${this.workerName}`,
            {
              headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
        } catch (error) {
          if (error.response?.status !== 404) {
            throw error;
          }
        }

        // Deploy the new worker script
        const workerScript = this.generateWorkerScript(page);
        
        // Deploy the worker script with content-type: application/javascript
        await axios.put(
          `${this.baseUrl}/accounts/${this.accountId}/workers/scripts/${this.workerName}`,
          workerScript,
          {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
              'Content-Type': 'application/javascript'
            }
          }
        );

        // Update the worker bindings
        await axios.put(
          `${this.baseUrl}/accounts/${this.accountId}/workers/scripts/${this.workerName}/bindings`,
          {
            bindings: [
              {
                type: 'kv_namespace',
                name: 'MAINTENANCE_PAGES',
                namespace_id: this.kvNamespaceId
              }
            ]
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (error) {
        throw new Error(`Failed to deploy worker script: ${error.message}`);
      }

      try {
        // First, try to get existing routes
        const routesResponse = await axios.get(
          `${this.baseUrl}/zones/${this.zoneId}/workers/routes`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`
            }
          }
        );

        // Find if there's an existing route for this domain
        const existingRoute = routesResponse.data.result.find(
          route => route.pattern === `*${page.domain}/*`
        );

        if (existingRoute) {
          // Update existing route
          await axios.put(
            `${this.baseUrl}/zones/${this.zoneId}/workers/routes/${existingRoute.id}`,
            {
              pattern: `*${page.domain}/*`,
              script: this.workerName
            },
            {
              headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
        } else {
          // Create new route
          await axios.post(
            `${this.baseUrl}/zones/${this.zoneId}/workers/routes`,
            {
              pattern: `*${page.domain}/*`,
              script: this.workerName
            },
            {
              headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
        }
      } catch (error) {
        throw new Error(`Failed to create/update worker route: ${error.message}`);
      }

      return true;
    } catch (error) {
      throw new Error('Failed to deploy page to Cloudflare');
    }
  }

  async togglePage(page, newStatus) {
    await this.initialize();
    if (!this.apiToken || !this.zoneId || !this.kvNamespaceId) {
      throw new Error('Cloudflare credentials not configured');
    }

    try {
      // Update the page status in KV
      const pageData = await axios.get(
        `${this.baseUrl}/accounts/${this.accountId}/storage/kv/namespaces/${this.kvNamespaceId}/values/${page.domain}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const updatedData = {
        ...pageData.data,
        status: newStatus
      };

      await axios.put(
        `${this.baseUrl}/accounts/${this.accountId}/storage/kv/namespaces/${this.kvNamespaceId}/values/${page.domain}`,
        JSON.stringify(updatedData),
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Update the page status in the app's database
      page.status = newStatus;
      await page.save();

      // If deactivating, remove the worker route
      if (newStatus === 'draft') {
        try {
          // Get all routes for the zone
          const routes = await axios.get(
            `${this.baseUrl}/zones/${this.zoneId}/workers/routes`,
            {
              headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
              }
            }
          );

          // Find the route for this domain
          const route = routes.data.result.find(r => r.pattern === `*${page.domain}/*`);
          if (route) {
            // Delete the route
            await axios.delete(
              `${this.baseUrl}/zones/${this.zoneId}/workers/routes/${route.id}`,
              {
                headers: {
                  'Authorization': `Bearer ${this.apiToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );
          }
        } catch (error) {
          // Don't throw here - we still want to consider the toggle successful
        }
      } else {
        // If activating, ensure the route exists
        try {
          await axios.post(
            `${this.baseUrl}/zones/${this.zoneId}/workers/routes`,
            {
              pattern: `*${page.domain}/*`,
              script: this.workerName
            },
            {
              headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
        } catch (error) {
          // Don't throw here - we still want to consider the toggle successful
        }
      }

      return true;
    } catch (error) {
      throw new Error('Failed to update page status in Cloudflare');
    }
  }

  generateWorkerScript(page) {
    // Render the HTML with the page data
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: ${page.design.fontFamily};
      background-color: ${page.design.backgroundColor};
      color: ${page.design.textColor};
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .container {
      max-width: ${page.design.maxWidth}px;
      padding: 2rem;
      text-align: center;
    }
    .logo {
      max-width: ${page.design.logoSize}px;
      margin-bottom: 2rem;
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    p {
      font-size: 1.2rem;
      line-height: 1.6;
    }
    ${page.design.customCSS}
  </style>
</head>
<body>
  <div class="container">
    ${page.design.logo ? `<img src="${page.design.logo}" alt="Logo" class="logo">` : ''}
    <h1>${page.title}</h1>
    <p>${page.description}</p>
    <div>${page.content}</div>
  </div>
</body>
</html>`;

    // Return the worker script that will serve this HTML
    return `
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  return new Response(\`${html}\`, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}`;
  }

  async testToken() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/user/tokens/verify`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return {
        success: true,
        message: 'API Token is valid'
      };
    } catch (error) {
      return {
        success: false,
        message: 'API Token is invalid',
        details: error.response?.data || error.message
      };
    }
  }

  async testAccountAccess() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/accounts/${this.accountId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return {
        success: true,
        message: 'Account access verified',
        details: response.data.result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Account access failed',
        details: error.response?.data || error.message
      };
    }
  }

  async testZoneAccess() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/zones/${this.zoneId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return {
        success: true,
        message: 'Zone access verified',
        details: response.data.result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Zone access failed',
        details: error.response?.data || error.message
      };
    }
  }

  async testWorkerAccess() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/accounts/${this.accountId}/workers/scripts/${this.workerName}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return {
        success: true,
        message: 'Worker access verified',
        details: response.data.result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Worker access failed',
        details: error.response?.data || error.message
      };
    }
  }

  async testKVAccess() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/accounts/${this.accountId}/storage/kv/namespaces/${this.kvNamespaceId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return {
        success: true,
        message: 'KV namespace access verified',
        details: response.data.result
      };
    } catch (error) {
      return {
        success: false,
        message: 'KV namespace access failed',
        details: error.response?.data || error.message
      };
    }
  }

  async deleteMaintenancePage(domain) {
    await this.initialize();
    if (!this.apiToken || !this.zoneId || !this.kvNamespaceId) {
      throw new Error('Cloudflare credentials not configured');
    }

    try {
      // First, try to get the page data to verify it exists
      try {
        const pageDataResponse = await axios.get(
          `${this.baseUrl}/accounts/${this.accountId}/storage/kv/namespaces/${this.kvNamespaceId}/values/${domain}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (pageDataResponse && pageDataResponse.data) {
          // Delete the page data from KV
          await axios.delete(
            `${this.baseUrl}/accounts/${this.accountId}/storage/kv/namespaces/${this.kvNamespaceId}/values/${domain}`,
            {
              headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
        }
      } catch (error) {
        if (error.response?.status !== 404) {
          console.error('Error handling KV operations:', error);
        }
      }

      // Remove the worker route
      try {
        const routesResponse = await axios.get(
          `${this.baseUrl}/zones/${this.zoneId}/workers/routes`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const route = routesResponse.data.result.find(r => r.pattern === `*${domain}/*`);
        if (route) {
          await axios.delete(
            `${this.baseUrl}/zones/${this.zoneId}/workers/routes/${route.id}`,
            {
              headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
        }
      } catch (error) {
        console.error('Error handling worker route deletion:', error);
      }

      // Remove the DNS record
      try {
        const dnsResponse = await axios.get(
          `${this.baseUrl}/zones/${this.zoneId}/dns_records`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const dnsRecord = dnsResponse.data.result.find(r => r.name === domain);
        if (dnsRecord) {
          await axios.delete(
            `${this.baseUrl}/zones/${this.zoneId}/dns_records/${dnsRecord.id}`,
            {
              headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
        }
      } catch (error) {
        console.error('Error handling DNS record deletion:', error);
      }

      return true;
    } catch (error) {
      console.error('Error in deleteMaintenancePage:', error);
      throw error;
    }
  }
}

module.exports = CloudflareService; 