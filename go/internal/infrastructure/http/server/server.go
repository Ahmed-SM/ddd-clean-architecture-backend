// Package server provides HTTP server
package server

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/enterprise/ddd-clean-architecture/pkg/logger"
	"github.com/gorilla/mux"
)

// Config contains server configuration
type Config struct {
	Addr         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
}

// Server represents the HTTP server
type Server struct {
	*http.Server
	router *mux.Router
	log    *logger.Logger
}

// New creates a new HTTP server
func New(cfg Config, log *logger.Logger) *Server {
	router := mux.NewRouter()

	server := &Server{
		Server: &http.Server{
			Addr:         cfg.Addr,
			ReadTimeout:  cfg.ReadTimeout,
			WriteTimeout: cfg.WriteTimeout,
			IdleTimeout:  cfg.IdleTimeout,
		},
		router: router,
		log:    log,
	}

	// Setup routes
	server.setupRoutes()

	// Add middleware
	router.Use(loggingMiddleware(log))
	router.Use(corsMiddleware())
	router.Use(recoveryMiddleware(log))

	server.Handler = router

	return server
}

// setupRoutes configures all routes
func (s *Server) setupRoutes() {
	api := s.router.PathPrefix("/api/v1").Subrouter()

	// Health check
	api.HandleFunc("/health", s.healthHandler).Methods("GET")

	// Orders
	api.HandleFunc("/orders", s.listOrders).Methods("GET")
	api.HandleFunc("/orders", s.createOrder).Methods("POST")
	api.HandleFunc("/orders/{id}", s.getOrder).Methods("GET")
	api.HandleFunc("/orders/{id}/status", s.updateStatus).Methods("PUT")
}

// healthHandler returns server health status
func (s *Server) healthHandler(w http.ResponseWriter, r *http.Request) {
	response := map[string]any{
		"status":    "healthy",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"version":   "1.0.0",
	}
	respondJSON(w, http.StatusOK, response)
}

// loggingMiddleware logs requests
func loggingMiddleware(log *logger.Logger) mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			wrapped := &responseWriter{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(wrapped, r)
			log.Info("request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", wrapped.status,
				"duration", time.Since(start).String(),
			)
		})
	}
}

// corsMiddleware handles CORS
func corsMiddleware() mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// recoveryMiddleware recovers from panics
func recoveryMiddleware(log *logger.Logger) mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					log.Error("panic recovered", "error", err)
					respondError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal server error")
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// responseWriter wraps http.ResponseWriter
type responseWriter struct {
	http.ResponseWriter
	status int
}

// WriteHeader captures the status code
func (rw *responseWriter) WriteHeader(statusCode int) {
	rw.status = statusCode
	rw.ResponseWriter.WriteHeader(statusCode)
}

// respondJSON sends JSON response
func respondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// respondError sends error response
func respondError(w http.ResponseWriter, status int, code, message string) {
	respondJSON(w, status, map[string]any{
		"success": false,
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}

// Shutdown gracefully shuts down the server
func (s *Server) Shutdown(ctx context.Context) error {
	return s.Server.Shutdown(ctx)
}
