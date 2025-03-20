const axios = require('axios');

class CloudflareService {
  constructor(user) {
    this.user = user;
    this.apiToken = user.cloudflare?.apiToken;
    this.zoneId = user.cloudflare?.zoneId;
    this.baseUrl = 'https://api.cloudflare.com/client/v4';
  }

  async deployPage(page) {
    if (!this.apiToken || !this.zoneId) {
      throw new Error('Cloudflare credentials not configured');
    }

    try {
      // Create or update the page in Cloudflare
      const response = await axios.put(
        `${this.baseUrl}/zones/${this.zoneId}/pages/${page._id}`,
        {
          name: page.domain,
          content: this.generatePageContent(page),
          settings: {
            maintenance_mode: true,
            custom_domain: page.domain
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Cloudflare Deploy Error:', error);
      throw new Error('Failed to deploy page to Cloudflare');
    }
  }

  async togglePage(page, newStatus) {
    if (!this.apiToken || !this.zoneId) {
      throw new Error('Cloudflare credentials not configured');
    }

    try {
      // Update the page status in Cloudflare
      const response = await axios.patch(
        `${this.baseUrl}/zones/${this.zoneId}/pages/${page._id}`,
        {
          settings: {
            maintenance_mode: newStatus === 'published'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Cloudflare Toggle Error:', error);
      throw new Error('Failed to update page status in Cloudflare');
    }
  }

  generatePageContent(page) {
    // Generate the HTML content for the maintenance page
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${page.title}</title>
        <style>
          :root {
            --bg-color: ${page.design.backgroundColor};
            --text-color: ${page.design.textColor};
            --font-family: ${page.design.fontFamily};
            --max-width: ${page.design.maxWidth}px;
          }

          body {
            font-family: var(--font-family), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .container {
            width: 100%;
            max-width: var(--max-width);
            margin: 0 auto;
            padding: 2rem;
            box-sizing: border-box;
            text-align: ${page.design.layout === 'left-aligned' ? 'left' : page.design.layout === 'right-aligned' ? 'right' : 'center'};
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }

          .logo {
            margin-bottom: 2rem;
            max-width: ${page.design.logoSize.width}px;
            height: auto;
            display: block;
            margin-left: auto;
            margin-right: auto;
            text-align: center !important;
          }

          .logo-container {
            width: 100%;
            text-align: center;
          }

          h1 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
            font-weight: 700;
          }

          .description {
            font-size: 1.25rem;
            margin-bottom: 2rem;
            opacity: 0.9;
          }

          .content {
            font-size: 1.125rem;
            line-height: 1.6;
            margin-bottom: 2rem;
          }

          .footer {
            width: 100%;
            padding: 1rem;
            text-align: center;
            font-size: 0.875rem;
            opacity: 0.7;
            margin-top: auto;
          }

          ${page.design.customCSS}
        </style>
      </head>
      <body>
        <div class="container">
          ${page.design.logo ? `<div class="logo-container"><img src="${page.design.logo}" alt="Logo" class="logo"></div>` : ''}
          <h1>${page.title}</h1>
          ${page.description ? `<div class="description">${page.description}</div>` : ''}
          <div class="content">${page.content}</div>
        </div>
        <footer class="footer">
          Last updated: ${new Date(page.updatedAt).toLocaleString()}
        </footer>
      </body>
      </html>
    `;
  }
}

module.exports = CloudflareService; 