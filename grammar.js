/**
 * @file Tree-sitter grammar for ABAP CDS
 * @author Kendrick Hommel <kendrick.hommel@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const RESERVED_KEYWORDS = [
  /all/i,
  /and/i,
  /as/i,
  /association/i,
  /avg/i,
  /case/i,
  /cast/i,
  /count/i,
  /cross/i,
  /distinct/i,
  /exists/i,
  /extend/i,
  /from/i,
  /full/i,
  /group/i,
  /having/i,
  /inner/i,
  /join/i,
  /key/i,
  /left/i,
  /max/i,
  /min/i,
  /not/i,
  /null/i,
  /on/i,
  /or/i,
  /order/i,
  /right/i,
  /select/i,
  /sum/i,
  /union/i,
  /view/i,
  /when/i,
  /where/i,
];

export default grammar({
  name: "acds",

  word: ($) => $.identifier,

  reserved: {
    global: (_) => RESERVED_KEYWORDS,
  },

  rules: {
    source_file: ($) =>
      repeat(choice($.simple_type_definition, ...RESERVED_KEYWORDS)),

    /*
     * - A name must start with a letter, slash character, or underscore.
     * - CDS keywords CANNOT be used as names
     * - The separator for names with multiple parts is a period (.).
     * - A name must have between 2 and 30 characters, but that is not of concern.
     *
     * Slashes need special namespace handling to make sure they dont clash with the
     * division operator.
     *
     * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_GENERAL_SYNTAX_RULES.html
     */
    identifier: (_) =>
      token(
        choice(
          /[a-z_][a-z0-9_]*/i, // base case
          /\/[a-z0-9_]+\/[a-z_][a-z0-9_]*/i, // namespaced
        ),
      ),

    /*
     * Builtin ABAP data types, prefixed with `abap`.
     *
     * Examples:
     * - abap.string
     * - abap.char( len )
     * - abap.curr( len, dec )
     *
     * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_OVERVIEW_BUILTIN_TYPES.html
     */
    builtin_type: ($) =>
      seq(
        field("name", $.builtin_type_name),
        optional(field("parameters", $.type_parameters)),
      ),

    builtin_type_name: (_) => token(/abap\.[a-z_][a-z0-9_]*/i),

    type_parameters: ($) =>
      seq(
        "(",
        field("length", $.unsigned_integer),
        optional(seq(",", field("decimals", $.unsigned_integer))),
        ")",
      ),

    unsigned_integer: (_) => /[0-9]+/,

    /*
     * [@type_annot1]
     * [@type_annot2]
     * ...
     * DEFINE TYPE simple_type : dtype | data_element | simple_type
     *
     * We cannot tell data elements and simple types apart syncactically.
     *
     * Semicolons are optional for simple statements like this.
     *
     * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_DEFINE_SIMPLE_TYPE.html
     */
    simple_type_definition: ($) =>
      seq(
        /define/i,
        /type/i,
        field("name", $.identifier),
        ":",
        field("type", choice($.builtin_type, $.identifier)),
        optional(";"),
      ),
  },
});
