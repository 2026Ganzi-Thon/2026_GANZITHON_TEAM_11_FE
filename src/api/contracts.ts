/** Wire format from API v0.6 §1, §3, §11. Nullable fields are present with null. */
export interface Auth {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

export type LoginRequest = {
  email: string;
  password: string;
};

export interface User {
  id: string;
  email: string;
  birth_date: string | null;
  birth_date_edits_remaining: number;
  stats: {
    night_count: number;
    counted_sheep_total: number;
    worry_record_count: number;
  };
}

export type NextScreen =
  | 'ONBOARDING_CONSENT'
  | 'ONBOARDING_BIRTH_DATE'
  | 'DAY_INTRO'
  | 'MORNING_ADOPTION'
  | 'HOME'
  | 'NIGHT_SUPPORT'
  | 'NIGHT_FEED'
  | 'NIGHT_CLOSING'
  | 'NIGHT_RETURN'
  | 'NIGHT_SHEEP_COUNT'
  | 'NIGHT_WORRY';

export interface Support {
  message: string;
  resources: {
    label: string;
    action: 'call' | 'open_contacts' | 'open_url';
    target: string | null;
  }[];
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  spotify_search_url: string;
}

interface CardBase {
  id: string;
  available: boolean;
  tone: 'empathy' | 'light' | 'warm' | null;
  category_id: string | null;
  author_type: 'user' | 'seed' | 'editorial' | 'mongchi' | 'ai';
  author_label: string | null;
  viewer: { yarn_sent: boolean; fluff_saved: boolean; song_saved: boolean };
}

export type Card = CardBase &
  (
    | { kind: 'text'; content: { text: string } | null }
    | {
        kind: 'song';
        content: { track: Track; recommendation: string | null } | null;
      }
  );

export interface NightSummary {
  counted: number;
  status: 'completed' | 'stopped';
  finished_at: string;
  entrusted_count: number;
  fluff_count: number;
  yarn_sent_count: number;
  closing_card: Card | null;
}

export interface Bootstrap {
  server_time: string;
  timezone: string;
  phase: 'day' | 'night';
  night_date: string;
  next_screen: NextScreen;
  user: User;
  night_id: string | null;
  active_session_id: string | null;
  last_session: NightSummary | null;
  support: Support | null;
  reminder: { enabled: boolean; local_time: string | null };
  required_consents: { terms_version: string; privacy_version: string };
}
