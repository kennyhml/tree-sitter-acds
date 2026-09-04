/**
 * @file Tree-sitter grammar for ABAP CDS
 * @author Kendrick Hommel <kendrick.hommel@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "acds",

  rules: {
    // TODO: add the actual grammar rules
    source_file: $ => "hello"
  }
});
