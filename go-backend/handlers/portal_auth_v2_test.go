package handlers

import "testing"

func TestToJSONArray(t *testing.T) {
	tests := []struct {
		name string
		in   []string
		want string
	}{
		{name: "nil slice marshals to null", in: nil, want: "null"},
		{name: "empty slice marshals to []", in: []string{}, want: "[]"},
		{name: "single element", in: []string{"a"}, want: `["a"]`},
		{name: "multiple elements preserve order", in: []string{"a", "b", "c"}, want: `["a","b","c"]`},
		{name: "escapes special characters", in: []string{`quote"here`}, want: `["quote\"here"]`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := toJSONArray(tt.in); got != tt.want {
				t.Errorf("toJSONArray(%v) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}
