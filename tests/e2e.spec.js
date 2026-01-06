import { test, expect } from '@playwright/test';

test.describe('AI Task Manager E2E Tests', () => {
  
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('AI Task Manager');
    await page.screenshot({ path: 'screenshots/app-loaded.png', fullPage: true });
  });

  test('should navigate between tabs', async ({ page }) => {
    await page.goto('/');
    
    // Chat tab screenshot
    await page.click('button:has-text("💬 Chat")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/chat-tab.png', fullPage: true });
    
    // Tasks tab screenshot
    await page.click('button:has-text("📋 Tasks")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/tasks-tab.png', fullPage: true });
    
    // Gantt tab screenshot
    await page.click('button:has-text("📊 Gantt Chart")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/gantt-tab.png', fullPage: true });
  });

  test('should create a new task', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to chat tab
    await page.click('button:has-text("💬 Chat")');
    
    // Fill task form
    const taskInput = page.locator('textarea.task-input');
    await taskInput.fill('タイトル：テスト用タスク\\n担当：テストユーザー\\n期間：今日から3日');
    
    // Select priority
    await page.selectOption('select.priority-select', 'High');
    
    // Take screenshot before submission
    await page.screenshot({ path: 'screenshots/task-form-filled.png', fullPage: true });
    
    // Submit task (mock API response)
    await page.route('**/chat', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          issueId: 'test-12345678',
          message: 'Task created successfully'
        })
      });
    });
    
    await page.click('button:has-text("タスク作成")');
    
    // Verify success message
    await expect(page.locator('.message.assistant')).toContainText('Task #12345678 created successfully!');
    
    // Take screenshot after task creation
    await page.screenshot({ path: 'screenshots/task-created.png', fullPage: true });
  });

  test('should display tasks in tasks tab', async ({ page }) => {
    await page.goto('/');
    
    // Mock API response for tasks
    await page.route('**/issues', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'test-task-1',
            title: 'テスト用タスク1',
            assigneeId: 'テストユーザー',
            startDate: '2025-01-15',
            endDate: '2025-01-18',
            priority: 2,
            status: 'Open',
            projectId: 'default'
          }
        ])
      });
    });
    
    // Mock API response for projects
    await page.route('**/projects', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'default', name: 'Default Project' }
        ])
      });
    });
    
    await page.click('button:has-text("📋 Tasks")');
    await page.waitForTimeout(2000);
    
    // Verify task is displayed
    await expect(page.locator('.issue-title')).toContainText('テスト用タスク1');
    
    // Take screenshot of tasks view
    await page.screenshot({ path: 'screenshots/tasks-with-data.png', fullPage: true });
  });

  test('should display gantt chart', async ({ page }) => {
    await page.goto('/');
    
    // Mock API responses
    await page.route('**/issues', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'gantt-task-1',
            title: 'ガントテスト',
            assigneeId: 'ユーザー1',
            startDate: '2025-01-15',
            endDate: '2025-01-20',
            priority: 2,
            status: 'In Progress',
            projectId: 'default'
          }
        ])
      });
    });
    
    await page.route('**/projects', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'default', name: 'Default Project' }
        ])
      });
    });
    
    await page.click('button:has-text("📊 Gantt Chart")');
    await page.waitForTimeout(2000);
    
    // Verify gantt elements are present
    await expect(page.locator('.gantt-container')).toBeVisible();
    await expect(page.locator('.gantt-bar')).toBeVisible();
    
    // Take screenshot of gantt chart
    await page.screenshot({ path: 'screenshots/gantt-with-data.png', fullPage: true });
  });

  test('should handle project creation', async ({ page }) => {
    await page.goto('/');
    
    // Mock projects API
    await page.route('**/projects', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 'default', name: 'Default Project' }])
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, id: 'new-project' })
        });
      }
    });
    
    // Click new project button
    await page.click('button:has-text("➕ 新規")');
    
    // Fill project name
    await page.fill('input[placeholder="プロジェクト名"]', 'テストプロジェクト');
    
    // Take screenshot of modal
    await page.screenshot({ path: 'screenshots/project-modal.png', fullPage: true });
    
    // Submit project
    await page.click('button:has-text("作成")');
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/project-created.png', fullPage: true });
  });
});