const mockApiFetch = vi.fn();

vi.mock("./client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { __dashboardTestUtils, fetchHomeDashboard } from "./dashboard";

describe("dashboard api contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds query with only required params", () => {
    const query = __dashboardTestUtils.buildHomeDashboardQuery({
      as_of: "2026-03-21",
      mode: "WEEK",
      anchor_date: "2026-03-21",
    });

    const parsed = new URLSearchParams(query);
    expect(parsed.get("as_of")).toBe("2026-03-21");
    expect(parsed.get("mode")).toBe("WEEK");
    expect(parsed.get("anchor_date")).toBe("2026-03-21");
    expect(Array.from(parsed.keys()).sort()).toEqual(["anchor_date", "as_of", "mode"]);
  });

  it("calls /dashboard/home with encoded query", async () => {
    mockApiFetch.mockResolvedValue({ as_of: "2026-03-21" });

    await fetchHomeDashboard({
      as_of: "2026-03-21",
      mode: "MONTH",
      anchor_date: "2026-03-20",
    });

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(String(mockApiFetch.mock.calls[0][0])).toContain("/dashboard/home?");
    expect(String(mockApiFetch.mock.calls[0][0])).toContain("as_of=2026-03-21");
    expect(String(mockApiFetch.mock.calls[0][0])).toContain("mode=MONTH");
    expect(String(mockApiFetch.mock.calls[0][0])).toContain("anchor_date=2026-03-20");
  });
});

