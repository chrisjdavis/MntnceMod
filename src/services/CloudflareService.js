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

      // Log the first few characters of the token for debugging
      console.log('API Token prefix:', config.apiToken.substring(0, 4) + '...');
      console.log('Account ID:', config.accountId);
      console.log('Zone ID:', config.zoneId);
      console.log('KV Namespace ID:', config.kvNamespaceId);

      this.apiToken = config.apiToken;
      this.email = config.email;
      this.accountId = config.accountId;
      this.zoneId = config.zoneId;
      this.kvNamespaceId = config.kvNamespaceId;
      this.workerName = config.workerName || 'maintenance-worker';

      // Test the token immediately
      console.log('Testing token verification...');
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
        console.error('Token verification failed:', response.data);
        throw new Error('Invalid Cloudflare API token');
      }

      console.log('Token verification successful');
      return true;
    } catch (error) {
      console.error('Error initializing Cloudflare service:', error.response?.data || error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers
      });
      throw new Error(`Failed to initialize Cloudflare service: ${error.message}`);
    }
  }

  async testConnection() {
    console.log('Starting testConnection...');
    await this.initialize();
    if (!this.apiToken || !this.zoneId || !this.kvNamespaceId) {
      throw new Error('Cloudflare credentials not configured');
    }

    try {
      // Test API token
      console.log('Testing API token...');
      const tokenResponse = await axios.get(
        `${this.baseUrl}/user/tokens/verify`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('Token verification response:', tokenResponse.data);

      // Test account access
      console.log('Testing account access...');
      await this.testAccountAccess();
      console.log('Account access verified');

      // Test zone access
      console.log('Testing zone access...');
      await this.testZoneAccess();
      console.log('Zone access verified');

      // Test KV access
      console.log('Testing KV access...');
      await this.testKVAccess();
      console.log('KV access verified');

      // Test worker access and create if missing
      console.log('Testing worker access...');
      try {
        const workerResponse = await axios.get(
          `${this.baseUrl}/accounts/${this.accountId}/workers/scripts/${this.workerName}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('Worker exists:', workerResponse.data);
      } catch (error) {
        console.log('Worker access check failed:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        
        if (error.response?.status === 404) {
          console.log('Worker not found, attempting to create new worker...');
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

            console.log('Creating worker with script:', workerScript);
            console.log('Using endpoint:', `${this.baseUrl}/accounts/${this.accountId}/workers/scripts/${this.workerName}`);
            
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
            
            console.log('Worker creation response:', {
              status: createResponse.status,
              data: createResponse.data
            });
            
            if (createResponse.status === 200) {
              console.log('Worker created successfully');
            } else {
              throw new Error('Worker creation failed: ' + JSON.stringify(createResponse.data));
            }
          } catch (createError) {
            console.error('Error creating worker:', {
              status: createError.response?.status,
              data: createError.response?.data,
              message: createError.message,
              headers: createError.response?.headers
            });
            throw new Error(`Failed to create worker: ${createError.message}`);
          }
        } else {
          throw error;
        }
      }

      return true;
    } catch (error) {
      console.error('Error testing Cloudflare connection:', error);
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
      console.log('Attempting to store page data in KV...');
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
        console.log('Successfully stored page data in KV');
      } catch (error) {
        console.error('KV Storage Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        throw new Error(`Failed to store page data in KV: ${error.message}`);
      }

      console.log('Attempting to deploy worker script...');
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
          console.log('Successfully deleted existing worker script');
        } catch (error) {
          if (error.response?.status !== 404) {
            console.error('Error deleting existing worker script:', error);
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
        console.log('Successfully deployed new worker script');

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
        console.log('Successfully updated worker bindings');
      } catch (error) {
        console.error('Worker Deploy Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        throw new Error(`Failed to deploy worker script: ${error.message}`);
      }

      console.log('Attempting to create/update worker route...');
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
        console.log('Successfully created/updated worker route');
      } catch (error) {
        console.error('Route Creation Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        throw new Error(`Failed to create/update worker route: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error('Cloudflare Deploy Error:', error.response?.data || error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers
      });
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
            console.log('Successfully removed worker route for deactivated page');
          }
        } catch (error) {
          console.error('Error removing worker route:', error);
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
          console.log('Successfully created worker route for activated page');
        } catch (error) {
          console.error('Error creating worker route:', error);
          // Don't throw here - we still want to consider the toggle successful
        }
      }

      return true;
    } catch (error) {
      console.error('Cloudflare Toggle Error:', error);
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
      const pageDataResponse = await axios.get(
        `${this.baseUrl}/accounts/${this.accountId}/storage/kv/namespaces/${this.kvNamespaceId}/values/${domain}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!pageDataResponse || !pageDataResponse.data) {
        console.log('No page data found for domain:', domain);
        return true; // Consider it a success if the page doesn't exist
      }

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

      // Remove the worker route
      try {
        // Get all routes for the zone
        const routesResponse = await axios.get(
          `${this.baseUrl}/zones/${this.zoneId}/workers/routes`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        // Find the route for this domain
        const route = routesResponse.data.result.find(r => r.pattern === `*${domain}/*`);
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
          console.log('Successfully removed worker route');
        }
      } catch (error) {
        console.error('Error removing worker route:', error);
        // Don't throw here - we still want to consider the deletion successful
      }

      return true;
    } catch (error) {
      console.error('Error deleting maintenance page:', error);
      throw new Error('Failed to delete maintenance page from Cloudflare');
    }
  }
}

module.exports = CloudflareService; 