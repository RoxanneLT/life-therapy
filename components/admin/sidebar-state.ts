/**
 * The sidebar's collapsed state, as a cookie the dashboard layout reads on the server so a reload
 * renders it already collapsed. A plain module, not admin-sidebar.tsx: a value imported into a
 * server component from a "use client" file arrives as a client reference, not the string.
 */
export const SIDEBAR_COLLAPSED_COOKIE = "admin-sidebar-collapsed";
