// Integration of Iconizer (icon-folder) icons into Vertical Tabs plugin
// This script hooks into the DOM to replace default Vertical Tabs icons with Iconizer ones

const ICONIZER_VERTICAL_TABS = (() => {
    // Store references to required plugins
    let iconFolderPlugin = null;
    let verticalTabsPlugin = null;

    // Configuration options
    const config = {
        debug: true,         // Enable for console debug messages
        updateInterval: 500,  // How often to check for new tabs (in ms)
        observerThrottle: 100 // Throttle for mutation observer
    };

    // Create a global console command for toggling debug mode
    window.toggleIconizerVTabsDebug = () => {
        config.debug = !config.debug;
        console.log(`[Iconizer-VTabs] Debug mode ${config.debug ? 'enabled' : 'disabled'}`);
        return config.debug;
    };

    // Helper to log debug messages
    const debug = (...args) => {
        if (config.debug) {
            console.log('[Iconizer-VTabs]', ...args);
            // Log stack trace for deeper debugging when needed
            if (args[0] === 'ERROR') {
                console.trace('[Iconizer-VTabs] Stack trace:');
            }
        }
    };

    // Get the Iconizer plugin instance
    const getIconFolderPlugin = () => {
        if (iconFolderPlugin) return iconFolderPlugin;

        const plugins = app.plugins.plugins;
        if (plugins['obsidian-icon-folder']) {
            iconFolderPlugin = plugins['obsidian-icon-folder'];
            debug('Found Iconizer plugin:', iconFolderPlugin);
            return iconFolderPlugin;
        }

        debug('Iconizer plugin not found');
        return null;
    };

    // Get the Vertical Tabs plugin instance
    const getVerticalTabsPlugin = () => {
        if (verticalTabsPlugin) return verticalTabsPlugin;

        const plugins = app.plugins.plugins;
        if (plugins['vertical-tabs']) {
            verticalTabsPlugin = plugins['vertical-tabs'];
            debug('Found Vertical Tabs plugin:', verticalTabsPlugin);
            return verticalTabsPlugin;
        }

        debug('Vertical Tabs plugin not found');
        return null;
    };

    // Find the vertical tabs container element
    const findVerticalTabsContainer = () => {
        // Look for the vertical tabs container by its class
        return document.querySelector('.vertical-tabs-container') ||
            document.querySelector('.vertical-tab-content-container');
    };

    // Get file path from a tab element
    const getFilePathFromTab = (tabElement) => {
        // Try to extract the path using data attributes or other identifiers
        // This may need adjusting based on how Vertical Tabs stores the file path

        // Method 1: Check for data attributes
        if (tabElement.hasAttribute('data-path')) {
            return tabElement.getAttribute('data-path');
        }

        // Method 2: Look for title attribute (often contains the file path)
        if (tabElement.hasAttribute('title')) {
            const title = tabElement.getAttribute('title');
            // Convert title to path if needed
            return title;
        }

        // Method 3: Try to find a child element that might contain the path
        const pathElement = tabElement.querySelector('[data-path]');
        if (pathElement) {
            return pathElement.getAttribute('data-path');
        }

        // Method 4: Get text content of a child element that shows the filename
        const titleElement = tabElement.querySelector('.vertical-tab-title');
        if (titleElement) {
            // This is just the name, not the full path, which is less ideal
            return titleElement.textContent;
        }

        debug('Could not determine file path for tab:', tabElement);
        return null;
    };

    // Apply Iconizer icon to a tab element
    const applyIconToTab = (tabElement, path) => {
        if (!path) {
            debug('No path provided for tab element', tabElement);
            return;
        }

        debug('Applying icon to tab with path:', path);

        const iconFolderPlugin = getIconFolderPlugin();
        if (!iconFolderPlugin) {
            debug('Icon folder plugin not available');
            return;
        }

        // Find the icon element within the tab
        const iconElement = tabElement.querySelector('.vertical-tab-icon') ||
            tabElement.querySelector('.nav-file-icon') ||
            tabElement.querySelector('svg');

        if (!iconElement) {
            debug('Could not find icon element in tab:', tabElement);
            return;
        }

        // Try to get the Iconizer icon for this path
        try {
            debug('Getting icon for path:', path);
            const customIcon = iconFolderPlugin.getIconByPath(iconFolderPlugin, path);
            if (customIcon) {
                debug('Found custom icon for', path, ':', customIcon);

                // Handle different icon types from Iconizer
                if (typeof customIcon === 'string') {
                    // Case 1: It's an emoji
                    if (customIcon.length <= 4 && /\p{Emoji}/u.test(customIcon)) {
                        iconElement.innerHTML = `<span class="emoji-icon">${customIcon}</span>`;
                        iconElement.classList.add('has-custom-icon');
                    }
                    // Case 2: It's an SVG icon name or HTML
                    else if (customIcon.includes('<svg') || customIcon.includes('lucide-')) {
                        iconElement.outerHTML = customIcon;
                    }
                    // Case 3: It's a CSS class for an icon
                    else {
                        const oldClasses = Array.from(iconElement.classList)
                            .filter(cls => cls.startsWith('lucide-') || cls.includes('icon-'));

                        oldClasses.forEach(cls => {
                            iconElement.classList.remove(cls);
                        });

                        iconElement.classList.add(...customIcon.split(' '));
                    }
                }
            }
        } catch (error) {
            debug('ERROR', 'Error applying icon:', error.message);
            debug('For tab element:', tabElement);
            debug('With path:', path);
        }
    };

    // Process all tabs in the container
    const processAllTabs = () => {
        debug('Processing all tabs...');
        const container = findVerticalTabsContainer();
        if (!container) {
            debug('ERROR', 'Vertical tabs container not found');
            debug('Available containers:', Array.from(document.querySelectorAll('.vertical-tabs-container, .vertical-tab-content-container')));
            return;
        }

        // Find all tab elements 
        const tabs = container.querySelectorAll('.vertical-tab-header');

        debug(`Found ${tabs.length} tabs to process`);

        tabs.forEach((tab, index) => {
            debug(`Processing tab ${index + 1}/${tabs.length}`);
            const path = getFilePathFromTab(tab);
            if (path) {
                debug('Found path for tab:', path);
                applyIconToTab(tab, path);
            } else {
                debug('WARNING: No path found for tab', tab);
            }
        });

        debug('Finished processing all tabs');
    };

    // Setup mutation observer to detect when tabs are added/changed
    const setupObserver = () => {
        const container = findVerticalTabsContainer();
        if (!container) {
            debug('No container found to observe');
            return;
        }

        let throttleTimer;

        const observer = new MutationObserver((mutations) => {
            // Throttle the processing to avoid excessive calls
            if (!throttleTimer) {
                throttleTimer = setTimeout(() => {
                    debug('Mutations detected, processing tabs');
                    processAllTabs();
                    throttleTimer = null;
                }, config.observerThrottle);
            }
        });

        observer.observe(container, {
            childList: true,
            subtree: true,
            attributes: true
        });

        debug('Observer setup for', container);

        return observer;
    };

    // Main initialization function
    const initialize = () => {
        debug('Initializing Iconizer-Vertical Tabs integration');

        // Check that both plugins are available
        const iconizer = getIconFolderPlugin();
        const verticalTabs = getVerticalTabsPlugin();

        if (!iconizer || !verticalTabs) {
            debug('Required plugins not found, will try again later');
            // Try again after a delay in case plugins are still loading
            setTimeout(initialize, 2000);
            return;
        }

        // Process tabs immediately and then set up observer
        processAllTabs();
        const observer = setupObserver();

        // Also set a periodic check as a fallback
        const intervalId = setInterval(processAllTabs, config.updateInterval);

        debug('Initialization complete');

        // Return cleanup function
        return () => {
            debug('Cleaning up');
            if (observer) observer.disconnect();
            clearInterval(intervalId);
        };
    };

    // Start the integration when document is fully loaded
    document.addEventListener('DOMContentLoaded', initialize);

    // If document is already loaded, initialize now
    if (document.readyState === 'complete') {
        initialize();
    }

    // Return public interface
    return {
        initialize,
        processAllTabs,
        setDebug: (value) => {
            config.debug = value;
            console.log(`[Iconizer-VTabs] Debug mode ${value ? 'enabled' : 'disabled'}`);
        },
        getDebugStatus: () => config.debug,
        forceRefresh: () => {
            console.log('[Iconizer-VTabs] Forcing refresh of all tabs');
            processAllTabs();
        }
    };
})();

// Automatically start the integration
ICONIZER_VERTICAL_TABS.initialize();

// Log instructions for debugging
console.log('[Iconizer-VTabs] Integration started.');
console.log('[Iconizer-VTabs] Debug mode is ' + (ICONIZER_VERTICAL_TABS.getDebugStatus() ? 'enabled' : 'disabled'));
console.log('[Iconizer-VTabs] Available console commands:');
console.log('  - toggleIconizerVTabsDebug() - Toggle debug mode');
console.log('  - ICONIZER_VERTICAL_TABS.forceRefresh() - Force refresh all tabs');
console.log('  - ICONIZER_VERTICAL_TABS.setDebug(true/false) - Set debug mode');
