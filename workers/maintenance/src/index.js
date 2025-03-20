/**
 * Maintenance page worker script
 * Handles serving maintenance pages for user domains
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function handleRequest(request) {
  const url = new URL(request.url);
  const host = request.headers.get('host');
  
  // Check if this domain has a maintenance page
  const pageData = await MAINTENANCE_PAGES.get(host);
  
  if (!pageData) {
    return new Response('No maintenance page found', { status: 404 });
  }

  try {
    const page = JSON.parse(pageData);
    
    // Check if maintenance mode is active
    if (!page.isActive) {
      return Response.redirect(page.originalUrl || `https://${host}`, 302);
    }

    // Serve the maintenance page
    const html = generateMaintenancePage(page);
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        ...corsHeaders,
      },
    });
  } catch (error) {
    return new Response('Error serving maintenance page', { status: 500 });
  }
}

function generateMaintenancePage(page) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${page.title || 'Site Maintenance'}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --page-bg: ${page.backgroundColor || '#f9fafb'};
            --page-text: ${page.textColor || '#111827'};
            --status-bg: ${page.statusBadgeColor || '#fee2e2'};
            --status-text: ${page.statusTextColor || '#991b1b'};
            --page-font: '${page.design?.fontFamily || 'Inter'}';
            --page-max-width: ${page.design?.maxWidth || 600}px;
        }
        body {
            margin: 0;
            padding: 0;
            font-family: var(--page-font), sans-serif;
            background-color: var(--page-bg);
            color: var(--page-text);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            max-width: var(--page-max-width);
            padding: 2rem;
            text-align: ${page.design?.layout === 'left-aligned' ? 'left' : page.design?.layout === 'right-aligned' ? 'right' : 'center'};
        }
        h1 {
            font-size: 2rem;
            margin-bottom: 1rem;
        }
        .message {
            font-size: 1.1rem;
            margin-bottom: 2rem;
        }
        .status {
            display: inline-block;
            padding: 0.5rem 1rem;
            border-radius: 9999px;
            background: var(--status-bg);
            color: var(--status-text);
            font-size: 0.875rem;
            font-weight: 500;
        }
        ${page.design?.customCSS || ''}
    </style>
</head>
<body>
    <div class="container">
        ${page.design?.logo ? `
            <div class="mb-8 ${page.design.layout === 'left-aligned' ? '' : (page.design.layout === 'right-aligned' ? 'flex justify-end' : 'flex justify-center')}">
                <img src="${page.design.logo}" 
                     alt="${page.title} Logo" 
                     style="width: ${page.design.logoSize?.width || 200}px; height: ${page.design.logoSize?.height || 50}px; object-fit: contain;">
            </div>
        ` : ''}
        <h1>${page.title || 'Site Maintenance'}</h1>
        <p class="message">${page.message || 'We are currently performing scheduled maintenance. We will be back shortly.'}</p>
        <div class="status">${page.status || 'Maintenance in Progress'}</div>
    </div>
</body>
</html>`;
}

addEventListener('fetch', event => {
  if (event.request.method === 'OPTIONS') {
    event.respondWith(new Response(null, {
      headers: corsHeaders
    }));
  } else {
    event.respondWith(handleRequest(event.request));
  }
}); 