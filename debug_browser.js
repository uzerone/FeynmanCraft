const puppeteer = require('puppeteer');

(async () => {
    try {
        console.log('Starting browser test...');
        
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Listen for console logs
        page.on('console', msg => {
            console.log('Browser console:', msg.type(), msg.text());
        });
        
        // Listen for errors
        page.on('error', err => {
            console.log('Page error:', err.message);
        });
        
        page.on('pageerror', err => {
            console.log('Page script error:', err.message);
        });
        
        console.log('Navigating to frontend...');
        await page.goto('http://localhost:5176/app/', {
            waitUntil: 'networkidle0',
            timeout: 10000
        });
        
        console.log('Page loaded, checking content...');
        
        // Wait a moment for React to render
        await page.waitForTimeout(2000);
        
        // Get the HTML content
        const content = await page.content();
        console.log('Page title:', await page.title());
        console.log('Root element exists:', await page.$('#root') !== null);
        
        // Check if there's any content in the root element
        const rootContent = await page.evaluate(() => {
            const root = document.getElementById('root');
            return root ? root.innerHTML.length : 0;
        });
        
        console.log('Root element content length:', rootContent);
        
        if (rootContent === 0) {
            console.log('ROOT IS EMPTY - React app not rendering');
            
            // Check for any JavaScript errors
            const jsErrors = await page.evaluate(() => {
                return window.jsErrors || [];
            });
            console.log('JS Errors:', jsErrors);
        } else {
            console.log('Root has content - React app is rendering');
        }
        
        await browser.close();
        console.log('Browser test completed');
        
    } catch (error) {
        console.error('Browser test failed:', error.message);
    }
})();