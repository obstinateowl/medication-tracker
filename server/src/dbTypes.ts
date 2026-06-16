export interface ResultSetHeader {
  fieldCount: number;
  affectedRows: number;
  insertId: number;
  info: string;
  serverStatus: number;
  warningStatus: number;
}

export interface RowDataPacket {
  [column: string]: unknown;
}

export interface ProfileRow extends RowDataPacket {
  id: number;
  name: string;
  created_at: Date;
}

export interface MedicationRow extends RowDataPacket {
  id: number;
  name: string;
  interval_minutes: number | null;
  max_per_day: number | null;
  waiting_message: string | null;
  created_at: Date;
}

export interface DoseLogRow extends RowDataPacket {
  id: number;
  profile_id: number;
  medication_id: number;
  taken_at: Date;
  logged_by_profile_id: number | null;
  medication_name?: string;
  logged_by_name?: string | null;
}

export interface CountRow extends RowDataPacket {
  cnt: number;
}

export interface LastDoseRow extends RowDataPacket {
  taken_at: Date;
}

export interface IdRow extends RowDataPacket {
  id: number;
}

export interface ProfileMedicationRow extends RowDataPacket {
  profile_id: number;
  medication_id: number;
  notify_when_due?: number | boolean;
  notify_minutes_before?: number | null;
}
