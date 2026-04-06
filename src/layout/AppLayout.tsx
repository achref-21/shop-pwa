import { Box, Group, Stack, Text } from "@mantine/core";
import {
  IconBuildingStore,
  IconCalendarStats,
  IconCash,
  IconChartBar,
  IconCreditCard,
  IconHome2,
  IconSearch,
} from "@tabler/icons-react";
import { Outlet, NavLink } from "react-router-dom";
import { useOnline } from "@/hooks/useOnline";
import "./AppLayout.css";

const navItems = [
  { to: "/", label: "Accueil", icon: IconHome2, end: true },
  { to: "/paiements", label: "Paiements", icon: IconCreditCard },
  { to: "/recette", label: "Recette", icon: IconCash },
  { to: "/fournisseurs", label: "Fournisseurs", icon: IconBuildingStore },
  { to: "/resume-journalier", label: "Journalier", icon: IconCalendarStats },
  { to: "/synthese-periodique", label: "Synthèse", icon: IconChartBar },
  { to: "/recherche-paiements", label: "Recherche", icon: IconSearch },
] as const;

export default function AppLayout() {
  const isOnline = useOnline();

  return (
    <Box className="app-shell">
      <Box component="header" className="app-header">
        <Group className="header-content" justify="space-between" wrap="nowrap">
          <Stack gap={0} className="header-branding">
            <Text component="h1" className="header-title">
              ShopManager
            </Text>
            <Text component="p" className="header-subtitle">
              Gestion commerciale
            </Text>
          </Stack>

          <Group className={`header-status ${isOnline ? "online" : "offline"}`} gap={6} wrap="nowrap">
            <Box className="status-dot" aria-hidden="true" />
            <Text component="span" className="status-text">
              {isOnline ? "En ligne" : "Hors ligne"}
            </Text>
          </Group>
        </Group>
      </Box>

      <Box component="main" className="main-content">
        <Outlet />
      </Box>

      <Box component="nav" className="bottom-nav" aria-label="Navigation principale">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              <Icon className="nav-icon" size={18} stroke={1.9} aria-hidden="true" />
              <Text component="span" className="nav-label">
                {item.label}
              </Text>
            </NavLink>
          );
        })}
      </Box>
    </Box>
  );
}
