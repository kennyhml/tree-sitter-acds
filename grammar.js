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

const STRING_LITERAL = /'([^'\\\r\n]|''|\\['\\])*'/;
const ANNOTATION_IDENTIFIER = /[a-z][a-z0-9_]*/i;

export default grammar({
  name: "acds",

  word: ($) => $.identifier,

  extras: ($) => [/\s/, $.line_comment, $.block_comment],

  supertypes: ($) => [$.literal, $.untyped_literal, $.annotation_value],

  reserved: {
    global: (_) => RESERVED_KEYWORDS,
  },

  rules: {
    source_file: ($) =>
      repeat(
        choice(
          $.enum_type_definition,
          $.simple_type_definition,
          ...RESERVED_KEYWORDS,
        ),
      ),

    // Two forward slashes (//) introduce a comment, which continues until the end of the line.
    line_comment: (_) => token(seq("//", /[^\r\n]*/)),

    // Comments within lines or that span multiple lines are enclosed by the characters /* and */.
    block_comment: (_) => token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),

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

    literal: ($) => choice($.untyped_literal, $.typed_literal),

    untyped_literal: ($) =>
      choice(
        $.integer_literal,
        $.decimal_literal,
        $.scientific_literal,
        $.string_literal,
      ),

    /*
     * A typed literal prefixes a single-quoted value with an ABAP Dictionary
     * data type from the `abap` type namespace.
     *
     * Example: abap.dats'20200101'
     */
    typed_literal: ($) =>
      seq(
        field("type", $.builtin_type_name),
        field(
          "value",
          alias(token.immediate(STRING_LITERAL), $.string_literal),
        ),
      ),

    /*
     * An untyped numeric literal can be prefixed directly by a sign. A decimal
     * point, when present, must follow at least one digit.
     */
    integer_literal: (_) => /[+-]?[0-9]+/,

    decimal_literal: (_) => /[+-]?[0-9]+\.[0-9]+/,

    scientific_literal: (_) => /[+-]?[0-9]+(\.[0-9]+)?[eE][+-]?[0-9]+/,

    /*
     * A single quote is escaped as `''` or `\'` and a backslash as `\\`.
     */
    string_literal: (_) => token(STRING_LITERAL),

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
     * @[<]Anno[:value]
     *        |[: { subannos } ]
     *        |[: [ arrelem ] ]
     *        |[.subAnno[ ... ]]
     *
     * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_ANNOTATIONS_SYNTAX.html
     */
    annotation: ($) =>
      seq(
        // @< places an annotation after a list element instead of before it.
        choice("@<", "@"),
        field(
          "name",
          choice(alias($._annotation_identifier, $.identifier), $.sub_annotation),
        ),
        optional(seq(":", field("value", $.annotation_value))),
      ),

    sub_annotation: ($) =>
      prec.left(
        seq(
          field(
            "parent",
            choice(
              alias($._annotation_identifier, $.identifier),
              $.sub_annotation,
            ),
          ),
          token.immediate("."),
          field(
            "name",
            alias($._immediate_annotation_identifier, $.identifier),
          ),
        ),
      ),

    _annotation_identifier: (_) => token(ANNOTATION_IDENTIFIER),

    _immediate_annotation_identifier: (_) =>
      token.immediate(ANNOTATION_IDENTIFIER),

    /*
     * ... literal
     * | #SYMBOL
     * | true|false
     * | #(unchecked expression)
     * | null
     *
     * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_ANNOTATIONS_SYNTAX_VALUE.html
     */
    annotation_value: ($) =>
      choice(
        // TODO: unchecked expressions
        $.untyped_literal,
        $.enum_literal,
        $.boolean_literal,
        $.null_literal,
        $.annotation_array,
        $.annotation_structure,
      ),

    /*
     * [ ...  value1 |{subannos1},
     *        value2 |{subannos2},
     *        ...
     * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_ANNOTATIONS_SYNTAX_ARRAY.html
     */
    annotation_array: ($) =>
      seq("[", optional(commaSep1($.annotation_value)), "]"),

    annotation_structure: ($) =>
      seq("{", optional(commaSep1($.annotation_property)), "}"),

    annotation_property: ($) =>
      seq(
        field(
          "name",
          choice(alias($._annotation_identifier, $.identifier), $.sub_annotation),
        ),
        optional(seq(":", field("value", $.annotation_value))),
      ),

    // Enumeration symbols #SYMBOL
    enum_literal: ($) => seq("#", field("value", $.enum_symbol)),

    enum_symbol: (_) => token.immediate(/[a-z][a-z0-9_]*/i),

    // Boolean values are case-insensitive and can also be quoted as strings.
    boolean_literal: (_) => choice(/true/i, /false/i),

    // null can only be assigned to annotations that allow it.
    null_literal: (_) => /null/i,

    /*
     * [@type_annot1]
     * [@type_annot2]
     * ...
     * DEFINE TYPE simple_type : dtype | data_element | simple_type
     *
     * We cannot tell data elements and simple types apart syntactically.
     *
     * Semicolons are optional for simple statements like this.
     *
     * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_DEFINE_SIMPLE_TYPE.html
     */
    simple_type_definition: ($) =>
      seq(
        repeat($.annotation),
        /define/i,
        /type/i,
        field("name", $.identifier),
        ":",
        field("type", choice($.builtin_type, $.identifier)),
        optional(";"),
      ),

    /*
     * [@type_annot1]
     * [@type_annot2]
     * ...
     * DEFINE TYPE EnumType : BaseType ENUM
     * {
     *   [@enum_annot1]
     *   EnumConstant1 = EnumValue1 | INITIAL;
     *   [@enum_annot2]
     *   EnumConstant2 = EnumValue2 | INITIAL;
     *   [...]
     * }
     * | DEFINE TYPE EnumTypeStack : EnumTypeBase[;]
     *
     * Syntactically, there is no way to tell an enum stack definition
     * apart from a simple type when the ENUM keyword is omitted.
     *
     * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_DEFINE_ENUM_TYPE.html
     */
    enum_type_definition: ($) =>
      seq(
        repeat($.annotation),
        /define/i,
        /type/i,
        field("name", $.identifier),
        ":",
        field("base_type", choice($.builtin_type, $.identifier)),
        /enum/i,
        field("body", $.enum_body),
      ),

    enum_body: ($) => seq("{", repeat1($.enum_constant_definition), "}"),

    // EnumConstant1 = EnumValue1 | INITIAL;
    enum_constant_definition: ($) =>
      seq(
        repeat($.annotation),
        field("name", $.identifier),
        "=",
        field("value", choice($.literal, $.initial)),
        ";",
      ),

    initial: (_) => /initial/i,
  },
});

function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}
