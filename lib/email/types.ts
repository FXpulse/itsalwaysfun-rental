// lib/email/types.ts
// Shared TS types for the /superadmin email feature. No runtime code.

export interface EmailAccount {
  id: string;
  brand: string;
  label: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  imap_tls: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_tls: boolean;
  username: string;
  encrypted_password: string;
  last_sync_at: string | null;
  last_synced_uid_per_folder: Record<string, number>;
  last_sync_error: string | null;
  last_sync_error_at: string | null;
  consecutive_failures: number;
  is_active: boolean;
  created_at: string;
}

export interface EmailFolder {
  id: string;
  account_id: string;
  path: string;
  name: string;
  special_use: string | null;
  is_active: boolean;
  unread_count: number;
  message_count: number;
}

export interface EmailThread {
  id: string;
  account_id: string;
  folder_id: string | null;
  subject: string | null;
  participants: string[];
  message_count: number;
  unread_count: number;
  last_message_at: string | null;
  archived_at: string | null;
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  account_id: string;
  folder_id: string | null;
  direction: "incoming" | "outgoing";
  imap_uid: number | null;
  message_id_header: string | null;
  in_reply_to: string | null;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string | null;
  sent_at: string | null;
  is_read: boolean;
  has_attachments: boolean;
  raw_size_bytes: number | null;
}

export interface EmailLabel {
  id: string;
  account_id: string;
  name: string;
  color: string;
}

// Rules — JSON shapes used by rules-engine
export type RuleConditionField = "from" | "to" | "subject" | "body" | "has_attachment";
export type RuleConditionOp =
  | "contains" | "equals" | "starts_with" | "matches_regex"
  | "is_true" | "is_false";

export interface RuleConditionLeaf {
  field: RuleConditionField;
  op: RuleConditionOp;
  value?: string;
}

export interface RuleConditionGroup {
  operator: "AND" | "OR";
  conditions: RuleConditionLeaf[];
}

export type RuleActionType =
  | "apply_label" | "move_to_folder" | "mark_read" | "mark_unread"
  | "archive" | "forward_to" | "auto_reply";

export interface RuleAction {
  type: RuleActionType;
  label_id?: string;
  folder_path?: string;
  forward_to_address?: string;
  auto_reply_subject?: string;
  auto_reply_body?: string;
}

export interface RuleActionBlock {
  actions: RuleAction[];
  stop_processing: boolean;
}

export interface EmailRule {
  id: string;
  account_id: string;
  name: string;
  priority: number;
  condition_jsonb: RuleConditionGroup;
  action_jsonb: RuleActionBlock;
  is_active: boolean;
  last_run_at: string | null;
  match_count: number;
}
