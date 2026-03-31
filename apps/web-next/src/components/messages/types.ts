import type {
  ChecklistItem as SharedChecklistItem,
  GIOMMessage as SharedGIOMMessage,
  GIOMMessageType as SharedGIOMMessageType,
  TableContent as SharedTableContent,
  TimelineItem as SharedTimelineItem
} from "@/lib/runtimeContracts";

export type GIOMMessageType = SharedGIOMMessageType;

export interface GIOMMessage extends SharedGIOMMessage {
  id: string;
}

export type ChecklistItem = SharedChecklistItem;
export type TableContent = SharedTableContent;
export type TimelineItem = SharedTimelineItem;
