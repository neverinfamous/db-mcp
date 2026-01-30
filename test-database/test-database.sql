-- =============================================================================
-- DB-MCP Test Database - Seed Data
-- =============================================================================
-- This file creates all test tables needed for comprehensive testing of
-- the db-mcp SQLite MCP server's 7 tool groups.
--
-- Usage: sqlite3 test.db < test-database.sql
-- =============================================================================

-- =============================================================================
-- CORE + STATS: Products and Orders
-- =============================================================================

CREATE TABLE IF NOT EXISTS test_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL,
    category TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO test_products (name, description, price, category) VALUES
    ('Laptop Pro 15', 'High-performance laptop with 15-inch display', 1299.99, 'electronics'),
    ('Wireless Mouse', 'Ergonomic wireless mouse with precision tracking', 49.99, 'electronics'),
    ('USB-C Hub', 'Multi-port USB-C hub with HDMI and USB 3.0', 79.99, 'electronics'),
    ('Mechanical Keyboard', 'RGB mechanical keyboard with Cherry MX switches', 149.99, 'electronics'),
    ('Monitor Stand', 'Adjustable aluminum monitor stand', 89.99, 'accessories'),
    ('Webcam HD', '1080p HD webcam with autofocus', 69.99, 'electronics'),
    ('Desk Lamp', 'LED desk lamp with adjustable brightness', 45.99, 'accessories'),
    ('Notebook Pack', 'Pack of 3 lined notebooks', 12.99, 'office'),
    ('Pen Set', 'Premium ballpoint pen set', 24.99, 'office'),
    ('Cable Organizer', 'Silicone cable management clips', 9.99, 'accessories'),
    ('Headphones Pro', 'Noise-cancelling over-ear headphones', 299.99, 'electronics'),
    ('Mouse Pad XL', 'Extra large gaming mouse pad', 29.99, 'accessories'),
    ('Phone Stand', 'Aluminum phone and tablet stand', 34.99, 'accessories'),
    ('Desk Mat', 'Leather desk mat 80x40cm', 59.99, 'accessories'),
    ('Power Strip', 'Surge protector with 6 outlets and USB', 39.99, 'electronics');

CREATE TABLE IF NOT EXISTS test_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER REFERENCES test_products(id),
    customer_name TEXT,
    quantity INTEGER,
    total_price REAL,
    order_date TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'pending'
);

INSERT INTO test_orders (product_id, customer_name, quantity, total_price, status, order_date) VALUES
    (1, 'Alice Johnson', 1, 1299.99, 'completed', '2026-01-15 10:30:00'),
    (2, 'Bob Smith', 2, 99.98, 'completed', '2026-01-15 11:45:00'),
    (3, 'Carol White', 1, 79.99, 'shipped', '2026-01-16 09:15:00'),
    (4, 'David Brown', 1, 149.99, 'pending', '2026-01-17 14:20:00'),
    (11, 'Eve Davis', 1, 299.99, 'completed', '2026-01-17 16:00:00'),
    (5, 'Frank Miller', 2, 179.98, 'shipped', '2026-01-18 08:30:00'),
    (6, 'Grace Wilson', 1, 69.99, 'pending', '2026-01-19 13:45:00'),
    (1, 'Henry Taylor', 1, 1299.99, 'completed', '2026-01-20 10:00:00'),
    (7, 'Ivy Anderson', 3, 137.97, 'completed', '2026-01-20 15:30:00'),
    (2, 'Jack Thomas', 1, 49.99, 'shipped', '2026-01-21 09:00:00'),
    (8, 'Karen Martinez', 5, 64.95, 'pending', '2026-01-22 11:20:00'),
    (9, 'Leo Garcia', 2, 49.98, 'completed', '2026-01-22 14:10:00'),
    (10, 'Mia Robinson', 10, 99.90, 'shipped', '2026-01-23 08:45:00'),
    (12, 'Noah Clark', 1, 29.99, 'pending', '2026-01-24 10:30:00'),
    (13, 'Olivia Lewis', 1, 34.99, 'completed', '2026-01-24 16:15:00'),
    (14, 'Peter Hall', 1, 59.99, 'shipped', '2026-01-25 09:30:00'),
    (15, 'Quinn Young', 2, 79.98, 'pending', '2026-01-26 11:00:00'),
    (4, 'Rachel King', 1, 149.99, 'completed', '2026-01-27 13:20:00'),
    (11, 'Sam Wright', 1, 299.99, 'shipped', '2026-01-28 15:45:00'),
    (3, 'Tina Scott', 2, 159.98, 'pending', '2026-01-29 10:15:00');

CREATE INDEX IF NOT EXISTS idx_orders_status ON test_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON test_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_products_category ON test_products(category);

-- =============================================================================
-- JSON: Document Storage with JSON
-- =============================================================================

CREATE TABLE IF NOT EXISTS test_jsonb_docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc TEXT NOT NULL, -- JSON document
    metadata TEXT,     -- JSON metadata
    tags TEXT DEFAULT '[]', -- JSON array of tags
    created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO test_jsonb_docs (doc, metadata, tags) VALUES
    ('{"type": "article", "title": "Getting Started with SQLite", "author": "Alice", "views": 1250, "rating": 4.5}',
     '{"source": "blog", "language": "en", "version": 1}',
     '["database", "tutorial", "beginner"]'),
    ('{"type": "article", "title": "Advanced JSON Operations", "author": "Bob", "views": 890, "rating": 4.8}',
     '{"source": "docs", "language": "en", "version": 2}',
     '["json", "advanced", "sqlite"]'),
    ('{"type": "video", "title": "MCP Protocol Deep Dive", "author": "Carol", "duration": 3600, "views": 5400}',
     '{"source": "youtube", "language": "en", "quality": "1080p"}',
     '["mcp", "protocol", "ai"]'),
    ('{"type": "article", "title": "FTS5 Full-Text Search", "author": "David", "views": 670, "rating": 4.2, "nested": {"level1": {"level2": "deep value"}}}',
     '{"source": "wiki", "language": "en", "version": 1}',
     '["fts5", "search", "indexing"]'),
    ('{"type": "podcast", "title": "Database Performance Tips", "author": "Eve", "duration": 2700, "episodes": 12}',
     '{"source": "spotify", "language": "en", "subscribers": 15000}',
     '["performance", "tips", "podcast"]'),
    ('{"type": "article", "title": "Vector Search Fundamentals", "author": "Frank", "views": 2100, "rating": 4.7}',
     '{"source": "medium", "language": "en", "version": 3}',
     '["vector", "embeddings", "similarity"]');

-- =============================================================================
-- TEXT + FTS5: Article Content
-- =============================================================================

CREATE TABLE IF NOT EXISTS test_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    author TEXT,
    category TEXT,
    published_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO test_articles (title, body, author, category) VALUES
    ('Introduction to SQLite', 
     'SQLite is a self-contained, serverless, zero-configuration database engine. It is the most widely deployed database in the world, found in countless applications from mobile apps to web browsers. SQLite reads and writes directly to ordinary disk files, making it incredibly portable and easy to use.',
     'Alice Johnson', 'database'),
    ('Understanding Full-Text Search',
     'Full-text search (FTS) enables searching for words and phrases within text content. SQLite provides FTS5, a powerful full-text search extension that supports phrase queries, boolean operators, and ranked results using BM25 algorithm. FTS5 is essential for applications requiring fast text search capabilities.',
     'Bob Smith', 'search'),
    ('The Model Context Protocol Explained',
     'The Model Context Protocol (MCP) is an open standard that enables AI assistants to interact with external data sources and tools. MCP provides a standardized way for AI models to access databases, APIs, and other services while maintaining security and privacy.',
     'Carol White', 'ai'),
    ('JSON in Modern Databases',
     'Modern databases increasingly support JSON as a first-class data type. JSON enables flexible schema design and is perfect for storing semi-structured data. SQLite provides comprehensive JSON functions including extraction, modification, and validation capabilities.',
     'David Brown', 'database'),
    ('Vector Embeddings for Similarity Search',
     'Vector embeddings represent data as numerical arrays, enabling semantic similarity search. By comparing the distance between vectors using cosine similarity or Euclidean distance, applications can find semantically similar content regardless of exact keyword matches.',
     'Eve Davis', 'ai'),
    ('Database Performance Optimization',
     'Optimizing database performance requires understanding query execution plans, proper indexing strategies, and efficient schema design. Key techniques include using appropriate indexes, avoiding unnecessary joins, and leveraging query caching.',
     'Frank Miller', 'performance'),
    ('Building RESTful APIs with SQLite',
     'SQLite is an excellent choice for small to medium-sized API backends. Its serverless nature simplifies deployment, while its robust ACID compliance ensures data integrity. Combined with modern frameworks, SQLite enables rapid API development.',
     'Grace Wilson', 'development'),
    ('Data Analysis with Statistical Functions',
     'Statistical analysis of database content reveals patterns and insights. Common operations include calculating averages, standard deviations, percentiles, and correlations. These metrics help understand data distributions and identify outliers.',
     'Henry Taylor', 'analytics');

-- =============================================================================
-- TEXT: User Data with Various Patterns
-- =============================================================================

CREATE TABLE IF NOT EXISTS test_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    phone TEXT,
    bio TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO test_users (username, email, phone, bio) VALUES
    ('johndoe', 'john.doe@example.com', '+1-555-0101', 'Software developer passionate about databases and AI.'),
    ('janesmith', 'jane.smith@company.org', '+1-555-0102', 'Data scientist specializing in machine learning.'),
    ('bobwilson', 'bob.wilson@startup.io', '+44-20-7123-4567', 'Full-stack developer and open source contributor.'),
    ('alicechen', 'alice.chen@university.edu', '+1-555-0104', 'PhD researcher in natural language processing.'),
    ('mikebrown', 'mike.brown@tech.co', NULL, 'DevOps engineer focused on infrastructure automation.'),
    ('sarahlee', 'sarah.lee@design.studio', '+1-555-0106', 'UX designer creating intuitive user experiences.'),
    ('davidkim', 'david.kim@finance.com', '+82-2-1234-5678', 'Quantitative analyst building trading algorithms.'),
    ('emmagarcia', 'emma.garcia@healthcare.org', '+1-555-0108', 'Health informatics specialist improving patient care.');

-- =============================================================================
-- STATS: Sensor Measurements (Large dataset for statistical operations)
-- =============================================================================

CREATE TABLE IF NOT EXISTS test_measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_id INTEGER,
    temperature REAL,
    humidity REAL,
    pressure REAL,
    measured_at TEXT
);

-- Generate 200 measurement records with realistic sensor data
-- Using multiple inserts for SQLite compatibility
INSERT INTO test_measurements (sensor_id, temperature, humidity, pressure, measured_at)
SELECT 
    1 + (value % 5),
    20.0 + (value * 0.731 % 15) + (value * 0.113 % 3),
    40.0 + (value * 0.919 % 40),
    1000.0 + (value * 0.557 % 50),
    datetime('2026-01-01', '+' || value || ' hours')
FROM (
    WITH RECURSIVE cnt(value) AS (
        SELECT 0
        UNION ALL
        SELECT value + 1 FROM cnt WHERE value < 199
    )
    SELECT value FROM cnt
);

-- =============================================================================
-- VECTOR: Embedding Storage
-- =============================================================================

CREATE TABLE IF NOT EXISTS test_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    category TEXT,
    embedding TEXT -- JSON array representing vector
);

-- Insert sample embeddings (8-dimensional vectors for simplicity)
INSERT INTO test_embeddings (content, category, embedding) VALUES
    ('Machine learning fundamentals', 'tech', '[0.12, 0.45, -0.23, 0.78, 0.34, -0.56, 0.89, 0.01]'),
    ('Deep learning neural networks', 'tech', '[0.15, 0.42, -0.21, 0.75, 0.38, -0.52, 0.85, 0.05]'),
    ('Natural language processing', 'tech', '[0.18, 0.48, -0.25, 0.72, 0.31, -0.58, 0.82, -0.02]'),
    ('Database optimization techniques', 'database', '[-0.34, 0.22, 0.67, -0.11, 0.55, 0.43, -0.28, 0.91]'),
    ('SQL query performance tuning', 'database', '[-0.31, 0.25, 0.64, -0.08, 0.52, 0.46, -0.25, 0.88]'),
    ('Index design strategies', 'database', '[-0.28, 0.28, 0.61, -0.14, 0.58, 0.40, -0.31, 0.85]'),
    ('Cooking Italian pasta dishes', 'food', '[0.67, -0.45, 0.12, 0.33, -0.78, 0.21, 0.54, -0.39]'),
    ('French cuisine techniques', 'food', '[0.64, -0.42, 0.15, 0.36, -0.75, 0.24, 0.51, -0.36]'),
    ('Healthy meal preparation', 'food', '[0.61, -0.48, 0.09, 0.30, -0.81, 0.18, 0.57, -0.42]'),
    ('Morning workout routines', 'fitness', '[-0.56, -0.23, -0.45, 0.89, 0.12, -0.67, 0.34, 0.78]'),
    ('Strength training basics', 'fitness', '[-0.53, -0.26, -0.42, 0.86, 0.15, -0.64, 0.37, 0.75]'),
    ('Cardio exercise benefits', 'fitness', '[-0.59, -0.20, -0.48, 0.92, 0.09, -0.70, 0.31, 0.81]'),
    ('Travel tips for Europe', 'travel', '[0.23, 0.78, 0.45, -0.34, -0.12, 0.89, -0.56, 0.01]'),
    ('Budget backpacking guide', 'travel', '[0.26, 0.75, 0.48, -0.31, -0.15, 0.86, -0.53, 0.04]'),
    ('Photography during trips', 'travel', '[0.20, 0.81, 0.42, -0.37, -0.09, 0.92, -0.59, -0.02]'),
    ('Transformer architecture explained', 'tech', '[0.14, 0.44, -0.22, 0.76, 0.35, -0.54, 0.87, 0.03]'),
    ('Vector databases overview', 'database', '[-0.32, 0.24, 0.65, -0.10, 0.54, 0.44, -0.27, 0.89]'),
    ('Asian cooking techniques', 'food', '[0.65, -0.44, 0.13, 0.34, -0.76, 0.22, 0.52, -0.37]'),
    ('Yoga and flexibility', 'fitness', '[-0.55, -0.24, -0.44, 0.88, 0.13, -0.66, 0.35, 0.76]'),
    ('Solo travel adventures', 'travel', '[0.24, 0.77, 0.46, -0.33, -0.13, 0.88, -0.55, 0.02]');

-- =============================================================================
-- GEO: Location Points
-- =============================================================================

CREATE TABLE IF NOT EXISTS test_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    city TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    type TEXT
);

INSERT INTO test_locations (name, city, latitude, longitude, type) VALUES
    ('Central Park', 'New York', 40.7829, -73.9654, 'park'),
    ('Empire State Building', 'New York', 40.7484, -73.9857, 'landmark'),
    ('Times Square', 'New York', 40.7580, -73.9855, 'attraction'),
    ('Eiffel Tower', 'Paris', 48.8584, 2.2945, 'landmark'),
    ('Louvre Museum', 'Paris', 48.8606, 2.3376, 'museum'),
    ('Notre-Dame', 'Paris', 48.8530, 2.3499, 'landmark'),
    ('Big Ben', 'London', 51.5007, -0.1246, 'landmark'),
    ('Tower Bridge', 'London', 51.5055, -0.0754, 'landmark'),
    ('Buckingham Palace', 'London', 51.5014, -0.1419, 'landmark'),
    ('Tokyo Tower', 'Tokyo', 35.6586, 139.7454, 'landmark'),
    ('Shibuya Crossing', 'Tokyo', 35.6595, 139.7004, 'attraction'),
    ('Senso-ji Temple', 'Tokyo', 35.7148, 139.7967, 'temple'),
    ('Sydney Opera House', 'Sydney', -33.8568, 151.2153, 'landmark'),
    ('Harbour Bridge', 'Sydney', -33.8523, 151.2108, 'landmark'),
    ('Golden Gate Bridge', 'San Francisco', 37.8199, -122.4783, 'landmark');

-- =============================================================================
-- TEXT: Hierarchical Categories (for path-based queries)
-- =============================================================================

CREATE TABLE IF NOT EXISTS test_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT NOT NULL, -- Dot-separated path like 'electronics.computers.laptops'
    level INTEGER
);

INSERT INTO test_categories (name, path, level) VALUES
    ('Electronics', 'electronics', 1),
    ('Computers', 'electronics.computers', 2),
    ('Laptops', 'electronics.computers.laptops', 3),
    ('Desktops', 'electronics.computers.desktops', 3),
    ('Phones', 'electronics.phones', 2),
    ('Smartphones', 'electronics.phones.smartphones', 3),
    ('Feature Phones', 'electronics.phones.feature', 3),
    ('Accessories', 'electronics.accessories', 2),
    ('Clothing', 'clothing', 1),
    ('Mens', 'clothing.mens', 2),
    ('Shirts', 'clothing.mens.shirts', 3),
    ('Pants', 'clothing.mens.pants', 3),
    ('Womens', 'clothing.womens', 2),
    ('Dresses', 'clothing.womens.dresses', 3),
    ('Home', 'home', 1),
    ('Kitchen', 'home.kitchen', 2),
    ('Appliances', 'home.kitchen.appliances', 3);

-- =============================================================================
-- STATS + ADMIN: Event Logs
-- =============================================================================

CREATE TABLE IF NOT EXISTS test_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    user_id INTEGER,
    payload TEXT, -- JSON payload
    event_date TEXT NOT NULL
);

-- Generate event log data
INSERT INTO test_events (event_type, user_id, payload, event_date)
SELECT 
    CASE value % 5
        WHEN 0 THEN 'page_view'
        WHEN 1 THEN 'click'
        WHEN 2 THEN 'purchase'
        WHEN 3 THEN 'login'
        WHEN 4 THEN 'search'
    END,
    1 + (value % 8),
    '{"page": "' || CASE value % 4
        WHEN 0 THEN 'home'
        WHEN 1 THEN 'products'
        WHEN 2 THEN 'cart'
        WHEN 3 THEN 'checkout'
    END || '", "session": "sess_' || (1000 + value) || '"}',
    datetime('2026-01-01', '+' || (value * 2) || ' hours')
FROM (
    WITH RECURSIVE cnt(value) AS (
        SELECT 0
        UNION ALL
        SELECT value + 1 FROM cnt WHERE value < 99
    )
    SELECT value FROM cnt
);

-- =============================================================================
-- Summary: Test Tables Created
-- =============================================================================
-- test_products      - 15 rows (Core, Stats)
-- test_orders        - 20 rows (Core, Stats)
-- test_jsonb_docs    - 6 rows  (JSON)
-- test_articles      - 8 rows  (Text, FTS)
-- test_users         - 8 rows  (Text, Core)
-- test_measurements  - 200 rows (Stats)
-- test_embeddings    - 20 rows (Vector)
-- test_locations     - 15 rows (Geo)
-- test_categories    - 17 rows (Text)
-- test_events        - 100 rows (Stats, Admin)
-- =============================================================================
