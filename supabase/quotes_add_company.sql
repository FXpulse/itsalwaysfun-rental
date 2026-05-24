-- Add optional company name to quotes
alter table public.quotes
  add column if not exists customer_company text;
