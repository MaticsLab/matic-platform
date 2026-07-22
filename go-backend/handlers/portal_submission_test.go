package handlers

import (
	"testing"

	"github.com/Jsanchez767/matic-platform/models"
	"github.com/google/uuid"
)

func TestComputeCompletion(t *testing.T) {
	f1 := models.FormField{ID: uuid.New()}
	f2 := models.FormField{ID: uuid.New()}
	f3 := models.FormField{ID: uuid.New()}
	threeFields := []models.FormField{f1, f2, f3}

	tests := []struct {
		name       string
		data       map[string]interface{}
		dataFields []models.FormField
		want       int
	}{
		{
			name:       "form has no data fields",
			data:       map[string]interface{}{f1.ID.String(): "answer"},
			dataFields: nil,
			want:       0,
		},
		{
			name:       "nothing filled in",
			data:       map[string]interface{}{},
			dataFields: threeFields,
			want:       0,
		},
		{
			name: "all fields filled",
			data: map[string]interface{}{
				f1.ID.String(): "a",
				f2.ID.String(): "b",
				f3.ID.String(): "c",
			},
			dataFields: threeFields,
			want:       100,
		},
		{
			name: "partial completion rounds down",
			data: map[string]interface{}{
				f1.ID.String(): "a",
			},
			dataFields: threeFields,
			want:       33,
		},
		{
			name: "nil and empty-string values don't count as filled",
			data: map[string]interface{}{
				f1.ID.String(): "a",
				f2.ID.String(): nil,
				f3.ID.String(): "",
			},
			dataFields: threeFields,
			want:       33,
		},
		{
			name: "unknown keys in data are ignored",
			data: map[string]interface{}{
				"not-a-field-id": "a",
				f1.ID.String():   "a",
			},
			dataFields: threeFields,
			want:       33,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := computeCompletion(tt.data, tt.dataFields); got != tt.want {
				t.Errorf("computeCompletion() = %d, want %d", got, tt.want)
			}
		})
	}
}
