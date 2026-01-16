import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders checklist sections and notes", () => {
  render(<App />);

  expect(screen.getByText(/Checklist/i)).toBeInTheDocument();
  expect(screen.getByText(/Top priority/i)).toBeInTheDocument();
  expect(screen.getByText(/Other tasks/i)).toBeInTheDocument();
  expect(screen.getByText(/Notes/i)).toBeInTheDocument();
});
