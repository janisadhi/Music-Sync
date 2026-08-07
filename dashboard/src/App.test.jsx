import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "./App";

describe("App component", () => {
  test("renders the Music Sync dashboard", () => {
    render(<App />);

    expect(screen.getByText("Music Sync")).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /Dashboard/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /Playlists/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /Songs/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /Sync History/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /Settings/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /System Health/i })
    ).toBeInTheDocument();
  });
});

