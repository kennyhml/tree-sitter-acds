# tree-sitter-abap-cds
Tree-sitter grammar for ABAP CDS

## Development

Regenerate the parser after editing `grammar.js`, then run the corpus and
highlighting tests:

```sh
tree-sitter generate
tree-sitter test
```

Syntax highlighting is defined in `queries/highlights.scm`. Highlight assertions
live in `test/highlight/*.acds` and run as part of `tree-sitter test`.
