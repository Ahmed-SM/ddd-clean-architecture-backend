// Package logger provides structured logging
package logger

import (
	"log/slog"
	"os"
)

// Logger wraps slog.Logger
type Logger struct {
	*slog.Logger
}

// Config contains logger configuration
type Config struct {
	Level  string
	Format string
}

// New creates a new logger
func New(cfg Config) *Logger {
	var level slog.Level
	switch cfg.Level {
	case "debug":
		level = slog.LevelDebug
	case "info":
		level = slog.LevelInfo
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	opts := &slog.HandlerOptions{Level: level}

	var handler slog.Handler
	if cfg.Format == "json" {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		handler = slog.NewTextHandler(os.Stdout, opts)
	}

	return &Logger{slog.New(handler)}
}

// With returns a logger with additional context
func (l *Logger) With(args ...any) *Logger {
	return &Logger{l.Logger.With(args...)}
}

// Fatal logs a fatal message and exits
func (l *Logger) Fatal(msg string, args ...any) {
	l.Logger.Error(msg, args...)
	os.Exit(1)
}
