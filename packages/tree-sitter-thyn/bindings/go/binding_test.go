package tree_sitter_thyn_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_thyn "github.com/tree-sitter/tree-sitter-thyn/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_thyn.Language())
	if language == nil {
		t.Errorf("Error loading Thyn grammar")
	}
}
