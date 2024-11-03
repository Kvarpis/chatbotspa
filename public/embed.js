(function() {
    const iframe = document.createElement('iframe');
    
    // Start with minimal size for just the chat button
    iframe.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 70px;
      height: 70px;
      border: 0;
      background: transparent;
      z-index: 999999;
      transition: all 0.3s ease;
    `;
    
    iframe.src = 'https://chatbotspa.vercel.app/embed';
    document.body.appendChild(iframe);

    // Listen for messages from the chat widget
    window.addEventListener('message', function(event) {
        if (event.origin === 'https://chatbotspa.vercel.app') {
            if (event.data === 'expand') {
                // Expand iframe when chat is opened
                iframe.style.width = '420px';
                iframe.style.height = '650px';
            } else if (event.data === 'minimize') {
                // Minimize iframe when chat is closed
                iframe.style.width = '70px';
                iframe.style.height = '70px';
            }
        }
    });
})();