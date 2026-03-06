// Package postgres provides PostgreSQL database connection
package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jmoiron/sqlx"
	_ "github.com/jackc/pgx/v5/stdlib"
)

// Config contains database configuration
type Config struct {
	Host        string
	Port        string
	User        string
	Password    string
	Database    string
	SSLMode     string
	MaxConns    int32
	MinConns    int32
	MaxConnLife time.Duration
	MaxConnIdle time.Duration
	HealthCheck time.Duration
}

// DB wraps the connection pool
type DB struct {
	Pool *pgxpool.Pool
	DB   *sqlx.DB
}

// New creates a new database connection pool
func New(ctx context.Context, cfg Config) (*DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Database, cfg.SSLMode,
	)

	// Set defaults
	if cfg.MaxConns == 0 {
		cfg.MaxConns = 25
	}
	if cfg.MinConns == 0 {
		cfg.MinConns = 5
	}
	if cfg.MaxConnLife == 0 {
		cfg.MaxConnLife = time.Hour
	}
	if cfg.MaxConnIdle == 0 {
		cfg.MaxConnIdle = 30 * time.Minute
	}
	if cfg.HealthCheck == 0 {
		cfg.HealthCheck = 5 * time.Minute
	}

	poolConfig, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database config: %w", err)
	}

	poolConfig.MaxConns = cfg.MaxConns
	poolConfig.MinConns = cfg.MinConns
	poolConfig.MaxConnLifetime = cfg.MaxConnLife
	poolConfig.MaxConnIdleTime = cfg.MaxConnIdle
	poolConfig.HealthCheckPeriod = cfg.HealthCheck

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Verify connection
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Create sqlx DB for easier querying
	sqlxDB, err := sqlx.Connect("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to create sqlx connection: %w", err)
	}

	return &DB{Pool: pool, DB: sqlxDB}, nil
}

// Close closes the connection pool
func (db *DB) Close() {
	db.Pool.Close()
	db.DB.Close()
}

// Ping verifies the connection
func (db *DB) Ping(ctx context.Context) error {
	return db.Pool.Ping(ctx)
}

// Stats returns connection pool statistics
func (db *DB) Stats() *pgxpool.Stat {
	return db.Pool.Stat()
}

// IsHealthy checks if the database is healthy
func (db *DB) IsHealthy(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	return db.Pool.Ping(ctx) == nil
}
