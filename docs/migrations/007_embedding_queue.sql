-- Embedding queue for async processing
CREATE TABLE embedding_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Entity reference
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('row', 'table', 'form', 'workspace')),
  
  -- Queue management
  priority INT DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),  -- 1 = highest
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',     -- Waiting to be processed
    'processing',  -- Currently being processed
    'completed',   -- Successfully processed
    'failed',      -- Processing failed
    'skipped'      -- Skipped (e.g., no content to embed)
  )),
  
  -- Content tracking
  content_hash TEXT,              -- Hash of content to detect changes
  last_content TEXT,              -- Last content that was embedded
  
  -- Processing info
  attempts INT DEFAULT 0,
  last_error TEXT,
  processed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint per entity
  CONSTRAINT embedding_queue_unique_entity UNIQUE (entity_id, entity_type)
);

-- Indexes
CREATE INDEX idx_embedding_queue_status ON embedding_queue(status, priority, created_at);
CREATE INDEX idx_embedding_queue_pending ON embedding_queue(priority, created_at) WHERE status = 'pending';
CREATE INDEX idx_embedding_queue_entity ON embedding_queue(entity_id, entity_type);

-- Function to queue entity for embedding
CREATE OR REPLACE FUNCTION queue_for_embedding(
  p_entity_id UUID,
  p_entity_type TEXT,
  p_priority INT DEFAULT 5
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO embedding_queue (entity_id, entity_type, priority, status)
  VALUES (p_entity_id, p_entity_type, p_priority, 'pending')
  ON CONFLICT (entity_id, entity_type) 
  DO UPDATE SET 
    priority = LEAST(embedding_queue.priority, p_priority),
    status = 'pending',
    updated_at = NOW()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;
