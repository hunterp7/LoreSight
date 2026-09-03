CREATE TABLE storyframe_world_releases (
  world_id text NOT NULL,
  world_version text NOT NULL,
  content_hash char(64) NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  world_pack jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL,
  PRIMARY KEY (world_id, world_version)
);

CREATE FUNCTION storyframe_reject_release_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'published Storyframe releases are immutable';
END;
$$;

CREATE TRIGGER storyframe_world_releases_immutable
BEFORE UPDATE OR DELETE ON storyframe_world_releases
FOR EACH ROW EXECUTE FUNCTION storyframe_reject_release_mutation();

CREATE TABLE storyframe_sessions (
  session_id text PRIMARY KEY,
  owner_id text NOT NULL,
  world_id text NOT NULL,
  world_version text NOT NULL,
  engine_version text NOT NULL,
  seed bigint NOT NULL,
  initial_state jsonb NOT NULL,
  latest_state jsonb NOT NULL,
  state_version bigint NOT NULL CHECK (state_version >= 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  FOREIGN KEY (world_id, world_version)
    REFERENCES storyframe_world_releases (world_id, world_version)
);

CREATE INDEX storyframe_sessions_owner_updated
ON storyframe_sessions (owner_id, updated_at DESC);

CREATE TABLE storyframe_events (
  session_id text NOT NULL REFERENCES storyframe_sessions (session_id),
  state_version bigint NOT NULL CHECK (state_version > 0),
  event_id text NOT NULL,
  mutation_id text NOT NULL,
  event jsonb NOT NULL,
  committed_at timestamptz NOT NULL,
  PRIMARY KEY (session_id, state_version),
  UNIQUE (session_id, event_id),
  UNIQUE (session_id, mutation_id)
);

CREATE TABLE storyframe_director_performances (
  owner_id text NOT NULL,
  session_id text NOT NULL REFERENCES storyframe_sessions (session_id),
  state_version bigint NOT NULL,
  frame_id text NOT NULL,
  contract_hash char(64) NOT NULL CHECK (contract_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK (status IN ('generated', 'fallback')),
  provider text NOT NULL,
  model text NOT NULL,
  attempt_count integer NOT NULL CHECK (attempt_count BETWEEN 0 AND 3),
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  performance jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (owner_id, session_id, state_version, contract_hash)
);

CREATE TABLE storyframe_operator_audit (
  id text PRIMARY KEY,
  occurred_at timestamptz NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('allowed', 'denied', 'failed')),
  trace_id text,
  details jsonb NOT NULL
);

CREATE INDEX storyframe_operator_audit_target
ON storyframe_operator_audit (target_type, target_id, occurred_at);

ALTER TABLE storyframe_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE storyframe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE storyframe_director_performances ENABLE ROW LEVEL SECURITY;

CREATE POLICY storyframe_sessions_owner_policy ON storyframe_sessions
USING (owner_id = current_setting('storyframe.subject_id', true))
WITH CHECK (owner_id = current_setting('storyframe.subject_id', true));

CREATE POLICY storyframe_events_owner_policy ON storyframe_events
USING (EXISTS (
  SELECT 1 FROM storyframe_sessions session
  WHERE session.session_id = storyframe_events.session_id
    AND session.owner_id = current_setting('storyframe.subject_id', true)
));

CREATE POLICY storyframe_director_owner_policy ON storyframe_director_performances
USING (owner_id = current_setting('storyframe.subject_id', true))
WITH CHECK (owner_id = current_setting('storyframe.subject_id', true));
