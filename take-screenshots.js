const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Helper to wait for a specific time
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function takeScreenshot(page, filename, description) {
  console.log(`📸 Capturing: ${description}...`);
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`✅ Saved: ${filename}`);
}

async function login(page) {
  console.log('🔐 Logging in...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await wait(1000);
  
  // Take login page screenshot
  await takeScreenshot(page, '01-login-page.png', 'Login Page');
  
  // Fill login form
  await page.type('input#username', ADMIN_CREDENTIALS.username);
  await page.type('input#password', ADMIN_CREDENTIALS.password);
  
  // Click login button
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  await wait(1000);
  
  console.log('✅ Logged in successfully');
}

async function captureAllScreenshots() {
  console.log('🚀 Starting screenshot capture process...\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  try {
    // 1. Login and capture login page
    await login(page);
    
    // 2. Dashboard
    console.log('\n📊 Capturing Dashboard...');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
    await wait(1500);
    await takeScreenshot(page, '02-dashboard.png', 'Dashboard Home');
    
    // 3. Users Management
    console.log('\n👥 Capturing Users Management...');
    await page.goto(`${BASE_URL}/dashboard/users`, { waitUntil: 'networkidle2' });
    await wait(2000);
    await takeScreenshot(page, '03-users-list.png', 'Users List');
    
    // 4. Add User Modal
    try {
      const addUserButton = await page.$('button:has-text("Add User")');
      if (addUserButton) {
        await addUserButton.click();
        await wait(1000);
        await takeScreenshot(page, '04-users-add-modal.png', 'Add User Modal');
        await page.keyboard.press('Escape');
        await wait(500);
      }
    } catch (e) {
      console.log('⚠️  Add User button not found, trying alternative selector...');
      try {
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const addBtn = buttons.find(btn => btn.textContent.includes('Add User'));
          if (addBtn) addBtn.click();
        });
        await wait(1000);
        await takeScreenshot(page, '04-users-add-modal.png', 'Add User Modal');
        await page.keyboard.press('Escape');
        await wait(500);
      } catch (e2) {
        console.log('⚠️  Could not capture Add User modal');
      }
    }
    
    // 5. User Bulk Upload Modal
    try {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const bulkBtn = buttons.find(btn => btn.textContent.includes('Bulk Upload'));
        if (bulkBtn) bulkBtn.click();
      });
      await wait(1000);
      await takeScreenshot(page, '05-users-bulk-upload.png', 'User Bulk Upload Modal');
      await page.keyboard.press('Escape');
      await wait(500);
    } catch (e) {
      console.log('⚠️  Could not capture User Bulk Upload modal');
    }
    
    // 6. User Upload History
    await page.goto(`${BASE_URL}/dashboard/users/upload-history`, { waitUntil: 'networkidle2' });
    await wait(2000);
    await takeScreenshot(page, '06-users-upload-history.png', 'User Upload History');
    
    // 7. Role Management
    console.log('\n🔑 Capturing Role Management...');
    await page.goto(`${BASE_URL}/dashboard/roles`, { waitUntil: 'networkidle2' });
    await wait(2000);
    await takeScreenshot(page, '07-roles-list.png', 'Role Management Page');
    
    // 8. Select a role to show permissions
    try {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const adminBtn = buttons.find(btn => btn.textContent.includes('Admin'));
        if (adminBtn) adminBtn.click();
      });
      await wait(1000);
      await takeScreenshot(page, '08-roles-permissions.png', 'Role Permissions Matrix');
    } catch (e) {
      console.log('⚠️  Could not capture role permissions');
    }
    
    // 9. Dealers Management
    console.log('\n🏪 Capturing Dealers Management...');
    await page.goto(`${BASE_URL}/dashboard/dealers`, { waitUntil: 'networkidle2' });
    await wait(2000);
    await takeScreenshot(page, '09-dealers-list.png', 'Dealers List');
    
    // 10. Scroll to show pagination
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await wait(500);
    await takeScreenshot(page, '10-dealers-pagination.png', 'Dealers Pagination Controls');
    
    // 11. Add Dealer Form
    try {
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await wait(500);
      
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const createBtn = buttons.find(btn => btn.textContent.includes('Create Dealer'));
        if (createBtn) createBtn.click();
      });
      await wait(1000);
      await takeScreenshot(page, '11-dealers-add-form.png', 'Add Dealer Form');
      await page.keyboard.press('Escape');
      await wait(500);
    } catch (e) {
      console.log('⚠️  Could not capture Add Dealer form');
    }
    
    // 12. Dealer Bulk Upload Modal
    try {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const bulkBtn = buttons.find(btn => btn.textContent.includes('Bulk Upload'));
        if (bulkBtn) bulkBtn.click();
      });
      await wait(1000);
      await takeScreenshot(page, '12-dealers-bulk-upload.png', 'Dealer Bulk Upload Modal');
      await page.keyboard.press('Escape');
      await wait(500);
    } catch (e) {
      console.log('⚠️  Could not capture Dealer Bulk Upload modal');
    }
    
    // 13. Dealer Upload History
    await page.goto(`${BASE_URL}/dashboard/dealers/upload-history`, { waitUntil: 'networkidle2' });
    await wait(2000);
    await takeScreenshot(page, '13-dealers-upload-history.png', 'Dealer Upload History');
    
    // 14. Sidebar Navigation
    console.log('\n📱 Capturing Sidebar Navigation...');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
    await wait(1500);
    await takeScreenshot(page, '14-sidebar-navigation.png', 'Sidebar Navigation');
    
    console.log('\n✅ All screenshots captured successfully!');
    
  } catch (error) {
    console.error('❌ Error during screenshot capture:', error);
  } finally {
    await browser.close();
  }
}

async function createZipFile() {
  console.log('\n📦 Creating zip file...');
  const date = new Date().toISOString().split('T')[0];
  const zipFilename = `dealer-payout-portal-screenshots-${date}.zip`;
  
  try {
    // Create zip file
    await execAsync(`cd screenshots && zip -r ../${zipFilename} . && cd ..`);
    
    const stats = fs.statSync(zipFilename);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log('\n✅ SUCCESS!');
    console.log('================================================');
    console.log(`Screenshots zip file created: ${zipFilename}`);
    console.log(`Location: ${__dirname}/${zipFilename}`);
    console.log(`Size: ${fileSizeInMB} MB`);
    console.log(`Total screenshots: ${fs.readdirSync(SCREENSHOTS_DIR).length}`);
    console.log('================================================\n');
    
    return zipFilename;
  } catch (error) {
    console.error('❌ Error creating zip file:', error);
    throw error;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  Dealer Payout Portal Screenshot Generator    ║');
  console.log('╚════════════════════════════════════════════════╝\n');
  
  // Check if application is running
  console.log('🔍 Checking if application is running on http://localhost:3000...\n');
  
  try {
    const response = await fetch(BASE_URL).catch(() => null);
    if (!response) {
      console.error('❌ Application is not running!');
      console.error('Please start the application first:');
      console.error('   npm run dev:all\n');
      process.exit(1);
    }
    
    console.log('✅ Application is running!\n');
    
    // Capture all screenshots
    await captureAllScreenshots();
    
    // Create zip file
    const zipFilename = await createZipFile();
    
    console.log('🎉 Screenshot capture completed successfully!');
    console.log(`\nYou can now commit and push the screenshots:`);
    console.log(`   git add screenshots/ ${zipFilename}`);
    console.log(`   git commit -m "Add UI screenshots and documentation"`);
    console.log(`   git push origin main\n`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main();
