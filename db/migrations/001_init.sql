-- ALFA — esquema inicial (multi-tenant desde el día 1)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO tenants (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'default')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    source TEXT NOT NULL,
    external_id TEXT,
    supplier_price NUMERIC(12,2),
    suggested_sale_price NUMERIC(12,2),
    category TEXT,
    raw_data JSONB DEFAULT '{}'::jsonb,
    shopify_product_id TEXT,
    shopify_variant_id TEXT,
    shopify_status TEXT DEFAULT 'not_published',
    is_flagged_saturated BOOLEAN DEFAULT false,
    is_flagged_noncompliant BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    product_id UUID NOT NULL REFERENCES products(id),
    demand_score NUMERIC(5,2),
    competition_score NUMERIC(5,2),
    margin_score NUMERIC(5,2),
    shipping_score NUMERIC(5,2),
    total_score NUMERIC(5,2),
    justification TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saturation_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    product_id UUID NOT NULL REFERENCES products(id),
    active_ads_count INTEGER,
    is_saturated BOOLEAN,
    checked_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    product_id UUID NOT NULL REFERENCES products(id),
    is_compliant BOOLEAN,
    restricted_reason TEXT,
    checked_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    product_id UUID REFERENCES products(id),
    platform TEXT,
    status TEXT DEFAULT 'draft',
    budget NUMERIC(12,2),
    spend NUMERIC(12,2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    roas NUMERIC(6,2),
    platform_campaign_id TEXT,
    last_checked_at TIMESTAMPTZ,
    auto_paused_at TIMESTAMPTZ,
    auto_pause_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS creatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    product_id UUID REFERENCES products(id),
    type TEXT NOT NULL, -- 'copy' | 'image' | 'video'
    content TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    shopify_order_id TEXT,
    product_id UUID REFERENCES products(id),
    status TEXT,
    revenue NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    subagent TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    input JSONB,
    output JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduled_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    product_id UUID REFERENCES products(id),
    creative_id UUID REFERENCES creatives(id),
    platform TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending',
    platform_post_id TEXT,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS engagement_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    scheduled_post_id UUID REFERENCES scheduled_posts(id),
    likes INTEGER,
    comments INTEGER,
    shares INTEGER,
    reach INTEGER,
    fetched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_shopify ON products(shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_product ON evaluations(product_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_subagent ON agent_logs(subagent, created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_platform ON campaigns(platform_campaign_id);
CREATE INDEX IF NOT EXISTS idx_orders_shopify ON orders(shopify_order_id);
