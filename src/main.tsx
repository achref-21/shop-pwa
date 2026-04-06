import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider, createTheme } from "@mantine/core";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "./styles/tokens.css";

const theme = createTheme({
  fontFamily: "DM Sans, sans-serif",
  fontFamilyMonospace: "DM Sans, sans-serif",
  headings: { fontFamily: "Outfit, sans-serif" },
  primaryColor: "teal",
  colors: {
    brand: [
      "#f0fafa",
      "#d5f2f0",
      "#aae5e1",
      "#7dd8d3",
      "#2ec4b6",
      "#1a9e96",
      "#147a73",
      "#0e5753",
      "#093633",
      "#041b1a",
    ] as const,
  },
  radius: { sm: "8px", md: "12px", lg: "20px" },
  shadows: {
    card: "0 2px 8px rgba(0,0,0,0.06)",
    modal: "0 8px 32px rgba(0,0,0,0.12)",
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <RouterProvider router={router} />
    </MantineProvider>
  </React.StrictMode>
);
