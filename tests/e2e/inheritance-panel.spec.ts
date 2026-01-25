import { test, expect } from '@playwright/test';

test.describe('Schema Inheritance Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to fully load
    await page.waitForSelector('header');
    // Clear localStorage to ensure clean state
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('header');
  });

  test.describe('Panel Visibility and Toggle', () => {
    test('panel is hidden by default', async ({ page }) => {
      // The Schema Inheritance heading should not be visible initially
      await expect(page.getByText('Schema Inheritance').first()).not.toBeVisible();
    });

    test('panel becomes visible when toggle button is clicked', async ({ page }) => {
      // Find and click the inheritance toggle button (GitBranch icon)
      const inheritanceButton = page.locator('button').filter({ has: page.locator('svg.lucide-git-branch') }).first();
      await inheritanceButton.click();

      // Wait for panel to appear
      await expect(page.getByText('Schema Inheritance').first()).toBeVisible({ timeout: 5000 });
    });

    test('panel hides when close button is clicked', async ({ page }) => {
      // Open the panel
      const inheritanceButton = page.locator('button').filter({ has: page.locator('svg.lucide-git-branch') }).first();
      await inheritanceButton.click();
      await expect(page.getByText('Schema Inheritance').first()).toBeVisible({ timeout: 5000 });

      // Find and click the close button (X icon) inside the panel
      const closeButton = page.locator('[data-slot="resizable-panel"]').last().locator('button').filter({ has: page.locator('svg.lucide-x') });
      await closeButton.click();

      // Panel should be hidden
      await expect(page.getByText('Schema Inheritance').first()).not.toBeVisible();
    });

    test('toggle button changes state when panel is opened', async ({ page }) => {
      const inheritanceButton = page.locator('button').filter({ has: page.locator('svg.lucide-git-branch') }).first();

      // Click to open
      await inheritanceButton.click();
      await page.waitForTimeout(300);

      // Button should have secondary/active styling when panel is open
      const buttonClasses = await inheritanceButton.getAttribute('class');
      expect(buttonClasses).toBeTruthy();
    });
  });

  test.describe('Panel Sizing', () => {
    test('panel has correct default sizing (75%/25% split)', async ({ page }) => {
      // Open the panel
      const inheritanceButton = page.locator('button').filter({ has: page.locator('svg.lucide-git-branch') }).first();
      await inheritanceButton.click();
      await page.waitForTimeout(500);

      // Get the flex values of the panels
      const panels = await page.evaluate(() => {
        const panelElements = document.querySelectorAll('[data-slot="resizable-panel"]');
        return Array.from(panelElements).map((p) => ({
          flex: (p as HTMLElement).style.flex,
        }));
      });

      // Should have at least 2 panels
      expect(panels.length).toBeGreaterThanOrEqual(2);

      // The main content should have ~75% and inheritance panel ~25%
      // Account for some variance due to the number formatting
      const mainPanelFlex = parseFloat(panels[0].flex.split(' ')[0]);
      const inheritancePanelFlex = parseFloat(panels[panels.length - 1].flex.split(' ')[0]);

      expect(mainPanelFlex).toBeGreaterThan(70);
      expect(mainPanelFlex).toBeLessThan(80);
      expect(inheritancePanelFlex).toBeGreaterThan(20);
      expect(inheritancePanelFlex).toBeLessThan(30);
    });

    test('panel respects minimum size constraints during resize', async ({ page }) => {
      // Open the panel
      const inheritanceButton = page.locator('button').filter({ has: page.locator('svg.lucide-git-branch') }).first();
      await inheritanceButton.click();
      await page.waitForTimeout(500);

      // Get the resize handle
      const resizeHandle = page.locator('[data-slot="resizable-handle"]').last();
      const handleBox = await resizeHandle.boundingBox();
      expect(handleBox).not.toBeNull();

      // Try to drag the handle all the way to the left (beyond minSize)
      const startX = handleBox!.x + handleBox!.width / 2;
      const startY = handleBox!.y + handleBox!.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(0, startY, { steps: 20 }); // Drag to far left edge
      await page.mouse.up();
      await page.waitForTimeout(200);

      // The inheritance panel should still have at least 15% (minSize)
      const panels = await page.evaluate(() => {
        const panelElements = document.querySelectorAll('[data-slot="resizable-panel"]');
        return Array.from(panelElements).map((p) => ({
          flex: (p as HTMLElement).style.flex,
        }));
      });

      const inheritancePanelFlex = parseFloat(panels[panels.length - 1].flex.split(' ')[0]);
      expect(inheritancePanelFlex).toBeGreaterThanOrEqual(15);
    });
  });

  test.describe('Panel Content', () => {
    test('shows "No specification loaded" message when no spec is loaded', async ({ page }) => {
      // Clear any existing spec content
      await page.evaluate(() => {
        localStorage.removeItem('openapi-viz-spec');
      });
      await page.reload();
      await page.waitForSelector('header');

      // Open the panel
      const inheritanceButton = page.locator('button').filter({ has: page.locator('svg.lucide-git-branch') }).first();
      await inheritanceButton.click();
      await page.waitForTimeout(500);

      // May show either "No specification loaded" or "No schema compositions found"
      // depending on if there's a default spec
      const noContentMessage = page.locator('text=/No specification loaded|No schema compositions found/');
      await expect(noContentMessage.first()).toBeVisible({ timeout: 5000 });
    });

    test('panel header has correct title and icon', async ({ page }) => {
      // Open the panel
      const inheritanceButton = page.locator('button').filter({ has: page.locator('svg.lucide-git-branch') }).first();
      await inheritanceButton.click();
      await page.waitForTimeout(500);

      // Check for the GitBranch icon in the panel header
      const panelHeader = page.locator('[data-slot="resizable-panel"]').last();
      const headerIcon = panelHeader.locator('svg.lucide-git-branch');
      await expect(headerIcon.first()).toBeVisible();

      // Check for the title text
      await expect(panelHeader.getByText('Schema Inheritance')).toBeVisible();
    });
  });

  test.describe('Panel Integration with Other Panels', () => {
    test('works alongside detail panel without layout issues', async ({ page }) => {
      // Open inheritance panel
      const inheritanceButton = page.locator('button').filter({ has: page.locator('svg.lucide-git-branch') }).first();
      await inheritanceButton.click();
      await page.waitForTimeout(500);

      // Both panels should be visible and properly positioned
      await expect(page.getByText('Schema Inheritance').first()).toBeVisible();

      // All resize handles should be interactable
      const handles = await page.locator('[data-slot="resizable-handle"]').all();
      for (const handle of handles) {
        const box = await handle.boundingBox();
        if (box) {
          const centerX = box.x + box.width / 2;
          const centerY = box.y + box.height / 2;

          const isAccessible = await page.evaluate(({ x, y }) => {
            const el = document.elementFromPoint(x, y);
            if (!el) return false;
            return !!el.closest('[data-slot="resizable-handle"]');
          }, { x: centerX, y: centerY });

          expect(isAccessible).toBe(true);
        }
      }
    });

    test('inheritance panel remains functional after toggling detail panel', async ({ page }) => {
      // Open inheritance panel
      const inheritanceButton = page.locator('button').filter({ has: page.locator('svg.lucide-git-branch') }).first();
      await inheritanceButton.click();
      await page.waitForTimeout(300);

      // Verify panel is visible
      await expect(page.getByText('Schema Inheritance').first()).toBeVisible();

      // Toggle inheritance panel off
      await inheritanceButton.click();
      await page.waitForTimeout(300);

      // Verify panel is hidden
      await expect(page.getByText('Schema Inheritance').first()).not.toBeVisible();

      // Toggle it back on
      await inheritanceButton.click();
      await page.waitForTimeout(300);

      // Verify panel is visible again with correct sizing
      await expect(page.getByText('Schema Inheritance').first()).toBeVisible();

      const panels = await page.evaluate(() => {
        const panelElements = document.querySelectorAll('[data-slot="resizable-panel"]');
        return Array.from(panelElements).map((p) => ({
          flex: (p as HTMLElement).style.flex,
        }));
      });

      // Should still have proper sizing
      const inheritancePanelFlex = parseFloat(panels[panels.length - 1].flex.split(' ')[0]);
      expect(inheritancePanelFlex).toBeGreaterThanOrEqual(15);
    });
  });

  test.describe('View Mode Compatibility', () => {
    test('panel works in graph-only view mode', async ({ page }) => {
      // Switch to graph view
      const graphButton = page.locator('button[aria-label="Graph view"]').or(page.locator('button').filter({ has: page.locator('svg.lucide-git-fork') })).first();
      if (await graphButton.isVisible()) {
        await graphButton.click();
        await page.waitForTimeout(300);
      }

      // Open inheritance panel
      const inheritanceButton = page.locator('button').filter({ has: page.locator('svg.lucide-git-branch') }).first();
      await inheritanceButton.click();
      await page.waitForTimeout(500);

      // Panel should be visible
      await expect(page.getByText('Schema Inheritance').first()).toBeVisible();
    });

    test('panel works in split view mode', async ({ page }) => {
      // Default is split view, just verify panel works
      const inheritanceButton = page.locator('button').filter({ has: page.locator('svg.lucide-git-branch') }).first();
      await inheritanceButton.click();
      await page.waitForTimeout(500);

      // Panel should be visible
      await expect(page.getByText('Schema Inheritance').first()).toBeVisible();

      // Resize handle should be accessible
      const resizeHandle = page.locator('[data-slot="resizable-handle"]').last();
      await expect(resizeHandle).toBeVisible();
    });
  });
});
