-- =====================================================
-- WORKFLOW/REVIEW SYSTEM TABLES
-- For scholarship/grant application review workflows
-- =====================================================

-- Review Workflows (main workflow container)
CREATE TABLE IF NOT EXISTS review_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    application_type TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    default_rubric_id UUID,
    default_stage_sequence JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Application Stages (stages in the review process)
CREATE TABLE IF NOT EXISTS application_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    review_workflow_id UUID REFERENCES review_workflows(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0,
    stage_type TEXT DEFAULT 'review',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    relative_deadline TEXT,
    custom_statuses JSONB DEFAULT '[]',
    custom_tags JSONB DEFAULT '[]',
    logic_rules JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviewer Types (roles for reviewers)
CREATE TABLE IF NOT EXISTS reviewer_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '{}',
    default_permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rubrics (scoring criteria)
CREATE TABLE IF NOT EXISTS rubrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    max_score INTEGER DEFAULT 100,
    total_points INTEGER DEFAULT 100,
    rubric_type TEXT DEFAULT 'analytic',
    categories JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stage Reviewer Configs (links stages, reviewer types, and rubrics)
CREATE TABLE IF NOT EXISTS stage_reviewer_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_id UUID NOT NULL REFERENCES application_stages(id) ON DELETE CASCADE,
    reviewer_type_id UUID NOT NULL REFERENCES reviewer_types(id) ON DELETE CASCADE,
    rubric_id UUID REFERENCES rubrics(id) ON DELETE SET NULL,
    assigned_rubric_id UUID REFERENCES rubrics(id) ON DELETE SET NULL,
    visibility_config JSONB DEFAULT '{}',
    field_visibility_config JSONB DEFAULT '{}',
    min_reviews_required INTEGER DEFAULT 1,
    can_view_prior_scores BOOLEAN DEFAULT FALSE,
    can_view_prior_comments BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for default_rubric_id after rubrics table exists
ALTER TABLE review_workflows 
    ADD CONSTRAINT fk_default_rubric 
    FOREIGN KEY (default_rubric_id) 
    REFERENCES rubrics(id) 
    ON DELETE SET NULL;

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_review_workflows_workspace ON review_workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_review_workflows_active ON review_workflows(is_active);

CREATE INDEX IF NOT EXISTS idx_application_stages_workspace ON application_stages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_application_stages_workflow ON application_stages(review_workflow_id);
CREATE INDEX IF NOT EXISTS idx_application_stages_order ON application_stages(review_workflow_id, order_index);

CREATE INDEX IF NOT EXISTS idx_reviewer_types_workspace ON reviewer_types(workspace_id);

CREATE INDEX IF NOT EXISTS idx_rubrics_workspace ON rubrics(workspace_id);

CREATE INDEX IF NOT EXISTS idx_stage_reviewer_configs_stage ON stage_reviewer_configs(stage_id);
CREATE INDEX IF NOT EXISTS idx_stage_reviewer_configs_reviewer_type ON stage_reviewer_configs(reviewer_type_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE review_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviewer_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_reviewer_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for review_workflows
CREATE POLICY "Users can view workflows in accessible workspaces" ON review_workflows
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage workflows in editable workspaces" ON review_workflows
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
        )
    );

-- RLS Policies for application_stages
CREATE POLICY "Users can view stages in accessible workspaces" ON application_stages
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage stages in editable workspaces" ON application_stages
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
        )
    );

-- RLS Policies for reviewer_types
CREATE POLICY "Users can view reviewer types in accessible workspaces" ON reviewer_types
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage reviewer types in editable workspaces" ON reviewer_types
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
        )
    );

-- RLS Policies for rubrics
CREATE POLICY "Users can view rubrics in accessible workspaces" ON rubrics
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage rubrics in editable workspaces" ON rubrics
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
        )
    );

-- RLS Policies for stage_reviewer_configs
CREATE POLICY "Users can view configs for accessible stages" ON stage_reviewer_configs
    FOR SELECT USING (
        stage_id IN (
            SELECT id FROM application_stages 
            WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can manage configs for editable stages" ON stage_reviewer_configs
    FOR ALL USING (
        stage_id IN (
            SELECT id FROM application_stages 
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members 
                WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
            )
        )
    );

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE TRIGGER update_review_workflows_updated_at BEFORE UPDATE ON review_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_application_stages_updated_at BEFORE UPDATE ON application_stages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviewer_types_updated_at BEFORE UPDATE ON reviewer_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rubrics_updated_at BEFORE UPDATE ON rubrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stage_reviewer_configs_updated_at BEFORE UPDATE ON stage_reviewer_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- REAL-TIME SUBSCRIPTIONS
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE review_workflows;
ALTER PUBLICATION supabase_realtime ADD TABLE application_stages;
ALTER PUBLICATION supabase_realtime ADD TABLE reviewer_types;
ALTER PUBLICATION supabase_realtime ADD TABLE rubrics;
ALTER PUBLICATION supabase_realtime ADD TABLE stage_reviewer_configs;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE review_workflows IS 'Review workflow definitions for application processing';
COMMENT ON TABLE application_stages IS 'Stages in review workflows (e.g., Initial Review, Committee Review)';
COMMENT ON TABLE reviewer_types IS 'Types/roles of reviewers (e.g., Financial Reviewer, Academic Reviewer)';
COMMENT ON TABLE rubrics IS 'Scoring rubrics with categories and point values';
COMMENT ON TABLE stage_reviewer_configs IS 'Configuration linking stages, reviewer types, and rubrics';
