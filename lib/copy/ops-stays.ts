// Copy for Catalog -> Stays (app/dashboard/(ops)/catalog/stays), phase 3.2 plan 07. New file; no other copy file is edited.
//
// CANVAS strings are taken verbatim from the design canvas board DashStays in all three languages. Every other EN string
// is DRAFTED UI COPY for the owner's review at the picture gate. AR (Gulf-friendly Modern Standard Arabic) and ES (Latin
// American, formal "usted", owner 2026-10-14) are DRAFTS written from the EN. The words "Published", "Draft", "Move up",
// "Move down" and the empty-state line "No stays yet" / "New stay" come from OPS_KIT_COPY and DASHBOARD_COPY, not from here.
//
// This file holds the LIST strings only. The panel strings (Details, Experiences and services, photos, publish) are added
// once the owner has chosen the redesigned panel (03.2-06 option). Imported directly; deliberately not registered in
// lib/copy/index.ts.

export type OpsStaysLocale = "en" | "ar" | "es";

export type OpsStaysCopy = {
  /** CANVAS: the search field. */
  search: string;
  /** CANVAS: the destination filter's first option. */
  allDestinations: string;
  /** CANVAS: column headers. */
  columnName: string;
  columnDestination: string;
  columnConnected: string;
  columnStatus: string;
  /** DRAFT: accessible name of the destination filter, `{name}` is the chosen option. */
  filterLabel: string;
  /** DRAFT: the line when a search or filter leaves no stay. */
  noMatch: string;
  /** DRAFT: shown while a search or filter is on, because the order cannot be changed on a part of the list. */
  orderLocked: string;
};

export const OPS_STAYS_COPY: Record<OpsStaysLocale, OpsStaysCopy> = {
  en: {
    search: "Search",
    allDestinations: "All destinations",
    columnName: "Name",
    columnDestination: "Destinations",
    columnConnected: "Experiences and services",
    columnStatus: "Status",
    filterLabel: "Filter by destination: {name}",
    noMatch: "No stay matches your search.",
    orderLocked: "Clear the search and the filter to change the order.",
  },
  ar: {
    search: "بحث",
    allDestinations: "كل الوجهات",
    columnName: "الاسم",
    columnDestination: "الوجهات",
    columnConnected: "التجارب والخدمات",
    columnStatus: "الحالة",
    filterLabel: "التصفية حسب الوجهة: {name}",
    noMatch: "لا توجد إقامة تطابق بحثك.",
    orderLocked: "امسح البحث والتصفية لتغيير الترتيب.",
  },
  es: {
    search: "Buscar",
    allDestinations: "Todos los destinos",
    columnName: "Nombre",
    columnDestination: "Destinos",
    columnConnected: "Experiencias y servicios",
    columnStatus: "Estado",
    filterLabel: "Filtrar por destino: {name}",
    noMatch: "Ninguna estancia coincide con su búsqueda.",
    orderLocked: "Borre la búsqueda y el filtro para cambiar el orden.",
  },
};
