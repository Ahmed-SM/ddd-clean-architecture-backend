// Package main is the entry point for the DDD Clean Architecture server
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/enterprise/ddd-clean-architecture/internal/infrastructure/http/server"
	"github.com/enterprise/ddd-clean-architecture/internal/infrastructure/persistence/postgres"
	"github.com/enterprise/ddd-clean-architecture/pkg/logger"
)

func main() {
	// Initialize logger
	log := logger.New(logger.Config{
		Level:  getEnv("LOG_LEVEL", "info"),
		Format: getEnv("LOG_FORMAT", "json"),
	})

	// Create context with cancellation for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize database connection
	dbConfig := postgres.Config{
		Host:     getEnv("DB_HOST", "localhost"),
		Port:     getEnv("DB_PORT", "5432"),
		User:     getEnv("DB_USER", "postgres"),
		Password: getEnv("DB_PASSWORD", "postgres"),
		Database: getEnv("DB_NAME", "ddd_db"),
		SSLMode:  getEnv("DB_SSLMODE", "disable"),
	}

	db, err := postgres.New(ctx, dbConfig)
	if err != nil {
		log.Fatal("failed to connect to database", "error", err)
	}
	defer db.Close()

	log.Info("database connection established")

	// Initialize HTTP server
	srv := server.New(server.Config{
		Addr:         getEnv("APP_ADDR", ":8080"),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}, log)

	// Start server in goroutine
	errCh := make(chan error, 1)
	go func() {
		log.Info("starting server", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- fmt.Errorf("server error: %w", err)
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case <-quit:
		log.Info("shutting down server...")
	case err := <-errCh:
		log.Error("server error", "error", err)
	}

	// Give outstanding requests 30 seconds to complete
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("server shutdown error", "error", err)
	}

	log.Info("server stopped")
}

// getEnv returns the environment variable value or a default
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
