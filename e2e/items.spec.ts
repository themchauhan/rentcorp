import { expect, test, type Page } from "@playwright/test";
import {
  expectNotFound,
  formAlert,
  IDS,
  login,
  tamperAndSubmit,
  uniq,
  USERS,
  waitForHydration,
} from "./helpers";

const itemRow = (page: Page, name: string) =>
  page.getByTestId("item-row").filter({ hasText: name });

async function fillItem(
  page: Page,
  item: { name?: string; category?: string; quantity?: string; unit?: string; price?: string },
) {
  if (item.name !== undefined) await page.getByLabel("Item name").fill(item.name);
  if (item.category !== undefined)
    await page.getByLabel("Category", { exact: true }).fill(item.category);
  if (item.quantity !== undefined) await page.getByLabel("Quantity owned").fill(item.quantity);
  if (item.unit !== undefined) await page.getByLabel("Unit", { exact: true }).fill(item.unit);
  if (item.price !== undefined) await page.getByLabel("Price (₹)").fill(item.price);
}

test("owner creates, edits, deactivates and reactivates an item", async ({ page }) => {
  const name = `E2E Tent ${uniq()}`;
  await login(page, USERS.adminA);
  await page.goto("/items");
  await page.getByRole("link", { name: "Add item" }).click();

  await fillItem(page, { name, quantity: "12", price: "1500" });
  await page
    .getByRole("group", { name: "Category suggestions" })
    .getByRole("button", { name: "Tents & Shamiana" })
    .click();
  await page.getByText("per event", { exact: true }).click();
  await page.getByRole("button", { name: "Save item" }).click();

  await expect(page).toHaveURL(/\/items$/);
  await expect(itemRow(page, name)).toContainText("₹1,500");
  await expect(itemRow(page, name)).toContainText("per event");
  await expect(itemRow(page, name)).toContainText("Tents & Shamiana · 12 piece owned");

  // Edit the price.
  await itemRow(page, name).click();
  await expect(page.getByLabel("Price (₹)")).toHaveValue("1500");
  await fillItem(page, { price: "1750.50" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(itemRow(page, name)).toContainText("₹1,750.50");

  // Deactivate: hidden by default, visible with "Show inactive".
  await itemRow(page, name).click();
  await page.getByRole("button", { name: "Deactivate item" }).click();
  await expect(page.getByText("Item deactivated.")).toBeVisible();
  await page.goto("/items");
  await expect(itemRow(page, name)).toHaveCount(0);
  await page.getByRole("link", { name: "Show inactive" }).click();
  await expect(itemRow(page, name)).toContainText("Inactive");

  // Reactivate.
  await itemRow(page, name).click();
  await page.getByRole("button", { name: "Reactivate item" }).click();
  await expect(page.getByText("Item is active again.")).toBeVisible();
  await page.goto("/items");
  await expect(itemRow(page, name)).toBeVisible();
});

test("search and category filter", async ({ page }) => {
  await login(page, USERS.staffA);
  await page.goto("/items");
  await page.getByRole("searchbox", { name: "Search items" }).fill("plastic");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=plastic/);
  await expect(itemRow(page, "Plastic chair")).toBeVisible();
  await expect(itemRow(page, "Round table")).toHaveCount(0);

  await page.goto("/items");
  await page
    .getByRole("navigation", { name: "Filter by category" })
    .getByRole("link", { name: "Lighting" })
    .click();
  await expect(itemRow(page, "LED string lights")).toBeVisible();
  await expect(itemRow(page, "Plastic chair")).toHaveCount(0);

  // The seeded inactive item only shows with "Show inactive".
  await page.goto("/items");
  await expect(itemRow(page, "Old wooden stage")).toHaveCount(0);
  await page.getByRole("link", { name: "Show inactive" }).click();
  await expect(itemRow(page, "Old wooden stage")).toContainText("Inactive");
});

test("a custom category becomes a quick-pick chip and a filter", async ({ page }) => {
  const category = `Crockery ${uniq()}`;
  const name = `E2E Bowl ${uniq()}`;
  await login(page, USERS.adminA);
  await page.goto("/items/new");
  await fillItem(page, { name, category, quantity: "100", price: "2" });
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(itemRow(page, name)).toBeVisible();

  await page
    .getByRole("navigation", { name: "Filter by category" })
    .getByRole("link", { name: category })
    .click();
  await expect(itemRow(page, name)).toBeVisible();

  await page.goto("/items/new");
  await page
    .getByRole("group", { name: "Category suggestions" })
    .getByRole("button", { name: category })
    .click();
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue(category);
});

test("staff can view the catalog but not change it", async ({ page }) => {
  await login(page, USERS.staffA);
  await page.goto("/items");
  await expect(itemRow(page, "Plastic chair")).toContainText("₹10");
  await expect(page.getByRole("link", { name: "Add item" })).toHaveCount(0);
  await expect(itemRow(page, "Plastic chair").getByRole("link")).toHaveCount(0);

  await page.goto("/items/new");
  await expect(page).toHaveURL(/\/no-access$/);
  await page.goto(`/items/${IDS.itemA_plasticChair}`);
  await expect(page).toHaveURL(/\/no-access$/);
});

test("another business's item is invisible and can't be edited", async ({ page }) => {
  await login(page, USERS.adminB);
  await page.goto("/items");
  await expect(itemRow(page, "Plastic chair")).toHaveCount(0);

  await expectNotFound(page, `/items/${IDS.itemA_plasticChair}`);

  // Tamper with B's own edit form so it targets A's item.
  await page.goto(`/items/${IDS.itemB_foldingChair}`);
  await waitForHydration(page);
  await page.getByLabel("Price (₹)").fill("1");
  await tamperAndSubmit(
    page.getByRole("button", { name: "Save changes" }),
    "itemId",
    IDS.itemA_plasticChair,
  );
  await expect(formAlert(page)).toHaveText("Item not found.");
  await tamperAndSubmit(
    page.getByRole("button", { name: "Deactivate item" }),
    "itemId",
    IDS.itemA_plasticChair,
  );
  await expect(page.getByText("Item not found.").last()).toBeVisible();

  // Tenant A's item is unchanged.
  await page.context().clearCookies();
  await login(page, USERS.staffA);
  await page.goto("/items");
  await expect(itemRow(page, "Plastic chair")).toContainText("₹10");
});

test("item form validates input", async ({ page }) => {
  await login(page, USERS.adminA);
  await page.goto("/items/new");
  await fillItem(page, { name: "", category: "", quantity: "-1", price: "12.345" });
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByText("Enter the item name")).toBeVisible();
  await expect(page.getByText("Pick or type a category")).toBeVisible();
  await expect(page.getByText("Enter a whole number (0 or more)")).toBeVisible();
  await expect(page.getByText("Enter a price like 150 or 150.50")).toBeVisible();

  await fillItem(page, {
    name: "  plastic CHAIR ",
    category: "Furniture",
    quantity: "5",
    price: "10",
  });
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByText("You already have an item with this name")).toBeVisible();
});
