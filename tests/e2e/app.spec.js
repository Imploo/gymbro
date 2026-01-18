import { test, expect } from "@playwright/test";

const signIn = async (page) => {
  await page.goto("/auth");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.goto("/exercises");
};

test.beforeEach(async ({ page }) => {
  await page.goto("/auth");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("auth gate and sign out", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("exercise lifecycle and rest timer", async ({ page }) => {
  await signIn(page);

  await expect(page.getByText("No exercises yet.")).toBeVisible();
  await page.getByRole("link", { name: "Add new exercise" }).click();
  await page.getByRole("combobox").selectOption({ label: "Bench Press" });
  await page.getByRole("button", { name: "Add from list" }).click();

  await expect(page.getByText("Bench Press")).toBeVisible();
  await page.getByRole("link", { name: /Bench Press/ }).click();

  const weightBadge = page.locator(".badge").first();
  const setsBadge = page.locator(".badge").nth(1);
  const warmupText = page.getByText(/Warmup set/);
  const warmupToggle = page.getByText("Warmup", { exact: true });

  // Warmup is enabled by default, turn it off to check working weight
  await expect(warmupText).toBeVisible();
  await warmupToggle.click();
  await expect(warmupText).toBeHidden();

  await expect(weightBadge).toHaveText("20 kg");
  await page.getByRole("button", { name: "+2.5" }).click();
  await expect(weightBadge).toHaveText("22.5 kg");
  await page.getByRole("button", { name: "-2.5" }).click();
  await expect(weightBadge).toHaveText("20 kg");

  await expect(setsBadge).toHaveText("1/5");
  await page.getByRole("button", { name: "Complete set" }).click();
  await expect(setsBadge).toHaveText("2/5");
  await expect(page.getByText(/Rest timer:/)).toBeVisible();

  await warmupToggle.click();
  await expect(warmupText).toBeVisible();

  await page.getByRole("button", { name: "Finish exercise" }).click();
  await expect(page).toHaveURL(/\/exercises$/);
  const storedExercises = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("gymbro.e2e.userExercises"))
  );
  expect(storedExercises[0].currentWeight).toBe(22.5);
  await expect(page.getByText("22.5 kg · Sets 0/5")).toBeVisible();
});

test("add custom exercise and update settings", async ({ page }) => {
  await signIn(page);

  await page.getByRole("link", { name: "Add new exercise" }).click();
  await page.getByPlaceholder("Exercise name").fill("Cable Row");
  await page.getByRole("button", { name: "Add custom" }).click();
  await expect(page.getByText("Cable Row")).toBeVisible();

  await page.goto("/settings");
  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.first().fill("25");
  await numberInputs.nth(1).fill("90");
  await page.getByTestId("plate-config-input").fill("20, 10, 5");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Enable notifications" }).click();

  const profile = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("gymbro.e2e.profile"))
  );
  expect(profile.preferences.notificationsEnabled).toBe(true);

  await page.goto("/exercises");
  await page.getByRole("link", { name: /Cable Row/ }).click();
  await expect(page.getByText("25 kg")).toBeVisible();
});

test("admin can manage global exercises", async ({ context, page }) => {
  await context.addInitScript(() => {
    const user = {
      uid: "e2e-admin",
      displayName: "E2E Admin",
      email: "admin@example.com",
      photoURL: "",
    };
    const profile = {
      profile: {
        displayName: "E2E Admin",
        email: "admin@example.com",
        photoURL: "",
      },
      preferences: {
        barWeight: 20,
        plateConfig: [20, 15, 10, 5, 2.5, 1.25],
        notificationsEnabled: false,
      },
      isAdmin: true,
    };
    window.localStorage.setItem("gymbro.e2e.user", JSON.stringify(user));
    window.localStorage.setItem("gymbro.e2e.profile", JSON.stringify(profile));
  });

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Global exercises" })).toBeVisible();

  await page.getByPlaceholder("Exercise name").fill("Front Squat");
  await page.getByRole("button", { name: "Add global exercise" }).click();
  await expect(page.getByText("Front Squat")).toBeVisible();

  await page.goto("/exercises/new");
  await page.getByRole("combobox").selectOption({ label: "Front Squat" });
});
