(function() {
    // Configuration
    const config = {
        baseUrl: 'https://chatbotspa.vercel.app',
        buttonSize: '70px',
        expandedWidth: '420px',
        expandedHeight: '650px',
        position: {
            bottom: '20px',
            right: '20px'
        }
    };

    // Create and configure iframe
    const iframe = document.createElement('iframe');
    
    // Start with minimal size for just the chat button
    iframe.style.cssText = `
        position: fixed;
        bottom: ${config.position.bottom};
        right: ${config.position.right};
        width: ${config.buttonSize};
        height: ${config.buttonSize};
        border: 0;
        background: transparent;
        z-index: 999999;
        transition: all 0.3s ease;
        opacity: 0;
    `;
    
    // Set the correct source URL (without /embed)
    iframe.src = config.baseUrl;

    // Handle iframe load event
    iframe.onload = function() {
        iframe.style.opacity = '1';
        console.log('Chat widget loaded successfully');
    };

    // Handle iframe error
    iframe.onerror = function(error) {
        console.error('Error loading chat widget:', error);
    };

    // Append iframe to body
    document.body.appendChild(iframe);

    // Listen for messages from the chat widget
    window.addEventListener('message', function(event) {
        if (event.origin === config.baseUrl) {
            console.log('Received message from chat:', event.data);
            
            if (event.data === 'expand') {
                // Expand iframe when chat is opened
                iframe.style.width = config.expandedWidth;
                iframe.style.height = config.expandedHeight;
            } else if (event.data === 'minimize') {
                // Minimize iframe when chat is closed
                iframe.style.width = config.buttonSize;
                iframe.style.height = config.buttonSize;
            }
        }
    });

    // Log initialization
    console.log('Chat widget initialized');
})();