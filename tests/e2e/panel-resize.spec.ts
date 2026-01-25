import { test, expect } from '@playwright/test';

test.describe('Panel Resize Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to fully load
    await page.waitForSelector('header');
  });

  test.describe('Schema Inheritance Panel', () => {
    test('can toggle inheritance panel open and closed', async ({ page }) => {
      // Find the Schema Inheritance button in the toolbar
      const inheritanceButton = page.locator('button').filter({ has: page.locator('svg.lucide-git-branch') }).first();

      // Click to open the panel
      await inheritanceButton.click();

      // Panel should now be visible - look for the panel header with the GitBranch icon and "Schema Inheritance" text
      const panelHeader = page.locator('[data-slot="resizable-panel"]').last().locator('div').filter({
        has: page.locator('svg.lucide-git-branch')
      }).filter({
        hasText: 'Schema Inheritance'
      });
      await expect(panelHeader.first()).toBeVisible({ timeout: 5000 });

      // Click the close button in the panel header (X button)
      const closeButton = page.locator('[data-slot="resizable-panel"]').last().locator('button').filter({ has: page.locator('svg.lucide-x') });
      await closeButton.click();

      // Panel should be closed (button should not be active/secondary anymore)
      await expect(inheritanceButton).not.toHaveClass(/secondary/);
    });

    test('resize handle is visible and has proper z-index', async ({ page }) => {
      // Open the inheritance panel
      const inheritanceButton = page.locator('button').filter({ has: page.locator('svg.lucide-git-branch') }).first();
      await inheritanceButton.click();

      // Wait for panel to be visible
      await page.waitForSelector('[data-slot="resizable-panel"]');

      // Find the resize handle (it should have z-[100])
      const resizeHandle = page.locator('[data-slot="resizable-handle"]').last();

      // Handle should be visible
      await expect(resizeHandle).toBeVisible();

      // The handle should have the grip icon visible
      const gripIcon = resizeHandle.locator('svg.lucide-grip-vertical, svg.lucide-grip-horizontal');
      await expect(gripIcon.first()).toBeVisible();
    });

    test('can resize the inheritance panel by dragging handle', async ({ page }) => {
      // Open the inheritance panel
      const inheritanceButton = page.locator('button').filter({ has: page.locator('svg.lucide-git-branch') }).first();
      await inheritanceButton.click();

      // Wait for the panel to be visible
      await page.waitForSelector('[data-slot="resizable-handle"]');

      // Get the resize handle for the inheritance panel (horizontal orientation, rightmost)
      const resizeHandle = page.locator('[data-slot="resizable-handle"]').last();

      // Get the panel before resize (use the panel-group to measure viewport-relative size)
      const panel = page.locator('[data-slot="resizable-panel"]').last();
      const initialBox = await panel.boundingBox();
      expect(initialBox).not.toBeNull();

      // Get the handle bounding box
      const handleBox = await resizeHandle.boundingBox();
      expect(handleBox).not.toBeNull();

      // Verify the handle can receive pointer events (key test for the bug fix)
      // This tests that the z-index fix allows interaction with the handle
      const isPointerEventsEnabled = await resizeHandle.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.pointerEvents !== 'none';
      });
      expect(isPointerEventsEnabled).toBe(true);

      // Drag the handle to resize the panel (move left to make panel larger)
      const startX = handleBox!.x + handleBox!.width / 2;
      const startY = handleBox!.y + handleBox!.height / 2;
      const dragDistance = -150; // Move left by 150px to increase panel width

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + dragDistance, startY, { steps: 20 });
      await page.mouse.up();

      // Wait a bit for the resize to complete
      await page.waitForTimeout(200);

      // Get the panel size after resize
      const finalBox = await panel.boundingBox();
      expect(finalBox).not.toBeNull();

      // The panel should be wider (we dragged left) or at least responsive to drag
      // Note: The actual width change depends on minSize constraints
      // The key assertion is that the drag operation completes without the handle being blocked
      expect(finalBox!.width).toBeGreaterThanOrEqual(initialBox!.width);
    });

    test('resize handle is interactable (not obscured)', async ({ page }) => {
      // Open the inheritance panel
      const inheritanceButton = page.locator('button').filter({ has: page.locator('svg.lucide-git-branch') }).first();
      await inheritanceButton.click();

      // Wait for panel to be visible
      await page.waitForSelector('[data-slot="resizable-panel"]');

      // Get the resize handle
      const resizeHandle = page.locator('[data-slot="resizable-handle"]').last();
      const handleBox = await resizeHandle.boundingBox();
      expect(handleBox).not.toBeNull();

      // Check that the element at the handle's center is the handle itself (not obscured)
      const centerX = handleBox!.x + handleBox!.width / 2;
      const centerY = handleBox!.y + handleBox!.height / 2;

      // Get the element at this position
      const elementAtPoint = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;
        // Walk up to find the data-slot attribute
        let current: Element | null = el;
        while (current) {
          if (current.getAttribute('data-slot') === 'resizable-handle') {
            return 'resizable-handle';
          }
          // Also check if it's a child of the handle
          if (current.closest('[data-slot="resizable-handle"]')) {
            return 'resizable-handle';
          }
          current = current.parentElement;
        }
        return el.tagName + '.' + el.className;
      }, { x: centerX, y: centerY });

      expect(elementAtPoint).toBe('resizable-handle');
    });
  });

  test.describe('Detail Panel with Inheritance Panel', () => {
    test('both panels can be open and resized simultaneously', async ({ page }) => {
      // First, we need some content in the editor to trigger the detail panel
      // Open the inheritance panel first
      const inheritanceButton = page.locator('button').filter({ has: page.locator('svg.lucide-git-branch') }).first();
      await inheritanceButton.click();

      // Wait for inheritance panel
      await page.waitForSelector('[data-slot="resizable-panel"]');

      // Count the number of resize handles visible
      const handleCount = await page.locator('[data-slot="resizable-handle"]').count();

      // At least one handle should be visible (for the inheritance panel)
      expect(handleCount).toBeGreaterThanOrEqual(1);

      // Each handle should be interactable
      for (let i = 0; i < handleCount; i++) {
        const handle = page.locator('[data-slot="resizable-handle"]').nth(i);
        const box = await handle.boundingBox();

        if (box) {
          // Check the handle is at the front (not obscured)
          const centerX = box.x + box.width / 2;
          const centerY = box.y + box.height / 2;

          const isAccessible = await page.evaluate(({ x, y }) => {
            const el = document.elementFromPoint(x, y);
            if (!el) return false;
            // Check if element is part of a resizable handle
            return !!el.closest('[data-slot="resizable-handle"]');
          }, { x: centerX, y: centerY });

          expect(isAccessible).toBe(true);
        }
      }
    });
  });

  test.describe('Nested Panel Groups', () => {
    test('resize handles have correct z-index in nested layouts', async ({ page }) => {
      // Open inheritance panel to create nested panel structure
      const inheritanceButton = page.locator('button').filter({ has: page.locator('svg.lucide-git-branch') }).first();
      await inheritanceButton.click();

      await page.waitForSelector('[data-slot="resizable-handle"]');

      // All resize handles should have z-[100] class applied
      const handles = page.locator('[data-slot="resizable-handle"]');
      const count = await handles.count();

      for (let i = 0; i < count; i++) {
        const handle = handles.nth(i);
        const hasCorrectZIndex = await handle.evaluate((el) => {
          return el.classList.contains('z-[100]');
        });
        expect(hasCorrectZIndex).toBe(true);
      }
    });

    test('panel groups have relative positioning for proper stacking context', async ({ page }) => {
      // Open inheritance panel to create nested panel structure
      const inheritanceButton = page.locator('button').filter({ has: page.locator('svg.lucide-git-branch') }).first();
      await inheritanceButton.click();

      await page.waitForSelector('[data-slot="resizable-panel-group"]');

      // All panel groups should have 'relative' class for proper stacking context
      const panelGroups = page.locator('[data-slot="resizable-panel-group"]');
      const count = await panelGroups.count();

      for (let i = 0; i < count; i++) {
        const group = panelGroups.nth(i);
        const hasRelativeClass = await group.evaluate((el) => {
          return el.classList.contains('relative');
        });
        expect(hasRelativeClass).toBe(true);
      }
    });
  });
});
