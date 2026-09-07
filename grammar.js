/**
 * @file Tree-sitter grammar for ABAP CDS
 * @author Kendrick Hommel <kendrick.hommel@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

import { dataDefinitionRules } from "./grammar/ddl.js";
import { functionDefinitionRules } from "./grammar/fdl.js";
import { serviceDefinitionRules } from "./grammar/sdl.js";
import { typeDefinitionRules } from "./grammar/tdl.js";

const STRING_LITERAL = /'([^'\\\r\n]|''|\\['\\])*'/;
const IDENTIFIER = /([a-z_][a-z0-9_]*)|(\/[a-z0-9_]+\/[a-z_][a-z0-9_]*)/i;

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
          $.service_definition,
          $.service_extension,
          $.table_entity_definition,
        ),
      ),

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
     * NOTE:Table and view are slightly different, but not worth making separate rules for.
     *
     * Table entity:
     * ... ASSOCIATION [cardinality] TO target ON cds_cond
     *                 [ WITH DEFAULT FILTER cds_cond ] ...
     *
     * View entity:
     * ... ASSOCIATION [cardinality] [TO] target [AS _assoc] ON cds_cond
     *                 [ WITH DEFAULT FILTER cds_cond ] ...
     *
     * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_TABLE_ENTITY_ASSOC.html
     * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_SIMPLE_ASSOCIATION_V2.html
     */
    association: ($) =>
      seq(
        kw("association"),
        optional(field("cardinality", $.cardinality)),
        field("target", $.association_target),
        field("condition", $.association_condition),
        optional($.default_filter),
      ),

    // This now covers both association variants
    association_target: ($) =>
      seq(
        optional(kw("to")),
        field("name", $.identifier),
        optional(field("alias", $.alias)),
      ),

    cardinality: ($) =>
      choice(
        field("target", $.numeric_cardinality),
        seq(
          optional(kw("of")),
          field("source", $.quantity),
          kw("to"),
          field("target", $.quantity),
        ),
      ),

    quantity: (_) => choice(...kws("one", "many"), seq(...kws("exact", "one"))),

    numeric_quantity: ($) => choice($.integer_literal, "*"),

    numeric_cardinality: ($) =>
      seq(
        "[",
        optional(seq(field("min", $.numeric_quantity), "..")),
        field("max", $.numeric_quantity),
        "]",
      ),

    association_condition: ($) =>
      seq(kw("on"), field("condition", $._logical_expression)),

    default_filter: ($) =>
      seq(
        ...kws("with", "default", "filter"),
        field("condition", $._logical_expression),
      ),

    // Wrapper such that a single relational expression is not needlessly
    // contained in another logical expression in the CST.
    _logical_expression: ($) =>
      choice($.relational_expression, $.logical_expression),

    /*
     * rel_expr | NOT cond | cond AND cond | cond OR cond | ( cond )
     *
     * Operand restrictions depend on where the condition is used.
     *
     * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_CONDITIONAL_EXPRESSION_V2.html
     */
    logical_expression: ($) =>
      choice(
        seq("(", $._logical_expression, ")"),
        prec.right(3, seq(kw("not"), $._logical_expression)),
        prec.left(
          2,
          seq($._logical_expression, kw("and"), $._logical_expression),
        ),
        prec.left(
          1,
          seq($._logical_expression, kw("or"), $._logical_expression),
        ),
      ),

    // temporary, should probably refine the individual paths
    relational_expression: ($) =>
      seq(
        field("left", $._conditional_operand),
        choice(
          seq(
            field("operator", choice("=", "<>", "<", ">", "<=", ">=")),
            field("right", $._conditional_operand),
          ),
          seq(
            optional(kw("not")),
            kw("between"),
            field("lower", $._conditional_operand),
            kw("and"),
            field("upper", $._conditional_operand),
          ),
          seq(
            optional(kw("not")),
            kw("like"),
            field("pattern", choice($.string_literal, $.typed_literal)),
            optional(
              seq(
                kw("escape"),
                field("escape", choice($.string_literal, $.typed_literal)),
              ),
            ),
          ),
          seq(kw("is"), optional(kw("not")), choice(kw("null"), kw("initial"))),
        ),
      ),

    _conditional_operand: ($) =>
      choice(
        $.literal,
        $.enum_literal,
        $.identifier,
        $.condition_path,
        $.condition_parameter,
      ),

    condition_path: ($) =>
      seq(
        field(
          "root",
          choice($.identifier, $.projection_reference, $.session_reference),
        ),
        repeat1(
          seq(token.immediate("."), field("member", $._immediate_identifier)),
        ),
      ),

    projection_reference: (_) => /\$projection/i,

    session_reference: (_) => /\$session/i,

    condition_parameter: ($) => seq(":", field("name", $.identifier)),

    ...typeDefinitionRules,
    ...functionDefinitionRules,
    ...serviceDefinitionRules,
    ...dataDefinitionRules,

    /*
     * - A name must start with a letter, slash character, or underscore.
     * - CDS keywords CANNOT be used as names
     * - The separator for names with multiple parts is a period (.).
     * - A name must have between 2 and 30 characters, but that is not of concern.
     *
     * Slashes need special namespace handling to make sure they dont clash with the
     * division operator.
     *
     * NOTE: This rule must be at the bottom because thats how tree-sitter solves
     * lexical conflicts between tokens of the same lengths (rule position). So
     * that means prefer a keyword over an identifier.
     *
     * @see https://help.sap.com/doc/abapdocu_latest_index_htm/latest/en-US/ABENCDS_GENERAL_SYNTAX_RULES.html
     */
    identifier: (_) => IDENTIFIER,

    _immediate_identifier: ($) =>
      alias(token.immediate(IDENTIFIER), $.identifier),
  },
});

/**
 * @param {RuleOrLiteral} rule
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

/**
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
