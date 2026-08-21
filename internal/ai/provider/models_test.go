package provider

import (
	"reflect"
	"testing"
)

func TestNormalizeReasoningEffortMax(t *testing.T) {
	if got := normalizeReasoningEffort("max"); got != "max" {
		t.Fatalf("got %q", got)
	}
	expected := []string{"max", "xhigh"}
	if got := normalizeAIProviderModelReasoningEffortOptions([]string{"max", "xhigh", "max"}); !reflect.DeepEqual(got, expected) {
		t.Fatalf("got %#v", got)
	}
}
