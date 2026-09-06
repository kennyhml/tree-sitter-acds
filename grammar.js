/**
 * @file Tree-sitter grammar for ABAP CDS
 * @author Kendrick Hommel <kendrick.hommel@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const STRING_LITERAL = /'([^'\\\r\n]|''|\\['\\])*'/;
const ANNOTATION_IDENTIFIER = /[a-z][a-z0-9_]*/i;
const IDENTIFIER = token(
  choice(
    prec(2, /[a-z_][a-z0-9_]{4,}/i), // prevent abap from splitting longer names
    /[a-z_][a-z0-9_]*/i, // base case
    /\/[a-z0-9_]+\/[a-z_][a-z0-9_]*/i, // namespaced
  ),
);

export default grammar({
  name: "acds",

  word: ($) => $.identifier,

  extras: ($) => [/\s/, $.line_comment, $.block_comment],

  supertypes: ($) => [$.literal, $.untyped_literal, $.annotation_value],

  /*
   * CDS does reserve a handful of keywords, but unfortunately not all of them.
   *
   * So the annoying lexing conflicts still need extra handling - just like in
   * the core ABAP grammar..
   */
  reserved: {
    global: (_) => [/and/i],
  },

  rules: {
    source_file: ($) =>
      repeat(
        choice(
          $.enum_type_definition,
          $.simple_type_definition,
          $.scalar_function_definition,
        ),
      ),

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
    identifier: (_) => IDENTIFIER,

    _immediate_identifier: ($) =>
      alias(token.immediate(IDENTIFIER), $.identifier),

    /*
     * This rule has no deeper meaning than solving a lexing issue when
     * the typename itself is `abap`, at which point the lexer wants to
     * choose the builtin type path.
     *
     * It is not designed to be used in highlighting queries.
     */
    _type_identifier: ($) =>
      choice($.identifier, alias(token(prec(1, /abap/i)), $.identifier)),

    // Enumeration symbols #SYMBOL
    enum_literal: ($) => seq("#", field("value", $.enum_symbol)),

    enum_symbol: (_) => token.immediate(/[a-z][a-z0-9_]*/i),

    // Two forward slashes (//) introduce a comment, which continues until the end of the line.
    line_comment: (_) => token(seq("//", /[^\r\n]*/)),

    // Comments within lines or that span multiple lines are enclosed by the characters /* and */.
    block_comment: (_) => token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),

    literal: ($) => choice($.untyped_literal, $.typed_literal),

    /*
     * An untyped numeric literal can be prefixed directly by a sign. A decimal
     * point, when present, must follow at least one digit.
     */
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
        field("type", alias($._builtin_type_path, $.builtin_type)),
        field(
          "value",
          alias(token.immediate(STRING_LITERAL), $.string_literal),
        ),
      ),

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
        $._builtin_type_path,
        optional(field("parameters", $.type_parameters)),
      ),

    /*
     * The `abap.type` path expression. `abap` and `type` are treated as
     * separate tokens, such that the dot does not become part of it.
     */
    _builtin_type_path: ($) =>
      seq(
        alias(token(prec(1, /abap/i)), "abap"), // keep this anonymous
        token.immediate("."),
        field("name", $._immediate_identifier),
      ),

    type_parameters: ($) =>
      seq(
        "(",
        field("length", $.integer_literal),
        optional(seq(",", field("decimals", $.integer_literal))),
        ")",
      ),

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
        field("name", choice($.identifier, $.sub_annotation)),
        optional(seq(":", field("value", $.annotation_value))),
      ),

    sub_annotation: ($) =>
      prec.left(
        seq(
          field("parent", choice($.identifier, $.sub_annotation)),
          token.immediate("."),
          field("name", $._immediate_identifier),
        ),
      ),

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
     *
     * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_ANNOTATIONS_SYNTAX_ARRAY.html
     */
    annotation_array: ($) =>
      seq("[", optional(commaSep1($.annotation_value)), "]"),

    annotation_structure: ($) =>
      seq("{", optional(commaSep1($.annotation_property)), "}"),

    annotation_property: ($) =>
      seq(
        field("name", choice($.identifier, $.sub_annotation)),
        optional(seq(":", field("value", $.annotation_value))),
      ),

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
        ...kws("define", "type"),
        field("name", $.identifier),
        ":",
        field("type", choice($.builtin_type, $._type_identifier)),
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
        ...kws("define", "type"),
        field("name", $.identifier),
        ":",
        field("base_type", choice($.builtin_type, $._type_identifier)),
        kw("enum"),
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

    /*
     * DEFINE SCALAR FUNCTION ScalarFunction
     *   [WITH PARAMETERS pname1 : typing
     *                    [, pname2 : typing]
     *                    [, ...]]
     *   RETURNS typing[;]
     *
     * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_DEFINE_SCALAR_FUNCTION.html
     */
    scalar_function_definition: ($) =>
      seq(
        ...kws("define", "scalar", "function"),
        field("name", $.identifier),
        optional(field("parameters", $.function_parameters)),
        field("returns", $.function_return_type),
        optional(";"),
      ),

    function_return_type: ($) =>
      seq(kw("returns"), field("type", $.scalar_typing)),

    /*
     * ... [WITH PARAMETERS pname1 : typing
     *                    [, pname2 : typing]
     *                    [, ...]] ...
     *
     * Needs a dedicated rule because it has no annotation and different typing for
     * the parameters that is not worth being permissive over - just adds ambiguity.
     */
    function_parameters: ($) =>
      seq(...kws("with", "parameters"), commaSep1($.function_parameter)),

    /*
     * ... [@parameter_annot1]
     *     [@parameter_annot2]
     *     ...
     *     pname : typing
     *     [@<parameter_annot1]
     *     [@<parameter_annot2]
     *     ...
     *
     * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_F1_PARAM.html
     */
    view_parameter: ($) =>
      seq(
        field("name", $.identifier),
        ":",
        choice($._type_identifier, $.builtin_type),
      ),

    function_parameter: ($) =>
      seq(field("name", $.identifier), ":", field("type", $.scalar_typing)),

    /*
     * dtype                      [WITH REFERENCE TYPE]
     * | simple_type              [WITH REFERENCE TYPE]
     * | data_element             [WITH REFERENCE TYPE]
     * | generic_type             [WITH REFERENCE TYPE]
     * | TYPE OF ParameterReference [WITH REFERENCE TYPE]
     *
     * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_SCALAR_TYPING.html
     */
    scalar_typing: ($) =>
      seq(
        field(
          "type",
          choice(
            $._type_identifier,
            alias(token(prec(1, /type/i)), $.identifier), // conflict with TYPE OF ...
            $.builtin_type,
            $.type_of,
          ),
        ),
        optional(field("reference_type", $.parameter_reference_type)),
      ),

    type_of: ($) =>
      seq(
        alias(token(prec(1, /type/i)), "type"),
        kw("of"),
        field("parameter", $.identifier),
      ),

    /*
     * 1. Static Reference Type Specification
     * WITH REFERENCE TYPE #CUKY | #UNIT | #CALC | #NONE
     * | WITH REFERENCE TYPE [#CUKY, #UNIT, REFERENCE TYPE OF pname, ...]
     * | WITH REFERENCE TYPE OF pname
     *
     * 2. Dynamic Reference Type Specification
     *
     * WITH REFERENCE TYPE
     * CASE
     * WHEN pname1: reference [AND pname2: reference][AND...]
     *  THEN reference
     * [WHEN ... [AND ... ] THEN ...]
     *  [ELSE reference]
     * END
     *
     * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_WITH_REFERENCE_TYPE.html
     */
    parameter_reference_type: ($) =>
      choice(
        seq(
          ...kws("with", "reference", "type"),
          field(
            "type",
            choice($.enum_literal, $.reference_types, $.reference_type_case),
          ),
        ),
        seq(kw("with"), field("type", $.reference_type_of)),
      ),

    // ... REFERENCE TYPE OF pname ...
    reference_type_of: ($) =>
      seq(...kws("reference", "type", "of"), field("parameter", $.identifier)),

    // ... [ #CUKY, #UNIT, #CALC, ... ] ...
    reference_types: ($) =>
      seq("[", commaSep1(choice($.enum_literal, $.reference_type_of)), "]"),

    /*
     * WITH REFERENCE TYPE
     * CASE
     * WHEN pname1: reference [AND pname2: reference][AND...]
     *  THEN reference
     * [WHEN ... [AND ... ] THEN ...]
     *  [ELSE reference]
     * END
     *
     * Requiring ELSE for return parameters is left to contextual validation.
     */
    reference_type_case: ($) =>
      seq(
        kw("case"),
        repeat1($.reference_type_when_clause),
        optional(
          seq(
            kw("else"),
            field("else", choice($.enum_literal, $.reference_type_of)),
          ),
        ),
        kw("end"),
      ),

    /*
     * WHEN pname1: reference [AND pname2: reference][AND...]
     *    THEN reference
     */
    reference_type_when_clause: ($) =>
      seq(
        kw("when"),
        field("condition", $.reference_type_condition),
        kw("then"),
        field("consequence", choice($.enum_literal, $.reference_type_of)),
      ),

    // ... when pname1: { reference / reference type of pname } [and ...] ...
    reference_type_condition: ($) =>
      seq(
        $.reference_type_constraint,
        repeat(seq(kw("and"), $.reference_type_constraint)),
      ),

    // ...pname1: { reference / reference type of pname } ...
    reference_type_constraint: ($) =>
      seq(
        field("parameter", $.identifier),
        ":",
        field("type", choice($.enum_literal, $.reference_type_of)),
      ),
  },
});

/**
 * Expose case-insensitive keywords as queryable anonymous tokens.
 *
 * The keyword is tagged with a field to blanket highlight them.
 *
 * @param {string} word
 */
function kw(word) {
  return field("keyword", alias(new RegExp(word, "i"), word));
}

/**
 * @param {string[]} words
 */
function kws(...words) {
  return words.map(kw);
}

/**
 * @param {RuleOrLiteral} rule
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}
