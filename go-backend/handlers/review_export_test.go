package handlers

import (
	"testing"
	"time"

	"github.com/Jsanchez767/matic-platform/models"
	"github.com/google/uuid"
)

func TestGroupRecommendationsBySubmission(t *testing.T) {
	subA := uuid.New()
	subB := uuid.New()

	recs := []models.RecommendationRequest{
		{ID: uuid.New(), SubmissionID: subA, RecommenderName: "Alice", Status: "pending"},
		{ID: uuid.New(), SubmissionID: subA, RecommenderName: "Bob", Status: "submitted"},
		{ID: uuid.New(), SubmissionID: subB, RecommenderName: "Carol", Status: "pending"},
	}

	grouped := groupRecommendationsBySubmission(recs)

	if len(grouped) != 2 {
		t.Fatalf("expected 2 submissions in the map, got %d", len(grouped))
	}
	if got := len(grouped[subA]); got != 2 {
		t.Errorf("submission A: expected 2 recommendations, got %d", got)
	}
	if got := len(grouped[subB]); got != 1 {
		t.Errorf("submission B: expected 1 recommendation, got %d", got)
	}
	if grouped[subA][0].RecommenderName != "Alice" || grouped[subA][1].RecommenderName != "Bob" {
		t.Errorf("submission A recommendations out of order or wrong: %+v", grouped[subA])
	}

	if _, ok := grouped[uuid.New()]; ok {
		t.Error("expected a lookup for an unrelated submission ID to be absent, not zero-valued")
	}
}

func TestGroupRecommendationsBySubmission_Empty(t *testing.T) {
	grouped := groupRecommendationsBySubmission(nil)
	if len(grouped) != 0 {
		t.Errorf("expected an empty map for no recommendations, got %d entries", len(grouped))
	}
}

func TestCountRecommendationStatuses(t *testing.T) {
	tests := []struct {
		name          string
		recs          []models.RecommendationSummary
		wantPending   int
		wantSubmitted int
	}{
		{
			name:          "empty list",
			recs:          nil,
			wantPending:   0,
			wantSubmitted: 0,
		},
		{
			name: "mixed statuses",
			recs: []models.RecommendationSummary{
				{Status: "pending"},
				{Status: "submitted"},
				{Status: "submitted"},
				{Status: "pending"},
			},
			wantPending:   2,
			wantSubmitted: 2,
		},
		{
			name: "unrecognized statuses (expired/cancelled) count toward neither bucket",
			recs: []models.RecommendationSummary{
				{Status: "expired"},
				{Status: "cancelled"},
				{Status: "pending"},
			},
			wantPending:   1,
			wantSubmitted: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotPending, gotSubmitted := countRecommendationStatuses(tt.recs)
			if gotPending != tt.wantPending || gotSubmitted != tt.wantSubmitted {
				t.Errorf("countRecommendationStatuses() = (pending=%d, submitted=%d), want (pending=%d, submitted=%d)",
					gotPending, gotSubmitted, tt.wantPending, tt.wantSubmitted)
			}
		})
	}
}

func TestParseFormData(t *testing.T) {
	tests := []struct {
		name    string
		raw     []byte
		want    map[string]interface{}
		wantErr bool
	}{
		{
			name: "empty input returns an empty map, not nil",
			raw:  nil,
			want: map[string]interface{}{},
		},
		{
			name: "literal null JSON returns an empty map",
			raw:  []byte("null"),
			want: map[string]interface{}{},
		},
		{
			name: "valid JSON object",
			raw:  []byte(`{"name":"Ada","age":30}`),
			want: map[string]interface{}{"name": "Ada", "age": float64(30)},
		},
		{
			name:    "malformed JSON returns an empty map and an error",
			raw:     []byte(`{not valid json`),
			want:    map[string]interface{}{},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseFormData(tt.raw)
			if (err != nil) != tt.wantErr {
				t.Fatalf("parseFormData() error = %v, wantErr %v", err, tt.wantErr)
			}
			if len(got) != len(tt.want) {
				t.Fatalf("parseFormData() = %+v, want %+v", got, tt.want)
			}
			for k, v := range tt.want {
				if got[k] != v {
					t.Errorf("parseFormData()[%q] = %v, want %v", k, got[k], v)
				}
			}
		})
	}
}

// sanity check that time.Time zero values don't cause a panic anywhere in the
// grouping path when a recommendation has no SubmittedAt/ExpiresAt set.
func TestGroupRecommendationsBySubmission_ZeroTimestamps(t *testing.T) {
	sub := uuid.New()
	recs := []models.RecommendationRequest{
		{ID: uuid.New(), SubmissionID: sub, RequestedAt: time.Time{}},
	}
	grouped := groupRecommendationsBySubmission(recs)
	if len(grouped[sub]) != 1 {
		t.Fatalf("expected 1 recommendation, got %d", len(grouped[sub]))
	}
}
