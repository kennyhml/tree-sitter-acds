package tree_sitter_acds_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_acds "github.com/kennyhml/tree-sitter-acds/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_acds.Language())
	if language == nil {
		t.Errorf("Error loading ABAP CDS grammar")
	}
}
