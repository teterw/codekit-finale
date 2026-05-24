CREATE TABLE IF NOT EXISTS message_reactions (
  id serial PRIMARY KEY,
  message_id integer NOT NULL,
  user_id integer NOT NULL,
  emoji text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS message_reactions_unique
ON message_reactions(message_id, user_id, emoji);
