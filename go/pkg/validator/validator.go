// Package validator provides request validation
package validator

import (
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Validator collects validation errors
type Validator struct {
	errors []FieldError
}

// FieldError represents a field validation error
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// New creates a new validator
func New() *Validator {
	return &Validator{errors: make([]FieldError, 0)}
}

// AddError adds a validation error
func (v *Validator) AddError(field, message string) {
	v.errors = append(v.errors, FieldError{
		Field:   field,
		Message: message,
	})
}

// HasErrors returns true if there are errors
func (v *Validator) HasErrors() bool {
	return len(v.errors) > 0
}

// Errors returns the validation errors
func (v *Validator) Errors() []FieldError {
	return v.errors
}

// Required validates a required string
func (v *Validator) Required(field, value string) {
	if strings.TrimSpace(value) == "" {
		v.AddError(field, field+" is required")
	}
}

// RequiredInt validates a required int
func (v *Validator) RequiredInt(field string, value int) {
	if value == 0 {
		v.AddError(field, field+" is required")
	}
}

// Min validates minimum value
func (v *Validator) Min(field string, value, min int) {
	if value < min {
		v.AddError(field, field+" must be at least "+strconv.Itoa(min))
	}
}

// Max validates maximum value
func (v *Validator) Max(field string, value, max int) {
	if value > max {
		v.AddError(field, field+" must be at most "+strconv.Itoa(max))
	}
}

// Range validates a value is within range
func (v *Validator) Range(field string, value, min, max int) {
	if value < min || value > max {
		v.AddError(field, field+" must be between "+strconv.Itoa(min)+" and "+strconv.Itoa(max))
	}
}

// Email validates email format
func (v *Validator) Email(field, value string) {
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(value) {
		v.AddError(field, "invalid email format")
	}
}

// UUID validates UUID format
func (v *Validator) UUID(field, value string) {
	uuidRegex := regexp.MustCompile(`^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$`)
	if !uuidRegex.MatchString(value) {
		v.AddError(field, "invalid UUID format")
	}
}

// In validates value is in list
func (v *Validator) In(field, value string, list ...string) {
	for _, item := range list {
		if value == item {
			return
		}
	}
	v.AddError(field, field+" must be one of: "+strings.Join(list, ", "))
}

// DateTime validates datetime format
func (v *Validator) DateTime(field, value, layout string) {
	_, err := time.Parse(layout, value)
	if err != nil {
		v.AddError(field, "invalid datetime format")
	}
}

// Positive validates positive number
func (v *Validator) Positive(field string, value int) {
	if value <= 0 {
		v.AddError(field, field+" must be positive")
	}
}

// PositiveFloat validates positive float
func (v *Validator) PositiveFloat(field string, value float64) {
	if value <= 0 {
		v.AddError(field, field+" must be positive")
	}
}

// Len validates string length
func (v *Validator) Len(field string, value string, min, max int) {
	l := len(value)
	if l < min || l > max {
		v.AddError(field, field+" must be between "+strconv.Itoa(min)+" and "+strconv.Itoa(max)+" characters")
	}
}
