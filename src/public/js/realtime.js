// Initialize SSE connection
function initRealtimeUpdates() {
  const eventSource = new EventSource('/api/events');

  eventSource.onmessage = function(event) {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
      case 'connected':
        break;
      
      case 'limits':
        updateLimitsDisplay(data.limits);
        break;
      
      case 'pageCount':
        updatePageCountDisplay(data.pageCount, data.canCreate);
        break;

      case 'subscription':
        updateSubscriptionDisplay(data.plan);
        break;
    }
  };

  eventSource.onerror = function(error) {
    console.error('EventSource failed:', error);
    eventSource.close();
    // Try to reconnect after 5 seconds
    setTimeout(initRealtimeUpdates, 5000);
  };
}

// Update the page limits display
function updateLimitsDisplay(limits) {
  const limitsElement = document.getElementById('page-limits');
  if (limitsElement) {
    limitsElement.textContent = `${limits.pages} pages`;
  }

  const viewsElement = document.getElementById('views-per-page');
  if (viewsElement) {
    viewsElement.textContent = `${limits.viewsPerPage.toLocaleString()} views`;
  }
}

// Update the page count and create button state
function updatePageCountDisplay(pageCount, canCreate) {
  const pageCountElement = document.getElementById('page-count');
  if (pageCountElement) {
    pageCountElement.textContent = `${pageCount} pages`;
  }

  const createButtonContainer = document.querySelector('.flex.justify-between.items-center.mb-8');
  if (createButtonContainer) {
    const createButton = createButtonContainer.querySelector('a[href="/pages/new"]')?.parentElement;
    const upgradeMessage = createButtonContainer.querySelector('.flex.items-center.space-x-4');
    
    if (createButton && upgradeMessage) {
      if (canCreate) {
        createButton.classList.remove('hidden');
        upgradeMessage.classList.add('hidden');
      } else {
        createButton.classList.add('hidden');
        upgradeMessage.classList.remove('hidden');
      }
    }
  }
}

// Update the subscription plan display
function updateSubscriptionDisplay(plan) {
  const planElement = document.querySelector('td .text-sm .text-gray-400');
  if (planElement) {
    planElement.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
  }
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', initRealtimeUpdates); 