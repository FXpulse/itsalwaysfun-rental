// Pre-built report templates. Each has a friendly name + description and
// generates a ReportDefinition when invoked with a date range.
//
// Tenants never see "dimensions" or "metrics" — they pick a question
// ("Where's my money coming from?") and get a chart.

import type { ReportDefinition } from "./report-engine";

export interface ReportTemplate {
  key: string;
  emoji: string;
  title: string;
  question: string;          // what tenant question this answers
  description: string;
  build(from: string, to: string): ReportDefinition;
}

const baseFilter = (from: string, to: string) => [
  { field: "event_date" as const, op: "gte" as const, value: from },
  { field: "event_date" as const, op: "lte" as const, value: to },
  { field: "booking_status" as const, op: "neq" as const, value: "cancelled" },
];

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    key: "revenue-trend",
    emoji: "💰",
    title: "Revenue trend",
    question: "How is my revenue changing over time?",
    description: "Daily revenue across the period, with a clear trend line.",
    build: (from, to) => ({
      dimensions: ["event_date_day"],
      metrics: ["sum_paid"],
      filters: baseFilter(from, to),
      chart_type: "line",
    }),
  },
  {
    key: "top-products",
    emoji: "🏆",
    title: "Top products",
    question: "Which products bring me the most money?",
    description: "Ranked list of products by total bookings and revenue.",
    build: (from, to) => ({
      dimensions: ["product_name"],
      metrics: ["count_bookings", "sum_revenue"],
      filters: baseFilter(from, to),
      chart_type: "bar",
      sort: { by: "metric", metric_index: 1, dir: "desc" },
      limit: 15,
    }),
  },
  {
    key: "busiest-days",
    emoji: "📅",
    title: "Busiest days",
    question: "What are my busiest dates this period?",
    description: "Top dates ranked by booking count.",
    build: (from, to) => ({
      dimensions: ["event_date_day"],
      metrics: ["count_bookings", "sum_revenue"],
      filters: baseFilter(from, to),
      chart_type: "bar",
      sort: { by: "metric", metric_index: 0, dir: "desc" },
      limit: 20,
    }),
  },
  {
    key: "top-customers",
    emoji: "🥇",
    title: "Top customers",
    question: "Who are my biggest spenders?",
    description: "Customers ranked by total spend in this period.",
    build: (from, to) => ({
      dimensions: ["customer_email"],
      metrics: ["count_bookings", "sum_revenue"],
      filters: baseFilter(from, to),
      chart_type: "table",
      sort: { by: "metric", metric_index: 1, dir: "desc" },
      limit: 25,
    }),
  },
  {
    key: "monthly-revenue",
    emoji: "📊",
    title: "Monthly revenue",
    question: "What did I make each month?",
    description: "One bar per month, easy to compare growth.",
    build: (from, to) => ({
      dimensions: ["event_date_month"],
      metrics: ["sum_paid", "count_bookings"],
      filters: baseFilter(from, to),
      chart_type: "bar",
    }),
  },
  {
    key: "cancellations",
    emoji: "🚫",
    title: "What's being cancelled",
    question: "Which products get cancelled the most?",
    description: "Cancellations per product — spot patterns or weather risk.",
    build: (from, to) => ({
      dimensions: ["product_name"],
      metrics: ["count_bookings", "count_cancelled"],
      // Show ALL — including cancelled — so we can count both
      filters: [
        { field: "event_date" as const, op: "gte" as const, value: from },
        { field: "event_date" as const, op: "lte" as const, value: to },
      ],
      chart_type: "table",
      sort: { by: "metric", metric_index: 1, dir: "desc" },
      limit: 20,
    }),
  },
];

export function getTemplate(key: string): ReportTemplate | null {
  return REPORT_TEMPLATES.find((t) => t.key === key) || null;
}
